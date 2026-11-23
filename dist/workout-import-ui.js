import {cardioDetails, fmt} from './core.js';
import {decodeWorkoutFile, parseWorkoutImport, WORKOUT_IMPORT_BYTES} from './workout-import.js';
import {inspectWorkoutBackup, isZipFile, workoutTranscriptionPrompt} from './workout-backup.js';

const normalizeName = name => name.normalize('NFKC').trim().toLowerCase();
const pageSize = 20;

function suggestedExercise(name, candidates) {
  const key = normalizeName(name);
  const sameName = candidates.filter(ex => normalizeName(ex.name) === key);
  if (sameName.length) return sameName.length === 1 ? sameName[0].id : '';
  const sameAlias = candidates.filter(ex => ex.aliases.some(alias => normalizeName(alias) === key));
  return sameAlias.length === 1 ? sameAlias[0].id : '';
}

function recordSample(row) {
  const set = row.set;
  const status = [set.completed ? '完了' : '未完了'];
  let detail;
  if (row.type === 'cardio') {
    detail = cardioDetails(set);
  } else {
    detail = `${row.needsBodyweight ? '追加重量なし（自重）' : fmt(set.kg, 6)+' kg'} × ${set.reps}回`;
    status.push(set.kind === 'warmup' ? 'ウォームアップ' : 'メイン', set.assisted ? '補助あり' : '補助なし');
    if (set.rpe != null) status.push('RPE '+set.rpe);
  }
  return `${row.date}　${row.name}　${detail}（${status.join('・')}）`;
}

function setupRecordPreview(form, rows) {
  const label = form.querySelector('[data-preview-range]');
  const list = form.querySelector('[data-preview-list]');
  const toggle = form.querySelector('[data-preview-all]');
  const controls = form.querySelector('[data-preview-pages]');
  const previous = controls.querySelector('[data-preview-prev]');
  const next = controls.querySelector('[data-preview-next]');
  let expanded = false, page = 0;
  function draw() {
    const start = expanded ? page * pageSize : 0;
    const end = Math.min(start + (expanded ? pageSize : 3), rows.length);
    label.textContent = expanded ? `全${rows.length}件中 ${start+1}～${end}件` : `取り込む表の先頭${end}件`;
    list.start = start+1;
    list.replaceChildren(...rows.slice(start,end).map(row => {
      const item = document.createElement('li');
      item.textContent = recordSample(row);
      return item;
    }));
    toggle.parentElement.hidden = rows.length <= 3;
    toggle.textContent = expanded ? '先頭3件の表示に戻す' : `全${rows.length}件を確認する`;
    toggle.setAttribute('aria-expanded', String(expanded));
    controls.hidden = !expanded || rows.length <= pageSize;
    previous.disabled = start === 0;
    next.disabled = end === rows.length;
  }
  toggle.addEventListener('click', () => { expanded = !expanded; page = 0; draw(); });
  previous.addEventListener('click', () => { page--; draw(); });
  next.addEventListener('click', () => { page++; draw(); });
  draw();
}

export function openWorkoutImport({openDialog, modal, h, bindForm, catalog, onMerge}) {
  let inputText = '';
  let skip = '__skip_workout__';
  const knownIds = new Set(catalog.map(ex => ex.id));
  while (knownIds.has(skip)) skip += '_';

  function sourceDialog() {
    openDialog('筋トレ記録を取り込む', `
      <p>CSV・TSVを選ぶか、見出しと記録を貼り付けてください。筋トレMEMOのバックアップZIPは、取り込み可能か形式を確認できます。</p>
      <form id="workout-import-source">
        <div class="form-grid">
          <div class="field full"><label for="workout-import-file">ファイルを選ぶ</label>
            <input type="file" id="workout-import-file" accept=".csv,.tsv,.txt,.zip,text/csv,text/tab-separated-values,text/plain,application/zip">
            <div data-workout-backup-note role="status" hidden></div></div>
          <div class="field full"><label for="workout-import-text">または表を貼り付ける</label>
            <textarea id="workout-import-text" rows="5" spellcheck="false" placeholder="日付,種目,重量(kg),回数&#10;2026-11-01,ベンチプレス,40,10"></textarea></div>
        </div>
        <details class="info-box" data-workout-transcription><summary>履歴画面やメモをAIで表に転記する</summary>
          <p>質問文をコピーし、使いたいAIに筋トレMEMOの履歴画像またはテキストと一緒に渡してください。返ってきた表を上の入力欄に貼り付けます。</p>
          <button class="button" type="button" data-copy-workout-transcription>転記用の質問文をコピー</button>
          <p class="small" role="status" data-copy-status></p>
          <div data-workout-manual-copy hidden><label for="workout-transcription-text">手動コピー用の質問文</label>
            <textarea id="workout-transcription-text" rows="5" readonly></textarea></div>
        </details>
        <div class="form-error" id="form-error" role="alert"></div>
        <div class="modal-actions"><button type="button" class="button" data-action="close">キャンセル</button>
          <button type="submit" class="button primary" data-preview-workouts>内容を確認</button></div>
      </form>`);
    const form = modal.querySelector('#workout-import-source');
    const fileInput = form.querySelector('#workout-import-file');
    const textInput = form.querySelector('#workout-import-text');
    const preview = form.querySelector('[data-preview-workouts]');
    const error = form.querySelector('#form-error');
    const backupNote = form.querySelector('[data-workout-backup-note]');
    const instructions = form.querySelector('[data-workout-transcription]');
    form.querySelector('[data-copy-workout-transcription]').addEventListener('click', async () => {
      const status = form.querySelector('[data-copy-status]');
      const fallback = form.querySelector('[data-workout-manual-copy]');
      try {
        await navigator.clipboard.writeText(workoutTranscriptionPrompt);
        if (!modal.open || !modal.contains(form)) return;
        fallback.hidden = true;
        status.textContent = '質問文をコピーしました。';
      } catch {
        if (!modal.open || !modal.contains(form)) return;
        fallback.hidden = false;
        const prompt = fallback.querySelector('textarea');
        prompt.value = workoutTranscriptionPrompt;
        prompt.focus();
        prompt.select();
        status.textContent = '選択した質問文をコピーしてください。';
      }
    });
    textInput.value = inputText;
    let revision = 0;
    function changed() {
      revision++;
      preview.disabled = false;
      error.textContent = '';
      backupNote.hidden = true;
    }
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) textInput.value = '';
      changed();
    });
    textInput.addEventListener('input', () => { fileInput.value = ''; changed(); });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const id = ++revision;
      const active = () => modal.open && modal.contains(form) && revision === id;
      preview.disabled = true;
      error.textContent = '';
      try {
        const file = fileInput.files[0];
        if (!file && !textInput.value.trim()) throw new Error('ファイルを選ぶか、表を貼り付けてください。');
        if (file && await isZipFile(file)) {
          const info = await inspectWorkoutBackup(file);
          if (!active()) return;
          let message;
          if (info.kind === 'other') {
            message = 'このZIPには筋トレMEMOのKintoreDBが見つかりません。CSV・TSVまたは履歴画面から転記した表を使用してください。';
          } else if (info.encrypted) {
            const encryption = info.aesBits ? `（AES-${info.aesBits}）` : '';
            const files = info.hasWal ? 'データベースと更新履歴（WAL）' : 'データベース';
            message = `筋トレMEMOの${files}が見つかりました。暗号化${encryption}のため記録は読み込んでいません。履歴画面から転記した表を貼り付けてください。`;
          } else {
            message = '筋トレMEMOのKintoreDBが含まれています。このデータベース形式の直接取り込みには対応していません。履歴画面から転記した表を貼り付けてください。';
          }
          backupNote.textContent = message;
          backupNote.hidden = false;
          instructions.open = true;
          return;
        }
        if (!active()) return;
        if (file && file.size > WORKOUT_IMPORT_BYTES) throw new Error('ファイルは16 MiB以内に分けてください。');
        const text = file ? decodeWorkoutFile(await file.arrayBuffer()) : textInput.value;
        if (!active()) return;
        const parsed = parseWorkoutImport(text);
        inputText = text;
        mappingDialog(parsed);
      } catch (err) {
        if (active()) error.textContent = err.message;
      } finally {
        if (active()) preview.disabled = false;
      }
    });
  }

  function mappingDialog(parsed, page = 0, mapping = new Map()) {
    const options = {
      strength:catalog.filter(ex => ex.load !== 'cardio'),
      cardio:catalog.filter(ex => ex.load === 'cardio'),
    };
    const bodyweightOnly = new Set(parsed.rows.filter(row => row.needsBodyweight).map(row => row.name));
    const pageCount = Math.ceil(parsed.sources.length / pageSize);
    const sources = parsed.sources.slice(page * pageSize, (page + 1) * pageSize);
    const fields = sources.map((source,index) => {
      const choices = bodyweightOnly.has(source.name)
        ? options.strength.filter(ex => ex.load === 'body') : options[source.type];
      const suggested = mapping.has(source.name) ? (mapping.get(source.name) ?? skip) : suggestedExercise(source.name,choices);
      return `<div class="field full"><label for="workout-map-${index}">${h(source.name)}（${source.count}件）</label>
        <select id="workout-map-${index}" name="map-${index}" data-map-source="${h(source.name)}" required>
          <option value="">対応する種目を選択</option>
          <option value="${skip}"${suggested === skip ? ' selected' : ''}>この種目は取り込まない</option>
          ${choices.map(ex => `<option value="${h(ex.id)}"${ex.id === suggested ? ' selected' : ''}>${h(ex.name)}（${h(ex.group)}・${h(ex.equipment)}）</option>`).join('')}
        </select>${bodyweightOnly.has(source.name) ? '<small>重量未入力の行があるため、自重種目を選べます。</small>' : ''}</div>`;
    });
    const dates = [...new Set(parsed.rows.map(row => row.date))].sort();
    const period = dates.length === 1 ? dates[0] : dates[0]+' ～ '+dates.at(-1);
    openDialog('取り込む種目を選ぶ', `
      <p>${h(period)} · ${parsed.sources.length}種目・${parsed.rows.length}件。元の種目名ごとに、記録を追加する先を選んでください。</p>
      <form id="workout-import-map">
        ${pageCount > 1 ? `<p>${page * pageSize + 1} ～ ${page * pageSize + sources.length}種目目（全${parsed.sources.length}種目）</p>` : ''}
        <div class="form-grid">${fields.join('')}</div>
        <div class="info-box"><strong data-preview-range aria-live="polite"></strong>
          <div><button type="button" class="button" aria-controls="workout-preview-rows" data-preview-all></button></div>
          <div data-preview-pages hidden>
            <button type="button" class="button" data-preview-prev>前の記録へ</button>
            <button type="button" class="button" data-preview-next>次の記録へ</button>
          </div>
          <ol data-preview-list id="workout-preview-rows"></ol>
        </div>
        ${parsed.ignoredColumns.length ? `<p class="small">取り込み対象外の列　${h(parsed.ignoredColumns.join('、'))}</p>` : ''}
        <p class="small">単位のない重量はkg、完了欄を省いた記録は完了済みとして扱います。重複した記録は追加時に照合します。</p>
        <div class="form-error" id="form-error" role="alert"></div>
        <div class="modal-actions"><button type="button" class="button" data-import-back>${page ? '前の種目へ' : '入力に戻る'}</button>
          ${page + 1 < pageCount ? '<button type="submit" class="button primary">次の種目へ</button>'
            : '<button type="submit" class="button primary" data-import-workouts>記録に追加</button>'}</div>
      </form>`);
    const form = modal.querySelector('#workout-import-map');
    setupRecordPreview(form,parsed.rows);
    function remember(data) {
      sources.forEach((source,index) => {
        const choice = data.get('map-'+index);
        mapping.set(source.name,choice === skip ? null : choice);
      });
    }
    form.querySelector('[data-import-back]').addEventListener('click', () => {
      if (!page) return sourceDialog();
      remember(new FormData(form));
      mappingDialog(parsed,page - 1,mapping);
    });
    bindForm(data => {
      remember(data);
      for (const source of sources) {
        if (mapping.get(source.name) === '') throw new Error(source.name+'の取り込み先を選んでください。');
      }
      if (page + 1 < pageCount) return mappingDialog(parsed,page + 1,mapping);
      if (![...mapping.values()].some(Boolean)) throw new Error('取り込む種目を1つ以上選んでください。');
      onMerge(parsed,mapping);
    });
  }

  sourceDialog();
}
