import React from 'react';
import { useComposition } from './engine';

/* K AI — colonna sonora ed effetti dell'introduzione.
 *
 * PERCHÉ SINTETIZZATA E NON FILE AUDIO
 * Il pezzo è già interamente codice: tenere anche il suono in codice
 * significa nessun asset binario da spedire nel bundle, sincronizzazione
 * esatta sulle stesse costanti temporali della coreografia (l'oggetto TM),
 * e la possibilità di ritoccare una battuta cambiando un numero invece di
 * riesportare un wav.
 *
 * IL CONTRATTO CON L'ESPORTATORE — LEGGERE PRIMA DI MODIFICARE
 * animations-v3 spiega che l'esportatore video cerca ogni fotogramma con
 * un seek sincrono e serializza subito: la grafica deve essere funzione
 * pura di T. L'audio è l'eccezione strutturale, perché suona nel tempo
 * reale e non può essere "renderizzato a T". Per non rompere l'export
 * questo modulo:
 *   - non tocca MAI l'albero visibile (il componente rende null);
 *   - suona solo durante una riproduzione autentica: playing === true e
 *     avanzamento in avanti e piccolo (un seek salta oltre la soglia);
 *   - al primo segnale anomalo tace e si risincronizza.
 * Il risultato è che in esportazione questo file è silenzioso e inerte.
 *
 * L'AUDIO NON FINISCE NEL VIDEO ESPORTATO
 * L'esportatore serializza fotogrammi, non cattura il Web Audio: l'mp4 che
 * produce è muto. Per questo esiste anche `renderScoreToWav()`, che rende
 * la stessa identica partitura in un file offline: quel wav si affianca al
 * video muto con un solo comando ffmpeg (istruzioni in fondo al file).
 */

/* ─────────────────────────────────────────────────────────────────────────
   Nomi di nota → frequenza
   ───────────────────────────────────────────────────────────────────── */

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** f('A3') → 220. Accetta diesis (C#4) e bemolle (Eb4). */
function f(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return 440;
  const midi = 12 * (parseInt(m[3], 10) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/* Generatore pseudo-casuale con seme.
   Serve a rendere identiche la riproduzione dal vivo e quella offline: con
   Math.random il rumore e le micro-variazioni della digitazione cambierebbero
   a ogni ascolto, e il wav non corrisponderebbe a ciò che si sente. */
function seeded(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   Armonia: un accordo per scena
   La progressione resta nella famiglia di La minore / Do maggiore: apre
   sospesa sul logo, si scalda quando l'app si costruisce, si incupisce
   appena sull'analisi dell'errore, e torna a casa sulla chiusura.
   ───────────────────────────────────────────────────────────────────── */

const CHORDS = {
  Logo:      { pad: ['A2', 'E3', 'A3', 'C4'],  bass: 'A1', color: 'am'  },
  Apri:      { pad: ['F2', 'C3', 'F3', 'A3'],  bass: 'F1', color: 'F'   },
  Scrivi:    { pad: ['C3', 'G3', 'C4', 'E4'],  bass: 'C2', color: 'C'   },
  Analisi:   { pad: ['D3', 'A3', 'D4', 'F4'],  bass: 'D2', color: 'dm'  },
  Trovato:   { pad: ['E3', 'B3', 'E4', 'G4'],  bass: 'E2', color: 'em'  },
  Correggi:  { pad: ['F2', 'C3', 'F3', 'A3'],  bass: 'F1', color: 'F'   },
  Riepilogo: { pad: ['G2', 'D3', 'G3', 'B3'],  bass: 'G1', color: 'G'   },
  Chiusura:  { pad: ['A2', 'E3', 'A3', 'C4'],  bass: 'A1', color: 'am'  },
};

/** Note dell'arpeggio per scena: pentatonica, sempre consonante sull'accordo. */
const ARP = {
  Logo:      ['A4', 'C5', 'E5', 'C5'],
  Apri:      ['F4', 'A4', 'C5', 'A4'],
  Scrivi:    ['C5', 'E5', 'G5', 'E5'],
  Analisi:   ['D5', 'F5', 'A5', 'F5'],
  Trovato:   ['E5', 'G5', 'B5', 'G5'],
  Correggi:  ['F4', 'A4', 'C5', 'E5'],
  Riepilogo: ['G4', 'B4', 'D5', 'B4'],
  Chiusura:  ['A4', 'C5', 'E5', 'A5'],
};

/** Quanto è presente l'arpeggio in ogni scena (0 = tacito). */
const ARP_LEVEL = {
  Logo: 0, Apri: 0.30, Scrivi: 0.55, Analisi: 0.22,
  Trovato: 0.30, Correggi: 0.62, Riepilogo: 0.45, Chiusura: 0.18,
};

/**
 * Quanto sta avanti la musica in ogni scena.
 *
 * Serve a dare respiro: a livello costante il pezzo diventa un tappeto
 * uniforme e gli effetti — che sono quelli che raccontano l'azione — non
 * emergono. La musica arretra dove parlano i suoni (la digitazione, la
 * scoperta dell'errore) e cresce dove deve portare lei (il riepilogo, la
 * chiusura).
 */
const SCENE_LEVEL = {
  Logo: 0.52, Apri: 0.46, Scrivi: 0.26, Analisi: 0.38,
  Trovato: 0.34, Correggi: 0.40, Riepilogo: 0.60, Chiusura: 0.50,
};

const BPM = 80;
const BEAT = 60 / BPM;      // 0.75 s
const EIGHTH = BEAT / 2;    // 0.375 s

/* ─────────────────────────────────────────────────────────────────────────
   Motore audio
   ───────────────────────────────────────────────────────────────────── */

export class ScoreEngine {
  // TypeScript vuole i campi dichiarati; sono tutti nodi Web Audio o numeri.
  ctx: any; rnd: any;
  master: any; comp: any; limiter: any;
  musicBus: any; sfxBus: any; verb: any; verbSend: any;
  noise: any; padVoices: any[]; bassVoice: any; airVoice: any;
  currentChord: any; started: boolean;
  sceneLevel: number; volumeScale: number;

  constructor(ctx, opts) {
    const o = opts || {};
    this.ctx = ctx;
    this.rnd = seeded(20260817);

    // Catena principale: tutto passa da un compressore morbido, così i
    // colpi degli effetti non fanno saltare il livello sopra la musica.
    // Il fattore porta il picco intorno a -4 dBFS a volume pieno: senza, la
    // partitura restava a 0.2 di picco e usciva molto più piano di qualsiasi
    // altra cosa il pubblico stia ascoltando. Misurato: a 2.6 i transitori
    // arrivavano a 0.99 e sfioravano il clipping, a 1.9 stanno intorno a 0.7.
    this.master = ctx.createGain();
    this.volumeScale = 1.9;
    this.master.gain.value = (o.volume == null ? 0.85 : o.volume) * this.volumeScale;

    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.knee.value = 24;
    this.comp.ratio.value = 3;
    this.comp.attack.value = 0.006;
    this.comp.release.value = 0.22;

    // Limitatore di sicurezza dopo il volume principale: il compressore
    // sopra modella la dinamica, questo garantisce solo che nulla superi
    // lo zero, anche alzando il volume al massimo o accavallando effetti.
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -3.5;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.0008;
    this.limiter.release.value = 0.12;

    // La musica sta sotto, gli effetti sopra: sono loro a raccontare cosa
    // succede sullo schermo, la musica tiene solo il tono.
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.52;
    this.sceneLevel = 0.52;
    // 2.2 e non 1: misurando la resa, clic, ticchettii e pop restavano sotto
    // l'energia del tappeto musicale e venivano mascherati. Sono suoni molto
    // brevi, quindi alzarli non gonfia il livello medio — il limitatore in
    // coda tiene comunque i transitori sotto lo zero.
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 2.2;

    // Riverbero corto: dà aria senza impastare: la voce del pezzo è la
    // grafica, la musica deve stare sotto.
    this.verb = ctx.createConvolver();
    this.verb.buffer = this._impulse(1.9, 2.6);
    this.verbSend = ctx.createGain();
    this.verbSend.gain.value = 0.20;

    this.musicBus.connect(this.comp);
    this.sfxBus.connect(this.comp);
    this.musicBus.connect(this.verbSend);
    this.sfxBus.connect(this.verbSend);
    this.verbSend.connect(this.verb);
    this.verb.connect(this.comp);
    this.comp.connect(this.master);
    this.master.connect(this.limiter);
    this.limiter.connect(ctx.destination);

    this.noise = this._noiseBuffer(2.5);

    this.padVoices = [];
    this.bassVoice = null;
    this.airVoice = null;
    this.currentChord = null;
    this.started = false;
  }

  /**
   * Nessun evento può essere programmato nel passato.
   *
   * Il componente calcola l'istante come `ora + (battuta - T)`: se la battuta
   * è appena passata quel valore diventa negativo, e setValueAtTime lancia
   * "Time must be a finite non-negative number", portandosi dietro l'intero
   * render della composizione. Un colpo leggermente in ritardo va suonato
   * subito, non deve far cadere il pezzo.
   */
  _when(t) {
    const now = this.ctx.currentTime;
    if (t == null || !isFinite(t)) return now;
    return t < now ? now : t;
  }

  /* ---- sorgenti di base ---- */

  _noiseBuffer(secs) {
    const n = Math.floor(this.ctx.sampleRate * secs);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = this.rnd() * 2 - 1;
    return buf;
  }

  /** Riverbero sintetico: rumore con coda esponenziale. */
  _impulse(secs, decay) {
    const rate = this.ctx.sampleRate;
    const n = Math.floor(rate * secs);
    const buf = this.ctx.createBuffer(2, n, rate);
    const r = seeded(7717);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) {
        d[i] = (r() * 2 - 1) * Math.pow(1 - i / n, decay);
      }
    }
    return buf;
  }

  _noiseSource() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    return s;
  }

  /* ---- strati musicali continui ---- */

  startBeds(when?) {
    if (this.started) return;
    this.started = true;
    const ctx = this.ctx;
    const t = this._when(when);

    // Aria: rumore filtratissimo, appena percepibile. Toglie il "vuoto
    // digitale" tra un evento e l'altro.
    const air = this._noiseSource();
    const airFilt = ctx.createBiquadFilter();
    airFilt.type = 'bandpass';
    airFilt.frequency.value = 900;
    airFilt.Q.value = 0.6;
    const airGain = ctx.createGain();
    airGain.gain.setValueAtTime(0, t);
    airGain.gain.linearRampToValueAtTime(0.016, t + 3);
    air.connect(airFilt).connect(airGain).connect(this.musicBus);
    air.start(t);
    this.airVoice = { src: air, gain: airGain };
  }

  /** Cambia accordo con una dissolvenza lenta: le scene non devono "scattare". */
  setChord(name, when?, fade?) {
    const chord = CHORDS[name];
    if (!chord || this.currentChord === name) return;
    this.currentChord = name;

    const ctx = this.ctx;
    const t = this._when(when);
    const dur = fade == null ? 2.2 : fade;

    // Il livello della scena entra insieme all'accordo, con la stessa rampa.
    // Il punto di partenza è il livello tracciato in `sceneLevel`, non
    // gain.value: stesso motivo per cui la dissolvenza delle voci non lo
    // legge (vedi il commento poco sotto).
    const lvl = SCENE_LEVEL[name] == null ? 0.45 : SCENE_LEVEL[name];
    const from = this.sceneLevel;
    this.sceneLevel = lvl;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setValueAtTime(from, t);
    this.musicBus.gain.linearRampToValueAtTime(lvl, t + dur * 0.9);

    // Spegni le voci precedenti lasciandole sfumare.
    //
    // Il livello di partenza va preso dal valore memorizzato alla creazione,
    // MAI da gain.value: in un OfflineAudioContext la programmazione avviene
    // tutta prima del rendering, quindi quel getter restituisce ancora il
    // default 1 e non il livello reale (~0.02). Leggendolo, ogni cambio di
    // scena alzava le voci uscenti a volume pieno invece di spegnerle: si
    // accumulavano scena dopo scena e il pezzo finiva in clipping.
    this.padVoices.forEach((v) => {
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setValueAtTime(v.peak, t);
      v.gain.gain.linearRampToValueAtTime(0.0001, t + dur);
      try { v.osc.stop(t + dur + 0.2); } catch (e) { /* già fermata */ }
    });
    this.padVoices = [];

    if (this.bassVoice) {
      const b = this.bassVoice;
      b.gain.gain.cancelScheduledValues(t);
      b.gain.gain.setValueAtTime(b.peak, t);
      b.gain.gain.linearRampToValueAtTime(0.0001, t + dur);
      try { b.osc.stop(t + dur + 0.2); } catch (e) { /* già fermata */ }
      this.bassVoice = null;
    }

    // Tappeto: ogni nota è una coppia leggermente scordata, che dà spessore
    // senza bisogno di più oscillatori.
    chord.pad.forEach((note, i) => {
      const base = f(note);
      [-3.5, 3.5].forEach((cents, k) => {
        const osc = ctx.createOscillator();
        osc.type = k === 0 ? 'sine' : 'triangle';
        osc.frequency.value = base * Math.pow(2, cents / 1200);

        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = 1500 + i * 260;
        filt.Q.value = 0.4;

        const g = ctx.createGain();
        const peak = (0.085 / chord.pad.length) * (k === 0 ? 1 : 0.55);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + dur * 0.8);

        osc.connect(filt).connect(g).connect(this.musicBus);
        osc.start(t);
        this.padVoices.push({ osc: osc, gain: g, peak: peak });
      });
    });

    // Basso: una sinusoide sola, tenuta bassa di livello.
    const bosc = ctx.createOscillator();
    bosc.type = 'sine';
    bosc.frequency.value = f(chord.bass);
    const bfil = ctx.createBiquadFilter();
    bfil.type = 'lowpass';
    bfil.frequency.value = 220;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.linearRampToValueAtTime(0.10, t + dur * 0.7);
    bosc.connect(bfil).connect(bg).connect(this.musicBus);
    bosc.start(t);
    this.bassVoice = { osc: bosc, gain: bg, peak: 0.10 };
  }

  /* ---- voci brevi ---- */

  /** Nota pizzicata: attacco immediato, coda esponenziale. */
  pluck(freq, when, level?, decay?, type?) {
    const ctx = this.ctx;
    const t = this._when(when);
    const d = decay || 0.9;
    const osc = ctx.createOscillator();
    osc.type = type || 'triangle';
    osc.frequency.value = freq;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(4200, t);
    filt.frequency.exponentialRampToValueAtTime(900, t + d);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(level, 0.0002), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(filt).connect(g).connect(this.musicBus);
    osc.start(t);
    osc.stop(t + d + 0.05);
  }

  /** Campanella: due parziali, coda lunga. Per il logo e la chiusura. */
  bell(freq, when, level?, decay?) {
    const ctx = this.ctx;
    const t = this._when(when);
    const d = decay || 2.4;
    [[1, 1], [2.76, 0.32]].forEach(([mult, amp]) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(level * amp, 0.0002), t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d * (mult === 1 ? 1 : 0.55));
      osc.connect(g).connect(this.sfxBus);
      osc.start(t);
      osc.stop(t + d + 0.1);
    });
  }

  /** Sbuffo di rumore filtrato: tratti del logo, whoosh, scorrimenti. */
  swish(when, opts?) {
    const ctx = this.ctx;
    const o = opts || {};
    const t = this._when(when);
    const d = o.dur || 0.34;
    const src = this._noiseSource();
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.Q.value = o.q || 1.1;
    const fromF = o.from || 700;
    const toF = o.to || 2600;
    filt.frequency.setValueAtTime(fromF, t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(toF, 40), t + d);
    const g = ctx.createGain();
    const lvl = o.level == null ? 0.10 : o.level;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(lvl, t + d * 0.28);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(filt).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + d + 0.05);
  }

  /** Ticchettio secco: un tasto, un elemento che compare. */
  tick(when, opts?) {
    const ctx = this.ctx;
    const o = opts || {};
    const t = this._when(when);
    const d = o.dur || 0.045;
    const src = this._noiseSource();
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = o.freq || 2400;
    filt.Q.value = 2.2;
    const g = ctx.createGain();
    const lvl = o.level == null ? 0.055 : o.level;
    g.gain.setValueAtTime(lvl, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(filt).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + d + 0.02);

    // Un filo di tono sotto il click: senza, i tasti suonano come statica.
    if (o.tone !== false) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = o.freq ? o.freq * 0.45 : 900;
      const og = ctx.createGain();
      og.gain.setValueAtTime(lvl * 0.5, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + d * 1.6);
      osc.connect(og).connect(this.sfxBus);
      osc.start(t);
      osc.stop(t + d * 1.6 + 0.02);
    }
  }

  /** Tonfo morbido: incolla, elemento pesante che atterra. */
  thunk(when, level?) {
    const ctx = this.ctx;
    const t = this._when(when);
    const lvl = level == null ? 0.16 : level;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(64, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(lvl, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.3);
    this.tick(t, { freq: 1500, level: lvl * 0.3, dur: 0.03, tone: false });
  }

  /** Clic del mouse: pressione e rilascio, due timbri diversi. */
  mouseClick(when?) {
    const t = this._when(when);
    this.tick(t, { freq: 3000, level: 0.075, dur: 0.028, tone: false });
    this.tick(t + 0.055, { freq: 2100, level: 0.045, dur: 0.024, tone: false });
  }

  /** Segnale d'errore: due note discendenti, mai stridulo. */
  alert(when?) {
    const t = this._when(when);
    this.pluck(f('F4'), t, 0.13, 0.5, 'sine');
    this.pluck(f('B3'), t + 0.17, 0.14, 0.9, 'sine');
    this.swish(t, { from: 1800, to: 320, dur: 0.5, level: 0.05, q: 1.6 });
  }

  /** Conferma: terzina ascendente. Per "compila". */
  chime(when, notes?) {
    const t = this._when(when);
    const ns = notes || ['C5', 'E5', 'G5'];
    ns.forEach((n, i) => this.bell(f(n), t + i * 0.085, 0.085, 1.7));
  }

  /* ---- controllo ---- */

  setVolume(v, when?) {
    const t = this._when(when);
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(v * this.volumeScale, t, 0.05);
  }

  /** Zittisce le voci brevi e abbassa i letti: usato su seek e pausa. */
  hush() {
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(0.0001, t, 0.06);
  }

  resume() {
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(this.sceneLevel, t, 0.12);
  }

  /** Dissolvenza finale: il pezzo deve chiudere, non essere troncato. */
  fadeOut(when?, dur?) {
    const t = this._when(when);
    const d = dur == null ? 2.6 : dur;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setValueAtTime(this.sceneLevel, t);
    this.musicBus.gain.linearRampToValueAtTime(0.0001, t + d);
    this.sceneLevel = 0.0001;
  }

  dispose() {
    try { this.padVoices.forEach((v) => v.osc.stop()); } catch (e) { /* ok */ }
    try { if (this.bassVoice) this.bassVoice.osc.stop(); } catch (e) { /* ok */ }
    try { if (this.airVoice) this.airVoice.src.stop(); } catch (e) { /* ok */ }
    try { this.master.disconnect(); } catch (e) { /* ok */ }
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   La partitura: eventi in tempo autoriale
   Le costanti sono le STESSE di TM in kai-intro-v2.jsx. Se una battuta
   della coreografia si sposta, va spostata anche qui — sono due letture
   dello stesso montaggio.
   ───────────────────────────────────────────────────────────────────── */

function buildScore(CUES, authoredTotal) {
  const A = CUES.Apri, S = CUES.Scrivi, N = CUES.Analisi, F_ = CUES.Trovato,
    R = CUES.Correggi, P = CUES.Riepilogo, Z = CUES.Chiusura;
  const ev = [];
  const add = (at, kind, opts) => { if (isFinite(at)) ev.push({ at: at, kind: kind, o: opts || {} }); };

  /* ── Logo: il monogramma si costruisce ── */
  add(0.15, 'bell', { note: 'A4', level: 0.075, decay: 3.2 });
  add(0.5,  'swish', { from: 500, to: 2200, dur: 0.5, level: 0.075 });   // asta
  add(1.6,  'swish', { from: 700, to: 2600, dur: 0.42, level: 0.08 });   // diagonali
  add(1.78, 'swish', { from: 900, to: 3000, dur: 0.38, level: 0.06 });
  add(2.9,  'bell', { note: 'E5', level: 0.07, decay: 2.6 });            // "AI"
  add(3.9,  'swish', { from: 1400, to: 420, dur: 0.6, level: 0.055 });   // la linea

  /* ── Apri: il logo scende, l'interfaccia si costruisce ── */
  add(A - 1.4, 'swish', { from: 2400, to: 600, dur: 0.9, level: 0.085, q: 0.8 });
  add(A + 0.55, 'tick', { freq: 1800, level: 0.05 });
  // I quattro pezzi dell'interfaccia entrano in scala ascendente
  [[A + 0.2, 1500], [A + 0.4, 1750], [A + 0.8, 2050], [A + 1.2, 2400]]
    .forEach(([at, fr]) => add(at, 'tick', { freq: fr, level: 0.05 }));

  /* ── Scrivi: cursore, digitazione, incolla, invio ── */
  add(S + 0.1, 'tick', { freq: 2600, level: 0.03, tone: false });        // cursore entra
  add(S + 1.3, 'typing', { dur: 3.8, rate: 13 });                        // l'utente scrive
  add(S + 5.5, 'thunk', { level: 0.15 });                                // incolla lo stack trace
  add(S + 7.5, 'click', {});                                             // clic su invia
  add(S + 7.7, 'swish', { from: 600, to: 3200, dur: 0.34, level: 0.09 }); // il messaggio parte
  add(S + 7.85, 'pluck', { note: 'C5', level: 0.06, decay: 0.6 });

  /* ── Analisi: K AI pensa ── */
  add(N + 0.3, 'pluck', { note: 'G4', level: 0.05, decay: 1.1 });
  // Pulsazione dei puntini "sta pensando"
  for (let i = 0; i < 8; i++) {
    add(N + 0.6 + i * 0.42, 'tick', { freq: 1200 + (i % 3) * 180, level: 0.022, tone: false });
  }

  /* ── Trovato: l'errore, la causa, la spiegazione ── */
  add(F_ + 0.9, 'alert', {});                                            // la riga che lancia la NPE
  add(F_ + 2.7, 'pluck', { note: 'D4', level: 0.13, decay: 1.3 });      // la causa
  add(F_ + 4.5, 'pluck', { note: 'A4', level: 0.105, decay: 1.5 });       // la spiegazione

  /* ── Correggi: il codice giusto compare riga per riga ── */
  add(R + 0.3, 'swish', { from: 1600, to: 700, dur: 0.7, level: 0.045, q: 0.9 }); // scorrimento
  add(R + 1.1, 'tick', { freq: 1900, level: 0.04 });                     // etichetta
  add(R + 1.5, 'lines', { count: 8, gap: 0.26 });                        // le righe corrette
  add(R + 6.1, 'chime', { notes: ['C5', 'E5', 'G5'] });                  // compila

  /* ── Riepilogo: tre passaggi in tipografia grande ── */
  add(P + 1.7, 'swish', { from: 2000, to: 500, dur: 1.1, level: 0.05, q: 0.7 });
  [0, 0.55, 1.1].forEach((d, i) =>
    add(P + 2.6 + d, 'pluck', { note: ['F4', 'A4', 'C5'][i], level: 0.115, decay: 1.4 }));

  /* ── Chiusura: il logo torna, la tagline ── */
  add(Z + 0.1, 'swish', { from: 900, to: 2800, dur: 1.2, level: 0.05, q: 0.6 });
  add(Z + 1.1, 'bell', { note: 'A4', level: 0.085, decay: 3.4 });
  add(Z + 2.4, 'swish', { from: 1500, to: 500, dur: 0.7, level: 0.04 });
  add(Z + 3.0, 'bell', { note: 'E5', level: 0.07, decay: 3.8 });
  add(Z + 3.6, 'bell', { note: 'A5', level: 0.05, decay: 4.2 });

  ev.sort((a, b) => a.at - b.at);
  return ev;
}

/** Nome della scena attiva a un dato istante autoriale. */
function sceneAt(CUES, order, t) {
  let name = order[0];
  for (let i = 0; i < order.length; i++) {
    if (t + 1e-6 >= CUES[order[i]]) name = order[i];
  }
  return name;
}

/**
 * Esegue un evento della partitura sul motore.
 * `when` è il tempo AudioContext in cui deve suonare.
 */
function playEvent(eng, e, when, rnd) {
  const o = e.o;
  switch (e.kind) {
    case 'bell':   eng.bell(f(o.note), when, o.level, o.decay); break;
    case 'pluck':  eng.pluck(f(o.note), when, o.level, o.decay, o.type); break;
    case 'swish':  eng.swish(when, o); break;
    case 'tick':   eng.tick(when, o); break;
    case 'thunk':  eng.thunk(when, o.level); break;
    case 'click':  eng.mouseClick(when); break;
    case 'alert':  eng.alert(when); break;
    case 'chime':  eng.chime(when, o.notes); break;

    case 'typing': {
      // Raffica di tasti con ritmo irregolare: a passo fisso suona finto.
      const n = Math.round(o.dur * o.rate);
      for (let i = 0; i < n; i++) {
        const jitter = (rnd() - 0.5) * (1 / o.rate) * 0.8;
        const at = when + (i / o.rate) + jitter;
        if (at < when) continue;
        eng.tick(at, { freq: 2100 + rnd() * 1100, level: 0.028 + rnd() * 0.016, dur: 0.035 });
        // ogni tanto una pausa di respiro, come chi pensa mentre scrive
        if (i > 0 && i % 11 === 0) i += 1;
      }
      break;
    }

    case 'lines': {
      // Le righe di codice che compaiono una dopo l'altra, in salita
      for (let i = 0; i < o.count; i++) {
        eng.tick(when + i * o.gap, { freq: 1500 + i * 95, level: 0.034 });
      }
      break;
    }

    default: break;
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   Componente: aggancia la partitura all'orologio della composizione
   ───────────────────────────────────────────────────────────────────── */

export function ScoreTrack(props) {
  const enabled = props.enabled !== false;
  const volume = props.volume == null ? 0.85 : props.volume;

  const comp = useComposition();
  const T = comp.T;
  const CUES = comp.CUES;
  const playing = comp.playing;
  const authoredTotal = comp.authoredTotal;

  const engRef = React.useRef(null);
  const lastRef = React.useRef(null);       // ultimo T osservato
  const rndRef = React.useRef(seeded(4242));
  const armedRef = React.useRef(false);     // AudioContext sbloccato da un gesto?

  const order = React.useMemo(() => Object.keys(CHORDS), []);
  const score = React.useMemo(() => buildScore(CUES, authoredTotal), [CUES, authoredTotal]);

  // L'AudioContext non può partire senza un gesto dell'utente.
  //
  // Non basta però restare in ascolto del PROSSIMO gesto: `enabled` diventa
  // vero proprio perché l'utente ha premuto play, quindi registrando solo i
  // listener si perderebbe quel clic e la musica partirebbe al successivo.
  // Si prova quindi ad armare subito — a quel punto la pagina ha già
  // l'attivazione dell'utente e il browser lo consente — tenendo i listener
  // come rete di sicurezza per i casi in cui non l'avesse.
  React.useEffect(() => {
    if (!enabled) return undefined;

    const arm = () => {
      if (armedRef.current) return;
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      try {
        const ctx = new AC();
        engRef.current = new ScoreEngine(ctx, { volume: volume });
        engRef.current.startBeds();
        // Se il browser lo apre sospeso, il gesto in corso basta a riprenderlo.
        if (ctx.state === 'suspended') ctx.resume().catch(() => { /* al prossimo gesto */ });
        armedRef.current = true;
      } catch (err) {
        // Nessun audio disponibile: il pezzo resta perfettamente guardabile.
        armedRef.current = true;
      }
    };

    arm();
    if (armedRef.current) return undefined;

    window.addEventListener('pointerdown', arm);
    window.addEventListener('keydown', arm);
    return () => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
    };
  }, [enabled, volume]);

  React.useEffect(() => {
    const eng = engRef.current;
    if (eng) eng.setVolume(enabled ? volume : 0);
  }, [enabled, volume]);

  React.useEffect(() => () => {
    if (engRef.current) engRef.current.dispose();
  }, []);

  // Un passo per fotogramma. Volutamente senza array di dipendenze: deve
  // girare a ogni commit, che è quando il tempo è cambiato.
  React.useEffect(() => {
    const eng = engRef.current;
    const prev = lastRef.current;
    lastRef.current = T;

    if (!eng || !enabled) return;
    if (prev == null) return;

    const dt = T - prev;

    // Riproduzione autentica: sta suonando e il tempo è avanzato di un passo
    // piccolo. Un salto (seek, cambio capitolo) supera la soglia e non suona.
    //
    // Qui NON si guarda il tempo di parete. Sembrava una difesa sensata
    // contro le raffiche di seek, ma React emette più render per ogni tick
    // dell'orologio — il figlio si aggiorna, poi il genitore che riceve
    // onTime — e quello che porta l'avanzamento arriva anche 2 ms dopo il
    // precedente. La condizione scartava proprio i fotogrammi buoni: musica
    // ed effetti restavano muti per intero. A distinguere una riproduzione
    // da uno scorrimento bastano `playing` e l'ampiezza del passo.
    const realPlayback = playing && dt > 0 && dt < 0.4;
    if (!realPlayback) {
      eng.hush();
      return;
    }
    eng.resume();

    const ctx = eng.ctx;
    // Lo scarto tra il commit React e l'orologio audio: un filo di anticipo
    // evita che una nota cada nel passato e venga scartata.
    const base = ctx.currentTime + 0.02;

    // Accordo della scena corrente
    eng.setChord(sceneAt(CUES, order, T), base, 2.2);

    // Arpeggio: quali ottavi cadono nella finestra appena percorsa
    const scene = sceneAt(CUES, order, T);
    const level = ARP_LEVEL[scene] || 0;
    if (level > 0) {
      const notes = ARP[scene] || ARP.Logo;
      const first = Math.ceil(prev / EIGHTH);
      const last = Math.floor(T / EIGHTH);
      for (let k = first; k <= last; k++) {
        const at = base + (k * EIGHTH - T);
        if (at < ctx.currentTime) continue;
        // Il secondo ottavo di ogni movimento è più tenue: dà oscillazione
        const soft = k % 2 === 1 ? 0.55 : 1;
        eng.pluck(f(notes[k % notes.length]), at, 0.05 * level * soft, 0.75);
      }
    }

    // Effetti la cui battuta è stata attraversata in questo fotogramma.
    // L'istante può cadere prima di `base` quando la battuta sta all'inizio
    // della finestra appena percorsa: il motore lo riporta a "adesso"
    // (_when), qui lo teniamo comunque non negativo.
    for (let i = 0; i < score.length; i++) {
      const e = score[i];
      if (e.at > prev && e.at <= T) {
        playEvent(eng, e, Math.max(base + (e.at - T), ctx.currentTime), rndRef.current);
      }
    }
  });

  return null;
}

/* ─────────────────────────────────────────────────────────────────────────
   Resa offline in WAV
   L'esportatore video serializza fotogrammi e non cattura il Web Audio,
   quindi l'mp4 esce muto. Questa funzione rende la stessa partitura in un
   file, da affiancare al video con:
   ffmpeg -i video.mp4 -i colonna-sonora.wav -c:v copy -c:a aac -shortest finale.mp4
   ───────────────────────────────────────────────────────────────────── */

function encodeWav(buffer) {
  const chans = buffer.numberOfChannels;
  const frames = buffer.length;
  const rate = buffer.sampleRate;
  const bytes = frames * chans * 2;
  const ab = new ArrayBuffer(44 + bytes);
  const view = new DataView(ab);
  const str = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

  str(0, 'RIFF');
  view.setUint32(4, 36 + bytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);            // PCM
  view.setUint16(22, chans, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * chans * 2, true);
  view.setUint16(32, chans * 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, bytes, true);

  const data = [];
  for (let c = 0; c < chans; c++) data.push(buffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < chans; c++) {
      let s = data[c][i];
      s = s < -1 ? -1 : s > 1 ? 1 : s;
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

/**
 * Rende l'intera colonna sonora e la scarica.
 * Usa il tempo autoriale: se il montaggio non è stato ritagliato sulla
 * timeline dell'host, coincide con quello di riproduzione.
 */
export async function renderScoreToWav(CUES, authoredTotal, opts) {
  const o = opts || {};
  const rate = o.sampleRate || 44100;
  const tail = 3;                      // coda per le campanelle finali
  const total = authoredTotal + tail;
  const OAC = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (!OAC) throw new Error('OfflineAudioContext non disponibile in questo browser');

  const ctx = new OAC(2, Math.ceil(total * rate), rate);
  const eng = new ScoreEngine(ctx, { volume: o.volume == null ? 0.85 : o.volume });
  eng.startBeds(0);

  const order = Object.keys(CHORDS);
  const rnd = seeded(4242);

  // Accordi alle rispettive scene
  order.forEach((name) => {
    const at = CUES[name];
    if (isFinite(at)) eng.setChord(name, Math.max(at - 0.6, 0), 2.2);
  });

  // Arpeggio su tutta la durata
  for (let k = 0; k * EIGHTH < authoredTotal; k++) {
    const at = k * EIGHTH;
    const scene = sceneAt(CUES, order, at);
    const level = ARP_LEVEL[scene] || 0;
    if (level <= 0) continue;
    const notes = ARP[scene] || ARP.Logo;
    const soft = k % 2 === 1 ? 0.55 : 1;
    eng.pluck(f(notes[k % notes.length]), at, 0.05 * level * soft, 0.75);
  }

  // Effetti
  buildScore(CUES, authoredTotal).forEach((e) => playEvent(eng, e, e.at, rnd));

  // Chiusura: la musica si spegne sull'ultima inquadratura invece di
  // essere tagliata di netto alla fine del file.
  eng.fadeOut(Math.max(authoredTotal - 2.6, 0), 2.6);

  const rendered = await ctx.startRendering();
  return encodeWav(rendered);
}

/**
 * Ricava la tabella dei cue dalla stringa OM_SCENES.
 *
 * Ripete la stessa aritmetica di ccDerive in animations-v3 (somma corrente
 * di `nat`, con `dur` come ripiego). Serve al pannello dei controlli, che
 * sta FUORI da CompositionStage e quindi non può chiamare useComposition().
 */
export function cuesFromScenes(raw) {
  let scenes;
  try {
    scenes = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
  } catch (e) {
    scenes = [];
  }
  const table = Object.create(null);
  let authStart = 0;
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const nat = typeof s.nat === 'number' && isFinite(s.nat) && s.nat > 0 ? s.nat : s.dur;
    if (!Object.prototype.hasOwnProperty.call(table, s.name)) {
      table[s.name] = Math.round(authStart * 1000) / 1000;
    }
    authStart += nat;
  }
  return { CUES: table, authoredTotal: Math.round(authStart * 1000) / 1000 };
}

/** Scarica il wav reso, con un nome parlante. */
export async function downloadScore(CUES, authoredTotal, opts) {
  const blob = await renderScoreToWav(CUES, authoredTotal, opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'k-ai-colonna-sonora.wav';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
/* ─────────────────────────────────────────────────────────────────────────
   COME OTTENERE IL VIDEO CON L'AUDIO

   1. Esporta il video dall'editor come al solito: esce muto, perché
      l'esportatore serializza fotogrammi e non registra il Web Audio.
   2. Nel pannello dei controlli premi "Scarica la traccia (WAV)".
      Il file dura quanto il montaggio più ~3 secondi di coda, per non
      tagliare le campanelle finali.
   3. Uniscili senza ricodificare il video:

        ffmpeg -i video-muto.mp4 -i k-ai-colonna-sonora.wav \
               -c:v copy -c:a aac -b:a 192k -shortest finale.mp4

      `-c:v copy` ricopia il flusso video così com'è: nessuna perdita di
      qualità e nessuna attesa. `-shortest` chiude sul più corto dei due,
      cioè il video, scartando la coda audio in eccesso.

   Se hai ritagliato o accelerato una sezione sulla timeline dell'host, il
   wav resta sul tempo autoriale: rigeneralo dopo aver finito i ritocchi,
   così i due tempi coincidono.
   ───────────────────────────────────────────────────────────────────── */
