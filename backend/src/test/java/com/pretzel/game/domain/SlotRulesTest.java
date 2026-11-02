package com.pretzel.game.domain;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Collections;
import static org.junit.jupiter.api.Assertions.assertEquals;
class SlotRulesTest {
    @Test void sumsEntireSlotRatherThanSubset() {
        assertEquals(SlotRules.Result.CONTINUE, SlotRules.evaluate(List.of(new CardAttributes(2,4), new CardAttributes(2,4), new CardAttributes(1,0)),4,8));
    }
    @Test void exceedingTargetIsNotImmediateFailure() {
        assertEquals(SlotRules.Result.CONTINUE, SlotRules.evaluate(List.of(new CardAttributes(4,8)),2,4));
    }
    @Test void seventhCardCanEliminateBeforeFailure() {
        assertEquals(SlotRules.Result.ELIMINATE, SlotRules.evaluate(Collections.nCopies(7,new CardAttributes(1,1)),7,7));
    }
    @Test void fullUnmatchedSlotFails() {
        assertEquals(SlotRules.Result.FAIL, SlotRules.evaluate(Collections.nCopies(7,new CardAttributes(1,1)),8,8));
    }
}
