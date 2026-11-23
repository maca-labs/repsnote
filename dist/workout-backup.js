const zipEntry = 0x02014b50;
const endOfDirectory = 0x06054b50;
const endLength = 22;

function invalidZip() {
  throw new Error('ZIPの目次を読み取れません。ファイルの種類と、書き出しが完了しているかを確認してください。');
}

async function viewOf(blob) {
  return new DataView(await blob.arrayBuffer());
}

export async function isZipFile(file) {
  if (/\.zip$/i.test(file.name ?? '')) return true;
  if (file.size < 4) return false;
  const start = await viewOf(file.slice(0,4));
  return [0x04034b50,endOfDirectory,0x08074b50].includes(start.getUint32(0,true));
}

async function findDirectoryEnd(file) {
  if (file.size < endLength) invalidZip();
  const last = await viewOf(file.slice(-endLength));
  if (last.getUint32(0,true) === endOfDirectory && last.getUint16(20,true) === 0) {
    return {view:last, offset:file.size-endLength};
  }
  // A standard ZIP comment can precede the end of the file by up to 65,535 bytes.
  const start = Math.max(0,file.size - endLength - 0xffff);
  const tail = await viewOf(file.slice(start));
  for (let i = tail.byteLength-endLength; i >= 0; i--) {
    if (tail.getUint32(i,true) === endOfDirectory && i+endLength+tail.getUint16(i+20,true) === tail.byteLength) {
      return {view:new DataView(tail.buffer, i, endLength), offset:start+i};
    }
  }
  invalidZip();
}

function encryptionInfo(view, begin, end, offset) {
  const encrypted = Boolean(view.getUint16(offset+8,true) & 1);
  for (let i = begin; i < end;) {
    if (i+4 > end) invalidZip();
    const id = view.getUint16(i,true), length = view.getUint16(i+2,true);
    const data = i+4;
    if (data+length > end) invalidZip();
    if (id === 0x9901 && length >= 7 && view.getUint16(data+2,false) === 0x4145) {
      const aesBits = [null,128,192,256][view.getUint8(data+4)] ?? null;
      return {encrypted:true, aesBits};
    }
    i = data+length;
  }
  return {encrypted:encrypted || view.getUint16(offset+10,true) === 99, aesBits:null};
}

// Inspect only the index. Never open a database, WAL, or other file inside the archive.
export async function inspectWorkoutBackup(file) {
  const {view:end, offset} = await findDirectoryEnd(file);
  const count = end.getUint16(10,true);
  const length = end.getUint32(12,true), start = end.getUint32(16,true);
  if (count === 0xffff || length === 0xffffffff || start === 0xffffffff) {
    throw new Error('ZIP64形式のバックアップには対応していません。履歴画面から表に転記できます。');
  }
  if (end.getUint16(4,true) || end.getUint16(6,true) || end.getUint16(8,true) !== count) {
    throw new Error('分割ZIPには対応していません。');
  }
  if (start+length > offset || count*46 > length) invalidZip();
  if (length > 16*1024*1024) throw new Error('ZIPの目次が大きすぎます。履歴画面から表に転記できます。');
  const index = await viewOf(file.slice(start,start+length));
  const decoder = new TextDecoder();
  const databases = new Map(), journals = new Map();
  let pos = 0;
  for (let n = 0; n < count; n++) {
    if (pos+46 > length || index.getUint32(pos,true) !== zipEntry) invalidZip();
    const nameSize = index.getUint16(pos+28,true), extraSize = index.getUint16(pos+30,true);
    const extra = pos+46+nameSize, next = extra+extraSize+index.getUint16(pos+32,true);
    if (next > length) invalidZip();
    const path = decoder.decode(new Uint8Array(index.buffer, pos+46, nameSize)).replaceAll('\\','/');
    if (/(?:^|\/)KintoreDB(?:-wal)?$/i.test(path)) {
      const info = encryptionInfo(index,extra,extra+extraSize,pos);
      const key = path.toLowerCase();
      if (key.endsWith('-wal')) journals.set(key.slice(0,-4),info);
      else databases.set(key,info);
    }
    pos = next;
  }
  let hasWal = false, encrypted = false;
  const strengths = new Set();
  for (const [path, database] of databases) {
    const journal = journals.get(path);
    if (journal) hasWal = true;
    for (const entry of [database,journal]) {
      if (!entry?.encrypted) continue;
      encrypted = true;
      strengths.add(entry.aesBits);
    }
  }
  return {kind:databases.size ? 'kintore' : 'other', encrypted, hasWal,
    aesBits:strengths.size === 1 ? [...strengths][0] : null};
}

export const workoutTranscriptionPrompt = `添付する筋トレの履歴画面またはテキストを、REPS NOTEに取り込めるタブ区切り（TSV）の表に転記してください。
次の見出しをそのまま使い、読み取れた実績を1セットずつ元の順序で書いてください。
日付\t種目\t重量\t単位\t回数\t完了\t種類\t補助\t時間(分)\t距離(km)\t傾斜(%)\t速度(km/h)\t消費カロリー(kcal)\t歩数
日付は年・月・日が確定できる場合だけYYYY-MM-DDで記載してください。筋トレは重量と単位（kg/lbs）、回数を元の表示どおりに転記します。片手分・両手分、自重・追加重量・体重を混同せず、自重のみと明記された行は重量と単位を空欄にします。種類は「メイン」または「ウォームアップ」、補助は「あり」または「なし」とします。時間から歩数までの有酸素用の列は空欄です。
有酸素は種類を「有酸素」、重量・単位・回数・補助をすべて空欄にします。時間は分で必須です。距離・傾斜・速度・消費カロリー・歩数は明記された値だけを各列の単位で転記し、不明な任意項目は空欄にしてください。数値欄に単位や「不明」を書かず、空欄に0を補わないでください。
予定・目標と完了済みの記録を区別してください。合計ボリューム、最高重量、平均値や集計グラフから個々のセットや回数を推測しないでください。セット数が曖昧なときは行を複製しないでください。複数の画像に同じ記録が重なる場合や、日付、単位、重量の意味、セット内容、ウォームアップや補助の扱いが曖昧な場合は、表を作る前にその箇所を質問してください。
完了状態は「完了」または「未完了」とします。記載がない属性を推測せず、必要なら先に確認してください。確定できた行だけを、説明やコードフェンスを付けずTSVで出力してください。`;
