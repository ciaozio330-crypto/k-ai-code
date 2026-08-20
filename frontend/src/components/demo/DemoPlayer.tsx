import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import KaiIntro, { DEMO_DURATION, SCENES } from './KaiIntro';
import { useI18n } from '@/lib/i18n';

// Importato qui e non da main.tsx di proposito: così finisce nel chunk della
// demo insieme ai suoi font, invece di pesare su ogni visita.
import '@/styles/demo.css';

/**
 * Lettore della demo.
 *
 * Sostituisce il vecchio mp4: la demo non è più un filmato ma l'animazione
 * vera che gira dal vivo. Il guadagno non è solo di peso (decine di KB di
 * codice contro sei megabyte di video) — resta nitida a qualsiasi
 * risoluzione perché è DOM, non pixel compressi, e la colonna sonora suona
 * sincronizzata invece di essere incollata sopra.
 *
 * L'audio parte solo quando l'utente preme play: è un suo gesto, quindi il
 * browser lo consente, e nessuno si trova musica addosso senza averla
 * chiesta.
 */

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/**
 * Inizio di ogni scena, per i marcatori sulla barra.
 *
 * Solo i tempi: il nome arriva dal dizionario, per indice. SCENES resta la
 * sorgente delle durate perché è la stessa che pilota l'animazione.
 */
const MARKS: { at: number }[] = SCENES.reduce<{ at: number }[]>((acc, _s, i) => {
  const prev = acc.length ? acc[acc.length - 1] : null;
  acc.push({ at: prev ? prev.at + SCENES[i - 1].dur : 0 });
  return acc;
}, []);

interface Props {
  /** Chiudi il modale (Esc o pulsante). */
  onClose?: () => void;
  /** Parti subito, senza schermata di copertina. */
  autoStart?: boolean;
}

export default function DemoPlayer({ onClose, autoStart = false }: Props) {
  const { t, locale } = useI18n();
  const [started, setStarted] = useState(autoStart);
  const [playing, setPlaying] = useState(autoStart);
  const [time, setTime] = useState(0);
  const [audio, setAudio] = useState(true);
  const [seekTo, setSeekTo] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  const onTime = useCallback((t: number) => setTime(t), []);

  const start = useCallback((from = 0) => {
    setStarted(true);
    setSeekTo(from);
    setPlaying(true);
  }, []);

  const seek = useCallback((t: number) => {
    const v = Math.max(0, Math.min(t, DEMO_DURATION));
    setSeekTo(v);
    setTime(v);
    // `seekTo` viene letto da un effetto che confronta il valore: due seek
    // allo stesso istante non scatterebbero. Azzerarlo subito dopo lo rende
    // di nuovo disponibile.
    requestAnimationFrame(() => setSeekTo(null));
  }, []);

  const onBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = barRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ratio = (e.clientX - r.left) / r.width;
    if (!started) { start(ratio * DEMO_DURATION); return; }
    seek(ratio * DEMO_DURATION);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose?.(); return; }
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        if (!started) start(0); else setPlaying((p) => !p);
      } else if (e.key === 'ArrowRight') { e.preventDefault(); seek(time + 5); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); seek(time - 5); }
      else if (e.key === 'm') { setAudio((a) => !a); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [started, time, seek, start, onClose]);

  const progress = (time / DEMO_DURATION) * 100;
  const sceneNames = t.demoPlayer.scenes;
  const currentScene = useMemo(() => {
    let name = sceneNames[0] || '';
    MARKS.forEach((m, i) => { if (time + 0.01 >= m.at) name = sceneNames[i] || name; });
    return name;
  }, [time, sceneNames]);

  return (
    <div className="dm">
      <div className="dm-viewport">
        <KaiIntro
          /* L'animazione ha i suoi testi solo in italiano e inglese, con le
             righe della spiegazione spezzate a mano per stare nel riquadro.
             Aggiungerci le altre quattro lingue vorrebbe dire rifare quelle
             interruzioni una per una: fino ad allora, chi non legge in
             italiano vede la demo in inglese, non in una lingua a caso. */
          lang={locale === 'it' ? 'IT' : 'EN'}
          playing={started && playing}
          loop
          audio={audio && started}
          volume={0.8}
          onTime={onTime}
          seekTo={seekTo}
        />

        <AnimatePresence>
          {!started && (
            <motion.div
              className="dm-cover"
              exit={{ opacity: 0, scale: 1.015 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="dm-cover-top">
                <span className="dm-brand">
                  <span className="dm-brand-mark">K</span>K AI <em>Code</em>
                </span>
                <span className="dm-cover-tag">{t.demoPlayer.liveDemo} · {fmt(DEMO_DURATION)}</span>
              </div>
              <div className="dm-cover-mid">
                <motion.button
                  className="dm-play"
                  onClick={() => start(0)}
                  aria-label={t.demoPlayer.play}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.96 }}
                >
                  <span className="dm-play-ring" aria-hidden="true" />
                  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 5.2v13.6L19 12z" fill="currentColor" />
                  </svg>
                </motion.button>
                <h2 className="dm-title">{t.demoPlayer.title}</h2>
                <p className="dm-sub">{t.demoPlayer.sub}</p>
              </div>
              <div className="dm-cover-chips">
                {MARKS.map((m, i) => (
                  <button key={m.at} className="dm-chip" onClick={() => start(m.at)}>
                    <b>{fmt(m.at)}</b>{sceneNames[i]}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="dm-bar">
        <button
          className="dm-ctl"
          onClick={() => (started ? setPlaying((p) => !p) : start(0))}
          aria-label={playing ? t.demoPlayer.pause : t.demoPlayer.play}
        >
          {playing ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1.3" />
              <rect x="14" y="5" width="4" height="14" rx="1.3" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5.2v13.6L19 12z" />
            </svg>
          )}
        </button>

        <span className="dm-time">{fmt(time)}</span>

        <div className="dm-track" ref={barRef} onClick={onBarClick} role="presentation">
          <div className="dm-track-fill" style={{ width: `${progress}%` }} />
          {MARKS.map((m, i) => (
            <span
              key={m.at}
              className="dm-mark"
              style={{ left: `${(m.at / DEMO_DURATION) * 100}%` }}
              title={sceneNames[i]}
            />
          ))}
        </div>

        <span className="dm-time dim">{fmt(DEMO_DURATION)}</span>

        <span className="dm-scene">{currentScene}</span>

        <button
          className={audio ? 'dm-ctl' : 'dm-ctl off'}
          onClick={() => setAudio((a) => !a)}
          aria-label={audio ? t.demoPlayer.muteOn : t.demoPlayer.muteOff}
          title={`${audio ? t.demoPlayer.muteOn : t.demoPlayer.muteOff} (M)`}
        >
          {audio ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5L6 9H3v6h3l5 4z" />
              <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5L6 9H3v6h3l5 4z" />
              <path d="M16 9.5l5 5M21 9.5l-5 5" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
