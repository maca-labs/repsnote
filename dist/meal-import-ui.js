import { fmt, mealTotals } from './core.js';
import { buildMealSearchPrompt, mealGroups, nutrients, parseMealResponse, reviewedMealDraft, mealImportEntry, prepareMealImport } from './meal-import.js';

function nutritionLabel(values) {
  return `${fmt(values.kcal, 1)} kcal / P ${fmt(values.p, 1)}・F ${fmt(values.f, 1)}・C ${fmt(values.c, 1)} g`;
}

export function openMealImport({day,modal,openDialog,bindForm,h,toast,onSave}) {
  let menu = '', response = '', group = '昼食';
  const cancel = '<button type="button" class="button" data-action="close">キャンセル</button>';
  const errorArea = '<div id="form-error" class="form-error" role="alert"></div>';
  const mealOptions = choice => mealGroups.map(meal =>
    `<option${meal === choice ? ' selected' : ''}>${meal}</option>`).join('');

  function start() {
    openDialog('AIで食事を一括取り込み', `<p>食べたものを入力して検索用の質問文をコピーし、検索できるAIに貼り付けてください。</p>
      <form><div class="field"><label for="meal-query">食べたもの</label>
      <textarea id="meal-query" rows="3" maxlength="5000" placeholder="セブンイレブンの幕の内弁当、バナナ1本">${h(menu)}</textarea></div>
      <button type="button" class="button" data-meal-prompt>AIへの質問文をコピー</button>
      <div id="meal-prompt-fallback" hidden><div class="field"><label for="meal-prompt-text">コピーする質問文</label><textarea id="meal-prompt-text" readonly rows="4"></textarea></div></div>
      <div class="divider"></div>
      <div class="field"><label for="meal-response">AIからの回答（JSON）</label>
      <textarea id="meal-response" name="response" rows="4" required placeholder='{"items":[…]}'>${h(response)}</textarea></div>
      <div class="field"><label for="meal-group">食事区分</label><select id="meal-group" name="group">${mealOptions(group)}</select></div>
      ${errorArea}<div class="modal-actions">${cancel}<button class="button primary" type="submit">読み込んで確認</button></div></form>`);
    const query = modal.querySelector('#meal-query');
    modal.querySelector('[data-meal-prompt]').onclick = async () => {
      let prompt;
      try { prompt = buildMealSearchPrompt(query.value); }
      catch (err) { query.focus(); toast(err.message); return; }
      const fallback = modal.querySelector('#meal-prompt-fallback');
      try { await navigator.clipboard.writeText(prompt); fallback.hidden = true; toast('質問文をコピーしました'); }
      catch {
        fallback.hidden = false;
        const field = fallback.querySelector('textarea');
        field.value = prompt; field.focus(); field.select();
        toast('選択した質問文をコピーしてください');
      }
    };
    bindForm(data => {
      menu = query.value; response = data.get('response'); group = data.get('group');
      review(parseMealResponse(response, group));
    });
  }

  function review(drafts) {
    function field(i, key, label, value, attrs='') {
      const id = `meal-import-${key}-${i}`;
      return `<div class="field"><label for="${id}">${h(label)}</label>
        <input id="${id}" name="${key}-${i}" value="${h(value)}" ${attrs}></div>`;
    }
    function row(draft, i) {
      const unit = draft.basis === '100g' ? 'g' : '食分';
      const missing = !draft.name || draft.baseAmount == null || Object.keys(nutrients).some(key => draft[key] == null);
      const amountInput = 'type="number" min="0" step="any" inputmode="decimal"';
      const provenance = draft.source || '出典なし';
      return `<section class="panel" data-meal-row="${i}">
        <label class="checkbox-row"><input type="checkbox" name="include-${i}" checked> <strong data-meal-name>${h(draft.name || '食品名未入力')}</strong>を取り込む</label>
        <p class="small" data-meal-portion></p>
        <div class="form-grid"><div class="field"><label for="meal-scale-${i}">食べた量の倍率</label><select id="meal-scale-${i}" data-meal-scale name="scale-${i}">
          <option value="0.5">0.5倍</option><option value="1" selected>1倍</option><option value="1.5">1.5倍</option><option value="2">2倍</option><option value="custom">倍率を入力</option></select></div>
          <div data-custom-scale hidden>${field(i,'multiple','指定倍率',1,amountInput)}</div></div>
        <p class="small" data-meal-subtotal></p>
        <details${missing?' open':''}><summary>食品・量・栄養値を確認／編集</summary>
          <p class="small" style="overflow-wrap:anywhere" data-meal-source>出典：${h(provenance)}</p><div class="form-grid">
          ${field(i,'name','食品名',draft.name,'maxlength="200"')}
          <div class="field"><label for="meal-type-${i}">食事区分</label><select id="meal-type-${i}" name="meal-${i}">${mealOptions(draft.meal)}</select></div>
          ${field(i,'amount',`倍率をかける前の量（${unit}）`,draft.baseAmount,amountInput)}
          </div><p class="small">${draft.basis === '100g' ? '100g' : '1食分'}あたりの栄養値</p><div class="form-grid">
          ${Object.entries(nutrients).map(([key,label])=>field(i,key,label,draft[key],amountInput)).join('')}
          </div></details></section>`;
    }
    openDialog('食事の取り込みを確認', `<p>${h(day)}の記録に追加します。量と推定値を確認し、不要な食品はチェックを外してください。</p>
      <form novalidate id="meal-import-review">${drafts.map(row).join('')}
      <div class="info-box" id="meal-import-total" aria-live="polite"></div>${errorArea}<div class="modal-actions">
      <button type="button" class="button" data-meal-back>回答に戻る</button><button type="submit" class="button primary">選んだ食事を一括保存</button></div></form>`);
    const form = modal.querySelector('form');
    const rows = [...form.querySelectorAll('[data-meal-row]')];
    function read(data, i) {
      const get = key => data.get(`${key}-${i}`);
      const number = key => get(key) === '' || get(key) == null ? null : Number(get(key));
      const item = {name:get('name') ?? '',meal:get('meal'), baseAmount:number('amount'),
        multiplier:get('scale') === 'custom' ? number('multiple') : number('scale')};
      for (const key of Object.keys(nutrients)) item[key] = number(key);
      return reviewedMealDraft(drafts[i],item);
    }
    function preview() {
      const data = new FormData(form), valid = [];
      let incomplete = 0;
      for (const [i, element] of rows.entries()) {
        const item = read(data, i);
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
    }
    form.oninput = preview;
    form.onchange = preview;
    form.querySelector('[data-meal-back]').onclick = start;
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
  start();
}
