const guides = {
  workout: {
    title: '筋トレの最初の1セット',
    steps: [
      '「種目を追加」をタップし、種目名を検索して選びます。',
      'セットの重量と回数を、実際に行った数値に合わせます。',
      'セットを終えたら右のチェックをタップ。「完了セット」が1つ増えます。',
    ],
  },
  food: {
    title: '食事を1品記録する',
    steps: [
      '「食事を追加」をタップし、食品名と朝食・昼食などの区分を入力します。',
      '栄養表示の基準を選び、カロリーとP（たんぱく質）・F（脂質）・C（炭水化物）を入力します。',
      '食べた量を確認して「食事を保存」をタップ。選んだ食事区分に追加されます。',
    ],
  },
  body: {
    title: '体重と測定時刻を記録する',
    steps: [
      '「からだ」を開いて「体重を記録」をタップします。',
      '測定日と時刻を確認し、体重をkgで入力します。体脂肪率は空欄でも保存できます。',
      '「記録を保存」をタップ。同じ日にもう一度測ったら、時刻を変えて追加できます。',
    ],
  },
  records: {
    title: '自己ベストを確認・訂正する',
    steps: [
      '「ベスト」を開き、確認したい種目を探します。',
      '補助なしで完了したメインセットの最高重量が表示されます。同じ重量なら回数が多い記録が優先されます。',
      '入力を直すときは「元の記録を訂正する」をタップ。保存すると自己ベストも再計算されます。',
    ],
  },
  history: {
    title: '履歴を見て月間まとめをシェアする',
    steps: [
      '「履歴」のカレンダーで日付をタップすると、その日のトレーニングや食事、体重の記録を確認できます。',
      '「履歴」に戻り、まとめたい月を表示して「月間まとめをシェア」をタップします。',
      '共有画像と投稿文を確認し、画像を保存したり投稿文をコピーしたりできます。',
    ],
  },
};

export function openHelp({view, demo, modal, openDialog}) {
  const options = Object.entries(guides).map(([key, guide]) =>
    `<option value="${key}">${guide.title}</option>`).join('');
  openDialog('使い方ガイド', `
    <div class="help-picker"><label for="help-topic">動画を選ぶ</label><select id="help-topic">${options}</select></div>
    <div class="help-layout">
      <div class="help-player"></div>
      <section class="help-instructions" aria-labelledby="help-steps-title">
        <h3 id="help-steps-title">操作手順</h3><ol></ol>
        ${demo ? '<p class="help-demo">自分の記録を残すには、ガイドを閉じて「自分の記録をはじめる」をタップしてください。</p>' : ''}
      </section>
    </div>`);

  const picker = modal.querySelector('#help-topic');
  const player = modal.querySelector('.help-player');
  const steps = modal.querySelector('.help-instructions ol');
  function selectTopic() {
    const key = picker.value;
    const guide = guides[key];
    player.querySelector('video')?.pause();
    player.innerHTML = `<div class="help-screen"><video playsinline preload="none" aria-label="${guide.title}の字幕付き動画"></video>
      <button type="button" class="help-play"><span aria-hidden="true">▶</span> 動画を再生</button></div>
      <div class="help-error" hidden><p role="status">動画を読み込めませんでした。「操作手順」でも確認できます。</p>
      <button type="button" class="button">動画を再読み込み</button></div>`;
    const video = player.querySelector('video');
    const error = player.querySelector('.help-error');
    const screen = player.querySelector('.help-screen');
    const play = player.querySelector('.help-play');
    function showError() {
      screen.hidden = true;
      error.hidden = false;
    }
    video.addEventListener('error', showError);
    video.addEventListener('play', () => {
      video.controls = true;
      play.hidden = true;
    });
    play.onclick = () => {
      video.play().then(() => video.focus()).catch(showError);
    };
    error.querySelector('button').onclick = () => {
      error.hidden = true;
      screen.hidden = false;
      video.load();
      play.click();
    };
    video.poster = new URL('./help/'+key+'.jpg', document.baseURI).href;
    video.src = new URL('./help/'+key+'.mp4', document.baseURI).href;
    steps.innerHTML = guide.steps.map(step => `<li>${step}</li>`).join('');
  }
  picker.value = Object.hasOwn(guides, view) ? view : 'workout';
  picker.onchange = selectTopic;
  selectTopic();
  modal.addEventListener('close', () => {
    const video = player.querySelector('video');
    video.pause();
    video.removeAttribute('src');
    video.load();
  }, {once:true});
}
