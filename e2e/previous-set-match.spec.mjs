import { expect, test } from '@playwright/test';

test('strength rows show completed previous sets in order within their own kind', async ({page}) => {
  await page.goto('./');
  const previousDate = await page.evaluate(async () => {
    const {blankState, localDate, newSet, shiftDay, uid} = await import('./core.js');
    const state = blankState();
    function workout(sets) {
      return {title:'ベンチプレス', note:'', exercises:[{id:uid(), exerciseId:'barbell-bench', note:'', sets}]};
    }
    const today = localDate();
    const yesterday = shiftDay(today, -1);
    state.workouts[yesterday] = workout([
      {...newSet(20, 10), kind:'warmup', completed:true},
      newSet(50, 5),
      {...newSet(60, 8), completed:true},
      {...newSet(55, 9), completed:true},
    ]);
    state.workouts[today] = workout([newSet(65, 8)]);
    localStorage.setItem('repnote:mode', 'real');
    localStorage.setItem('repnote:v1:real', JSON.stringify(state));
    return yesterday;
  });
  await page.reload();
  const previous = page.locator('.set-row .previous');
  const add = page.getByRole('button', {name:'ベンチプレスのセットを1つ追加'});
  await expect(previous).toHaveText(['前回 60 × 8']);
  const weights = page.locator('[data-change=set-weight]');
  const firstWeight = weights.first();
  const recentOptions = 'optgroup[label="前回の重量"] option';
  await expect(firstWeight).toHaveValue('65');
  await expect(firstWeight.locator(recentOptions)).toHaveText(['55']);
  await expect(firstWeight.locator('optgroup[label="現在・近くの重量"] option[value="60"]')).toHaveCount(1);
  await firstWeight.focus();
  await expect(firstWeight.locator('[data-weight-range] option[value="20"]')).toHaveCount(1);
  await add.click();
  await add.click();
  await expect(previous.nth(2)).toBeVisible();
  await expect(previous).toHaveText(['前回 60 × 8', '前回 55 × 9', '前回 —'], {useInnerText:true});

  await page.getByRole('button', {name:'ベンチプレス セット2の詳細を編集'}).click();
  await page.getByLabel('セットの種類').selectOption('warmup');
  await page.getByRole('dialog').getByRole('button', {name:'訂正して保存'}).click();
  await expect(previous).toHaveText(['前回 60 × 8', '前回 20 × 10', '前回 55 × 9']);
  await expect(weights.nth(1).locator(recentOptions)).toHaveText(['20']);
  await weights.nth(1).selectOption('20');
  await expect(weights.nth(1)).toHaveValue('20');
  await page.getByRole('button', {name:'ベンチプレス セット2をコピー'}).click();
  await expect(previous).toHaveText(['前回 60 × 8', '前回 20 × 10', '前回 —', '前回 55 × 9'], {useInnerText:true});

  await page.getByLabel('記録する日付').fill(previousDate);
  await expect(weights.first()).toHaveValue('20');
  await expect(previous.first()).toBeHidden();
});
