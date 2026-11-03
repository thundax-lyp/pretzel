"""Visibility, import and replay regression checks for the actual structure layouts."""

import copy
import importlib.util
import json
import random
import unittest
from pathlib import Path

from geometry import (
    DEFAULT_PROJECTION,
    available,
    blockers,
    engine_geometry,
    metrics,
    overlaps,
    polygons,
    position,
)
from study import engine, imported, oracle_geometry, replay
from variants import choose, rehouse

ROOT = Path(__file__).resolve().parent


class StructureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.baseline = json.loads((ROOT / "height-study/baseline-levels.json").read_text())

    def test_same_layer_touch_is_not_covering(self):
        cards = [position(0, 0, 0), position(1, 0, 0)]
        self.assertEqual(blockers(cards), [[], []])

    def test_half_cell_partial_overlap_blocks_whole_card(self):
        cards = [position(0, 0, 0), position(0.5, 0, 1)]
        self.assertEqual(blockers(cards), [[1], []])
        self.assertEqual(available({0, 1}, blockers(cards)), [1])

    def test_side_only_occlusion_is_not_missed(self):
        cards = [position(0, 0, 0), position(1, 1, 5)]
        self.assertFalse(overlaps(polygons(cards[0]), polygons(cards[1])))
        self.assertEqual(blockers(cards), [[1], []])

    def test_removing_blocker_exposes_card(self):
        cards = [position(0, 0, 0), position(0.5, 0, 1)]
        self.assertEqual(available({0}, blockers(cards)), [0])

    def test_camera_change_changes_visibility_in_both_oracles(self):
        cards = [position(0, 0, 0), position(1, 1, 5)]
        changed = {**DEFAULT_PROJECTION, "layerStep": 30}
        self.assertNotEqual(blockers(cards), blockers(cards, changed))
        self.assertEqual(
            tuple(map(tuple, blockers(cards, changed))),
            oracle_geometry(((0, 0, 0), (1, 1, 5)), (28, 16, 30, 14)),
        )

    def test_all_prototypes_have_real_height_48_cards_and_reference(self):
        source = self.baseline["packs"][0]["hard"]
        for layers in (6, 7, 8):
            _, positions = choose(layers)
            value = rehouse(source, positions, 2026110300)
            self.assertEqual(len(value["cards"]), 48)
            self.assertEqual(value["layers"], layers)
            self.assertEqual(sum(c["z"] == layers - 1 for c in value["cards"]) > 0, True)
            self.assertIn(value["initialClickable"], (6, 7, 8))
            self.assertEqual(value["targets"], source["targets"])
            self.assertEqual(value["reference"], source["reference"])
            self.assertEqual(
                [c["animal"] for c in value["cards"]], [c["animal"] for c in source["cards"]]
            )
            metric = metrics(value["cards"], value["reference"])
            self.assertEqual(sum(metric["layerCounts"]), 48)
            self.assertEqual(metric["longestDependencyChain"], layers)

    def test_clipping_oracle_matches_sat_for_random_half_grid_positions(self):
        rng = random.Random(721)
        for _ in range(12):
            positions = tuple(
                sorted(
                    set(
                        (rng.randrange(10) / 2, rng.randrange(12) / 2, rng.randrange(8))
                        for _ in range(12)
                    )
                )
            )
            self.assertEqual(engine_geometry(positions), oracle_geometry(positions))

    def test_shuffled_locations_keep_visibility_consistent(self):
        _, positions = choose(8)
        level = imported(
            rehouse(self.baseline["packs"][0]["hard"], positions, 2026110300),
            2026110300,
            "actual-eight",
        )
        locations = list(range(48))
        random.Random(23).shuffle(locations)
        covers = engine.blockers(level, locations)
        occupied = set(range(48)) - {0, 4, 9, 18}
        board = sum(1 << i for i in occupied)
        expected = [
            i
            for i in sorted(occupied)
            if not {locations[j] for j in occupied}
            & set(oracle_geometry(level.positions)[locations[i]])
        ]
        self.assertEqual(engine.open_cards(board, 0, covers), expected)

    def test_import_uses_real_positions_instead_of_main_template(self):
        source = self.baseline["packs"][1]["hard"]
        level = imported(source, 2026110301, "actual-turtle")
        self.assertEqual(level.positions, tuple((c["x"], c["y"], c["z"]) for c in source["cards"]))
        self.assertNotEqual(level.positions, engine.layout("three-peaks"))

    def test_paid_run_certificate_replayed_and_tampering_rejected(self):
        source = self.baseline["packs"][0]["hard"]
        level = imported(source, 2026110300, "actual-baseline")
        run = engine.play(level, 10, "enhanced")
        self.assertTrue(run["ads"] > 0)
        replay(level, run)
        bad = copy.deepcopy(run)
        first = next(e for e in bad["events"] if e["type"] == "take")
        first["id"] = next(
            i for i, covered in enumerate(engine_geometry(level.positions)) if covered
        )
        with self.assertRaises(ValueError):
            replay(level, bad)

    def test_all_20_first_levels_remain_unchanged(self):
        current = json.loads((ROOT / "levels.json").read_text())
        for old, new in zip(self.baseline["packs"], current["packs"]):
            self.assertEqual(old["easy"], new["easy"])

    def test_shared_validator_rejects_layer_outside_configuration(self):
        spec = importlib.util.spec_from_file_location("structure_builder", ROOT / "build-levels.py")
        build = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(build)
        value = copy.deepcopy(self.baseline["packs"][0]["hard"])
        value["maxLayers"] = 6
        value["cards"][0]["z"] = 6
        with self.assertRaises(ValueError):
            build.validate(value)


if __name__ == "__main__":
    unittest.main()
