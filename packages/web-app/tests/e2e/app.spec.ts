import { test, expect } from '@playwright/test';

test.describe('Browser UI Shell & Application Integration', () => {
    test.beforeEach(({ page }) => {
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
        page.on('pageerror', err => console.log('PAGE ERROR:', err.message, err.stack));
    });

    test('1 & 2. App loads successfully and audio initialization UI is visible', async ({ page }) => {
        await page.goto('/');
        
        // Ensure the overlay is visible
        const overlay = page.locator('.init-overlay');
        await expect(overlay).toBeVisible();
        
        // Check for the initialize button
        const initButton = page.locator('button[title="Power On"]');
        await expect(initButton).toBeVisible();
    });

    test('3 & 4. Clicking Power On calls the application boundary and updates the UI', async ({ page }) => {
        await page.goto('/');
        
        const initButton = page.locator('button[title="Power On"]');
        await initButton.click();
        
        // After click, the overlay should disappear indicating audio is running
        const overlay = page.locator('.init-overlay');
        await expect(overlay).toBeHidden();
        
        // Transport controls become available
        const startButton = page.locator('button[title="All Start"]');
        // It is disabled initially because there are no loops
        await expect(startButton).toBeDisabled();
    });

    test('5, 7, 8. Record invokes action and UI reflects state with session info', async ({ page }) => {
        await page.goto('/');
        await page.locator('button[title="Power On"]').click();
        
        // Verify Session info is rendered (4 tracks)
        const trackPanels = page.locator('[data-testid^="track-panel-"]');
        await expect(trackPanels).toHaveCount(4);
        
        // Click Record on Track 1
        const track1 = trackPanels.first();
        const recButton = track1.locator('button[aria-label="Track 1 REC"]');
        
        await recButton.click();
        
        // Global state indicator shows RECORDING or PREPARING
        const appStateLabel = page.locator('[data-testid="app-state-label"]');
        await expect(appStateLabel).toHaveText(/PREPARING|RECORDING/);
        
        // Track 1 should show COUNT-IN or RECORDING
        const statusText = track1.locator('.status-text');
        await expect(statusText).toHaveText(/COUNT-IN|RECORDING/);
    });

    test('6. Record, loop creates, playback, and stop invokes stop action', async ({ page }) => {
        test.setTimeout(45000); // Allow time for recording bars
        await page.goto('/');
        await page.locator('button[title="Power On"]').click();
        
        // Record on Track 1
        await page.locator('button[aria-label="Track 1 REC"]').click();
        
        // Wait for recording to finish
        const track1Status = page.locator('[data-testid="track-panel-1"] .status-text');
        await expect(track1Status).toHaveText('READY', { timeout: 30000 });
        
        const appStateLabel = page.locator('[data-testid="app-state-label"]');
        await expect(appStateLabel).toHaveText(/STS: IDLE/);
        
        // Start playback
        await page.locator('button[aria-label="Track 1 PLAY"]').click();
        await expect(track1Status).toHaveText('PLAYING');
        await expect(appStateLabel).toHaveText(/STS: PLAYING/);

        // Stop global
        await page.locator('button[aria-label="All Stop"]').click();
        
        await expect(appStateLabel).toHaveText(/STS: IDLE/);
    });
});
