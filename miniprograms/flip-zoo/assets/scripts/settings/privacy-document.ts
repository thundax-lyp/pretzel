export interface PrivacyDocument {
    title: string;
    dates: { label: string; value: string }[];
    blocks: {
        type: "heading" | "paragraph" | "list-item";
        text: string;
        level?: 1 | 2 | 3;
    }[];
}

export function parsePrivacyDocument(value: unknown): PrivacyDocument {
    const object = (item: unknown): Record<string, unknown> => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            throw new Error("Invalid privacy document object");
        }
        return item as Record<string, unknown>;
    };
    const text = (item: unknown): string => {
        if (typeof item !== "string" || !item.trim()) {
            throw new Error("Invalid privacy document text");
        }
        return item;
    };
    const source = object(value);
    if (
        !Array.isArray(source.dates) ||
        source.dates.length === 0 ||
        !Array.isArray(source.blocks) ||
        source.blocks.length === 0
    ) {
        throw new Error("Invalid privacy document sections");
    }
    return {
        title: text(source.title),
        dates: source.dates.map((item) => {
            const date = object(item);
            return { label: text(date.label), value: text(date.value) };
        }),
        blocks: source.blocks.map((item) => {
            const block = object(item);
            if (block.type === "heading") {
                if (
                    block.level !== 1 &&
                    block.level !== 2 &&
                    block.level !== 3
                ) {
                    throw new Error("Invalid privacy heading level");
                }
                return {
                    type: block.type,
                    text: text(block.text),
                    level: block.level,
                };
            }
            if (block.type !== "paragraph" && block.type !== "list-item") {
                throw new Error("Invalid privacy block type");
            }
            return { type: block.type, text: text(block.text) };
        }),
    };
}
