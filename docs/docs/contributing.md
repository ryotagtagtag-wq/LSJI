---
title: Contributing
description: How to contribute to LSJI
---

# Contributing

Thank you for your interest in contributing to LSJI!

## Development Setup

```bash
# Clone the repository
git clone https://github.com/ryotagtagtag-wq/LSJI.git
cd LSJI

# Install dependencies
npm install

# Run tests
npm test

# Build documentation
cd docs && npm run build
```

## Project Structure

```
LSJI/
├── src/                 # Core library
│   ├── core/           # QLearning, Agent, Env
│   ├── storage/        # Storage backends
│   ├── envs/           # Built-in environments
│   ├── cli.ts          # CLI
│   └── index.ts        # Public exports
├── test/               # Vitest tests
├── docs/               # Docusaurus documentation
└── bin/                # CLI entry point
```

## Making Changes

### 1. Create a Branch

```bash
git checkout -b feature/my-feature
```

### 2. Make Changes

Follow the existing code style:
- TypeScript with JSDoc comments
- ESM imports/exports
- No external dependencies in core

### 3. Run Tests

```bash
npm test
```

### 4. Update Documentation

If you add new features, update relevant docs in `docs/docs/`.

### 5. Commit

```bash
git add .
git commit -m "feat: add my feature"
```

**Commit Message Format:**
- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `refactor:` — Code refactoring
- `test:` — Tests
- `chore:` — Maintenance

### 6. Push and Create PR

```bash
git push origin feature/my-feature
```

## Adding a New Environment

1. Create `src/envs/my-env.ts` extending `Env`
2. Implement all abstract methods
3. Export from `src/index.ts`
4. Add documentation in `docs/docs/api/environments.md`
5. Add example in `docs/docs/examples/`

## Adding a New Storage Backend

1. Create `src/storage/my-backend.ts` extending `Storage`
2. Implement all abstract methods
3. Add to `createStorage` factory in `src/storage/index.ts`
3. Export from `src/index.ts`
4. Add tests in `test/storage/`

## Modifying Learning Algorithm

1. Extend `QLearning` class or create new class in `src/core/`
2. Maintain compatibility with `Agent` interface
3. Add tests for new algorithm
4. Document in `docs/docs/api/`

## Code Style

- **TypeScript** with strict mode
- **ESM** modules (`import`/`export`)
- **JSDoc** for all public APIs
- **No `any`** unless absolutely necessary
- **Async/await** for async operations

## Testing Guidelines

- Use `MemoryStorage` for unit tests
- Test both success and error cases
- Test edge cases (empty Q-table, terminal states)
- Keep tests fast and isolated

```typescript
// Example test structure
import { describe, it, expect, beforeEach } from 'vitest';
import { MyFeature } from '../src/core/my-feature';
import { MemoryStorage } from '../src/storage/memory';

describe('MyFeature', () => {
  let storage;
  let feature;

  beforeEach(async () => {
    storage = new MemoryStorage();
    await storage.initialize();
    feature = new MyFeature({ storage });
  });

  it('should do something', async () => {
    const result = await feature.doSomething();
    expect(result).toBe(expected);
  });
});
```

## Documentation

- Update relevant `.md` files in `docs/docs/`
- Add JSDoc comments for new public APIs
- Include code examples

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.

## Questions?

- Open a [GitHub Issue](https://github.com/ryotagtagtag-wq/LSJI/issues)
- Start a [Discussion](https://github.com/ryotagtagtag-wq/LSJI/discussions)
