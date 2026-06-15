// 消息提示音工具 - 使用 Web Audio API 生成提示音，无需外部音频文件

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

// 播放普通消息提示音（短促清脆）
export function playMessageSound() {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.2);
  } catch {
    // 静默失败，不影响功能
  }
}

// 播放@提及提示音（双音调，更醒目）
export function playMentionSound() {
  try {
    const ctx = getAudioContext();
    const oscillator1 = ctx.createOscillator();
    const oscillator2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator1.type = 'sine';
    oscillator1.frequency.setValueAtTime(880, ctx.currentTime);

    oscillator2.type = 'sine';
    oscillator2.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);

    gainNode.gain.setValueAtTime(0.35, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    oscillator1.start(ctx.currentTime);
    oscillator1.stop(ctx.currentTime + 0.12);
    oscillator2.start(ctx.currentTime + 0.12);
    oscillator2.stop(ctx.currentTime + 0.35);
  } catch {
    // 静默失败
  }
}

// 声音开关管理
const SOUND_ENABLED_KEY = 'discussion_sound_enabled';

export function isSoundEnabled(): boolean {
  const stored = localStorage.getItem(SOUND_ENABLED_KEY);
  return stored !== 'false'; // 默认开启
}

export function setSoundEnabled(enabled: boolean) {
  localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
}
