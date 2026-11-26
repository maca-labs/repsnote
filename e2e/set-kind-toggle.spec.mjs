import { expect, test } from '@playwright/test';

test.use({hasTouch:true});

test('tapping a set number switches its kind and updates comparisons and the personal best', async ({page}) => {
  await page.clock.setFixedTime(new Date('2026-11-26T12:00:00+09:00'));
  await page.goto('./');
  await page.evaluate(async () => {
    const {blankState, newSet, uid} = await import('./core.js');
    const state = blankState();
    function workout(sets) {
      return {title:'ベンチプレス', note:'', exercises:[{id:uid(), exerciseId:'barbell-bench', note:'', sets}]};
    }
    state.workouts['2026-11-25'] = workout([
      {...newSet(20, 10), kind:'warmup', completed:true},
      {...newSet(60, 8), completed:true},
      {...newSet(55, 9), completed:true},
    ]);
    state.workouts['2026-11-26'] = workout([
      {...newSet(70, 6), completed:true, rpe:8},
      newSet(65, 7),
    ]);
    localStorage.setItem('repnote:mode', 'real');
    localStorage.setItem('repnote:v1:real', JSON.stringify(state));
  });
  await page.reload();
  const rows = page.locator('.set-row');
  const first = rows.first();
  const toggle = first.getByRole('button', {name:'ベンチプレス セット1のウォームアップ', exact:true});
  const previous = rows.locator('.previous');
  const savedSets = () => page.evaluate(() =>
    JSON.parse(localStorage.getItem('repnote:v1:real')).workouts['2026-11-26'].exercises[0].sets);
  const original = await savedSets();

  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle).toHaveText('1');
  await expect(previous).toHaveText(['前回 60 × 8', '前回 55 × 9']);
  await expect(first.locator('.tiny-crown')).toHaveCount(1);

  await toggle.tap();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(toggle).toHaveText('W');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(previous).toHaveText(['前回 20 × 10', '前回 60 × 8']);
  await expect(first.locator('.tiny-crown')).toHaveCount(0);
  await expect(first.locator('[data-change="set-weight"]')).toHaveValue('70');
  await expect(first.locator('[data-change="set-reps"]')).toHaveValue('6');
  await expect(first.getByRole('button', {name:'ベンチプレス セット1を未完了にする'})).toHaveAttribute('aria-pressed', 'true');
  expect(await savedSets()).toEqual([{...original[0], kind:'warmup'}, original[1]]);

  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.press('Space');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(toggle).toHaveText('1');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(previous).toHaveText(['前回 60 × 8', '前回 55 × 9']);
  await expect(toggle).toBeFocused();
  await expect(first.locator('.tiny-crown')).toHaveCount(1);
  expect(await savedSets()).toEqual(original);
});
