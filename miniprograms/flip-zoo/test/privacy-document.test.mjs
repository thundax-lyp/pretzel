import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parsePrivacyDocument } from "../assets/scripts/settings/privacy-document.ts";

const source = JSON.parse(
    readFileSync(
        new URL(
            "../assets/resources/privacy/child-privacy-policy.json",
            import.meta.url,
        ),
        "utf8",
    ),
);

test("structured policy preserves all nonempty lines of the supplied document", () => {
    const document = parsePrivacyDocument(source);
    const text = [
        document.title,
        ...document.dates.map((date) => `${date.label}：${date.value}`),
        ...document.blocks.map((block) => block.text),
    ].join("\n");
    // SHA-256 of the approved policy text with the corrected publication date.
    assert.equal(
        createHash("sha256").update(text).digest("hex"),
        "f7cde0f48fc53316fd395a94a889aac295df381e38b7ee091ffec9a832be26c8",
    );
    assert.equal(
        document.blocks.filter(
            (block) =>
                block.type === "heading" &&
                /^[一二三四五六七]、/.test(block.text),
        ).length,
        7,
    );
    const contents = document.blocks.findIndex(
        (block) => block.text === "本声明包含内容",
    );
    assert.ok(
        document.blocks
            .slice(contents + 1, contents + 8)
            .every((block) => block.type === "list-item"),
    );
});

test("malformed policy blocks fail validation instead of rendering partial legal text", () => {
    for (const block of [
        { type: "html", text: "<h1>title</h1>" },
        { type: "heading", level: 4, text: "title" },
        { type: "paragraph", text: "" },
    ])
        assert.throws(() =>
            parsePrivacyDocument({ ...source, blocks: [block] }),
        );
    assert.throws(() => parsePrivacyDocument({ ...source, dates: null }));
    assert.throws(() => parsePrivacyDocument({ ...source, blocks: [] }));
});
