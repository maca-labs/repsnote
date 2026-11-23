export function createTimerSound(win = globalThis) {
  let context = null;

  // Call from the activating gesture, before waiting on storage or a lock.
  async function arm() {
    if (win.navigator?.userActivation?.isActive === false) return false;
    try {
      if (!context || context.state === 'closed') {
        const AudioContext = win.AudioContext ?? win.webkitAudioContext;
        if (!AudioContext) return false;
        context = new AudioContext();
      }
      const current = context;
      if (current.state !== 'running') await current.resume();
      return context === current && current.state === 'running';
    } catch {
      return false;
    }
  }

  function play() {
    if (context?.state !== 'running') return false;
    try {
      const tone = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + 0.01;
      tone.type = 'sine';
      tone.frequency.setValueAtTime(698.46, start);
      tone.frequency.setValueAtTime(880, start + 0.20);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.13, start + 0.012);
      gain.gain.linearRampToValueAtTime(0, start + 0.16);
      gain.gain.setValueAtTime(0, start + 0.20);
      gain.gain.linearRampToValueAtTime(0.13, start + 0.212);
      gain.gain.linearRampToValueAtTime(0, start + 0.46);
      tone.connect(gain);
      gain.connect(context.destination);
      tone.onended = () => { tone.disconnect(); gain.disconnect(); };
      tone.start(start);
      tone.stop(start + 0.47);
      return true;
    } catch {
      return false;
    }
  }

  async function disarm() {
    const current = context;
    context = null;
    try { await current?.close(); } catch { /* Audio output may already be unavailable. */ }
  }

  return {arm, play, disarm};
}
