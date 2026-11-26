import { expect, test } from '@playwright/test';

const history = page => page.locator('[data-action="nav"][data-view="history"]:visible').first();
const calendarDay = (page,date) => page.locator(`.calendar-day[data-date="${date}"]`);

test.beforeEach(async ({page}) => {
  await page.clock.setFixedTime(new Date('2026-11-23T12:00:00+09:00'));
  await page.goto('./');
  await page.evaluate(async () => {
    const {blankState,newSet} = await import('./core.js');
    const records = blankState();
    const meal = {meal:'朝食',basis:'serving',amount:1,kcal:210,p:8,f:2,c:40};
    records.meals['2026-10-07'] = [{...meal,id:'meal-1',name:'十月のおにぎり'}];
    records.workouts['2026-10-07'] = {title:'WORKOUT',note:'',exercises:[]};
    records.meals['2026-11-23'] = [{...meal,id:'meal-2',name:'今日のうどん'}];
    records.meals['2026-11-21'] = [{...meal,id:'meal-3',name:'トースト'}];
    records.workouts['2026-11-21'] = {title:'セットの下書き',note:'',exercises:[
      {id:'draft',exerciseId:'leg-press',sets:[newSet(55,8)]},
    ]};
    records.workouts['2026-11-22'] = {title:'WORKOUT',note:'軽めのストレッチ',exercises:[]};
    records.body = [
      {date:'2026-10-08',kg:69.2,bodyFat:18.2},
      {id:'later',date:'2026-10-08',time:'21:40',kg:70.1,bodyFat:null},
      {id:'today',date:'2026-11-23',time:'07:15',kg:68.7,bodyFat:17.9},
      {id:'yesterday',date:'2026-11-22',time:'08:12',kg:69.1,bodyFat:null},
    ];
    records.workouts['2026-11-23'] = {title:'今日の筋トレ',note:'',exercises:[
      {id:'legs',exerciseId:'leg-press',sets:[{...newSet(80,10),completed:true}]},
    ]};
    localStorage.setItem('repnote:mode','real');
    localStorage.setItem('repnote:v1:real',JSON.stringify(records));
  });
  await page.reload();
  await history(page).click();
});

test('an older food-only date opens its meals directly', async ({page}) => {
  await page.getByRole('button',{name:'前月'}).click();
  await calendarDay(page,'2026-10-07').click();
  await expect(page.getByRole('heading',{level:1})).toHaveText('食事・PFC');
  await expect(page.getByLabel('記録する日付')).toHaveValue('2026-10-07');
  await expect(page.locator('.food-item')).toHaveText(/十月のおにぎり/);
});

test('body-only dates expose all and only that day’s measurements, including an editable legacy row', async ({page}) => {
  await page.getByRole('button',{name:'前月'}).click();
  const cell = calendarDay(page,'2026-10-08');
  await expect(cell).toHaveAccessibleName(/体重2件/);
  await expect(cell.locator('.day-marks > span')).toHaveCount(1);
  await expect(page.locator('.history-calendar-footer')).toContainText('体重');
  await cell.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading',{name:/10月8日/})).toBeVisible();
  const rows = dialog.locator('.body-entry');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText(/21:40[\s\S]*70\.1/);
  await expect(rows.last()).toContainText(/時刻未記録[\s\S]*18\.2%[\s\S]*69\.2/);
  await rows.last().getByRole('button',{name:/訂正/}).click();
  await expect(dialog.getByLabel('体重（kg）',{exact:true})).toHaveValue('69.2');
  await dialog.getByLabel('体重（kg）',{exact:true}).fill('69.3');
  await dialog.getByRole('button',{name:'記録を保存'}).click();
  await cell.click();
  await expect(dialog.locator('.body-entry').last()).toContainText('69.3');
});

test('mixed dates offer every recorded type while recent workouts and empty days still open workouts directly', async ({page}) => {
  const cell = calendarDay(page,'2026-11-23');
  await expect(cell.locator('.day-marks > span')).toHaveCount(3);
  await cell.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.body-entry')).toContainText(/07:15[\s\S]*68\.7/);
  await dialog.getByRole('button',{name:/食事/}).click();
  await expect(page.locator('.food-item')).toContainText('今日のうどん');
  await history(page).click();
  await cell.click();
  await dialog.getByRole('button',{name:/トレーニング/}).click();
  await expect(page.locator('.hero-title')).toHaveText('今日の筋トレ');
  await history(page).click();
  await page.locator('.history-item').filter({hasText:'今日の筋トレ'}).click();
  await expect(page.locator('.hero-title')).toHaveText('今日の筋トレ');
  await history(page).click();
  await calendarDay(page,'2026-11-01').click();
  await expect(page.getByRole('heading',{level:1})).toHaveText('トレーニング');
  await expect(page.getByLabel('記録する日付')).toHaveValue('2026-11-01');
});

test('dates with saved workout notes or incomplete sets keep those records accessible', async ({page}) => {
  const dialog = page.getByRole('dialog');
  await calendarDay(page,'2026-11-21').click();
  await expect(dialog.getByRole('button',{name:/食事/})).toBeVisible();
  await dialog.getByRole('button',{name:/トレーニング/}).click();
  await expect(page.locator('.hero-title')).toHaveText('セットの下書き');
  await history(page).click();
  await calendarDay(page,'2026-11-22').click();
  await expect(dialog.locator('.body-entry')).toContainText('69.1');
  await dialog.getByRole('button',{name:/トレーニング/}).click();
  await expect(page.getByRole('textbox',{name:'トレーニングメモ'})).toHaveValue('軽めのストレッチ');
});
