import {expect, test} from '@playwright/test';

const topics = ['workout', 'food', 'body', 'records', 'history'];
const helpButton = page => page.getByRole('button',{name:'使い方を動画で見る'});
const dialog = page => page.getByRole('dialog',{name:'使い方ガイド'});

test('each screen opens its own guide on a small phone without starting a download or changing records', async ({page}) => {
  await page.setViewportSize({width:320,height:568});
  const mediaRequests = [];
  page.on('request',request=>{
    if (request.url().endsWith('.mp4')) mediaRequests.push(request.url());
  });
  await page.goto('./');
  const storage = () => page.evaluate(()=>localStorage.getItem('repnote:v1:real'));
  const before = await storage();
  for (const key of topics) {
    await page.locator(`[data-action="nav"][data-view="${key}"]:visible`).click();
    const help = helpButton(page);
    await expect(help).toBeInViewport();
    await help.click();
    const guide = dialog(page);
    await expect(guide.getByLabel('動画を選ぶ')).toHaveValue(key);
    await expect(guide.locator('video')).toHaveAttribute('src',new RegExp('/help/'+key+'\\.mp4$'));
    await expect(guide.getByRole('listitem')).toHaveCount(3);
    expect(await guide.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(guide).toBeHidden();
    await expect(help).toBeFocused();
  }
  expect(mediaRequests).toEqual([]);
  expect(await storage()).toBe(before);
});

test('the five captioned clips play inline, seek, and stop on a topic change or close', async ({page}) => {
  await page.goto('./');
  await helpButton(page).click();
  const guide = dialog(page);
  const picker = guide.getByLabel('動画を選ぶ');
  for (const key of topics) {
    await picker.selectOption(key);
    const video = guide.locator('video');
    await expect(video).toHaveAttribute('playsinline','');
    await guide.getByRole('button',{name:'動画を再生'}).click();
    await expect.poll(()=>video.evaluate(el=>el.currentTime)).toBeGreaterThan(0);
    expect(await video.evaluate(el=>el.videoWidth>0 && el.duration>3)).toBe(true);
    await video.evaluate(el=>{
      el.pause();
      el.currentTime = el.duration/2;
    });
    await expect.poll(()=>video.evaluate(el=>!el.seeking && el.currentTime>=el.duration/2-.1)).toBe(true);
  }
  const oldClip = await guide.locator('video').elementHandle();
  await oldClip.evaluate(el=>el.play());
  await picker.selectOption('food');
  expect(await oldClip.evaluate(el=>el.paused)).toBe(true);
  const lastClip = await guide.locator('video').elementHandle();
  await lastClip.evaluate(el=>el.play());
  await guide.getByRole('button',{name:'閉じる'}).click();
  await expect.poll(()=>lastClip.evaluate(el=>el.paused && !el.hasAttribute('src'))).toBe(true);
});

test('when a video fails, the written guide remains available and playback can be retried', async ({page}) => {
  await page.route('**/help/workout.mp4',route=>route.abort());
  await page.goto('./');
  await helpButton(page).click();
  const guide = dialog(page);
  await guide.getByRole('button',{name:'動画を再生'}).click();
  await expect(guide.getByRole('status')).toContainText('動画を読み込めませんでした');
  await expect(guide.getByRole('listitem').first()).toContainText('種目を追加');
  await page.unroute('**/help/workout.mp4');
  await guide.getByRole('button',{name:'動画を再読み込み'}).click();
  await expect.poll(()=>guide.locator('video').evaluate(el=>el.currentTime)).toBeGreaterThan(0);
  await expect(guide.getByRole('button',{name:'動画を再読み込み'})).toBeHidden();
});
