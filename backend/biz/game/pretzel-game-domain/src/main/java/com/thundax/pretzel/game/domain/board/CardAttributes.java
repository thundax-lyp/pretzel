package com.thundax.pretzel.game.domain.board;

public record CardAttributes(int eyes, int legs) {
    public CardAttributes {
        if (eyes < 1
                || eyes > 6
                || !(legs == 0 || legs == 1 || legs == 2 || legs == 3 || legs == 4 || legs == 5 || legs == 6
                        || legs == 8)) {
            throw new IllegalArgumentException("Unsupported card attributes");
        }
    }
}
