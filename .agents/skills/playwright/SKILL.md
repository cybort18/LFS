---
name: playwright
description: End-to-end testing and browser automation skill with Playwright. Use when writing, debugging, running, or fixing Playwright tests, multi-page flows, browser context isolation, mobile device emulation, download handling, network interception, and visual UI assertions.
---

# Playwright E2E Testing & Browser Automation Skill

This skill provides testing best practices, locators, context handling, and assertions for web applications using `@playwright/test`.

## Key Capabilities & Patterns

### 1. Isolated Contexts & Multi-Device Testing
For multi-client or P2P apps, simulate multiple independent devices (e.g. Sender PC & Receiver Mobile):
```javascript
// PC Context
const pcContext = await browser.newContext();
const pcPage = await pcContext.newPage();
await pcPage.goto('http://localhost:3000');

// Mobile Context with UA Emulation
const mobileContext = await browser.newContext({
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15'
});
const mobilePage = await mobileContext.newPage();
await mobilePage.goto('http://localhost:3000');
```

### 2. Reliable Locators & Assertions
- Use web-first assertions: `await expect(locator).toBeVisible()`, `await expect(locator).toHaveText(...)`.
- Avoid hardcoded sleeps; rely on auto-waiting locators and event promises.

### 3. File Downloads & File Uploads
```javascript
// Staging/Uploading a file
await page.locator('#file-input').setInputFiles(filePath);

// Awaiting a browser download event
const downloadPromise = page.waitForEvent('download');
await page.click('#btn-accept-transfer');
const download = await downloadPromise;
expect(download.suggestedFilename()).toBe('filename.ext');
```

### 4. Running & Debugging Tests
- Run all tests: `npx playwright test`
- Run with list output: `npx playwright test --reporter=list`
- Run specific test file: `npx playwright test tests/e2e.spec.js`
