import { test, expect } from '@playwright/test';

test('the selected month has the same completed cardio totals in history, the post and the image', async ({page}) => {
  await page.clock.setFixedTime(new Date('2026-11-23T12:00:00+09:00'));
  await page.addInitScript(() => {
    const paintText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (value, ...args) {
      if (this.canvas.id === 'share-canvas') (this.canvas.paintedLabels ??= []).push(String(value));
      return paintText.call(this,value,...args);
    };
  });
  await page.goto('./');
  await page.evaluate(async () => {
    const {blankState,newCardioSet,uid} = await import('./core.js');
    const state = blankState();
    function run(date, ...sets) {
      state.workouts[date] = {title:'RUN',note:'',exercises:[{
        id:uid(),exerciseId:'cardio-running',note:'',
        sets:sets.map(([minutes,distanceKm,completed=true])=>({...newCardioSet(),minutes,distanceKm,completed})),
      }]};
    }
    run('2026-11-01',[25,4],[5,null]);
    run('2026-11-08',[15,2.25],[80,16,false]);
    run('2026-10-31',[32,null],[20,3,false]);
    localStorage.setItem('repnote:mode','real');
    localStorage.setItem('repnote:v1:real',JSON.stringify(state));
  });
  await page.reload();
  await page.locator('[data-action="nav"][data-view="history"]:visible').first().click();

  async function checkMonth(expectedTime, expectedDistance) {
    const summary = page.locator('aside .panel').filter({has:page.getByRole('heading',{name:/^\d+月の記録$/})});
    await expect(summary).toContainText(expectedTime);
    const history = await summary.innerText();
    await page.getByRole('button',{name:'月間まとめをシェア'}).click();
    const post = page.locator('#share-text');
    await expect(post).toHaveValue(expectedTime);
    const image = await page.locator('#share-canvas').evaluate(canvas=>canvas.paintedLabels.join(' '));
    for (const text of [history, await post.inputValue(), image]) {
      expect(text).toMatch(expectedTime);
      if (expectedDistance) {
        expect(text).toContain('有酸素の合計距離');
        expect(text).toMatch(expectedDistance);
      } else {
        expect(text).not.toContain('有酸素の合計距離');
        expect(text).not.toMatch(/\bkm\b/);
      }
    }
    await page.getByRole('dialog').getByRole('button',{name:'閉じる'}).click();
  }
  await checkMonth(/\b45\s*分/,/\b6\.25\s*km（記録分）/);
  await page.getByRole('button',{name:'前月'}).click();
  await checkMonth(/\b32\s*分/);
});
