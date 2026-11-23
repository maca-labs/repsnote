import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

async function startPersonalLog(page) {
  await page.goto('./');
  await page.getByRole('button', { name: '自分の記録をはじめる' }).click();
  await expect(page.locator('.demo-banner')).toHaveCount(0);
}

test('a storage refresh keeps the saved note and the other tab’s unsaved draft', async ({ page: a, context }) => {
  await startPersonalLog(a);
  const noteA = a.getByRole('textbox', { name: 'トレーニングメモ' });
  await noteA.fill('最初のメモ');
  await noteA.press('Tab');
  const b = await context.newPage();
  await b.goto('./');
  const noteB = b.getByRole('textbox', { name: 'トレーニングメモ' });
  await expect(noteB).toHaveValue('最初のメモ');

  await noteA.fill('Aで入力中の下書き');
  await noteB.fill('Bで保存したメモ');
  await noteB.press('Tab');
  await expect(a.locator('.session-note')).toContainText('Bで保存したメモ');
  await b.reload();
  await expect(noteB).toHaveValue('Bで保存したメモ');
  await expect(noteA).toHaveValue('Aで入力中の下書き');
  await a.reload();
  await expect(noteA).toHaveValue('Aで入力中の下書き');
  await a.getByRole('button', { name: '下書きで保存' }).click();
  await expect(noteB).toHaveValue('Aで入力中の下書き');
});

test('a monthly post keeps a deleted calorie figure out of the copied and shared text', async ({ page, context }) => {
  await startPersonalLog(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(async () => {
    const { blankState, localDate, uid } = await import('./core.js');
    const state = blankState();
    state.meals[localDate()] = [{id:uid(),name:'弁当',meal:'昼食',basis:'serving',amount:1,kcal:800,p:20,f:20,c:110}];
    localStorage.setItem('repnote:v1:real', JSON.stringify(state));
  });
  await page.reload();
  // Observe what the app gives the OS without opening a share target or posting.
  await page.evaluate(() => {
    Object.defineProperty(navigator,'canShare',{value:() => true});
    Object.defineProperty(navigator,'share',{value:async ({ text, files }) => {
      window.deliveredPost = {text,type:files[0].type};
    }});
  });
  await page.locator('[data-action=nav][data-view=history]:visible').first().click();
  await page.locator('[data-action=share-month]').click();
  const post = page.getByRole('textbox', { name: '投稿文・自由に編集できます' });
  await expect(post).toHaveValue(/800\s*kcal/);
  const edited = (await post.inputValue()).split('\n').filter(line => !line.includes('kcal')).join('\n')+'\n今月のまとめ';
  await post.fill(edited);
  await page.locator('[name=share-theme]').selectOption('light');
  await page.locator('[name=share-format]').selectOption('portrait');
  await expect(post).toHaveValue(edited);
  await page.locator('[data-action=share-copy]').click();
  // The system clipboard on Windows returns CRLF for textarea line breaks.
  await expect.poll(() => page.evaluate(async () => (await navigator.clipboard.readText()).replaceAll('\r\n','\n'))).toBe(edited);
  await page.locator('[data-action=share-native]').click();
  await expect.poll(() => page.evaluate(() => window.deliveredPost)).toEqual({text:edited,type:'image/png'});
});

test('correcting the source meal keeps reviewed exclusions, meal groups and quantities on reload', async ({ page }) => {
  await startPersonalLog(page);
  const foodTab = page.locator('[data-action=nav][data-view=food]:visible').first();
  await foodTab.click();
  await page.locator('[data-action=meal-import]').click();
  const items = [
    {name:'バナナ',basis:'serving',amount:1,kcal:90,p:1,f:0,c:21},
    {name:'弁当',basis:'serving',amount:1,kcal:400,p:15,f:5,c:60,meal:'夕食'},
    {name:'除外する食品',basis:'serving',amount:1,kcal:200,p:12,f:6,c:25,meal:'間食'}
  ];
  const source = page.locator('#meal-response');
  const submit = page.locator('#modal button[type=submit]');
  const review = page.locator('#meal-import-review');
  await source.fill(JSON.stringify({items}));
  await page.locator('#meal-group').selectOption('朝食');
  await submit.click();
  await review.locator('#meal-type-0').selectOption('間食');
  await review.locator('#meal-scale-0').selectOption('2');
  await review.locator('[name=include-2]').uncheck();
  await review.locator('[data-meal-back]').click();
  items[1].kcal = 410;
  await source.fill(JSON.stringify({items}));
  await submit.click();
  await expect(review.locator('#meal-import-total')).toContainText(/選択2件の合計\s+590 kcal/);
  await expect(review.locator('#meal-type-0')).toHaveValue('間食');
  await expect(review.locator('#meal-scale-0')).toHaveValue('2');
  await expect(review.locator('[name=include-2]')).not.toBeChecked();
  await submit.click();
  await expect(page.locator('#modal')).not.toBeVisible();
  await page.reload();
  await foodTab.click();
  await expect(page.locator('.food-item')).toHaveCount(2);
  const snacks = page.locator('.meal-section').filter({has:page.locator('.meal-header span',{hasText:'間食'})});
  const dinner = page.locator('.meal-section').filter({has:page.locator('.meal-header span',{hasText:'夕食'})});
  await expect(snacks.locator('.food-item')).toContainText('バナナ');
  await expect(snacks.locator('.food-value')).toHaveText('180 kcal');
  await expect(dinner.locator('.food-item')).toContainText('弁当');
  await expect(dinner.locator('.food-value')).toHaveText('410 kcal');
});

for (const legacy of [false, true]) {
  test(`an exported ${legacy ? 'legacy' : 'current'} CSV cannot restore eight reps over the corrected nine`, async ({ page }, testInfo) => {
    await startPersonalLog(page);
    await page.locator('[data-action=add-exercise]').click();
    await page.getByRole('textbox', { name:'種目を検索' }).fill('ベンチプレス');
    await page.locator('.option-main[data-action=choose-exercise][data-id=barbell-bench]').click();
    await page.locator('[data-change=set-weight]').selectOption('5');
    const reps = page.locator('[data-change=set-reps]');
    await reps.selectOption('8');
    await page.locator('[data-action=complete-set]').click();
    await expect(page.locator('.set-row.done')).toHaveCount(1);
    const settings = page.locator('[data-action=settings]:visible').first();
    await settings.click();
    const download = page.waitForEvent('download');
    await page.locator('[data-action=export-csv]').click();
    const csvPath = testInfo.outputPath('history.csv');
    await (await download).saveAs(csvPath);
    let csv = await readFile(csvPath,'utf8');
    if (legacy && csv.includes('REPS NOTE セットID')) {
      // Legacy exports predate the trailing ID column. This fixture has one simple row.
      csv = csv.replace(/,"[^"\r\n]*"(?=\r?$)/gm,'');
    }
    async function importCsv() {
      await page.locator('[data-action=workout-import]').click();
      await page.locator('#workout-import-file').setInputFiles({name:'history.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
      await page.locator('[data-preview-workouts]').click();
      await expect(page.locator('#workout-map-0')).toHaveValue('barbell-bench');
      await page.locator('[data-import-workouts]').click();
      await expect(page.locator('#modal')).not.toBeVisible();
      await expect(page.locator('#toast')).toContainText('追加 0件・重複 1件');
    }
    await importCsv();
    await expect(reps).toHaveCount(1);
    await reps.selectOption('9');
    await settings.click();
    await importCsv();
    await page.reload();
    await expect(reps).toHaveCount(1);
    await expect(reps).toHaveValue('9');
    await expect(page.locator('.set-row.done')).toHaveCount(1);
  });
}
