import { fmt, mealTotals } from './core.js';
import { buildMealSearchPrompt, mealGroups, nutrients, parseMealResponse, reconcileMealReview, reviewedMealDraft, mealImportEntry, prepareMealImport } from './meal-import.js';
import { buildMealPhotoPrompt, validateMealPhoto, canShareMealPhoto, shareMealPhoto } from './meal-photo.js';

function nutritionLabel(values) {
  return `${fmt(values.kcal, 1)} kcal / P ${fmt(values.p, 1)}・F ${fmt(values.f, 1)}・C ${fmt(values.c, 1)} g`;
}

export function openMealImport({day,modal,openDialog,bindForm,h,toast,onSave,draft,onDraftChange=()=>{}}) {
  let mode = draft?.mode === 'photo' ? 'photo' : 'text';
  let menu = draft?.menu ?? '', response = draft?.response ?? '', group = draft?.group ?? '昼食';
  let previousReview = draft?.previousReview ?? [];
  let photo, previewUrl, currentForm;
  const lifetime = new AbortController();
  function persist(stage) {
    if (!lifetime.signal.aborted && mode === 'photo') onDraftChange({mode,menu,response,group,stage,previousReview});
  }
  function releasePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  function dispose() {
    lifetime.abort();
    releasePreview();
    photo = null;
    if (modal.contains(currentForm) && mode === 'photo') onDraftChange(null);
  }
  const listeners = {signal:lifetime.signal};
  // Clear on dismissal itself: a user can reload before the queued close event arrives.
  modal.addEventListener('beforetoggle', event => {
    if (event.newState === 'closed' && modal.contains(currentForm)) dispose();
  }, listeners);
  // Older dialogs do not dispatch beforetoggle. The app's backdrop handler closes on click.
  modal.addEventListener('click', event => {
    if (modal.contains(currentForm) && (!modal.open || event.target.closest('[data-action="close"]'))) dispose();
  }, listeners);
  modal.addEventListener('cancel', event => {
    if (modal.contains(currentForm) && !event.defaultPrevented) dispose();
  }, listeners);
  modal.addEventListener('close', () => {
    if (!modal.open || !modal.contains(currentForm)) dispose();
  }, listeners);
  const cancel = '<button type="button" class="button" data-action="close">キャンセル</button>';
  const errorArea = '<div id="form-error" class="form-error" role="alert"></div>';
  const mealOptions = choice => mealGroups.map(meal =>
    `<option${meal === choice ? ' selected' : ''}>${meal}</option>`).join('');

  function start() {
    releasePreview();
    const fromPhoto = mode === 'photo';
    openDialog('AIで食事を一括取り込み', `<form id="meal-import-source" data-food-draft>
      <div class="meal-source-switch" role="group" aria-label="取り込み方法">
        <button type="button" data-meal-mode="text" aria-pressed="${!fromPhoto}">メニュー名から</button>
        <button type="button" data-meal-mode="photo" aria-pressed="${fromPhoto}">写真から</button>
      </div>
      ${fromPhoto ? `<div class="meal-source-section">
        <div class="meal-source-heading"><h3>食事の写真をAIに渡す</h3>
          <button type="button" class="text-button" data-meal-jump>回答欄へ ↓</button></div>
        <div class="meal-source-actions">
          <button type="button" class="button" data-photo-pick="meal-photo-file">写真を選ぶ</button>
          <button type="button" class="button" data-photo-pick="meal-photo-camera">カメラで撮る</button>
        </div>
        <input type="file" id="meal-photo-file" accept="image/*,.heic,.heif" aria-label="食事の写真を選ぶ" hidden>
        <input type="file" id="meal-photo-camera" accept="image/*" capture="environment" aria-label="食事を撮影する" hidden>
        <div class="meal-photo-selection" hidden><img id="meal-photo-preview" alt="選んだ食事の写真">
          <div><span data-photo-name></span><span data-photo-preview-error hidden>この形式のプレビューは表示できません。</span>
          <div class="meal-source-actions"><a class="text-button" data-meal-photo-download>写真を保存</a>
          <button type="button" class="text-button" data-meal-photo-clear>写真を外す</button></div></div></div>
        </div>` : '<p class="meal-source-note">食べたものを入力し、質問文を検索できるAIに貼り付けてください。</p>'}
      <div class="field"><label for="meal-query">${fromPhoto ? '料理名・食べた量の補足（任意）' : '食べたもの'}</label>
      <textarea id="meal-query" rows="2" maxlength="5000" placeholder="${fromPhoto ? '例：ごはんは半分だけ食べました' : 'セブンイレブンの幕の内弁当、バナナ1本'}">${h(menu)}</textarea></div>
      ${fromPhoto ? '<button type="button" class="button primary" data-meal-photo-share hidden>写真と質問文を共有</button>' : ''}
      ${fromPhoto ? '<p class="meal-source-note" data-meal-photo-manual></p>' : ''}
      <div class="meal-source-actions"><button type="button" class="button" data-meal-prompt>AIへの質問文をコピー</button>
        ${fromPhoto ? '<a class="button" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">ChatGPTを開く</a>' : ''}</div>
      ${fromPhoto ? '<p class="meal-source-note" data-meal-photo-status role="status"></p>' : ''}
      <div id="meal-prompt-fallback" hidden><div class="field"><label for="meal-prompt-text">コピーする質問文</label><textarea id="meal-prompt-text" readonly rows="4"></textarea></div></div>
      <section class="meal-return"><h3>${fromPhoto ? 'AIの回答をここに戻す' : 'AIの回答を取り込む'}</h3>
      <div class="field"><label for="meal-response">AIからの回答（JSON）</label>
        <textarea id="meal-response" name="response" rows="3" required placeholder="AIから返ってきたJSON全体を貼り付け">${h(response)}</textarea></div>
      <button type="button" class="text-button" data-meal-paste>回答を貼り付ける</button></section>
      <div class="field"><label for="meal-group">食事区分</label><select id="meal-group" name="group">${mealOptions(group)}</select></div>
      ${errorArea}<div class="modal-actions">${cancel}<button class="button primary" type="submit">読み込んで確認</button></div></form>`);
    const form = currentForm = modal.querySelector('#meal-import-source');
    const query = form.querySelector('#meal-query');
    const answer = form.querySelector('#meal-response');
    function remember() {
      menu = query.value; response = answer.value; group = form.querySelector('#meal-group').value;
      persist('source');
    }
    form.oninput = form.onchange = remember;
    for (const button of form.querySelectorAll('[data-meal-mode]')) {
      button.onclick = () => {
        if (button.dataset.mealMode === mode) return;
        remember();
        mode = button.dataset.mealMode;
        if (mode === 'text') onDraftChange(null);
        start();
        currentForm.querySelector('[aria-pressed="true"]').focus();
      };
    }
    if (fromPhoto) {
      form.querySelector('[data-meal-jump]').onclick = () => {
        answer.focus({preventScroll:true});
        form.querySelector('.meal-return').scrollIntoView({block:'start'});
      };
      form.querySelector('a[target="_blank"]').onclick = () => {
        form.querySelector('.meal-return').scrollIntoView({block:'start'});
      };
      wirePhoto(form, query);
    }
    form.querySelector('[data-meal-prompt]').onclick = async () => {
      let prompt;
      try { prompt = fromPhoto ? buildMealPhotoPrompt(query.value) : buildMealSearchPrompt(query.value); }
      catch (err) { query.focus(); toast(err.message); return; }
      const fallback = form.querySelector('#meal-prompt-fallback');
      try {
        await navigator.clipboard.writeText(prompt); fallback.hidden = true;
        toast('質問文をコピーしました');
      }
      catch {
        if (!form.isConnected || !modal.open) return;
        fallback.hidden = false;
        const field = fallback.querySelector('textarea');
        field.value = prompt; field.focus(); field.select();
        toast('選択した質問文をコピーしてください');
      }
    };
    form.querySelector('[data-meal-paste]').onclick = async () => {
      const original = answer.value;
      try {
        const text = await navigator.clipboard.readText();
        if (!form.isConnected || !modal.open || answer.value !== original) return;
        if (text) {
          answer.value = text; remember(); answer.focus(); return;
        }
      } catch {}
      if (form.isConnected && modal.open) { answer.focus(); toast('回答欄を長押しするか、端末の貼り付け操作を使ってください'); }
    };
    remember();
    bindForm(data => {
      menu = query.value; response = data.get('response'); group = data.get('group');
      review(reconcileMealReview(parseMealResponse(response, group), previousReview));
    });
  }

  function wirePhoto(form, query) {
    const card = form.querySelector('.meal-photo-selection');
    const image = card.querySelector('img');
    const share = form.querySelector('[data-meal-photo-share]');
    const status = form.querySelector('[data-meal-photo-status]');
    const manual = form.querySelector('[data-meal-photo-manual]');
    const previewError = card.querySelector('[data-photo-preview-error]');
    const download = card.querySelector('[data-meal-photo-download]');
    function display() {
      releasePreview();
      card.hidden = !photo;
      share.hidden = !photo || !canShareMealPhoto(photo);
      manual.textContent = share.hidden
        ? '質問文をコピーし、使いたいAIで写真を添付して質問文を貼り付けてください。'
        : '共有先にAIが見つからない場合は、質問文をコピーし、AIで同じ写真を添付してください。';
      status.textContent = '';
      previewError.hidden = true;
      image.hidden = !photo;
      if (!photo) { image.removeAttribute('src'); download.removeAttribute('href'); return; }
      card.querySelector('[data-photo-name]').textContent = photo.name;
      image.onerror = () => { image.hidden = true; previewError.hidden = false; };
      previewUrl = URL.createObjectURL(photo);
      image.src = previewUrl;
      download.href = previewUrl;
      download.download = photo.name;
    }
    for (const button of form.querySelectorAll('[data-photo-pick]')) {
      const input = form.querySelector('#'+button.dataset.photoPick);
      button.onclick = () => input.click();
      input.onchange = () => {
        const selected = input.files[0];
        input.value = '';
        if (!selected) return;
        try { photo = validateMealPhoto(selected); display(); }
        catch (err) { status.textContent = err.message; }
      };
    }
    card.querySelector('[data-meal-photo-clear]').onclick = () => { photo = null; display(); };
    share.onclick = async () => {
      if (!photo || share.disabled) return;
      share.disabled = true;
      try {
        const result = await shareMealPhoto(photo, buildMealPhotoPrompt(query.value));
        if (!form.isConnected || !modal.open) return;
        if (result === 'shared') {
          status.textContent = 'AIで質問文と写真を確認し、回答をこの下に貼り付けてください。';
          form.querySelector('.meal-return').scrollIntoView({block:'start'});
        }
        else if (result === 'cancelled') status.textContent = '共有をキャンセルしました。写真は選択したままです。';
        else status.textContent = '質問文をコピーし、AIで同じ写真を添付してください。';
      } catch (err) { status.textContent = err.message; }
      finally { share.disabled = false; }
    };
    display();
  }

  function review(items) {
    releasePreview();
    function field(i, key, label, value, attrs='') {
      const id = `meal-import-${key}-${i}`;
      return `<div class="field"><label for="${id}">${h(label)}</label>
        <input id="${id}" name="${key}-${i}" value="${h(value)}" ${attrs}></div>`;
    }
    function row({values:draft, included, scale, multiple, needsReview}, i) {
      const unit = draft.basis === '100g' ? 'g' : '食分';
      const missing = !draft.name || draft.baseAmount == null || Object.keys(nutrients).some(key => draft[key] == null);
      const amountInput = 'type="number" min="0" step="any" inputmode="decimal"';
      const provenance = draft.source || '出典なし';
      return `<section class="panel" data-meal-row="${i}">
        <label class="checkbox-row"><input type="checkbox" name="include-${i}"${included ? ' checked' : ''}> <strong data-meal-name id="meal-name-${i}">${h(draft.name || '食品名未入力')}</strong>を取り込む</label>
        ${needsReview ? '<p class="small">同名の食品があり、前の設定を特定できません。取り込む場合は内容を確認してチェックしてください。</p>' : ''}
        <p class="small" data-meal-portion></p>
        <div class="form-grid"><div class="field"><label id="meal-type-label-${i}" for="meal-type-${i}">食事区分</label>
          <select id="meal-type-${i}" name="meal-${i}" aria-labelledby="meal-name-${i} meal-type-label-${i}">${mealOptions(draft.meal)}</select></div>
          <div class="field"><label for="meal-scale-${i}">食べた量の倍率</label><select id="meal-scale-${i}" data-meal-scale name="scale-${i}">
          ${['0.5','1','1.5','2','custom'].map(value => `<option value="${value}"${value === scale ? ' selected' : ''}>${value === 'custom' ? '倍率を入力' : value+'倍'}</option>`).join('')}</select></div>
          <div data-custom-scale hidden>${field(i,'multiple','指定倍率',multiple,amountInput)}</div></div>
        <p class="small" data-meal-subtotal></p>
        <details${missing?' open':''}><summary>食品・量・栄養値を確認／編集</summary>
          <p class="small" style="overflow-wrap:anywhere" data-meal-source>出典：${h(provenance)}</p><div class="form-grid">
          ${field(i,'name','食品名',draft.name,'maxlength="200"')}
          ${field(i,'amount',`倍率をかける前の量（${unit}）`,draft.baseAmount,amountInput)}
          </div><p class="small">${draft.basis === '100g' ? '100g' : '1食分'}あたりの栄養値</p><div class="form-grid">
          ${Object.entries(nutrients).map(([key,label])=>field(i,key,label,draft[key],amountInput)).join('')}
          </div></details></section>`;
    }
    openDialog('食事の取り込みを確認', `<p>${h(day)}の記録に追加します。量と推定値を確認し、不要な食品はチェックを外してください。</p>
      <form novalidate data-food-draft id="meal-import-review">${items.length>1 ? `<div class="field"><label for="meal-group-bulk">チェックした食品の食事区分を一括変更</label>
        <select id="meal-group-bulk"><option value="">区分を選んで変更</option>${mealOptions('')}</select></div>` : ''}${items.map(row).join('')}
      <div class="info-box" id="meal-import-total" aria-live="polite"></div>${errorArea}<div class="modal-actions">
      <button type="button" class="button" data-meal-back>回答に戻る</button><button type="submit" class="button primary">選んだ食事を一括保存</button></div></form>`);
    const form = currentForm = modal.querySelector('form');
    const rows = [...form.querySelectorAll('[data-meal-row]')];
    function read(data, i) {
      const get = key => data.get(`${key}-${i}`);
      const number = key => get(key) === '' || get(key) == null ? null : Number(get(key));
      const item = {name:get('name') ?? '',meal:get('meal'), baseAmount:number('amount'),
        multiplier:get('scale') === 'custom' ? number('multiple') : number('scale')};
      for (const key of Object.keys(nutrients)) item[key] = number(key);
      return reviewedMealDraft(items[i].original,item);
    }
    function snapshot(data) {
      return items.map(({original}, i) => ({
        original, values:read(data,i), included:data.has(`include-${i}`),
        scale:data.get(`scale-${i}`), multiple:data.get(`multiple-${i}`),
      }));
    }
    function preview() {
      const data = new FormData(form), valid = [];
      const selections = snapshot(data);
      let incomplete = 0;
      for (const [i, element] of rows.entries()) {
        const item = selections[i].values;
        element.querySelector('[data-meal-name]').textContent = item.name.trim() || '食品名未入力';
        const portion = item.portion || (item.basis === '100g' ? '100gあたり' : '1食分あたり');
        element.querySelector('[data-meal-portion]').textContent = portion + (item.estimated ? ' · 推定値' : '');
        element.querySelector('[data-meal-source]').textContent = '出典：' + (item.source || '出典なし');
        element.querySelector('[data-custom-scale]').hidden = data.get(`scale-${i}`) !== 'custom';
        const output = element.querySelector('[data-meal-subtotal]');
        if (!data.has(`include-${i}`)) { output.textContent = '取り込み対象外'; continue; }
        try {
          const entry = mealImportEntry(item);
          valid.push(entry); output.textContent = nutritionLabel(mealTotals([entry]));
        } catch (err) { incomplete++; output.textContent = err.message; }
      }
      form.querySelector('#meal-import-total').textContent = incomplete
        ? `未入力・要確認の食品が${incomplete}件あります。`
        : `選択${valid.length}件の合計　${nutritionLabel(mealTotals(valid))}`;
      if (mode === 'photo') {
        previousReview = selections;
        persist('review');
      }
    }
    form.oninput = preview;
    form.onchange = event => {
      if (event.target.id === 'meal-group-bulk' && event.target.value) {
        for (const [i, element] of rows.entries()) {
          if (element.querySelector(`[name="include-${i}"]`).checked) {
            element.querySelector(`[name="meal-${i}"]`).value = event.target.value;
          }
        }
        event.target.value = '';
      }
      preview();
    };
    form.querySelector('[data-meal-back]').onclick = () => {
      previousReview = snapshot(new FormData(form));
      start();
    };
    preview();
    bindForm(data => {
      const selected = [];
      for (const [i, element] of rows.entries()) {
        if (!data.has(`include-${i}`)) continue;
        const draft = read(data,i);
        try { mealImportEntry(draft); }
        catch (err) {
          element.querySelector('details').open = true;
          throw new Error(`${i+1}件目：${err.message}`);
        }
        selected.push(draft);
      }
      onSave(prepareMealImport(selected).entries);
    });
  }
  if (mode === 'photo' && draft?.stage === 'review') {
    try { review(reconcileMealReview(parseMealResponse(response, group), previousReview)); }
    catch (err) { start(); currentForm.querySelector('#form-error').textContent = err.message; }
  } else start();
}
