import { expect, test } from '@playwright/test';

test('a maintenance plan shows the measured difference on screen, in the post and on the image', async ({page}) => {
  await page.clock.setFixedTime(new Date('2026-11-23T12:00:00+09:00'));
  await page.addInitScript(() => {
    const paint = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      if (this.canvas.id === 'share-canvas') (this.canvas.words ??= []).push(text);
      return paint.call(this,text,...args);
    };
  });
  await page.goto('./');
  await page.getByRole('button',{name:'自分の記録をはじめる'}).click();
  await page.locator('[data-action="nav"][data-view="body"]:visible').first().click();
  await page.getByRole('button',{name:'計画をつくる'}).click();
  const dialog=page.getByRole('dialog');
  await dialog.locator('[name="startWeight"]').fill('70');
  await dialog.locator('[name="targetWeight"]').fill('70');
  await dialog.getByRole('button',{name:'計画を保存'}).click();
  const plan=page.locator('aside .panel').filter({has:page.getByRole('heading',{name:'ボディメイク計画'})});
  const post=dialog.locator('#share-text');
  const canvas=dialog.locator('#share-canvas');
  const weights=dialog.getByRole('checkbox',{name:'重量・体重を表示'});

  async function checkMeasured(value) {
    await expect(plan).toContainText('目標との差');
    await expect(plan).toContainText(value);
    await expect(plan.locator('.progress-track')).toHaveCount(0);
    await plan.getByRole('button',{name:'計画をシェア'}).click();
    await weights.check();
    expect(await post.inputValue()).toContain(value);
    const image = await canvas.evaluate(el=>el.words);
    expect(image).toContain(value);
    expect(image).toContain('目標との差');
    expect(image).not.toContain('100%');
  }

  await checkMeasured('開始後は未測定');
  await dialog.getByRole('button',{name:'閉じる'}).click();
  await page.getByRole('button',{name:'体重を記録',exact:true}).click();
  await dialog.getByLabel('体重（kg）',{exact:true}).fill('71');
  await dialog.getByRole('button',{name:'記録を保存'}).click();
  await checkMeasured('+1 kg');
  await canvas.evaluate(el=>{el.words=[];});
  await weights.uncheck();
  const hiddenPost=await post.inputValue();
  const hiddenImage=await canvas.evaluate(el=>el.words.join(' '));
  for (const content of [hiddenPost,hiddenImage]) {
    expect(content).toContain('体重維持');
    expect(content).not.toMatch(/目標との差|100%|\+1\b|\bkg\b|\b7[01]\b/);
  }
});
