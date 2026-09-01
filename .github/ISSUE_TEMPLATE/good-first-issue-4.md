---
name: "Good First Issue: Add web UI tests with Playwright"
about: Add end-to-end tests for the control panel
title: "[Test] Add Playwright E2E tests for web control panel"
labels: ["good first issue", "testing", "ui", "help wanted"]
assignees: ""
---

## Description

The web control panel (`src/server/ui/`) has no automated tests. Add Playwright tests to verify critical user flows.

## Tasks

- [ ] Set up Playwright in `src/server/ui/` (add to package.json)
- [ ] Create `test/ui/control-panel.spec.js`
- [ ] Test critical flows:
  - [ ] Page loads without errors
  - [ ] Run list displays correctly
  - [ ] "New Run" modal opens and submits
  - [ ] Thought log updates in real-time (mock WebSocket)
  - [ ] Approval queue shows pending items
  - [ ] Approve/reject buttons work
  - [ ] Budget panel displays data

## Files to Create/Modify

- `src/server/ui/package.json` - Add playwright dependency
- `src/server/ui/playwright.config.js` - Config
- `test/ui/control-panel.spec.js` - Main test file

## Test Scenarios

```javascript
// Example test structure
test('page loads and shows empty state', async ({ page }) => {
  await page.goto('http://localhost:3456');
  await expect(page.locator('text=No runs yet')).toBeVisible();
});

test('can create new run', async ({ page }) => {
  await page.goto('http://localhost:3456');
  await page.click('button:has-text("New Run")');
  await page.fill('textarea', 'Test task');
  await page.click('button:has-text("Start Run")');
  await expect(page.locator('.run-item')).toBeVisible();
});
```

## Acceptance Criteria

- [ ] Playwright installed and configured
- [ ] At least 5 meaningful tests
- [ ] Tests run in CI (GitHub Actions)
- [ ] Tests pass locally: `npm run test:ui`
- [ ] No flaky tests

## Getting Started

```bash
cd src/server/ui
npm install -D @playwright/test
npx playwright install chromium

# Create test file and config
# Run tests
npx playwright test
```

## Resources

- [Playwright Documentation](https://playwright.dev/)
- UI source: `src/server/ui/src/App.jsx`
- WebSocket events in `src/server/index.js`

## Mentorship

Happy to help with WebSocket mocking! Tag @game_ryo.
