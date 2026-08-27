import { test, expect } from '@playwright/test';

test.describe('Precision Loop hardware workflow', () => {
  test.beforeEach(({ page }) => {
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  });

  async function powerOn(page: any) {
    await page.goto('/');
    await page.locator('button[title="Power On"]').click();
    await expect(page.locator('.init-overlay')).toBeHidden();
  }

  test('boots into a four-track loop station', async ({ page }) => {
    await powerOn(page);
    await expect(page.locator('[data-testid^="track-panel-"]')).toHaveCount(4);
    await expect(page.locator('[data-track-state="EMPTY"]')).toHaveCount(4);
    await expect(page.locator('button[title="All Start"]')).toBeDisabled();
  });

  test('records a loop through count-in and automatically enters playback', async ({ page }) => {
    test.setTimeout(45000);
    await powerOn(page);

    const track1 = page.locator('[data-testid="track-panel-1"]');
    await track1.locator('button[aria-label="Track 1 REC"]').click();

    await expect(track1).toHaveAttribute('data-track-state', 'COUNT-IN', { timeout: 5000 });
    await expect(page.locator('[data-testid="app-state-label"]')).toHaveText(/STS: PREPARING/);

    await expect(track1).toHaveAttribute('data-track-state', 'RECORDING', { timeout: 5000 });
    await expect(page.locator('[data-testid="app-state-label"]')).toHaveText(/STS: RECORDING/);

    // Closing a loop immediately starts that loop, as expected from a looper.
    await expect(track1).toHaveAttribute('data-track-state', 'PLAYING', { timeout: 30000 });
    await expect(track1.locator('button[aria-label="Track 1 STOP"]')).toBeVisible();
  });

  test('supports independent simultaneous playback and recording', async ({ page }) => {
    test.setTimeout(75000);
    await powerOn(page);

    const track1 = page.locator('[data-testid="track-panel-1"]');
    const track2 = page.locator('[data-testid="track-panel-2"]');

    // Record Track 1; it should automatically begin playing.
    await track1.locator('button[aria-label="Track 1 REC"]').click();
    await expect(track1).toHaveAttribute('data-track-state', 'PLAYING', { timeout: 30000 });

    // Record Track 2 while Track 1 continues playing.
    await track2.locator('button[aria-label="Track 2 REC"]').click();
    await expect(track2).toHaveAttribute('data-track-state', 'COUNT-IN', { timeout: 5000 });
    await expect(track1).toHaveAttribute('data-track-state', 'PLAYING');

    await expect(track2).toHaveAttribute('data-track-state', 'RECORDING', { timeout: 5000 });
    await expect(track1).toHaveAttribute('data-track-state', 'PLAYING');

    await expect(track2).toHaveAttribute('data-track-state', 'PLAYING', { timeout: 30000 });
    await expect(track1).toHaveAttribute('data-track-state', 'PLAYING');

    // Stop only Track 1. Track 2 must continue playing.
    await track1.locator('button[aria-label="Track 1 STOP"]').click();
    await expect(track1).toHaveAttribute('data-track-state', 'READY');
    await expect(track2).toHaveAttribute('data-track-state', 'PLAYING');

    // Global stop terminates the remaining playback.
    await page.locator('button[aria-label="All Stop"]').click();
    await expect(track2).toHaveAttribute('data-track-state', 'READY');
    await expect(page.locator('[data-testid="app-state-label"]')).toHaveText(/STS: IDLE/);
  });
});
