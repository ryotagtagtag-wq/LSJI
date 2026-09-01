---
name: "Good First Issue: Add JSDoc comments to core RL classes"
about: Improve code documentation for newcomers
title: "[Docs] Add JSDoc comments to core RL classes (Agent, QLearning, Env)"
labels: ["good first issue", "documentation", "help wanted"]
assignees: ""
---

## Description

The core RL classes (`Agent`, `QLearning`, `Env`) in `src/core/` are missing comprehensive JSDoc comments. This makes it harder for new contributors to understand the codebase.

## Tasks

- [ ] Add JSDoc comments to `src/core/agent.js` - all public methods
- [ ] Add JSDoc comments to `src/core/qlearning.js` - all public methods  
- [ ] Add JSDoc comments to `src/core/env.js` - interface and StateEncoder
- [ ] Follow existing patterns in the codebase (see `src/storage/sqlite.js` for examples)

## Files to Modify

- `src/core/agent.js`
- `src/core/qlearning.js`
- `src/core/env.js`

## Acceptance Criteria

- [ ] All public methods have `@param`, `@returns`, and `@description` tags
- [ ] Class-level `@description` explains purpose
- [ ] Type annotations match actual implementation
- [ ] Run `npm test` passes after changes

## Getting Started

```bash
# 1. Fork and clone the repo
git clone https://github.com/your-username/LSJI.git
cd LSJI

# 2. Install dependencies
npm install

# 3. Run tests to ensure baseline
npm test

# 4. Make your changes to the three files

# 5. Run tests again
npm test

# 6. Submit PR!
```

## Resources

- [JSDoc Guide](https://jsdoc.app/)
- [TypeScript JSDoc Reference](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)
- Existing examples in `src/storage/sqlite.js`

## Mentorship

Happy to guide you through this! Tag @game_ryo in the PR for review.
