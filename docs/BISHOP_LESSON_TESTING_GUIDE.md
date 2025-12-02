# Quick Start - Testing the New Bishop Lesson

## Prerequisites
- Backend running (`php artisan serve`)
- Frontend running (`npm run dev`)
- Database seeded with `ComprehensiveTutorialSeeder`

## Test Scenarios

### ✅ Scenario 1: Stage 1 - Introduction
**Expected Behavior:**
- White bishop visible at d4 (center of board)
- White king at e1, black king at e8 (minimal valid position)
- 4 green arrows emanating diagonally from bishop
- 14 squares highlighted in light color
- Instruction text explains diagonal movement with arrows (↗ ↖ ↘ ↙)
- Title: "Meet the Bishop! ♗"

**Test Steps:**
1. Click on bishop at d4
2. Try moving to ANY diagonal square (e.g., a1, f6, h8, etc.)
3. **Expected**: Move succeeds with message "Perfect! You moved the bishop diagonally!"
4. **Expected**: Auto-advance to Stage 2

**Invalid Move Test:**
1. Try moving bishop straight (e.g., d4 to d6)
2. **Expected**: Rejected with message "Remember: bishops only move diagonally..."

---

### ✅ Scenario 2: Stage 2 - Guided Practice
**Expected Behavior:**
- Same board position (bishop at d4)
- 3 blue arrows showing example moves
- 7 highlighted squares as guidance
- Instruction: "Now YOU try! ... All diagonal moves are correct!"
- Title: "Your Turn - Move the Bishop!"

**Test Steps:**
1. Try moving to a highlighted square (e.g., c3, e5, f6)
2. **Expected**: Success with "Excellent! You moved the bishop diagonally! ✨"
3. **Expected**: Stage marked as complete, can advance to Stage 3

**Multiple Valid Answers Test:**
- Test various diagonal moves: b2, c3, e3, f2, g1, c5, b6, a7, e5, f6, g7, h8, a1
- **Expected**: ALL diagonal moves accepted

---

### ✅ Scenario 3: Stage 3 - Capture Challenge
**Expected Behavior:**
- Bishop at d4
- Black pawn at f6
- 1 red arrow from d4 to f6
- 3 highlighted squares: d4, e5, f6
- Instruction: "Bishops capture by landing on enemy pieces. Move your bishop to capture the black pawn!"
- Title: "Bishop Captures ⚔️"

**Test Steps:**
1. Try moving bishop to f6 (capturing the pawn)
2. **Expected**: Success with "Perfect capture! 🎯 You understand how bishops move and capture!"
3. **Expected**: Lesson completion

**Wrong Move Test:**
1. Try moving to a different diagonal square (e.g., e5)
2. **Expected**: Stage NOT completed (must capture specifically)

---

## Visual Verification Checklist

### Stage 1 Visual Aids
- [ ] Green arrows visible from d4 to: a1, g1, a7, h8
- [ ] All 14 diagonal squares highlighted
- [ ] Bishop piece clearly visible at d4
- [ ] Instruction text readable with emojis

### Stage 2 Visual Aids
- [ ] Blue arrows visible from d4 to: a7, g1, h8
- [ ] 7 highlighted squares visible: d4, c3, e5, f6, g7, b2, f2
- [ ] Arrows have different color (blue vs green from Stage 1)

### Stage 3 Visual Aids
- [ ] Red arrow visible from d4 to f6
- [ ] Black pawn visible at f6
- [ ] Path squares highlighted: d4, e5, f6
- [ ] Red arrow indicates capture intent

---

## Backend Validation Tests

### Test Invalid Moves
```
Move: d4d6 (straight vertical)
Expected: Rejected with "bishops only move diagonally"

Move: d4f4 (straight horizontal)
Expected: Rejected with "bishops only move diagonally"

Move: d4e6 (knight move)
Expected: Rejected with "bishops only move diagonally"
```

### Test Valid Diagonal Moves
```
Move: d4a1 ✅
Move: d4b2 ✅
Move: d4c3 ✅
Move: d4e5 ✅
Move: d4f6 ✅
Move: d4g7 ✅
Move: d4h8 ✅
Move: d4c5 ✅
Move: d4b6 ✅
Move: d4a7 ✅
Move: d4e3 ✅
Move: d4f2 ✅
Move: d4g1 ✅
```

---

## Common Issues & Solutions

### Issue: No arrows visible
**Solution**: Check `visual_aids` in database, verify `EnhancedInteractiveLesson.jsx:352` renders arrows

### Issue: All moves accepted (even non-diagonal)
**Solution**: Verify `goals` has `'piece' => 'bishop'` in database

### Issue: Hints not working
**Solution**: Check `hints` array in stage data, verify lesson has `enable_hints: true`

### Issue: Stage doesn't advance
**Solution**: Check `success_criteria` and ensure move validation returns `success: true`

---

## Database Verification

Check bishop lesson stages in database:
```sql
SELECT
    s.stage_order,
    s.title,
    s.initial_fen,
    JSON_EXTRACT(s.goals, '$[0].type') as goal_type,
    JSON_EXTRACT(s.goals, '$[0].piece') as piece,
    JSON_EXTRACT(s.visual_aids, '$.arrows') as arrows_count
FROM interactive_lesson_stages s
JOIN tutorial_lessons l ON s.lesson_id = l.id
WHERE l.slug = 'bishop-movement'
ORDER BY s.stage_order;
```

**Expected Output:**
```
stage_order | title                           | initial_fen                      | goal_type  | piece
1           | Meet the Bishop! ♗             | 4k3/8/8/8/3B4/8/8/4K3 w - - 0 1 | move_piece | bishop
2           | Your Turn - Move the Bishop!   | 4k3/8/8/8/3B4/8/8/4K3 w - - 0 1 | move_piece | bishop
3           | Bishop Captures ⚔️             | 4k3/8/5p2/8/3B4/8/8/4K3 w - - 0 1 | capture    | (null)
```

**Note**: The FEN includes both kings (e1 and e8) because chess.js requires them for validation.

---

## Success Criteria

- [ ] Stage 1 accepts any diagonal move
- [ ] Stage 2 accepts any diagonal move
- [ ] Stage 3 requires capturing f6
- [ ] Non-diagonal moves rejected in all stages
- [ ] Visual arrows displayed correctly
- [ ] Feedback messages show with emojis
- [ ] Progress tracked across stages
- [ ] Lesson completion recorded

---

## Browser Console Checks

Open browser console and check for:
- ✅ No JavaScript errors
- ✅ Chess.js successfully validates moves
- ✅ FEN loads correctly: `8/8/8/8/3B4/8/8/8 w - - 0 1`
- ✅ Visual aids render without errors
- ✅ API calls to `/tutorial/lessons/{id}/validate-move` succeed

---

## Performance Benchmarks

- **Initial Load**: < 500ms
- **Stage Transition**: < 300ms
- **Move Validation**: < 100ms
- **Visual Aids Render**: < 50ms

---

**Last Updated**: 2025-12-01
**Status**: Ready for Testing
