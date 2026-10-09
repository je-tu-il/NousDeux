import { Platform } from 'react-native';
import { useOnboardingStore } from '../store/onboardingStore';
import { triggerHaptic, HapticFeedbackType } from './haptics';

export type SoundEffectType = 'tap' | 'pop' | 'success' | 'coin' | 'reward' | 'tick';

// Web Audio API Context (instancié paresseusement lors du premier geste utilisateur)
let audioCtx: any = null;

function getAudioContext(): any {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined') return null;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Synthétise un micro-effet sonore haute fidélité via Web Audio API.
 * Zéro dépendance native, zéro latence réseau, compatible iOS Safari & Android Chrome.
 */
function synthesizeSound(type: SoundEffectType) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  switch (type) {
    case 'tap': {
      // Clic doux & mat (420Hz -> 180Hz en 35ms)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.035);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
      break;
    }

    case 'pop': {
      // Pop pétillant & chaleureux (300Hz -> 720Hz en 45ms)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(720, now + 0.045);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.055);
      break;
    }

    case 'tick': {
      // Tic précis de roulette / défilement (850Hz -> 300Hz en 18ms)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(850, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.018);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.022);
      break;
    }

    case 'coin': {
      // Carillon argenté brillant (deux notes B5 -> E6)
      const playNote = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.14, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.01);
      };

      playNote(987.77, now, 0.08); // Si5
      playNote(1318.51, now + 0.06, 0.18); // Mi6
      break;
    }

    case 'success': {
      // Accord majeur montant harmonieux (Mi5 -> Sol#5)
      const playChime = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.16, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.01);
      };

      playChime(659.25, now, 0.12);
      playChime(830.61, now + 0.08, 0.22);
      break;
    }

    case 'reward': {
      // Fanfare victorieuse ascendante (Do5 -> Mi5 -> Sol5 -> Do6)
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const start = now + i * 0.07;
        const dur = i === notes.length - 1 ? 0.35 : 0.12;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i === notes.length - 1 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.01);
      });
      break;
    }
  }
}

/**
 * Joue un effet sonore synchronisé avec un micro-retour haptique.
 * Respecte le réglage utilisateur `soundEnabled`.
 */
export function playSound(
  type: SoundEffectType = 'tap',
  pairedHaptic?: HapticFeedbackType
): void {
  // 1. Retour haptique associé
  if (pairedHaptic) {
    void triggerHaptic(pairedHaptic);
  } else {
    // Retours haptiques par défaut associés aux sons
    const hapticMap: Record<SoundEffectType, HapticFeedbackType> = {
      tap: 'light',
      pop: 'selection',
      tick: 'light',
      coin: 'medium',
      success: 'success',
      reward: 'success',
    };
    void triggerHaptic(hapticMap[type] || 'light');
  }

  // 2. Vérification si le son est activé dans le store
  try {
    const isEnabled = useOnboardingStore.getState().soundEnabled ?? true;
    if (!isEnabled) return;
  } catch {}

  // 3. Rendu audio
  try {
    synthesizeSound(type);
  } catch {}
}

export const sound = {
  tap: () => playSound('tap', 'light'),
  pop: () => playSound('pop', 'selection'),
  tick: () => playSound('tick', 'light'),
  coin: () => playSound('coin', 'medium'),
  success: () => playSound('success', 'success'),
  reward: () => playSound('reward', 'heavy'),
};
