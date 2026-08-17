import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, CSSProperties } from 'react';

/**
 * Motore della composizione — versione per il sito.
 *
 * L'animazione della demo nasce come progetto Claude Design, dove gira su
 * `animations-v3.jsx`: un motore che oltre a far scorrere il tempo gestisce
 * l'esportazione video (wrapper svg/foreignObject, eventi di seek, inlining
 * dei font, badge diagnostici, pannello di riproduzione dell'editor). Qui
 * niente di tutto ciò serve: sul sito la demo si guarda e basta.
 *
 * Questo file riproduce quindi solo il contratto che la coreografia usa
 * davvero — `useComposition()`, `Captions`, e le funzioni di interpolazione —
 * così il pezzo resta identico all'originale e le due versioni non divergono.
 * Le funzioni matematiche sono copiate alla lettera dal motore originale:
 * cambiarle qui significherebbe far muovere le cose diversamente.
 */

/* ── Easing (copiate verbatim da animations-v3) ────────────────────────── */

export const Easing = {
  linear: (t: number) => t,

  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),

  easeInQuart: (t: number) => t * t * t * t,
  easeOutQuart: (t: number) => 1 - (--t) * t * t * t,
  easeInOutQuart: (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t),

  easeInExpo: (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
  easeOutExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutExpo: (t: number) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    if (t < 0.5) return 0.5 * Math.pow(2, 20 * t - 10);
    return 1 - 0.5 * Math.pow(2, -20 * t + 10);
  },

  easeInSine: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: (t: number) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,

  easeOutBack: (t: number) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInBack: (t: number) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  easeInOutBack: (t: number) => {
    const c1 = 1.70158, c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },

  easeOutElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    if (t === 0) return 0;
    if (t === 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
};

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

type EaseFn = (t: number) => number;

/** interpolate([0, 0.5, 1], [0, 100, 50]) -> fn(t) */
export function interpolate(input: number[], output: number[], ease: EaseFn | EaseFn[] = Easing.linear) {
  return (t: number) => {
    if (t <= input[0]) return output[0];
    if (t >= input[input.length - 1]) return output[output.length - 1];
    for (let i = 0; i < input.length - 1; i++) {
      if (t >= input[i] && t <= input[i + 1]) {
        const span = input[i + 1] - input[i];
        const local = span === 0 ? 0 : (t - input[i]) / span;
        const easeFn = Array.isArray(ease) ? (ease[i] || Easing.linear) : ease;
        return output[i] + (output[i + 1] - output[i]) * easeFn(local);
      }
    }
    return output[output.length - 1];
  };
}

/** animate({from, to, start, end, ease})(t) — tween a segmento singolo. */
export function animate({
  from = 0, to = 1, start = 0, end = 1, ease = Easing.easeInOutCubic,
}: { from?: number; to?: number; start?: number; end?: number; ease?: EaseFn }) {
  return (t: number) => {
    if (t <= start) return from;
    if (t >= end) return to;
    return from + (to - from) * ease((t - start) / (end - start));
  };
}

/* ── Scene e cue ───────────────────────────────────────────────────────── */

export interface Scene { name: string; dur: number; nat?: number; desc?: string }

interface Section { name: string; playStart: number; dur: number; authStart: number; nat: number }
interface Derived {
  sections: Section[];
  table: Record<string, number>;
  total: number;
  authoredTotal: number;
}

/** Somma corrente delle durate: identica a ccDerive nel motore originale. */
function derive(scenes: Scene[]): Derived {
  let playStart = 0, authStart = 0;
  const sections: Section[] = [];
  const table: Record<string, number> = Object.create(null);
  for (const s of scenes) {
    const nat = typeof s.nat === 'number' && isFinite(s.nat) && s.nat > 0 ? s.nat : s.dur;
    sections.push({ name: s.name, playStart, dur: s.dur, authStart, nat });
    if (!Object.prototype.hasOwnProperty.call(table, s.name)) {
      table[s.name] = Math.round(authStart * 1000) / 1000;
    }
    playStart += s.dur;
    authStart += nat;
  }
  return {
    sections, table,
    total: Math.round(playStart * 1000) / 1000,
    authoredTotal: Math.round(authStart * 1000) / 1000,
  };
}

/** Tempo di riproduzione → tempo autoriale (identico a ccWarp). */
function warp(d: Derived, t: number): number {
  const ss = d.sections;
  if (!ss.length) return 0;
  let idx = ss.length - 1;
  for (let i = 0; i < ss.length; i++) {
    if (t < ss[i].playStart + ss[i].dur) { idx = i; break; }
  }
  const s = ss[idx];
  const local = Math.min(Math.max(t - s.playStart, 0), s.dur);
  return Math.min(s.authStart + (s.dur > 0 ? local * (s.nat / s.dur) : 0), d.authoredTotal);
}

/* ── Contesto ──────────────────────────────────────────────────────────── */

export interface Composition {
  /** Tempo autoriale: TUTTA la coreografia va agganciata a questo. */
  T: number;
  CUES: Record<string, number>;
  time: number;
  duration: number;
  authoredTotal: number;
  playing: boolean;
}

const CompositionContext = createContext<Composition | null>(null);

export function useComposition(): Composition {
  const ctx = useContext(CompositionContext);
  if (!ctx) throw new Error('useComposition() va usato dentro <CompositionStage>');
  return ctx;
}

/* ── Didascalie ────────────────────────────────────────────────────────── */

const CAPTION_FADE = 0.18;

export interface CaptionItem { at: number; until?: number; text: string }

export function Captions({ items, style }: { items: CaptionItem[]; style?: CSSProperties }) {
  const { T } = useComposition();
  const sorted = useMemo(
    () => (items || []).filter((it) => it && isFinite(+it.at)).sort((a, b) => a.at - b.at),
    [items]
  );

  let active: CaptionItem | null = null;
  let end = Infinity;
  for (let i = 0; i < sorted.length; i++) {
    if (T < sorted[i].at) break;
    active = sorted[i];
    end = typeof active.until === 'number' && isFinite(active.until)
      ? active.until
      : (i + 1 < sorted.length ? sorted[i + 1].at : Infinity);
  }
  if (!active || T >= end) return null;

  let o = Math.min(1, (T - active.at) / CAPTION_FADE);
  if (isFinite(end)) o = Math.min(o, (end - T) / CAPTION_FADE);
  o = Math.max(0, Math.min(1, o));

  return (
    <div className="dm-caption" style={{ opacity: o, ...style }}>
      {active.text}
    </div>
  );
}

/* ── Palco ─────────────────────────────────────────────────────────────── */

interface StageProps {
  width: number;
  height: number;
  scenes: Scene[] | string;
  bg?: string;
  /** Riproduci appena montato (dopo che l'utente ha premuto play). */
  playing?: boolean;
  loop?: boolean;
  /** Notifica il tempo corrente, per la barra di avanzamento esterna. */
  onTime?: (time: number, duration: number) => void;
  /** Chiamato quando il pezzo arriva in fondo senza loop. */
  onEnded?: () => void;
  /** Posizione richiesta dall'esterno (in secondi), per il seek manuale. */
  seekTo?: number | null;
  children: ReactNode;
}

/**
 * Fa scorrere il tempo e mette in scala il pezzo dentro il contenitore.
 *
 * La coreografia è scritta per un fotogramma fisso (1920x1080 o 1080x1920),
 * quindi invece di renderla responsive si scala l'intero palco: è lo stesso
 * approccio dell'originale e garantisce che le proporzioni restino quelle
 * pensate in fase di montaggio.
 */
export function CompositionStage({
  width, height, scenes, bg = '#0b0b0e',
  playing = false, loop = true, onTime, onEnded, seekTo = null, children,
}: StageProps) {
  const parsed = useMemo<Scene[]>(() => {
    if (Array.isArray(scenes)) return scenes;
    try { return JSON.parse(String(scenes)); } catch { return []; }
  }, [scenes]);

  const d = useMemo(() => derive(parsed), [parsed]);
  const [time, setTime] = useState(0);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  // Il tempo vive in un ref e viene riversato nello stato una volta per
  // fotogramma: tenerlo solo nello stato farebbe dipendere l'avanzamento
  // dalla cadenza dei render invece che dall'orologio.
  const tRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      setScale(Math.min(r.width / width, r.height / height));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  // Seek esterno
  useEffect(() => {
    if (seekTo == null) return;
    tRef.current = Math.max(0, Math.min(seekTo, d.total));
    setTime(tRef.current);
  }, [seekTo, d.total]);

  useEffect(() => {
    if (!playing) return undefined;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.25); // un tab tornato in primo
      last = now;                                     // piano non deve saltare
      let t = tRef.current + dt;
      if (t >= d.total) {
        if (loop) t = t % (d.total || 1);
        else { t = d.total; tRef.current = t; setTime(t); onEnded?.(); return; }
      }
      tRef.current = t;
      setTime(t);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, loop, d.total, onEnded]);

  useEffect(() => { onTime?.(time, d.total); }, [time, d.total, onTime]);

  const value = useMemo<Composition>(() => ({
    T: warp(d, time),
    CUES: d.table,
    time,
    duration: d.total,
    authoredTotal: d.authoredTotal,
    playing,
  }), [d, time, playing]);

  return (
    <div className="dm-stage" ref={boxRef} style={{ background: bg }}>
      <div
        className="dm-frame"
        style={{
          width, height,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <CompositionContext.Provider value={value}>
          {children}
        </CompositionContext.Provider>
      </div>
    </div>
  );
}
