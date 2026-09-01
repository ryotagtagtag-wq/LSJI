---
name: "Good First Issue: Improve CLI output formatting with colors"
about: Make CLI output more readable with chalk/colors
title: "[CLI] Add colored output and progress indicators"
labels: ["good first issue", "cli", "ux", "help wanted"]
assignees: ""
---

## Description

The CLI output is currently plain text. Add colors, spinners, and better formatting using a lightweight library like `chalk` or `kleur`.

## Tasks

- [ ] Add `kleur` (zero-dependency, fast) to dependencies
- [ ] Update `src/cli.js` output functions:
  - [ ] Success messages → green
  - [ ] Errors → red
  - [ ] Warnings → yellow
  - [ ] Info/debug → blue/cyan
  - [ ] JSON output → syntax highlighted (optional)
- [ ] Add spinner for long-running operations (train, agent run)
- [ ] Add progress bar for training episodes

## Files to Modify

- `package.json` - Add `kleur` dependency
- `src/cli.js` - Update `output()`, `main()`, and command handlers

## Example Improvements

```javascript
import kleur from 'kleur';

// Before
console.log('Training complete:', result);

// After
console.log(kleur.green('✓ Training complete:'), result);

// Spinner for long operations
import { createSpinner } from 'kleur/colors';
// Or use simple animation
const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
```

## Acceptance Criteria

- [ ] `lsji train --episodes 100` shows colored output
- [ ] Errors are clearly red
- [ ] Success messages are green
- [ ] Spinner shows during `agent run` and `train`
- [ ] No performance regression
- [ ] Works in CI (no TTY issues)
- [ ] `npm test` passes

## Getting Started

```bash
# 1. Add dependency
npm install kleur

# 2. Import in cli.js
import kleur from 'kleur';

# 3. Update output() function and command handlers
# 4. Test each command
lsji train --episodes 50
lsji agent run --task "test" --provider local
lsji status --json
```

## Resources

- [kleur Documentation](https://github.com/lukeed/kleur) - Zero deps, fast
- [CLI Best Practices](https://clig.dev/)
- Current CLI: `src/cli.js`

## Mentorship

Simple but impactful! Tag @game_ryo for review.
