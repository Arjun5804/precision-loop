import { test, expect } from '@playwright/test';

test.describe('Browser UI Shell & Application Integration', () => {
    test.beforeEach(({ page }) => {
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    });

    test('1 & 2. App loads successfully and audio initialization UI is visible', async ({ page }) => {
        await page.goto('/');
        
        // Ensure the overlay is visible
        const overlay = page.locator('.init-overlay');
        await expect(overlay).toBeVisible();
        
        // Check for the initialize button
        const initButton = page.locator('button', { hasText: 'Initialize Audio' });
        await expect(initButton).toBeVisible();
    });

    test('3 & 4. Clicking Initialize Audio calls the application boundary and updates the UI', async ({ page }) => {
        await page.goto('/');
        
        const initButton = page.locator('button', { hasText: 'Initialize Audio' });
        await initButton.click();
        
        // After click, the overlay should disappear indicating audio is running
        const overlay = page.locator('.init-overlay');
        await expect(overlay).toBeHidden();
        
        // Transport controls become available
        const startButton = page.locator('button', { hasText: 'All Start' });
        await expect(startButton).not.toBeDisabled();
    });

    test('5, 7, 8. Record invokes action and UI reflects state with session info', async ({ page }) => {
        await page.goto('/');
        await page.locator('button', { hasText: 'Initialize Audio' }).click();
        
        // Verify Session info is rendered (4 tracks)
        const trackPanels = page.locator('.track-panel');
        await expect(trackPanels).toHaveCount(4);
        
        // Click Record on Track 1
        const track1 = trackPanels.first();
        const recButton = track1.locator('button.btn-indicator');
        await expect(recButton).toHaveText('REC');
        
        await recButton.click();
        
        // The transport state should change to PREPARING or RECORDING
        // We'll check if the global state indicator shows RECORDING or PREPARING
        // Wait for it to become RECORDING (it might be PREPARING first)
        const appStateLabel = page.locator('.transport-section div').last();
        await expect(appStateLabel).toHaveText(/PREPARING|RECORDING/);
    });

    test('6. Stop invokes stop action', async ({ page }) => {
        await page.goto('/');
        await page.locator('button', { hasText: 'Initialize Audio' }).click();
        
        // Start playback
        await page.locator('button', { hasText: 'All Start' }).click();
        
        const appStateLabel = page.locator('.transport-section div').last();
        await expect(appStateLabel).toHaveText('PLAYING');
        
        // Stop
        await page.locator('button', { hasText: 'Stop' }).click();
        
        await expect(appStateLabel).toHaveText('IDLE');
    });
});
