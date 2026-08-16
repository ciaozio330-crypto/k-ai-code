import { useCallback, useEffect, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface Chapter {
  /** Secondi dall'inizio */
  at: number;
  label: string;
}

interface Props {
  src: string;
  title: string;
  chapters?: Chapter[];
  /**
   * Durata in secondi, mostrata in copertina. Serve perché finché il
   * <video> non è montato il browser non ha alcun metadato da cui ricavarla.
   */
  durationHint?: number;
  onClose?: () => void;
}

function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * Lettore video con copertina progettata e capitoli.
 *
 * Perché non `poster="..."` e basta: un poster è un JPEG: sfoca sui display
 * ad alta densità, va rigenerato a ogni cambio di brand e pesa in download.
 * Una copertina in DOM è nitida a qualsiasi densità, si adatta al viewport,
 * è leggibile dagli screen reader e costa zero byte in più.
 *
 * Il <video> non viene proprio montato finché non si preme play: i 6 MB del
 * filmato non partono in download solo perché qualcuno ha aperto il modale.
 * Una volta montato usa `preload="auto"`, perché a quel punto la volontà di
 * guardarlo c'è ed è il buffering veloce a contare.
 */
export function VideoPlayer({ src, title, chapters = [], durationHint, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  /**
   * Punto in cui posizionarsi appena i metadata sono disponibili.
   * Assegnare `currentTime` con `readyState === HAVE_NOTHING` viene ignorato
   * da diversi browser: partendo da un capitolo il video ripartirebbe da zero.
   */
  const pendingSeek = useRef<number | null>(null);

  const start = useCallback((from = 0) => {
    setStarted(true);
    setLoading(true);
    setFailed(false);
    pendingSeek.current = from > 0 ? from : null;

    // Il <video> viene montato in questo stesso commit: aspetta il paint
    // prima di cercarne il riferimento.
    requestAnimationFrame(() => {
      const v = videoRef.current;
      if (!v) return;
      if (pendingSeek.current != null && v.readyState >= 1) {
        v.currentTime = pendingSeek.current;
        pendingSeek.current = null;
      }
      v.play().catch(() => {
        // L'autoplay può essere rifiutato dal browser: il video resta
        // visibile con i controlli nativi e l'utente preme play.
        setLoading(false);
      });
    });
  }, []);

  const onLoadedMetadata = (e: SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    setDuration(v.duration);
    if (pendingSeek.current != null) {
      v.currentTime = pendingSeek.current;
      pendingSeek.current = null;
    }
  };

  const seek = (to: number) => {
    const v = videoRef.current;
    if (!started || !v) { start(to); return; }
    if (v.readyState >= 1) v.currentTime = to;
    else pendingSeek.current = to;
    v.play().catch(() => { /* l'utente premerà play */ });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose?.(); return; }
      const v = videoRef.current;
      if (!v || !started) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); start(); }
        return;
      }
      if (e.key === ' ') { e.preventDefault(); v.paused ? v.play() : v.pause(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); v.currentTime = Math.min(v.duration || 0, v.currentTime + 5); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 5); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [started, start, onClose]);

  // Capitolo corrente: l'ultimo il cui inizio è già stato superato
  const activeChapter = chapters.reduce(
    (acc, c, i) => (time + 0.25 >= c.at ? i : acc),
    -1
  );
  const progress = duration ? (time / duration) * 100 : 0;

  return (
    <div className="vp">
      <div className="vp-stage">
        {started && (
          <video
            ref={videoRef}
            src={src}
            controls
            playsInline
            preload="auto"
            onPlay={() => { setPlaying(true); setLoading(false); }}
            onPause={() => setPlaying(false)}
            onWaiting={() => setLoading(true)}
            onPlaying={() => setLoading(false)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onLoadedMetadata={onLoadedMetadata}
            onError={() => { setLoading(false); setFailed(true); }}
          />
        )}

        <AnimatePresence>
          {!started && (
            <motion.div
              className="vp-cover"
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="vp-cover-grid" aria-hidden="true" />
              <div className="vp-cover-glow" aria-hidden="true" />

              <div className="vp-cover-top">
                <span className="vp-brand">
                  <span className="vp-brand-mark">K</span>
                  K AI <em>Code</em>
                </span>
                <span className="vp-cover-dur">
                  {chapters.length} capitoli{durationHint ? ` · ${fmtTime(durationHint)}` : ''}
                </span>
              </div>

              <div className="vp-cover-mid">
                <motion.button
                  className="vp-play"
                  onClick={() => start()}
                  aria-label={`Riproduci: ${title}`}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.96 }}
                >
                  <span className="vp-play-ring" aria-hidden="true" />
                  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 5.2v13.6L19 12z" fill="currentColor" />
                  </svg>
                </motion.button>
                <h2 className="vp-title">{title}</h2>
                <p className="vp-sub">
                  Presentazione, demo dal vivo e piani. Meno di un minuto.
                </p>
              </div>

              {chapters.length > 0 && (
                <div className="vp-cover-chapters">
                  {chapters.map((c) => (
                    <button key={c.at} className="vp-cover-chip" onClick={() => start(c.at)}>
                      <b>{fmtTime(c.at)}</b>
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {loading && started && (
          <div className="vp-spinner" role="status" aria-label="Caricamento del video" />
        )}

        {failed && (
          <div className="vp-failed">
            <p><b>Il video non si carica.</b> Controlla la connessione e riprova.</p>
            <button onClick={() => start(time)}>Riprova</button>
          </div>
        )}
      </div>

      {chapters.length > 0 && (
        <div className="vp-rail">
          <div className="vp-progress" aria-hidden="true">
            <div style={{ width: `${progress}%` }} />
          </div>
          <div className="vp-chapters">
            {chapters.map((c, i) => (
              <button
                key={c.at}
                className={i === activeChapter && started ? 'vp-chapter on' : 'vp-chapter'}
                onClick={() => seek(c.at)}
              >
                <span className="vp-chapter-time">{fmtTime(c.at)}</span>
                <span className="vp-chapter-label">{c.label}</span>
              </button>
            ))}
          </div>
          <div className="vp-hints">
            <span><b>spazio</b> play/pausa</span>
            <span><b>← →</b> 5 secondi</span>
            <span className="vp-state">{started ? (playing ? 'in riproduzione' : 'in pausa') : 'pronto'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoPlayer;
