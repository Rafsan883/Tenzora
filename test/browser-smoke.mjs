import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const base = process.env.PREVIEW_URL || 'http://localhost:5173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const failures = [];
page.on('pageerror', error => failures.push(error.message));
try {
  await page.goto(`${base}/home`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('button', { name: /^login$/i }).first().click({ timeout: 60000 });
  await page.getByPlaceholder('Email', { exact: true }).fill('preview.admin@gmail.com');
  await page.getByPlaceholder('Password', { exact: true }).fill('LocalPreview123!');
  await page.locator('form').getByRole('button', { name: /sign in/i }).click();
  await page.waitForFunction(() => Boolean(localStorage.getItem('token')), null, { timeout: 30000 });
  for (const path of ['/profile', '/settings', '/watchlist', '/import', '/admin', '/community', '/chat', '/watch2gether', '/watch/1?ep=1']) {
    await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    assert.equal(await page.getByText('Something went wrong', { exact: true }).count(), 0, path);
  }
  assert.deepEqual(failures, [], 'Browser runtime errors');
  console.log('Browser smoke passed: sign-in and nine key pages.');
} finally { await browser.close(); }
