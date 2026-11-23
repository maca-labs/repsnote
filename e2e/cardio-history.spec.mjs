import { expect, test } from '@playwright/test';

test('running history shows completed time and distance in lbs mode, including after reload', async ({page}) => {
  await page.goto('./');
  await page.getByRole('button',{name:'自分の記録をはじめる'}).click();
  const pounds = page.locator('.top-actions [data-unit="lbs"]');
  await pounds.click();
  await expect(pounds).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-action="add-exercise"]').click();
  await page.getByRole('textbox',{name:'種目を検索'}).fill('ランニング');
  await page.getByRole('button',{name:'ランニングを追加',exact:true}).click();
  await page.getByRole('button',{name:'ランニング セット1の時間・距離などを編集'}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('時間（分）').fill('35');
  await dialog.getByLabel('距離（km）').fill('5.25');
  await dialog.getByRole('button',{name:'保存する'}).click();
  await page.getByRole('button',{name:'ランニング セット1を完了にする'}).click();
  await page.getByRole('button',{name:'ランニング セット1をコピー'}).click();
  await expect(page.locator('.cardio-row')).toHaveCount(2);
  await expect(page.locator('.cardio-row.done')).toHaveCount(1);

  const history = page.locator('[data-action="nav"][data-view="history"]:visible').first();
  const entry = page.locator('.history-item');
  async function checkHistory() {
    await history.click();
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText(/\b35\s*分/);
    await expect(entry).toContainText(/\b5\.25\s*km/);
    await expect(entry).not.toContainText(/セット|\b(?:kg|lbs)\b/);
  }
  await checkHistory();
  await page.reload();
  await checkHistory();

  await entry.click();
  const summary = page.locator('.metric-grid');
  await expect(summary).toContainText(/35\s*分/);
  await expect(summary).toContainText(/5\.25\s*km/);
  await expect(summary).not.toContainText(/完了セット|ボリューム|lbs/);
  await page.getByRole('button',{name:'ランニング セット1の時間・距離などを編集'}).click();
  await dialog.getByLabel('距離（km）').fill('');
  await dialog.getByRole('button',{name:'保存する'}).click();
  await expect(summary).toContainText(/35\s*分/);
  await expect(summary).not.toContainText(/km|lbs/);
  await history.click();
  await expect(entry).toContainText(/\b35\s*分/);
  await expect(entry).not.toContainText(/\bkm\b|セット|\b(?:kg|lbs)\b/);
});
