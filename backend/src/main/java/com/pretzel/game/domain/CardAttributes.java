package com.pretzel.game.domain;

public record CardAttributes(int eyes, int legs) {
    public CardAttributes {
        if (eyes < 1 || eyes > 4 || !(legs == 0 || legs == 1 || legs == 2 || legs == 3 || legs == 4 || legs == 6 || legs == 8)) {
            throw new IllegalArgumentException("Unsupported card attributes");
        }
    }
}
