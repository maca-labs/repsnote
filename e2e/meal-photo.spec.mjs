import {expect, test} from '@playwright/test';

const food = page => page.locator('[data-action="nav"][data-view="food"]:visible').first().click();
const response = JSON.stringify({items:[
  {name:'カレーライス',basis:'100g',amount:200,kcal:160,p:4,f:5,c:25,estimated:true,source:'料理写真からの推定'},
  {name:'サラダ',basis:'serving',amount:1,kcal:50,p:2,f:1,c:8,estimated:true},
]});

async function openPhotoImport(page, date) {
  await page.goto('./');
  await page.getByRole('button',{name:'自分の記録をはじめる'}).click();
  await expect(page.locator('.demo-banner')).toHaveCount(0);
  await food(page);
  if (date) await page.getByLabel('記録する日付').fill(date);
  await page.locator('[data-action="meal-import"]').click();
  await page.locator('[data-meal-mode="photo"]').click();
}

async function choosePhoto(page, buttonName='写真を選ぶ') {
  const png = await page.evaluate(()=>{
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 48;
    const paint = canvas.getContext('2d');
    paint.fillStyle = '#dec'; paint.fillRect(0,0,64,48);
    paint.fillStyle = '#a63'; paint.fillRect(8,8,36,28);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const buffer = Buffer.from(png,'base64');
  const [picker] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button',{name:buttonName,exact:true}).click(),
  ]);
  await picker.setFiles({name:'test-meal.png',mimeType:'image/png',buffer});
  await expect(page.locator('#meal-photo-preview')).toBeVisible();
  await expect.poll(()=>page.locator('#meal-photo-preview').evaluate(img=>img.naturalWidth)).toBe(64);
  return png;
}

test('a selected photo is shared on request, then the reviewed result is saved once for the original date', async ({page}) => {
  await page.addInitScript(()=>{
    window.sentMeals = [];
    Object.defineProperties(navigator,{
      canShare:{value:data=>data.files?.length===1},
      share:{value:async data=>{
        window.sentMeals.push({text:data.text, names:data.files.map(file=>file.name)});
      }},
    });
  });
  const date = '2024-05-16';
  await openPhotoImport(page,date);
  await choosePhoto(page,'カメラで撮る');
  await page.locator('#meal-query').fill('ごはんは半分残しました');
  expect(await page.evaluate(()=>window.sentMeals.length)).toBe(0);
  await page.locator('[data-meal-photo-share]').click();
  const [sent] = await page.evaluate(()=>window.sentMeals);
  expect(sent.names).toEqual(['test-meal.png']);
  expect(sent.text).toContain('ごはんは半分残しました');
  expect(sent.text).toContain('items');
  await page.locator('#meal-response').fill(response);
  await page.getByRole('button',{name:'読み込んで確認'}).click();
  await page.locator('#meal-type-0').selectOption('夕食');
  await page.locator('#meal-scale-0').selectOption('0.5');
  await page.locator('[name="include-1"]').uncheck();
  await expect(page.locator('#meal-import-total')).toContainText('160 kcal');
  await page.reload();
  await expect(page.locator('#meal-import-review')).toBeVisible();
  await expect(page.locator('#modal')).toContainText(date);
  await expect(page.locator('#meal-type-0')).toHaveValue('夕食');
  await expect(page.locator('#meal-scale-0')).toHaveValue('0.5');
  await expect(page.locator('[name="include-1"]')).not.toBeChecked();
  await expect(page.locator('.food-item')).toHaveCount(0);
  await page.getByRole('button',{name:'選んだ食事を一括保存'}).click();
  await expect(page.locator('#modal')).toBeHidden();
  await page.reload();
  await food(page);
  await expect(page.locator('#modal')).toBeHidden();
  await expect(page.locator('.food-item')).toHaveCount(0);
  await page.getByLabel('記録する日付').fill(date);
  await expect(page.locator('.food-item')).toHaveCount(1);
  const dinner = page.locator('.meal-section').filter({has:page.getByText('夕食',{exact:true})});
  await expect(dinner.locator('.food-item')).toContainText('カレーライス');
  await expect(dinner.locator('.food-value')).toHaveText('160 kcal');
});

test('manual handoff preserves the return form through an AI tab and reload without storing the image', async ({context,page}) => {
  await page.addInitScript(result=>{
    Object.defineProperties(navigator,{
      canShare:{value:()=>false},
      clipboard:{value:{
        writeText:async text=>{window.copiedMealPrompt=text;},
        readText:async ()=>result,
      }},
    });
  },response);
  // Exercise the link and return without contacting the external service.
  await context.route('https://chatgpt.com/**',route=>route.fulfill({contentType:'text/html',body:'<title>AI test page</title>'}));
  await openPhotoImport(page);
  await expect(page.locator('#meal-photo-camera')).toHaveAttribute('capture','environment');
  const png = await choosePhoto(page);
  await page.locator('[data-meal-photo-clear]').click();
  await expect(page.locator('#meal-photo-preview')).toBeHidden();
  await choosePhoto(page);
  await page.locator('#meal-query').fill('サラダもあります');
  await page.locator('#meal-group').selectOption('朝食');
  await expect(page.locator('[data-meal-photo-share]')).toBeHidden();
  await page.locator('[data-meal-prompt]').click();
  const prompt = await page.evaluate(()=>window.copiedMealPrompt);
  expect(prompt).toContain('サラダもあります');
  expect(prompt).toContain('写真');
  const [ai] = await Promise.all([
    context.waitForEvent('page'),
    page.locator('#modal a[href^="https://chatgpt.com"]').click(),
  ]);
  await expect(ai).toHaveTitle('AI test page');
  await ai.close();
  await page.reload();
  await expect(page.locator('#meal-query')).toHaveValue('サラダもあります');
  await expect(page.locator('#meal-group')).toHaveValue('朝食');
  expect(await page.locator('#meal-photo-file').evaluate(input=>input.files.length)).toBe(0);
  await expect(page.locator('#meal-photo-preview')).toBeHidden();
  const stored = await page.evaluate(()=>JSON.stringify([Object.entries(sessionStorage),Object.entries(localStorage)]));
  expect(stored).not.toContain(png);
  expect(stored).not.toContain('blob:');
  await page.locator('[data-meal-paste]').click();
  await expect(page.locator('#meal-response')).toHaveValue(response);
  await page.reload();
  await expect(page.locator('#meal-response')).toHaveValue(response);
  await page.getByRole('button',{name:'読み込んで確認'}).click();
  await expect(page.locator('#meal-type-0')).toHaveValue('朝食');
  await expect(page.locator('[data-meal-row]')).toHaveCount(2);
  await page.locator('#modal').getByRole('button',{name:'閉じる'}).click();
  await page.reload();
  await food(page);
  await expect(page.locator('#modal')).toBeHidden();
  await expect(page.locator('.food-item')).toHaveCount(0);
});
