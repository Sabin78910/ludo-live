// Tiny WebAudio synth (no audio files) plus haptics. Everything is best-effort and silent on failure.
export type Sfx = "dice" | "hop" | "enter" | "capture" | "home" | "win" | "six" | "tick" | "tap";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(ac: AudioContext, freq: number, at: number, dur: number, type: OscillatorType = "sine", gain = 0.18, slideTo?: number) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(ac.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

function noise(ac: AudioContext, at: number, dur: number, gain = 0.12, freq = 1800) {
  const buf = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * dur)), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(ac.destination);
  src.start(at);
}

export function play(sfx: Sfx): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  switch (sfx) {
    case "dice":
      for (let i = 0; i < 6; i++) noise(ac, t + i * 0.08, 0.05, 0.25, 2400 - i * 200);
      break;
    case "hop":
      tone(ac, 520, t, 0.08, "triangle", 0.12, 780);
      break;
    case "enter":
      tone(ac, 440, t, 0.12, "triangle", 0.15, 880);
      break;
    case "capture":
      tone(ac, 180, t, 0.3, "sawtooth", 0.15, 60);
      noise(ac, t, 0.25, 0.3, 600);
      break;
    case "home":
      [660, 830, 990].forEach((f, i) => tone(ac, f, t + i * 0.09, 0.22, "sine", 0.15));
      break;
    case "six":
      tone(ac, 990, t, 0.12, "sine", 0.1, 1480);
      break;
    case "win":
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(ac, f, t + i * 0.13, 0.3, "triangle", 0.16));
      break;
    case "tick":
      tone(ac, 1200, t, 0.04, "square", 0.05);
      break;
    case "tap":
      tone(ac, 700, t, 0.04, "sine", 0.06);
      break;
  }
}

const PATTERNS: Partial<Record<Sfx, number | number[]>> = {
  dice: 20,
  capture: [40, 30, 60],
  home: [20, 40, 20],
  win: [60, 40, 60, 40, 120],
  six: 15,
};

export function vibrate(sfx: Sfx): void {
  const p = PATTERNS[sfx];
  try {
    if (p !== undefined && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(p);
  } catch {
    // Not supported.
  }
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
