import { CARDIO_FIELDS, localDate, parseDay, toKg, uid, validCardioValue } from './core.js';

export const WORKOUT_IMPORT_BYTES = 16 * 1024 * 1024;
const maxSets = 100000;
const plainSetId = /^[a-zA-Z0-9_.:-]{1,100}$/;

export function workoutCsvSetId(set) {
  const id = set.memoImport?.id === set.id ? (set.memoImport?.sourceId ?? set.id) : set.id;
  if (!id) return '';
  return plainSetId.test(id) ? id : '~'+JSON.stringify(id);
}

function readSetId(value, line) {
  if (!value || plainSetId.test(value)) return value;
  if (value.startsWith('~')) {
    // JSON preserves all backup IDs, including whitespace, quotes and line breaks.
    let id;
    try { id = JSON.parse(value.slice(1)); } catch { /* Report the CSV line below. */ }
    if (typeof id === 'string' && id.length <= 100 && id.trim()) return id;
  }
  fail(line,'セットIDの形式を確認してください。');
}

export function decodeWorkoutFile(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length > WORKOUT_IMPORT_BYTES) throw new Error('16 MiB以下のファイルを選んでください。');
  const bom = bytes[0] * 256 + bytes[1];
  const encodings = bom === 0xfffe ? ['utf-16le'] : bom === 0xfeff ? ['utf-16be'] : ['utf-8','shift_jis'];
  for (const encoding of encodings) {
    try { return new TextDecoder(encoding, {fatal:true}).decode(bytes); }
    catch { /* Try the other common encoding used by Japanese spreadsheet apps. */ }
  }
  throw new Error('文字コードを判別できません。UTF-8のCSVまたはTSVで保存してください。');
}

function readTable(text) {
  const firstLine = text.split(/[\r\n]/, 1)[0];
  const delimiter = firstLine.replace(/"(?:[^"]|"")*"/g, '').includes('\t') ? '\t' : ',';
  const table = [];
  let fields = [], field = '', quoted = false, closed = false, line = 1, start = 1;
  function endField() { fields.push(field); field = ''; closed = false; }
  function endRecord() {
    endField();
    if (fields.some(value => value.trim())) table.push({line:start, fields});
    fields = [];
    if (table.length > maxSets + 1) throw new Error('一度に取り込めるのは10万行までです。');
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const newline = ch === '\r' || ch === '\n';
    if (newline && ch === '\r' && text[i+1] === '\n') i++;
    if (quoted) {
      if (ch === '"' && text[i+1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else field += newline ? '\n' : ch;
    } else if (newline) {
      endRecord();
      start = line + 1;
    } else if (ch === delimiter) endField();
    else if (ch === '"' && !field && !closed) quoted = true;
    else if (closed && ch === ' ') continue;
    else if (closed || ch === '"') throw new Error(`${line}行目の引用符を確認してください。`);
    else field += ch;
    if (newline) line++;
  }
  if (quoted) throw new Error(`${start}行目の引用符が閉じていません。`);
  endRecord();
  return table;
}

const normalize = value => value.normalize('NFKC').trim().toLowerCase();
const headings = {
  date:['日付','記録日','実施日','トレーニング日','date','workout date'],
  name:['種目','種目名','エクササイズ','exercise','exercise name'],
  menu:['メニュー','メニュー名','ワークアウト名','workout','routine'],
  kg:['重量(kg)','重量kg','weight(kg)','weight kg','kg'],
  lbs:['重量(lb)','重量(lbs)','重量lb','重量lbs','weight(lb)','weight(lbs)','weight lb','weight lbs','lb','lbs'],
  weight:['重量','重さ','使用重量','weight'], unit:['単位','重量単位','unit','weight unit'],
  reps:['回数','レップ数','reps','repetitions'], count:['セット数','sets','set count'],
  completed:['完了','完了状態','completed'], kind:['種類','セット種別','セットの種類','set type'],
  assisted:['補助','補助あり','assisted'], rpe:['rpe'],
  minutes:['時間(分)','時間','分','運動時間(分)','minutes','duration(min)'],
  distanceKm:['距離(km)','距離','distance(km)','distance km'], inclinePct:['傾斜(%)','傾斜','incline(%)'],
  speedKmh:['速度(km/h)','速度','speed(km/h)'], kcal:['消費カロリー(kcal)','消費カロリー','kcal'],
  steps:['歩数','steps'], ordinal:['セット番号','set number','set no'], loadLabel:['重量の意味'],
  setId:['REPS NOTE セットID'],
};
const headerKey = value => normalize(value).replace(/[\s_]+/g,'');
const lookup = new Map(Object.entries(headings).flatMap(([key, names]) => names.map(name => [headerKey(name),key])));

function fail(line, message) { throw new Error(`${line}行目: ${message}`); }
function readNumber(raw, label, line) {
  const text = normalize(raw);
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/.test(text) || !Number.isFinite(Number(text))) {
    fail(line, `${label}は数値で入力してください。`);
  }
  return Number(text);
}
function unitOf(value, line) {
  if (!value || value === 'kg') return 'kg';
  if (value === 'lbs' || value === 'lb') return 'lbs';
  fail(line, '重量の単位はkgまたはlbsです。');
}
function readWeight(row, line) {
  const weights = [];
  const unit = normalize(row.unit ?? '');
  if (unit) unitOf(unit, line);
  // A lone unit-specific column and a separate unit field must describe the same load.
  // When both kg and lbs are present their numeric equivalence is checked below.
  if (unit && !row.weight && Boolean(row.kg) !== Boolean(row.lbs)
    && unitOf(unit,line) !== (row.kg ? 'kg' : 'lbs')) {
    fail(line, '重量の列と単位欄が一致しません。');
  }
  for (const column of ['kg','lbs','weight']) {
    if (!row[column]) continue;
    const raw = normalize(row[column]);
    const suffix = raw.match(/(kg|lbs?)$/);
    const value = readNumber(suffix ? raw.slice(0, -suffix[0].length) : raw, '重量', line);
    const declared = column === 'weight' ? unit : column;
    const actual = unitOf(suffix?.[0] || declared, line);
    if (declared && unitOf(declared,line) !== actual) fail(line, '重量の列・単位と値の単位が一致しません。');
    const kg = toKg(value,actual);
    if (kg < 0 || kg > 5000.00000001) fail(line, '重量は0～5000kgです。');
    weights.push(Math.min(kg,5000));
  }
  if (weights.some(kg => Math.abs(kg - weights[0]) > 0.05)) fail(line, 'kgとlbsの重量が一致しません。');
  return weights[0] ?? null;
}
function flag(raw, yes, no, fallback, line, label) {
  if (!raw) return fallback;
  const value = normalize(raw);
  if (yes.includes(value)) return true;
  if (no.includes(value)) return false;
  fail(line, `${label}の値を確認してください。`);
}
function dayFrom(raw, line) {
  const match = normalize(raw).match(/^(\d{4})(?:[-/.]|年)(\d{1,2})(?:[-/.]|月)(\d{1,2})日?$/);
  if (!match) fail(line, '日付は年・月・日の順に指定してください。');
  const day = match[1]+'-'+match[2].padStart(2,'0')+'-'+match[3].padStart(2,'0');
  if (localDate(parseDay(day)) !== day) fail(line,'存在しない日付です。');
  return day;
}
function parseSet(row,line) {
  const completed = flag(row.completed,['完了','済','true','1','yes'],['未完了','下書き','false','0','no'],true,line,'完了');
  const kind = normalize(row.kind ?? '');
  if (CARDIO_FIELDS.some(({key}) => row[key]) || kind === '有酸素' || kind === 'cardio') {
    if (row.reps || row.kg || row.lbs || row.weight || row.assisted || row.rpe || (kind && !['有酸素','cardio'].includes(kind))) {
      fail(line,'有酸素と筋トレの数値・種別が同じ行に混在しています。');
    }
    const set = {completed};
    for (const field of CARDIO_FIELDS) {
      const value = row[field.key] ? readNumber(row[field.key],field.label,line) : null;
      if (!validCardioValue(field,value)) fail(line, `${field.label}（${field.unit}）の値を確認してください。`);
      set[field.key] = value;
    }
    return {type:'cardio', set};
  }
  const reps = readNumber(row.reps ?? '', '回数', line);
  if (!Number.isInteger(reps) || reps < 1 || reps > 999) fail(line,'回数は1～999の整数です。');
  const kg = readWeight(row,line);
  const warmup = flag(kind,['warmup','warm-up','ウォームアップ','アップ'],['work','メイン','メインセット','通常'],false,line,'種類');
  const assisted = flag(row.assisted,['あり','補助あり','true','1','yes'],['なし','補助なし','false','0','no'],false,line,'補助');
  const rpe = row.rpe ? readNumber(row.rpe,'RPE',line) : null;
  if (rpe !== null && (rpe < 1 || rpe > 10)) fail(line,'RPEは1～10です。');
  return {type:'strength', needsBodyweight:kg === null, set:{kg:kg ?? 0,reps,completed,kind:warmup?'warmup':'work',assisted,rpe}};
}

export function parseWorkoutImport(input) {
  if (typeof input !== 'string' || input.length > WORKOUT_IMPORT_BYTES) throw new Error('16 MiB以下のCSVまたはTSVを指定してください。');
  const raw = input.replace(/^\uFEFF/,'').replace(/^[\r\n]+/,'');
  const fenced = raw.match(/^```(?:csv|tsv|text|plaintext)?[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t\r\n]*$/i);
  const table = readTable(fenced ? fenced[1] : raw);
  const columns = table[0]?.fields ?? [];
  const keys = columns.map(name => lookup.get(headerKey(name)));
  if (columns.some(name => headerKey(name) === 'セット' || headerKey(name) === 'set')) {
    throw new Error('「セット」列は、行番号なら「セット番号」、同じセットの繰り返しなら「セット数」にしてください。');
  }
  const known = keys.filter(Boolean);
  if (new Set(known).size !== known.length) throw new Error('同じ項目の列が複数あります。');
  if (!keys.includes('date') || !keys.includes('name') || !(keys.includes('reps') || keys.includes('minutes'))) {
    throw new Error('先頭行に「日付」「種目」と「回数」または「時間(分)」が必要です。');
  }
  const native = keys.includes('loadLabel') && keys.includes('kg') && keys.includes('lbs');
  const unquoteExport = value => native ? value.replace(/^'(?=[=+@-])/,'') : value;
  const ignoredColumns = columns.filter((_, index) => !keys[index]);
  const rows = [], sources = new Map(), setIds = new Set();
  for (const {line, fields} of table.slice(1)) {
    if (fields.length !== keys.length) fail(line,'項目数が見出しと異なります。');
    const data = Object.fromEntries(known.map(key => [key, fields[keys.indexOf(key)].trim()]));
    const name = unquoteExport(data.name);
    if (!name || name.length > 250) fail(line,'種目名は1～250文字です。');
    const menu = unquoteExport(data.menu ?? '');
    if (menu.length > 80) fail(line,'メニュー名は80文字までです。');
    const date = dayFrom(data.date,line);
    const parsed = parseSet(data,line);
    const count = data.count ? readNumber(data.count,'セット数',line) : 1;
    if (!Number.isInteger(count) || count < 1 || count > 50000 || rows.length + count > maxSets) fail(line,'セット数を確認してください（一度に10万件まで）。');
    const setId = readSetId(unquoteExport(data.setId ?? ''),line);
    if (setId) {
      if (count !== 1) fail(line,'セットIDは1セットにつき1つ指定してください。');
      if (setIds.has(setId)) fail(line,'CSV内のセットIDが重複しています。');
      setIds.add(setId);
    }
    const source = sources.get(name) ?? {name,type:parsed.type,count:0};
    if (source.type !== parsed.type) fail(line,'同名の種目に筋トレと有酸素が混在しています。種目名を分けてください。');
    source.count += count;
    sources.set(name,source);
    for (let i = 0; i < count; i++) rows.push({line,date,name,menu,setId,...parsed});
  }
  if (!rows.length) throw new Error('取り込むセットがありません。');
  return {rows,sources:[...sources.values()],ignoredColumns};
}

function setSignature(set) {
  const fields = Object.hasOwn(set, 'minutes') ? CARDIO_FIELDS.map(field => field.key) : ['kg','reps','kind','assisted','rpe'];
  return JSON.stringify([set.completed,...fields.map(key => set[key] ?? null)]);
}

export function mergeWorkoutImport(state, parsed, mapping, catalog) {
  const exercises = new Map(catalog.map(ex => [ex.id,ex]));
  const groups = new Map();
  let skipped = 0, duplicates = 0, added = 0, linked = 0;
  for (const row of parsed.rows) {
    if (!mapping.has(row.name)) fail(row.line, `「${row.name}」の取り込み先を選んでください。`);
    const id = mapping.get(row.name);
    if (id === null) { skipped++; continue; }
    const exercise = exercises.get(id);
    if (!exercise || (exercise.load === 'cardio') !== (row.type === 'cardio')) fail(row.line,'取り込み先の種目の種類が一致しません。');
    if (row.needsBodyweight && exercise.load !== 'body') fail(row.line,'重量が空欄です。自重種目を選ぶか重量を入力してください。');
    const key = JSON.stringify([row.date,id]);
    if (!groups.has(key)) groups.set(key,{id,date:row.date,menu:row.menu,rows:[]});
    groups.get(key).rows.push(row);
  }
  // Work on a separate state. A rejected row, failed validation or cancelled preview cannot alter the journal.
  const next = structuredClone(state);
  const owners = new Map();
  for (const [date,workout] of Object.entries(next.workouts)) {
    for (const entry of workout.exercises) {
      owners.set(entry.id,null);
      for (const set of entry.sets) {
        const owner = {date,exerciseId:entry.exerciseId};
        owners.set(set.id,owner);
        if (set.memoImport?.id === set.id && set.memoImport.sourceId) owners.set(set.memoImport.sourceId,owner);
      }
    }
  }
  for (const {id,date,menu,rows} of groups.values()) {
    const workout = next.workouts[date] ??= {title:menu || 'WORKOUT',note:'',exercises:[]};
    const matching = workout.exercises.filter(entry => entry.exerciseId === id);
    let destination = matching[0];
    const occurrence = new Map();
    const incoming = rows.map(row => {
      const signature = setSignature(row.set);
      const key = JSON.stringify([row.name,signature]);
      const n = (occurrence.get(key) ?? 0) + 1;
      occurrence.set(key,n);
      return {...row,signature,receipt:JSON.stringify([row.name,signature,n])};
    });
    const expected = new Set(incoming.filter(item => !item.setId).map(item => item.receipt));
    const identified = new Set(incoming.map(item => item.setId).filter(Boolean));
    const imported = new Set(), existing = new Map(), unmatched = [];
    for (const entry of matching) {
      for (const set of entry.sets) {
        // Copied drafts have a new id; only the original row owns its receipt.
        const prior = set.memoImport?.id === set.id ? set.memoImport : null;
        if (identified.has(set.id) || identified.has(prior?.sourceId)) continue;
        if (prior && expected.has(prior.receipt) && !imported.has(prior.receipt)) imported.add(prior.receipt);
        else unmatched.push(set);
      }
    }
    // Reserve original receipts first. A set can satisfy only one CSV row in this import.
    for (const set of unmatched) {
      const aliases = set.memoImport?.id === set.id ? set.memoImport.additionalReceipts : null;
      const receipt = aliases?.find(value => expected.has(value) && !imported.has(value));
      if (receipt) {
        imported.add(receipt);
        continue;
      }
      const signature = setSignature(set);
      if (!existing.has(signature)) existing.set(signature,[]);
      existing.get(signature).push(set);
    }
    for (const {set,setId,signature,receipt,line} of incoming) {
      if (setId && owners.has(setId)) {
        const owner = owners.get(setId);
        if (owner?.date !== date || owner.exerciseId !== id) fail(line,'同じセットIDが別の日付または別の種目で使われています。取り込み先を確認してください。');
        duplicates++;
        continue;
      }
      if (!setId) {
        if (imported.has(receipt)) { duplicates++; continue; }
        const match = existing.get(signature)?.pop();
        if (match) {
          if (match.memoImport?.id !== match.id) {
            match.memoImport = {id:match.id,receipt};
            linked++;
          } else if (match.memoImport.receipt !== receipt && !match.memoImport.additionalReceipts?.includes(receipt)) {
            (match.memoImport.additionalReceipts ??= []).push(receipt);
            linked++;
          }
          duplicates++;
          continue;
        }
      }
      if (!destination) {
        destination = {id:uid(),exerciseId:id,note:'',sets:[]};
        workout.exercises.push(destination);
      }
      const recordId = setId && plainSetId.test(setId) ? setId : uid();
      const memoImport = {id:recordId,receipt};
      if (setId && setId !== recordId) memoImport.sourceId = setId;
      destination.sets.push({...set,id:recordId,memoImport});
      added++;
    }
  }
  return {state:next,added,duplicates,skipped,linked};
}
