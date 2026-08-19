import type { Transition } from 'motion/react';

/**
 * Token di movimento.
 *
 * Prima ogni componente sceglieva da sé durata, curva e rigidità: c'erano
 * spring con stiffness da 260 a 500, durate da 0.14s a 0.6s e tre curve
 * diverse. Il risultato è che il sito si muove con ritmi scollegati, e la
 * differenza si sente anche senza saperla nominare.
 *
 * Le regole seguite qui:
 *   - la durata cresce con la distanza percorsa, non con l'importanza;
 *   - l'uscita è più rapida dell'entrata (~60%), perché sparire deve
 *     sembrare immediato mentre apparire può prendersi il suo tempo;
 *   - le curve sono due sole, una per il movimento e una per il colore;
 *   - ciò che risponde a un gesto usa una molla, non una durata: il tocco
 *     deve sembrare fisico.
 */

/** Curva standard: parte decisa e si posa. Per entrate e spostamenti. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Curva simmetrica, per ciò che va e torna (hover, apri/chiudi). */
export const EASE_IN_OUT = [0.32, 0.72, 0, 1] as const;

/** Durate, in secondi. Un solo posto dove cambiarle. */
export const DUR = {
  /** Micro-riscontro: colore, opacità di un bordo. */
  instant: 0.14,
  /** Elemento piccolo che si sposta di poco. */
  quick: 0.24,
  /** Pannello, scheda, cambio di contenuto. */
  base: 0.34,
  /** Ingresso di una sezione durante lo scorrimento. */
  slow: 0.55,
} as const;

/** L'uscita dura circa il 60% dell'entrata: sparire deve essere svelto. */
export const exitOf = (enter: number) => Math.round(enter * 0.6 * 100) / 100;

/* ── Transizioni pronte ─────────────────────────────────────────────── */

export const tEnter: Transition = { duration: DUR.base, ease: EASE_OUT };
export const tExit: Transition = { duration: exitOf(DUR.base), ease: EASE_OUT };
export const tSection: Transition = { duration: DUR.slow, ease: EASE_OUT };
export const tQuick: Transition = { duration: DUR.quick, ease: EASE_OUT };

/**
 * Molle. Una per la risposta al tocco (rapida e secca) e una per gli
 * elementi che si posano (più morbida). Non servono altre varianti.
 */
export const springSnappy: Transition = { type: 'spring', stiffness: 460, damping: 34 };
export const springSoft: Transition = { type: 'spring', stiffness: 280, damping: 28 };

/** Ritardo fra elementi di una sequenza: sotto i 30ms non si legge, sopra i 60 sembra lento. */
export const STAGGER = 0.045;

/** Variante contenitore per un elenco che entra a cascata. */
export const staggerParent = (delayChildren = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: STAGGER, delayChildren } },
});

/** Variante figlio, da abbinare a `staggerParent`. */
export const staggerChild = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: tEnter },
};
