import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const TEST_PORT = 3000;
const BASE_URL = `http://localhost:${TEST_PORT}`;

test.describe('LFS End-to-End P2P Transfer Tests', () => {

  test('Host initialization, QR code display, and multi-device connection', async ({ browser }) => {
    // 1. Create PC Sender Context
    const pcContext = await browser.newContext();
    const pcPage = await pcContext.newPage();
    pcPage.on('console', msg => console.log('PC:', msg.text()));
    await pcPage.goto(BASE_URL);

    // Verify PC UI elements
    await expect(pcPage.locator('.brand-title')).toHaveText('LocalFastShares');
    await expect(pcPage.locator('#ws-status-text')).toHaveText('Connected to LAN Room');
    
    // Verify QR code & LAN URL
    const lanUrl = await pcPage.locator('#lan-url-text').textContent();
    expect(lanUrl).toContain('http://');

    // 2. Create Mobile Receiver Context
    const mobileContext = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
    });
    const mobilePage = await mobileContext.newPage();
    mobilePage.on('console', msg => console.log('MOBILE:', msg.text()));
    await mobilePage.goto(BASE_URL);

    await expect(mobilePage.locator('#ws-status-text')).toHaveText('Connected to LAN Room');

    // 3. Stage a file on PC
    const testFilePath = path.join(process.cwd(), 'tests', 'sample_test_file.txt');
    fs.writeFileSync(testFilePath, 'Hello, LocalFastShares P2P file transfer content verification!');

    const fileInput = pcPage.locator('#file-input');
    await fileInput.setInputFiles(testFilePath);
    await expect(pcPage.locator('.file-name')).toHaveText('sample_test_file.txt');

    // 4. Scan Devices on PC
    await pcPage.click('#btn-scan-devices');
    
    // Wait for mobile device to appear in PC device list and select it
    const deviceItem = pcPage.locator('.device-item').first();
    await expect(deviceItem).toBeVisible({ timeout: 10000 });
    await deviceItem.click();

    // 5. Send Files
    const sendBtn = pcPage.locator('#btn-send-files');
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // 6. Verify Consent Modal on Mobile Receiver
    const modal = mobilePage.locator('#consent-modal');
    await expect(modal).toHaveClass(/active/, { timeout: 10000 });
    await expect(mobilePage.locator('#modal-sender-title')).toContainText('Incoming File');

    // 7. Accept Transfer on Mobile
    const downloadPromise = mobilePage.waitForEvent('download');
    await mobilePage.click('#btn-accept-transfer');

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('sample_test_file.txt');

    // Clean up temporary test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

});
