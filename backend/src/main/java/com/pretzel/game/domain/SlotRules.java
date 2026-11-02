package com.pretzel.game.domain;

import java.util.List;

public final class SlotRules {
    private SlotRules() {}
    public enum Result { CONTINUE, ELIMINATE, FAIL }
    public static Result evaluate(List<CardAttributes> cards, int targetEyes, int targetLegs) {
        if (cards.size() > 7 || targetEyes <= 0 || targetLegs < 0) throw new IllegalArgumentException("Invalid slot or target");
        int eyes = cards.stream().mapToInt(CardAttributes::eyes).sum();
        int legs = cards.stream().mapToInt(CardAttributes::legs).sum();
        if (!cards.isEmpty() && eyes == targetEyes && legs == targetLegs) return Result.ELIMINATE;
        return cards.size() == 7 ? Result.FAIL : Result.CONTINUE;
    }
}
