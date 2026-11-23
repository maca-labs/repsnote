import { expect, test } from '@playwright/test';

async function personal(page) {
  await page.goto('./');
  await page.getByRole('button',{name:'自分の記録をはじめる'}).click();
}
const openFood = page => page.locator('[data-action="nav"][data-view="food"]:visible').first().click();
const form = page => page.locator('#food-entry');
const field = (page,name) => form(page).locator('[name="'+name+'"]');

test('a new meal draft survives a second tab saving a note and both records persist', async ({page,context}) => {
  await personal(page);
  const other = await context.newPage();
  await other.goto('./');
  await openFood(page);
  await page.locator('[data-action="add-food"][data-meal="昼食"]').click();
  await field(page,'name').fill('検証の弁当');
  await field(page,'kcal').fill('410');
  await field(page,'p').fill('24');
  await field(page,'saveFood').uncheck();
  const note=other.getByRole('textbox',{name:'トレーニングメモ'});
  await note.fill('Bで保存したメモ');
  await note.press('Tab');
  await expect(page.locator('#toast')).toContainText('別のタブ');
  await expect(form(page)).toBeVisible();
  await expect(field(page,'name')).toHaveValue('検証の弁当');
  await expect(field(page,'kcal')).toHaveValue('410');
  await expect(field(page,'p')).toHaveValue('24');
  await expect(field(page,'meal')).toHaveValue('昼食');
  await expect(field(page,'saveFood')).not.toBeChecked();
  await form(page).getByRole('button',{name:'食事を保存'}).click();
  await expect(page.locator('.food-value')).toHaveText('410 kcal');
  await other.reload();
  await expect(note).toHaveValue('Bで保存したメモ');
  await openFood(other);
  await expect(other.locator('.food-item')).toHaveCount(1);
  await expect(other.locator('.food-item')).toContainText('検証の弁当');
});

test('switching a doubled saved food back to new clears the preset before a second meal is saved', async ({page}) => {
  await personal(page);
  await openFood(page);
  await page.getByRole('button',{name:'食事を追加',exact:true}).click();
  await field(page,'name').fill('登録ヨーグルト');
  await field(page,'basis').selectOption('100g');
  await field(page,'kcal').fill('120');
  await field(page,'p').fill('9');
  await form(page).getByRole('button',{name:'2倍',exact:true}).click();
  await form(page).getByRole('button',{name:'食事を保存'}).click();
  await expect(page.locator('.food-value')).toHaveText('240 kcal');
  await page.locator('[data-action="add-food"][data-meal="間食"]').click();
  await page.locator('#saved-food-select').selectOption({label:'登録ヨーグルト'});
  await form(page).getByRole('button',{name:'2倍',exact:true}).click();
  await expect(page.locator('#food-calculation')).toContainText('240 kcal');
  await page.locator('#saved-food-select').selectOption({label:'新しく入力する'});
  await expect(field(page,'name')).toHaveValue('');
  await expect(field(page,'kcal')).toHaveValue('');
  await expect(field(page,'p')).toHaveValue('0');
  await expect(field(page,'basis')).toHaveValue('serving');
  await expect(field(page,'amount')).toHaveValue('1');
  await expect(field(page,'meal')).toHaveValue('間食');
  await expect(form(page).getByRole('button',{name:'1倍',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(field(page,'saveFood')).toBeChecked();
  await form(page).getByRole('button',{name:'食事を保存'}).click();
  await expect(form(page)).toBeVisible();
  await field(page,'name').fill('バナナ');
  await field(page,'kcal').fill('90');
  await form(page).getByRole('button',{name:'食事を保存'}).click();
  await page.reload();
  await openFood(page);
  await expect(page.locator('.food-value')).toHaveText(['240 kcal','90 kcal']);
});

test('an external save preserves both steps of bulk meal import and appends to the latest meals', async ({page,context}) => {
  await personal(page);
  const other=await context.newPage();
  await other.goto('./');
  await openFood(page);
  await page.locator('[data-action="meal-import"]').click();
  const response=JSON.stringify({items:[
    {name:'バナナ',basis:'serving',amount:1,kcal:90,p:1,f:0,c:21},
    {name:'ヨーグルト',basis:'serving',amount:1,kcal:55,p:3,f:2,c:5},
  ]});
  await page.locator('#meal-query').fill('バナナとヨーグルト');
  await page.locator('#meal-response').fill(response);
  const note=other.getByRole('textbox',{name:'トレーニングメモ'});
  await note.fill('取り込み中の別タブ'); await note.press('Tab');
  await expect(page.locator('#toast')).toContainText('別のタブ');
  await expect(page.locator('#meal-response')).toBeVisible();
  await expect(page.locator('#meal-response')).toHaveValue(response);
  await expect(page.locator('#meal-query')).toHaveValue('バナナとヨーグルト');
  await page.getByRole('button',{name:'読み込んで確認'}).click();
  await page.locator('#meal-scale-0').selectOption('2');
  await page.locator('#meal-type-0').selectOption('間食');
  await page.locator('[name="include-1"]').uncheck();
  await openFood(other);
  await other.getByRole('button',{name:'食事を追加',exact:true}).click();
  await field(other,'name').fill('別タブの朝食');
  await field(other,'kcal').fill('220');
  await form(other).getByRole('button',{name:'食事を保存'}).click();
  await expect(page.locator('.food-item')).toContainText('別タブの朝食');
  await expect(page.locator('#meal-import-review')).toBeVisible();
  await expect(page.locator('#meal-import-total')).toContainText('180 kcal');
  await expect(page.locator('#meal-type-0')).toHaveValue('間食');
  await expect(page.locator('[name="include-1"]')).not.toBeChecked();
  await page.getByRole('button',{name:'選んだ食事を一括保存'}).click();
  await page.reload(); await openFood(page);
  await expect(page.locator('.food-value')).toHaveText(['220 kcal','180 kcal']);
});

test('a stale food editor keeps its draft and asks before replacing a correction or reviving a deleted record', async ({page,context}) => {
  await personal(page);
  await openFood(page);
  await page.getByRole('button',{name:'食事を追加',exact:true}).click();
  await field(page,'name').fill('バナナ');
  await field(page,'kcal').fill('90');
  await form(page).getByRole('button',{name:'食事を保存'}).click();
  const other = await context.newPage();
  await other.goto('./'); await openFood(other);
  const edit = p => p.locator('.food-item [data-action="edit-food"]').click();
  const save = p => form(p).getByRole('button',{name:'食事を保存'}).click();
  await edit(page); await edit(other);
  await field(page,'kcal').fill('110');
  await field(other,'kcal').fill('100');
  await save(other);
  await expect(page.locator('#toast')).toContainText('別のタブ');
  await expect(field(page,'kcal')).toHaveValue('110');
  const first = page.waitForEvent('dialog').then(async d => {expect(d.message()).toContain('変更'); await d.dismiss();});
  await Promise.all([first,save(page)]);
  await expect(form(page)).toBeVisible();
  await expect(page.locator('.food-value')).toHaveText('100 kcal');
  await edit(other); await form(other).getByRole('button',{name:'削除',exact:true}).click();
  await expect(page.locator('.food-item')).toHaveCount(0);
  await expect(field(page,'kcal')).toHaveValue('110');
  const second = page.waitForEvent('dialog').then(async d => {expect(d.message()).toContain('削除'); await d.accept();});
  await Promise.all([second,save(page)]);
  await expect(page.locator('.food-value')).toHaveText('110 kcal');
  await other.reload(); await openFood(other);
  await expect(other.locator('.food-value')).toHaveText('110 kcal');
});
