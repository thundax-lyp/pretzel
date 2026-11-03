"""Behavioral checks for the offline level designer."""

import copy
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

SOURCE = Path(__file__).with_name("game-design.py")
SPEC = importlib.util.spec_from_file_location("game_design", SOURCE)
design = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = design
SPEC.loader.exec_module(design)


class GameDesignTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.level = design.generate(2026110307, "three-peaks")

    def game(self):
        return design.Game(self.level)

    def top(self, game):
        return design.open_cards(game.board, 0, design.blockers(game.level, game.locations))

    def fixture(self, target, kind=8):
        return design.Game(
            replace(self.level, cards=(kind,) * 48, targets=(target,) + self.level.targets[1:])
        )

    def test_seed_reproducibility(self):
        self.assertEqual(self.level, design.generate(self.level.seed, self.level.profile))

    def test_every_layout_has_replayable_reference_and_six_to_eight_open_cards(self):
        for profile in design.PROFILES:
            level = design.generate(341, profile)
            design.check_level(level)
            game = design.Game(level)
            self.assertIn(len(self.top(game)), (6, 8))

    def test_content_limits_and_question_count(self):
        level = self.level
        counts = design.Counter(level.cards)
        self.assertEqual(len(level.targets), 12)
        self.assertEqual(len(level.cards), 48)
        self.assertEqual(len(counts), 12)
        self.assertLessEqual(max(counts.values()), 6)
        self.assertIn(sum(k >= 20 for k in level.cards), range(2, 5))
        self.assertIn(sum(design.ANIMALS[k][2] % 2 for k in level.cards), range(4, 9))

    def test_blocked_card_rejected_without_mutation(self):
        g = self.game()
        i = next(i for i in range(48) if i not in self.top(g))
        before = copy.deepcopy(g.__dict__)
        with self.assertRaises(ValueError):
            g.take(i)
        self.assertEqual(g.__dict__, before)

    def test_duplicate_take_rejected(self):
        g = self.fixture((100, 100))
        i = self.top(g)[0]
        g.take(i)
        with self.assertRaises(ValueError):
            g.take(i)

    def test_seventh_matching_card_clears(self):
        g = self.fixture((7, 0))
        for _ in range(7):
            g.take(self.top(g)[0])
        self.assertEqual(g.q, 1)
        self.assertEqual(g.status, "playing")
        self.assertFalse(g.slot)

    def test_full_failure_cannot_grant_or_use_tool(self):
        g = self.fixture((100, 100))
        g.grant("remove")
        for _ in range(7):
            g.take(self.top(g)[0])
        self.assertEqual(g.status, "failed")
        before = copy.deepcopy(g.__dict__)
        with self.assertRaises(ValueError):
            g.remove(g.slot[:3])
        with self.assertRaises(ValueError):
            g.grant("rewind")
        self.assertEqual(g.__dict__, before)

    def test_whole_slot_not_subset(self):
        g = self.fixture((2, 2), kind=4)
        a, b = self.top(g)[:2]
        cards = list(g.level.cards)
        cards[b] = 2
        g.level = replace(g.level, cards=tuple(cards))
        g.take(a)
        g.take(b)
        self.assertEqual(g.q, 0)
        self.assertEqual(len(g.slot), 2)

    def test_removal_can_clear_remaining_slot(self):
        g = self.fixture((2, 2), kind=4)
        a, b = self.top(g)[:2]
        cards = list(g.level.cards)
        cards[b] = 2
        g.level = replace(g.level, cards=tuple(cards))
        g.take(a)
        g.take(b)
        g.grant("remove")
        g.remove([a])
        self.assertEqual(g.q, 1)
        self.assertEqual(g.temp, [a])

    def test_invalid_removal_keeps_inventory(self):
        g = self.game()
        g.grant("remove")
        for selected in ([], [999], [0, 0]):
            with self.assertRaises(ValueError):
                g.remove(selected)
        self.assertEqual(g.inventory["remove"], 1)
        self.assertEqual(g.ads, 1)

    def test_storage_above_twelve_and_return_preserves_identity(self):
        g = self.fixture((100, 100))
        for _ in range(5):
            chosen = []
            for _ in range(3):
                i = self.top(g)[0]
                chosen.append(i)
                g.take(i)
            g.grant("remove")
            g.remove(chosen)
        self.assertEqual(len(g.temp), 15)
        i = g.temp[0]
        g.take(i)
        self.assertNotIn(i, g.temp)
        self.assertEqual(g.slot, [i])
        self.assertEqual(g.board.bit_count() + len(g.temp) + len(g.slot), 48)

    def test_video_limit_shared_across_types(self):
        g = self.game()
        for n in range(10):
            g.grant(design.TOOLS[n % 3])
        with self.assertRaises(ValueError):
            g.grant("remove")
        self.assertEqual(g.ads, 10)

    def test_reserve_not_video_and_cannot_repeat(self):
        g = design.Game(self.level, reserve=1)
        g.grant("shuffle", "reserve")
        self.assertEqual(g.ads, 0)
        with self.assertRaises(ValueError):
            g.grant("shuffle", "reserve")

    def test_rewind_restores_cards_without_refunding_video_or_reserve(self):
        g = design.Game(self.level, reserve=1)
        before = g.snapshot()
        for i in self.level.reference[0]:
            g.take(i)
        g.grant("rewind", "reserve")
        g.rewind(1)
        self.assertEqual(g.snapshot(), before)
        self.assertEqual(g.reserves["rewind"], 0)
        self.assertEqual(g.inventory["rewind"], 0)
        for i in self.level.reference[0]:
            g.take(i)
        g.grant("rewind")
        g.rewind(1)
        self.assertEqual(g.ads, 1)
        self.assertEqual(g.snapshot(), before)

    def test_invalid_rewind_keeps_inventory(self):
        g = self.game()
        g.grant("rewind")
        with self.assertRaises(ValueError):
            g.rewind(1)
        self.assertEqual(g.inventory["rewind"], 1)

    def test_invalid_shuffle_keeps_inventory(self):
        g = self.game()
        g.grant("shuffle")
        with self.assertRaises(ValueError):
            g.shuffle([0] * 48)
        with self.assertRaises(ValueError):
            g.shuffle(g.locations)
        self.assertEqual(g.inventory["shuffle"], 1)

    def test_certified_repack_finishes_without_creating_cards(self):
        g = self.game()
        route, _ = design.allocation(g)
        positions, paths = design.repair_layout(g, route)
        g.locations = positions
        self.assertEqual(sorted(i for group in paths for i in group), list(range(48)))
        for group in paths:
            for i in group:
                g.take(i)
        self.assertEqual(g.status, "won")

    def test_allocation_budget_zero_reports_unknown(self):
        g = self.game()
        # A partial pick prevents the fast canonical suffix shortcut.
        g.take(self.level.reference[0][0])
        result, unknown = design.allocation(g, budget=0)
        self.assertIsNone(result)
        self.assertTrue(unknown)

    def test_deterministic_simulation_and_independent_replay(self):
        a = design.play(self.level, 0, "enhanced")
        self.assertEqual(a, design.play(self.level, 0, "enhanced"))
        design.replay(self.level, a)
        corrupted = copy.deepcopy(a)
        corrupted["ads"] += 1
        with self.assertRaises(ValueError):
            design.replay(self.level, corrupted)

    def test_selection_does_not_use_evaluation_repeats(self):
        level, metadata = design.select_level(12, "three-peaks", "balanced", "challenging")
        self.assertEqual(metadata["calibration_repeats"], [-3, -2, -1])
        self.assertEqual(metadata["candidates"][-1]["wins"], 0)
        design.check_level(level)
        self.assertEqual(
            level, design.select_level(12, "three-peaks", "balanced", "challenging")[0]
        )

    def test_corrective_replay_preserves_progress_and_certificate_is_checked(self):
        level = design.generate(202611040201, "three-peaks")
        run = design.play(level, 3, "enhanced")
        self.assertGreater(run["tools"].get("rewind", 0), 0)
        self.assertGreater(run["automatic_questions"], 0)
        design.replay(level, run)
        corrupted = copy.deepcopy(run)
        recovery = next(e for e in corrupted["events"] if e["type"] == "rewind")
        recovery["certificate"][0] = [999]
        with self.assertRaises(ValueError):
            design.replay(level, corrupted)

    def test_automatic_flag_outside_recovery_is_rejected(self):
        run = design.play(self.level, 0, "none")
        first = next(e for e in run["events"] if e["type"] == "take")
        first["automatic"] = True
        with self.assertRaises(ValueError):
            design.replay(self.level, run)

    def test_timing_is_an_explicit_assumption_and_does_not_change_play(self):
        a = design.play(self.level, 0, "none")
        b = design.play(self.level, 0, "none", timing=(5, 20, 16, 3))
        self.assertEqual(a["events"], b["events"])
        self.assertEqual(b["estimated_play_seconds"], a["estimated_play_seconds"] * 2)

    def test_cli_generate_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "run"
            command = [
                sys.executable,
                str(SOURCE),
                "generate",
                "--boards",
                "1",
                "--output",
                str(target),
            ]
            result = subprocess.run(command, capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            data = json.loads((target / "levels.json").read_text())
            self.assertEqual(len(data["levels"]), 1)
            result = subprocess.run(command, capture_output=True, text=True, check=False)
            self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
