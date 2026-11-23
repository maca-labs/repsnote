export function buildMealPhotoPrompt(note = '') {
  const details = String(note ?? '').trim();
  return [
    '添付した食事の写真を見て、写っている食品をREPS NOTEに取り込むためのJSONを作ってください。',
    '写真が届いていない、または読み取れない場合は、写真の再添付を依頼してください。',
    '栄養成分表示が読めるときは、その商品に書かれた基準量と数値を優先してください。料理の見た目や一般的な分量から概算した項目は estimated を true にして、source に推定の根拠を短く書いてください。判別できない値は null にしてください。出典や細かな数値を作ったり、不明な値を0で埋めたりしないでください。',
    '料理は食品ごとに1件とし、弁当全体とその中身のような重複は避けてください。',
    '各食品に name（食品名）、basis（1食分や1包装あたりは "serving"、100gあたりは "100g"）、portion（基準量の説明）、amount（食べた食数・包装数、100g基準なら食べたグラム数）、kcal（エネルギー）、p（たんぱく質g）、f（脂質g）、c（炭水化物g）、source（写真の栄養成分表示や推定の根拠）、estimated（推定を含むなら true）を入れてください。',
    'kcal・p・f・c は基準量あたりの値です。量はアプリで掛け算します。例えば1包装の半分を食べたときは表示値をそのまま入れて amount を0.5にしてください。食べた量がわからない場合は amount を null にしてください。',
    '食品を確認できたら、返答は {"items":[...]} のJSONを1つだけにしてください。数値には単位を付けず、estimated は文字列ではなく true または false にしてください。',
    ...(details ? ['', '食べた量・料理名などの補足', details] : []),
  ].join('\n');
}

export function validateMealPhoto(file) {
  if (!file) throw new Error('食事の写真を選んでください。');
  const type = file.type.toLowerCase();
  // Some mobile pickers supply an empty or generic MIME type, including for HEIC photos.
  const generic = type === '' || type === 'application/octet-stream';
  const image = generic ? /\.(?:jpe?g|jfif|png|webp|heic|heif|avif|gif|bmp|tiff?)$/i.test(file.name)
    : type.startsWith('image/') && type !== 'image/svg+xml';
  if (!image) throw new Error('写真の画像ファイルを選んでください。');
  if (file.size === 0) throw new Error('選んだ写真にデータがありません。別の写真を選んでください。');
  return file;
}

export function canShareMealPhoto(file, nav = navigator) {
  if (!file || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  try {
    return nav.canShare({files:[validateMealPhoto(file)]});
  } catch {
    return false;
  }
}

export async function shareMealPhoto(file, prompt, nav = navigator) {
  if (!canShareMealPhoto(file, nav)) return 'unsupported';
  try {
    // Call share during the tap, before awaiting any clipboard or file operations.
    await nav.share({files:[file], text:prompt});
    return 'shared';
  } catch (error) {
    return error?.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}
