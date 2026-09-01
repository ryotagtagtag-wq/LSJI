---
name: "Good First Issue: Add unit tests for Budget Controller"
about: Increase test coverage for budget control system
title: "[Test] Add unit tests for TokenCounter, CostTracker, CircuitBreaker"
labels: ["good first issue", "testing", "help wanted"]
assignees: ""
---

## Description

The budget control system (`src/execution/budget/`) has 3 core classes but limited test coverage. We need unit tests to ensure reliability.

## Tasks

- [ ] Create `test/execution/budget/token-counter.test.js`
- [ ] Create `test/execution/budget/cost-tracker.test.js`
- [ ] Create `test/execution/budget/circuit-breaker.test.js`
- [ ] Test edge cases: limit exceeded, circuit breaker states, token counting accuracy

## Files to Create

- `test/execution/budget/token-counter.test.js`
- `test/execution/budget/cost-tracker.test.js`
- `test/execution/budget/circuit-breaker.test.js`

## Test Scenarios to Cover

### TokenCounter
- [ ] Count tokens for different providers (OpenAI, Anthropic, Gemini)
- [ ] Handle missing usage data gracefully
- [ ] Aggregate tokens across multiple calls

### CostTracker
- [ ] Track cost per run, daily, monthly
- [ ] Enforce limits correctly
- [ ] Calculate USD costs per model
- [ ] Reset run budget

### CircuitBreaker
- [ ] Closed → Open transition on failures
- [ ] Half-open state behavior
- [ ] Auto-close after success
- [ ] Configurable threshold/timeout

## Acceptance Criteria

- [ ] All new tests pass: `npm test`
- [ ] Coverage increases for budget module
- [ ] Tests follow existing patterns (see `test/core/qlearning.test.js`)
- [ ] No flaky tests

## Getting Started

```bash
# 1. Look at existing test structure
cat test/core/qlearning.test.js

# 2. Examine the source files
cat src/execution/budget/token-counter.js
cat src/execution/budget/cost-tracker.js
cat src/execution/budget/circuit-breaker.js

# 3. Write tests using vitest
# 4. Run: npm test
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- Budget system docs: `docs/docs/core-concepts.md#budget-control`
- Source code in `src/execution/budget/`

## Mentorship

Tag @game_ryo for guidance on test design!
