import React from 'react';
import {
  CompositionStage, useComposition, Captions,
  Easing, interpolate, animate, clamp,
} from './engine';
import { ScoreTrack } from './score';

/* K AI - video introduzione v2. Composizione continua.
 *
 * Coreografia portata alla lettera dal progetto Claude Design: sono cambiati
 * solo gli import in testa e l'involucro in fondo (l'originale leggeva i
 * comandi dell'editor da window, qui arrivano come props). Il corpo NON va
 * riscritto a mano: se il montaggio cambia, si riporta di nuovo da li'.
 */

/* K AI — video introduzione v2. Composizione continua su animations-v3. */

const APP_W = 1600, APP_H = 920;
const RAIL_W = 48, SIDE_W = 262, CHROME_H = 68, HEAD_H = 54;
const MAIN_X = RAIL_W + SIDE_W;

const THEMES = {
  chiaro: {
    desk: '#e7e5e0', win: '#ffffff', chrome: '#f2f3f5', chromeLine: '#e2e4e8',
    side: '#ffffff', line: '#e8eaee', pri: '#14161a', mut: '#7b828e',
    accent: '#6D5EFC', accentSoft: '#EFECFF', bubble: '#F2F3F5',
    code: '#F8F9FB', codeLine: '#E7E9EE', kw: '#7B4CE0', str: '#177A5C',
    cmt: '#9aa1ad', num: '#B45309', err: '#D6455D',
    ok: '#12855F', okSoft: '#E8F6F0', veil: '#ffffff', ink: '#14161a',
  },
  scuro: {
    desk: '#08090b', win: '#0F1216', chrome: '#14181D', chromeLine: '#20242c',
    side: '#111419', line: '#22262e', pri: '#E6E9EE', mut: '#7c8492',
    accent: '#10B981', accentSoft: '#10251F', bubble: '#1A1F26',
    code: '#141922', codeLine: '#232935', kw: '#A78BFA', str: '#5EEAD4',
    cmt: '#6b7383', num: '#FBBF24', err: '#F87171',
    ok: '#34D399', okSoft: '#10251F', veil: '#ffffff', ink: '#14161a',
  },
};

const SANS = "'Manrope', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const SERIF = "'Fraunces', 'Playfair Display', Georgia, serif";

const MOTION = {
  enter: (from, to, start, end) => animate({ from, to, start, end, ease: Easing.easeOutCubic }),
  glide: (from, to, start, end) => animate({ from, to, start, end, ease: Easing.easeInOutCubic }),
  pop: (from, to, start, end) => animate({ from, to, start, end, ease: Easing.easeOutBack }),
};
const cut = (s, t, start, dur) => s.slice(0, Math.round(clamp((t - start) / dur, 0, 1) * s.length));

/* ── codice (uguale nelle due lingue, solo i commenti cambiano) ──────── */
const BUG16 = [
  '@EventHandler',
  'public void onJoin(PlayerJoinEvent e) {',
  '    String msg = getConfig().getString("messages.welcome");',
  '    e.getPlayer().sendMessage(',
  '        msg.replace("%player%", e.getPlayer().getName()));',
  '}',
];
const BUG9 = [
  '@EventHandler',
  'public void onJoin(PlayerJoinEvent e) {',
  '    String msg = getConfig()',
  '        .getString("messages.welcome");',
  '    e.getPlayer().sendMessage(',
  '        msg.replace("%player%",',
  '            e.getPlayer().getName()));',
  '}',
];
const TRACE16 = [
  'java.lang.NullPointerException: Cannot invoke "String.replace(...)"',
  '  because "msg" is null   at KitPlugin.onJoin(KitPlugin.java:5)',
];
const TRACE9 = [
  'java.lang.NullPointerException:',
  '  Cannot invoke "String.replace(...)"',
  '  because "msg" is null',
  '  at KitPlugin.onJoin(KitPlugin.java:5)',
];
const fix16 = (c1, c2) => [
  '@Override',
  'public void onEnable() {',
  '    saveDefaultConfig();            ' + c1,
  '}',
  '',
  'String msg = getConfig().getString("messages.welcome",',
  '        "&aBenvenuto %player%!");   ' + c2,
  'e.getPlayer().sendMessage(msg.replace("%player%",',
  '        e.getPlayer().getName()));',
];
const fix9 = (c1, c2) => [
  '@Override',
  'public void onEnable() {',
  '    saveDefaultConfig();',
  '    ' + c1,
  '}',
  '',
  'String msg = getConfig().getString(',
  '    "messages.welcome",',
  '    "&aBenvenuto %player%!");   ' + c2,
  'e.getPlayer().sendMessage(',
  '    msg.replace("%player%",',
  '        e.getPlayer().getName()));',
];

/* ── testi per lingua ────────────────────────────────────────────────── */
const LANG = {
  IT: {
    ask: 'Vorrei capire perché il mio codice dà questo errore',
    thinking: 'Analizzo il problema',
    hi: 8,
    expl16: [
      'Trovato. getConfig().getString("messages.welcome") restituisce',
      'null: la chiave non esiste in config.yml, perché il file di',
      'default non viene mai creato. Chiamare .replace() su null',
      'lancia la NullPointerException alla riga 5.',
    ],
    expl9: [
      'Trovato. getConfig()',
      '  .getString("messages.welcome")',
      'restituisce null: la chiave non',
      'esiste in config.yml, perché il file',
      'di default non viene mai creato.',
      'Chiamare .replace() su null lancia',
      'la NullPointerException.',
    ],
    cmt1: '// crea config.yml se manca',
    cmt2: '// fallback: mai null',
    fixLabel: 'Codice corretto',
    badge: 'COMPILA ✓',
    header: 'Errore NPE onJoin',
    steps: ['Legge il contesto', 'Trova la causa', 'Scrive il fix'],
    tagline: 'K AI, il programmatore d\u2019eccellenza',
    caps: [
      'Specializzato in plugin e mod Minecraft',
      'Incolli il codice e lo stack trace',
      'K AI legge il contesto del progetto',
      'Trova la riga che lancia la NullPointerException',
      'Spiega la causa, non solo il sintomo',
      'E restituisce il codice corretto',
    ],
    ui: {
      newConv: '+  Nuova conversazione', search: 'Cerca', convs: 'CONVERSAZIONI',
      placeholder: 'Scrivi a K AI…  (incolla pure uno screenshot)', send: 'Invia  →',
      hints: ['Invio invia', 'Shift+Invio a capo', 'Ctrl K cerca'],
      token: 'Token · finestra 4h', reset: 'reset tra 3h 57m', logout: 'Esci',
      tokenRight: 'K AI · 40k token nella finestra',
      items: ['ciao', 'Porta questo plugin da Spi…', 'Mod Fabric: aggiungi un m…', 'Perche ottengo NullPointe…', 'Config YAML del kit'],
      tab: 'K AI Code — Assistente di programmazione',
      paste: '+ stack trace',
    },
  },
  EN: {
    ask: 'I\u2019d like to understand why my code throws this error',
    thinking: 'Analyzing the problem',
    hi: 9,
    expl16: [
      'Found it. getConfig().getString("messages.welcome") returns',
      'null: the key is missing from config.yml, because the default',
      'file is never created. Calling .replace() on null throws',
      'the NullPointerException on line 5.',
    ],
    expl9: [
      'Found it. getConfig()',
      '  .getString("messages.welcome")',
      'returns null: the key is missing',
      'from config.yml, because the',
      'default file is never created.',
      'Calling .replace() on null throws',
      'the NullPointerException.',
    ],
    cmt1: '// creates config.yml if missing',
    cmt2: '// fallback: never null',
    fixLabel: 'Fixed code',
    badge: 'COMPILES ✓',
    header: 'NPE error in onJoin',
    steps: ['Reads the context', 'Finds the cause', 'Writes the fix'],
    tagline: 'K AI, programming excellence',
    caps: [
      'Built for Minecraft plugins and mods',
      'Paste your code and the stack trace',
      'K AI reads your project context',
      'It finds the line that throws the NullPointerException',
      'It explains the cause, not just the symptom',
      'And returns the fixed code',
    ],
    ui: {
      newConv: '+  New conversation', search: 'Search', convs: 'CONVERSATIONS',
      placeholder: 'Message K AI…  (screenshots welcome)', send: 'Send  →',
      hints: ['Enter to send', 'Shift+Enter newline', 'Ctrl K search'],
      token: 'Tokens · 4h window', reset: 'resets in 3h 57m', logout: 'Log out',
      tokenRight: 'K AI · 40k tokens in window',
      items: ['hi', 'Port this plugin from Spi…', 'Fabric mod: add a m…', 'Why do I get NullPointe…', 'Kit config YAML'],
      tab: 'K AI Code — Programming assistant',
      paste: '+ stack trace',
    },
  },
};

/* ── geometrie per formato ───────────────────────────────────────────── */
const GEO16 = {
  bubbleX: 600, bubbleW: 880, colX: 480, colW: 1000, compX: 400, compW: 1120,
  code: 14, lh: 22, ask: 17, explF: 15.5, explLh: 26, traceF: 12.5, traceLh: 18,
  avatarY: 470, bodyY: 508, labelY: 640, fixY: 666, scroll: -240,
  explStep: 0.85, fixStep: 0.4,
};
const GEO9 = {
  bubbleX: 660, bubbleW: 500, colX: 660, colW: 500, compX: 620, compW: 560,
  code: 12.5, lh: 20, ask: 15, explF: 13.5, explLh: 22, traceF: 11, traceLh: 16,
  avatarY: 500, bodyY: 536, labelY: 716, fixY: 742, scroll: -300,
  explStep: 0.5, fixStep: 0.32,
};

const TOKEN_RE = /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*")|(@\w+)|\b(public|void|private|new|return|override|String|final|class|static|if|else|null)\b|\b(\d+)\b/g;
function tokenize(line, C) {
  const out = []; let last = 0, m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(line))) {
    if (m.index > last) out.push({ t: line.slice(last, m.index), c: C.pri });
    const col = m[1] ? C.cmt : m[2] ? C.str : m[3] ? C.accent : m[4] ? C.kw : C.num;
    out.push({ t: m[0], c: col });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ t: line.slice(last), c: C.pri });
  return out;
}

function CodeLine({ line, C, size, lh, bg, mark }: any) {
  return (
    <div style={{
      whiteSpace: 'pre', font: `500 ${size}px ${MONO}`, lineHeight: lh + 'px',
      background: bg || 'transparent', margin: '0 -14px', padding: '0 14px',
      borderLeft: mark ? `3px solid ${mark}` : '3px solid transparent',
    }}>
      {tokenize(line, C).map((tk, i) => <span key={i} style={{ color: tk.c }}>{tk.t}</span>)}
      {line === '' ? ' ' : null}
    </div>
  );
}

/* ── telaio app ──────────────────────────────────────────────────────── */
function Chrome({ C, X }) {
  const dot = (bg) => ({ width: 11, height: 11, borderRadius: 99, background: bg });
  return (
    <div style={{
      position: 'absolute', left: 0, top: 0, width: APP_W, height: CHROME_H,
      background: C.chrome, borderBottom: `1px solid ${C.chromeLine}`,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px 6px' }}>
        <div style={{ display: 'flex', gap: 6, marginRight: 8 }}>
          <div style={dot('#e06c62')} /><div style={dot('#e3b34c')} /><div style={dot('#5fb85f')} />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, height: 30, padding: '0 14px',
          background: C.win, borderRadius: '8px 8px 0 0', font: `600 13px ${SANS}`,
          color: C.pri, whiteSpace: 'nowrap',
        }}>
          <span style={{ font: `700 12px ${SERIF}`, color: C.pri }}>K</span>{X.tab}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px 9px' }}>
        <span style={{ color: C.mut, font: `500 15px ${SANS}` }}>←  →  ⟳</span>
        <div style={{
          flex: 1, height: 28, borderRadius: 99, background: C.win,
          border: `1px solid ${C.chromeLine}`, display: 'flex', alignItems: 'center',
          padding: '0 12px', font: `500 12.5px ${SANS}`, color: C.mut,
        }}>k-ai-code-ujbf.vercel.app</div>
      </div>
    </div>
  );
}

function Sidebar({ C, T, TM, X, wordmark }) {
  const rail = MOTION.enter(0, 1, TM.uiRail, TM.uiRail + 0.9)(T);
  const ui = MOTION.enter(0, 1, TM.uiSide, TM.uiSide + 1.1)(T);
  return (
    <React.Fragment>
      <div style={{
        position: 'absolute', left: 0, top: CHROME_H, width: RAIL_W, height: APP_H - CHROME_H,
        background: C.side, borderRight: `1px solid ${C.line}`, opacity: rail,
        display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 18, gap: 22,
      }}>
        <span style={{ font: `700 20px ${SERIF}`, color: C.pri }}>K</span>
        <span style={{ font: `400 16px ${SANS}`, color: C.accent }}>▢</span>
        <span style={{ font: `400 16px ${SANS}`, color: C.mut }}>▤</span>
      </div>
      <div style={{
        position: 'absolute', left: RAIL_W, top: CHROME_H, width: SIDE_W, height: APP_H - CHROME_H,
        background: C.side, borderRight: `1px solid ${C.line}`,
      }}>
        <div style={{
          position: 'absolute', left: 32, top: 22, font: `600 26px ${SERIF}`, lineHeight: '34px',
          color: C.pri, letterSpacing: '0.02em', opacity: wordmark,
        }}>K AI</div>
        <div style={{
          position: 'absolute', right: 18, top: 30, padding: '3px 8px', borderRadius: 5,
          background: C.accentSoft, color: C.accent, font: `700 9.5px ${SANS}`,
          letterSpacing: '0.14em', opacity: ui,
        }}>STARTER</div>
        <div style={{ opacity: ui }}>
          <div style={{
            position: 'absolute', left: 22, top: 78, width: SIDE_W - 44, height: 42,
            borderRadius: 10, background: C.accent, color: '#fff', whiteSpace: 'nowrap',
            font: `700 13.5px ${SANS}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{X.newConv}</div>
          <div style={{
            position: 'absolute', left: 22, top: 132, width: SIDE_W - 44, height: 34,
            borderRadius: 9, border: `1px solid ${C.line}`, color: C.mut,
            font: `500 12.5px ${SANS}`, display: 'flex', alignItems: 'center', padding: '0 12px',
            justifyContent: 'space-between', boxSizing: 'border-box',
          }}><span>⌕  {X.search}</span><span style={{ font: `500 10px ${MONO}` }}>Ctrl K</span></div>
          <div style={{
            position: 'absolute', left: 26, top: 184, color: C.mut,
            font: `700 9.5px ${SANS}`, letterSpacing: '0.16em',
          }}>{X.convs}</div>
          <div style={{
            position: 'absolute', left: 22, top: 206, width: SIDE_W - 44, height: 32,
            borderRadius: 8, background: C.accentSoft, color: C.pri, font: `600 13px ${SANS}`,
            display: 'flex', alignItems: 'center', padding: '0 12px', boxSizing: 'border-box',
            whiteSpace: 'nowrap',
          }}>{X.header}</div>
          {X.items.map((it, i) => (
            <div key={i} style={{
              position: 'absolute', left: 34, top: 250 + i * 32, color: C.mut,
              font: `500 13px ${SANS}`, whiteSpace: 'nowrap',
            }}>{it}</div>
          ))}
          <div style={{ position: 'absolute', left: 26, bottom: 92, width: SIDE_W - 52 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', font: `600 11px ${SANS}`,
              color: C.mut, whiteSpace: 'nowrap',
            }}><span>{X.token}</span><span style={{ color: C.pri }}>0/40k</span></div>
            <div style={{ height: 3, borderRadius: 9, background: C.line, marginTop: 8 }} />
            <div style={{ marginTop: 10, font: `500 11px ${SANS}`, color: C.mut }}>{X.reset}</div>
          </div>
          <div style={{
            position: 'absolute', left: 26, bottom: 34, font: `600 12px ${SANS}`, color: C.mut,
          }}>{X.logout}</div>
        </div>
      </div>
    </React.Fragment>
  );
}

function Header({ C, T, TM, X }) {
  const ui = MOTION.enter(0, 1, TM.uiHead, TM.uiHead + 1)(T);
  return (
    <div style={{
      position: 'absolute', left: MAIN_X, top: CHROME_H, width: APP_W - MAIN_X, height: HEAD_H,
      borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 26px', boxSizing: 'border-box', opacity: ui,
    }}>
      <span style={{ font: `600 15px ${SANS}`, color: C.pri, whiteSpace: 'nowrap' }}>{X.header}</span>
      <span style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 99,
        border: `1px solid ${C.line}`, font: `600 12.5px ${SANS}`, color: C.pri, whiteSpace: 'nowrap',
      }}>
        <span style={{ width: 7, height: 7, borderRadius: 9, background: C.accent }} />K AI  ⌄
      </span>
    </div>
  );
}

function UserBubble({ C, T, TM, L }) {
  const o = MOTION.pop(0, 1, TM.bubble, TM.bubble + 0.7)(T);
  const y = MOTION.pop(26, 0, TM.bubble, TM.bubble + 0.9)(T);
  const errOn = MOTION.enter(0, 1, TM.err, TM.err + 0.8)(T);
  const causeOn = MOTION.enter(0, 1, TM.cause, TM.cause + 0.8)(T);
  return (
    <div style={{
      position: 'absolute', left: L.bubbleX, top: 140, width: L.bubbleW, opacity: o,
      transform: `translateY(${y}px)`, background: C.bubble, borderRadius: 16,
      padding: '20px 24px', boxSizing: 'border-box',
    }}>
      <div style={{ font: `500 ${L.ask}px ${SANS}`, color: C.pri, marginBottom: 12 }}>{L.text.ask}</div>
      <div style={{
        background: C.code, border: `1px solid ${C.codeLine}`, borderRadius: 10, padding: '12px 14px',
      }}>
        {L.bug.map((l, i) => (
          <CodeLine key={i} line={l} C={C} size={L.code} lh={L.lh}
            bg={i === L.errIdx ? `rgba(214,69,93,${0.10 * errOn})` : i === L.causeIdx ? `rgba(180,83,9,${0.10 * causeOn})` : null}
            mark={i === L.errIdx ? (errOn > 0.4 ? C.err : null) : i === L.causeIdx ? (causeOn > 0.4 ? '#B45309' : null) : null} />
        ))}
      </div>
      <div style={{
        marginTop: 12, color: C.err, font: `500 ${L.traceF}px ${MONO}`,
        lineHeight: L.traceLh + 'px', whiteSpace: 'pre',
      }}>{L.trace.join('\n')}</div>
    </div>
  );
}

function Answer({ C, T, TM, L }) {
  const head = MOTION.enter(0, 1, TM.head, TM.head + 0.6)(T);
  const think = clamp(MOTION.enter(0, 1, TM.thinkIn, TM.thinkIn + 0.4)(T)
    - MOTION.enter(0, 1, TM.thinkOut, TM.thinkOut + 0.4)(T), 0, 1);
  const dots = '·····'.slice(0, 1 + (Math.floor(T * 3) % 3));
  const label = MOTION.enter(0, 1, TM.label, TM.label + 0.5)(T);
  const done = MOTION.enter(0, 1, TM.done, TM.done + 0.6)(T);
  return (
    <React.Fragment>
      <div style={{
        position: 'absolute', left: L.colX, top: L.avatarY, display: 'flex', alignItems: 'center',
        gap: 10, opacity: head, whiteSpace: 'nowrap',
      }}>
        <span style={{
          width: 26, height: 26, borderRadius: 7, border: `1px solid ${C.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          font: `700 14px ${SERIF}`, color: C.pri, background: C.code,
        }}>K</span>
        <span style={{ font: `700 13px ${SANS}`, color: C.pri, letterSpacing: '0.04em' }}>K AI</span>
      </div>

      <div style={{
        position: 'absolute', left: L.colX, top: L.bodyY, opacity: think, whiteSpace: 'nowrap',
        font: `500 ${L.explF}px ${MONO}`, color: C.mut,
      }}>{L.text.thinking}{dots}</div>

      <div style={{ position: 'absolute', left: L.colX, top: L.bodyY, width: L.colW }}>
        {L.expl.map((l, i) => {
          const s = cut(l, T, TM.expl + i * L.explStep, 0.9);
          return (
            <div key={i} style={{
              whiteSpace: 'pre', font: `500 ${L.explF}px ${MONO}`,
              lineHeight: L.explLh + 'px', color: C.pri,
            }}>
              {i === 0 && s.length > 0
                ? <span><span style={{ color: C.ok, fontWeight: 700 }}>{s.slice(0, L.text.hi)}</span>{s.slice(L.text.hi)}</span>
                : s}
            </div>
          );
        })}
      </div>

      <div style={{
        position: 'absolute', left: L.colX, top: L.labelY, display: 'flex', alignItems: 'center',
        gap: 10, opacity: label, whiteSpace: 'nowrap',
      }}>
        <span style={{ font: `700 13px ${SANS}`, color: C.pri }}>{L.text.fixLabel}</span>
        <span style={{
          padding: '3px 9px', borderRadius: 6, background: C.okSoft, color: C.ok,
          font: `700 10.5px ${SANS}`, letterSpacing: '0.08em', opacity: done,
        }}>{L.text.badge}</span>
      </div>

      <div style={{
        position: 'absolute', left: L.colX, top: L.fixY, width: L.colW, boxSizing: 'border-box',
        background: C.code, border: `1px solid ${C.codeLine}`, borderRadius: 12,
        padding: '14px 16px', opacity: label,
      }}>
        {L.fix.map((l, i) => {
          const start = TM.fix + i * L.fixStep;
          const o = MOTION.enter(0, 1, start, start + 0.5)(T);
          const dy = MOTION.enter(6, 0, start, start + 0.6)(T);
          return (
            <div key={i} style={{
              opacity: o, transform: `translateY(${dy}px)`,
              height: L.lh * clamp(o * 1.4, 0, 1), overflow: 'hidden',
            }}>
              <CodeLine line={l} C={C} size={L.code} lh={L.lh} />
            </div>
          );
        })}
      </div>
    </React.Fragment>
  );
}

function Composer({ C, T, TM, L }) {
  const X = L.text.ui;
  const ui = MOTION.enter(0, 1, TM.uiComp, TM.uiComp + 1.1)(T);
  const typed = cut(L.text.ask, T, TM.type, TM.typeDur);
  const pasted = MOTION.enter(0, 1, TM.paste, TM.paste + 0.4)(T);
  const sent = MOTION.enter(0, 1, TM.send, TM.send + 0.3)(T);
  const top = MOTION.glide(782, 688, TM.paste, TM.paste + 0.5)(T)
    + MOTION.glide(0, 94, TM.send + 0.3, TM.send + 0.8)(T);
  const caret = Math.floor(T * 1.7) % 2 === 0 && T > TM.type - 0.3 && T < TM.send;
  const press = 1 - 0.06 * clamp(MOTION.enter(0, 1, TM.click, TM.click + 0.12)(T)
    - MOTION.enter(0, 1, TM.click + 0.15, TM.click + 0.3)(T), 0, 1);
  return (
    <div style={{ opacity: ui }}>
      <div style={{
        position: 'absolute', left: L.compX, top, width: L.compW, bottom: 42, boxSizing: 'border-box',
        border: `1px solid ${C.codeLine}`, borderRadius: 14, background: C.win,
        padding: '16px 18px', boxShadow: `0 1px 0 ${C.line}`,
      }}>
        <div style={{ font: `500 ${L.ask}px ${SANS}`, color: typed ? C.pri : C.mut }}>
          {sent > 0.5 ? <span style={{ color: C.mut }}>{X.placeholder}</span>
            : <span>{typed}{caret ? <span style={{ color: C.accent }}>|</span> : null}</span>}
        </div>
        {pasted > 0 && sent < 0.5 && (
          <div style={{
            marginTop: 12, marginBottom: 30, background: C.code,
            border: `1px solid ${C.codeLine}`, borderRadius: 9, padding: '10px 12px',
            opacity: pasted, transform: `scale(${0.98 + 0.02 * pasted})`,
          }}>
            {L.bug.slice(0, 3).map((l, i) => (
              <CodeLine key={i} line={l} C={C} size={L.code - 1.5} lh={L.lh - 3} />
            ))}
            <div style={{ font: `500 ${L.code - 2.5}px ${MONO}`, color: C.mut }}>{X.paste}</div>
          </div>
        )}
        <div style={{
          position: 'absolute', right: 18, bottom: 16, padding: '9px 18px', borderRadius: 9,
          background: typed && sent < 0.5 ? C.accent : C.accentSoft,
          color: typed && sent < 0.5 ? '#fff' : C.accent,
          font: `700 13px ${SANS}`, transform: `scale(${press})`, whiteSpace: 'nowrap',
        }}>{X.send}</div>
        <div style={{
          position: 'absolute', left: 18, bottom: 16, color: C.mut, font: `500 15px ${SANS}`,
        }}>▣</div>
      </div>
      <div style={{
        position: 'absolute', left: L.compX + 4, bottom: 16, display: 'flex', gap: 14,
        font: `500 11.5px ${MONO}`, color: C.mut, whiteSpace: 'nowrap',
      }}>{X.hints.map((h, i) => <span key={i}>{h}</span>)}</div>
      <div style={{
        position: 'absolute', left: L.compX + L.compW - 260, bottom: 16, width: 260,
        textAlign: 'right', font: `500 11.5px ${MONO}`, color: C.mut, whiteSpace: 'nowrap',
      }}>{X.tokenRight}</div>
    </div>
  );
}

function Cursor({ T, TM, L }) {
  const on = clamp(MOTION.enter(0, 1, TM.cursorOn, TM.cursorOn + 0.3)(T)
    - MOTION.enter(0, 1, TM.send + 0.8, TM.send + 1.4)(T), 0, 1);
  const inX = L.compX + 40, outX = L.compX + L.compW - 60;
  const ts = [TM.cursorOn, TM.cursorOn + 0.7, TM.toSend, TM.click, TM.click + 1.2];
  const x = interpolate(ts, [outX, inX, inX, outX, outX + 18], Easing.easeInOutCubic)(T);
  const y = interpolate(ts, [640, 806, 806, 846, 860], Easing.easeInOutCubic)(T);
  const click = clamp(MOTION.enter(0, 1, TM.click, TM.click + 0.1)(T)
    - MOTION.enter(0, 1, TM.click + 0.12, TM.click + 0.4)(T), 0, 1);
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity: on }}>
      <div style={{
        position: 'absolute', left: -16, top: -16, width: 34, height: 34, borderRadius: 99,
        border: '2px solid rgba(109,94,252,0.75)', opacity: click, transform: `scale(${0.4 + click})`,
      }} />
      <svg width="22" height="30" viewBox="0 0 22 30" style={{ display: 'block' }}>
        <path d="M2 1 L2 22 L8 16.5 L12 27 L16 25 L12 15 L19 14 Z"
          fill="#16181d" stroke="#ffffff" strokeWidth="1.6" />
      </svg>
    </div>
  );
}

/* ── logo: costruzione, viaggio, ritorno ─────────────────────────────── */
function Lockup({ C, T, TM, W, H, toStage, camScale, text }) {
  const portrait = H > W;
  const outOp = MOTION.enter(0, 1, TM.swap, TM.swap + 0.2)(T);
  const backOp = MOTION.enter(0, 1, TM.logoBack, TM.logoBack + 1.1)(T);
  const endOp = MOTION.enter(0, 1, TM.out, TM.out + 0.8)(T);
  const opacity = clamp(clamp(1 - outOp, 0, 1) + backOp - endOp, 0, 1);

  const back = T > TM.dim;
  const bigK = portrait ? 4.4 : 5.9;
  const breath = MOTION.glide(1.05, 1.0, 0.2, TM.travel)(T);
  const p = MOTION.glide(0, 1, TM.travel, TM.travelEnd)(T);
  const target = toStage(80, 90);
  const k = (bigK * breath) + (camScale - bigK * breath) * p;
  const bx = W / 2 - 0.5 * 62 * bigK * breath, by = H * 0.42 - 17 * bigK * breath;
  const inK = bigK * MOTION.glide(0.88, 1.0, TM.logoBack, TM.out)(T);
  const scale = back ? inK : k;
  const px = back ? W / 2 - 0.5 * 62 * inK : bx + (target.x - bx) * p;
  const py = back ? H * 0.42 - 17 * inK : by + (target.y - by) * p;

  /* costruzione: l'asta scende, poi le diagonali entrano da sinistra */
  const kWipe = back ? 1 : MOTION.glide(0, 1, TM.stem, TM.diag + 0.6)(T);
  const kOp = back ? 1 : MOTION.enter(0, 1, TM.stem, TM.stem + 0.5)(T);
  const kLift = back ? 0 : MOTION.glide(5, 0, TM.stem, TM.diag + 0.8)(T);
  const guide = back ? 0 : clamp(MOTION.glide(0, 1, TM.stem - 0.35, TM.stem + 0.5)(T)
    - MOTION.enter(0, 1, TM.diag + 0.4, TM.diag + 1.0)(T), 0, 1);
  const aiOp = back ? 1 : MOTION.enter(0, 1, TM.ai, TM.ai + 0.8)(T);
  const aiTrack = back ? 0 : MOTION.glide(0.42, 0, TM.ai, TM.ai + 1.1)(T);
  const rule = back ? MOTION.glide(0, 1, TM.ruleBack, TM.ruleBack + 0.9)(T)
    : clamp(MOTION.glide(0, 1, TM.rule, TM.rule + 1.0)(T)
      - MOTION.enter(0, 1, TM.travel, TM.travel + 0.5)(T), 0, 1);
  const tagOp = MOTION.enter(0, 1, TM.tag, TM.tag + 1.0)(T);
  const tagY = MOTION.enter(14, 0, TM.tag, TM.tag + 1.2)(T);

  return (
    <div style={{
      position: 'absolute', left: 0, top: 0, width: W, height: H,
      opacity, pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute', left: px, top: py, transform: `scale(${scale})`,
        transformOrigin: 'left top',
      }}>
        <div style={{
          font: `600 26px ${SERIF}`, color: C.ink, letterSpacing: '0.02em',
          whiteSpace: 'nowrap', lineHeight: '34px',
        }}>
          <span style={{ position: 'relative', display: 'inline-block' }}>
            <span style={{
              display: 'inline-block', opacity: kOp,
              clipPath: `inset(${(1 - kWipe) * 106}% -12% -8% -12%)`,
              transform: `translateY(${kLift}px)`,
            }}>K</span>
            <span style={{
              position: 'absolute', left: -1, bottom: 6, height: 1,
              width: `${26 * guide}px`, background: C.ink, opacity: 0.45 * guide,
            }} />
          </span>
          <span style={{
            opacity: aiOp, letterSpacing: `${aiTrack}em`, display: 'inline-block',
          }}>&nbsp;AI</span>
        </div>
        <div style={{
          position: 'absolute', left: 0, top: 40, height: 1, background: C.ink,
          width: `${62 * rule}px`, opacity: 0.35 * rule,
        }} />
      </div>
      {back && (
        <div style={{
          position: 'absolute', left: 0, right: 0,
          top: H * 0.42 - 17 * inK + 40 * inK + (portrait ? 74 : 62), textAlign: 'center',
          opacity: tagOp, transform: `translateY(${tagY}px)`,
          font: `500 ${portrait ? 38 : 34}px ${SERIF}`, color: '#23262b', letterSpacing: '0.01em',
        }}>{text.tagline}</div>
      )}
    </div>
  );
}

/* ── capitolo tipografico prima della chiusura ───────────────────────── */
function Recap({ T, TM, W, H, steps, C }) {
  const dim = clamp(MOTION.glide(0, 1, TM.dim, TM.dim + 1.0)(T)
    - MOTION.glide(0, 1, TM.endVeil, TM.endVeil + 1.0)(T), 0, 1);
  if (dim <= 0.001) return null;
  const portrait = H > W;
  const size = portrait ? 44 : 52;
  const rule = MOTION.glide(0, 1, TM.dim + 0.6, TM.dim + 1.4)(T);
  return (
    <div style={{
      position: 'absolute', inset: 0, background: `rgba(255,255,255,${0.9 * dim})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ opacity: dim, maxWidth: portrait ? '88%' : '64%' }}>
        <div style={{
          height: 1, background: C.ink, opacity: 0.3, width: `${120 * rule}px`, marginBottom: 44,
        }} />
        {steps.map((s, i) => {
          const at = TM.steps + i * 1.15;
          const o = MOTION.enter(0, 1, at, at + 0.9)(T);
          const dy = MOTION.enter(26, 0, at, at + 1.1)(T);
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'baseline', gap: 26, opacity: o, whiteSpace: 'nowrap',
              transform: `translateY(${dy}px)`, marginBottom: portrait ? 26 : 30,
            }}>
              <span style={{
                font: `500 ${size * 0.28}px ${MONO}`, color: C.accent, letterSpacing: '0.08em',
              }}>0{i + 1}</span>
              <span style={{
                font: `500 ${size}px ${SERIF}`, color: C.ink, letterSpacing: '0.005em',
              }}>{s}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Piece(props) {
  const { T, CUES, authoredTotal } = useComposition();
  const C = THEMES[props.theme] || THEMES.chiaro;
  const text = LANG[props.lang] || LANG.IT;
  const portrait = props.portrait;
  const G = portrait ? GEO9 : GEO16;
  const L = Object.assign({}, G, {
    text,
    bug: portrait ? BUG9 : BUG16,
    trace: portrait ? TRACE9 : TRACE16,
    expl: portrait ? text.expl9 : text.expl16,
    fix: portrait ? fix9(text.cmt1, text.cmt2) : fix16(text.cmt1, text.cmt2),
    errIdx: portrait ? 5 : 4,
    causeIdx: portrait ? 3 : 2,
  });
  const W = portrait ? 1080 : 1920, H = portrait ? 1920 : 1080;
  const base = portrait ? (H / APP_H) * 0.86 : Math.min(W / APP_W, H / APP_H) * 0.98;

  const A = CUES.Apri, S = CUES.Scrivi, N = CUES.Analisi, F = CUES.Trovato,
    R = CUES.Correggi, P = CUES.Riepilogo, Z = CUES.Chiusura;

  const TM = {
    stem: 0.5, diag: 1.6, ai: 2.9, rule: 3.9,
    travel: A - 1.4, travelEnd: A + 0.6, swap: A + 0.55,
    appIn: A - 1.2, veilOut: A - 1.4,
    uiRail: A + 0.2, uiSide: A + 0.4, uiHead: A + 0.8, uiComp: A + 1.2,
    cursorOn: S + 0.1, type: S + 1.3, typeDur: 3.8, paste: S + 5.5,
    toSend: S + 6.7, click: S + 7.5, send: S + 7.7, bubble: S + 7.85,
    head: N + 0.3, thinkIn: N + 0.6, thinkOut: N + 3.9,
    err: F + 0.9, cause: F + 2.7, expl: F + 4.5,
    scrollA: R + 0.3, scrollB: R + 1.9, label: R + 1.1, fix: R + 1.5, done: R + 6.1,
    dim: P + 1.7, steps: P + 2.6,
    endVeil: Z + 0.1, logoBack: Z + 1.1, ruleBack: Z + 2.4, tag: Z + 3.0,
    out: authoredTotal - 0.9,
  };

  const camT = [0, A - 0.2, A + 1.2, S + 0.4, S + 1.9, S + 8.2, S + 9.8, F + 0.1,
    F + 1.8, F + 4.2, F + 5.6, R + 0.5, R + 2.6, R + 8.6, P + 2.0, Z, authoredTotal];
  const camX = [800, 800, 812, 812, 940, 940, 980, 980, 900, 900, 900, 900, 910, 910, 800, 800, 800];
  const camY = [460, 460, 466, 472, 730, 716, 380, 390, 300, 300, 480, 470, 500, 528, 460, 460, 460];
  const camXP = [910, 910, 910, 910, 900, 900, 910, 910, 900, 900, 910, 910, 910, 910, 910, 910, 910];
  const camYP = [460, 460, 466, 472, 760, 750, 400, 400, 300, 300, 600, 600, 580, 600, 460, 460, 460];
  const camZ = [1.0, 1.0, 1.03, 1.05, 1.5, 1.54, 1.3, 1.32, 1.95, 1.9, 1.42, 1.4, 1.45, 1.5, 1.0, 1.0, 1.0];

  const fx = interpolate(camT, portrait ? camXP : camX, Easing.easeInOutCubic)(T);
  const fy = interpolate(camT, portrait ? camYP : camY, Easing.easeInOutCubic)(T);
  const z0 = interpolate(camT, camZ, Easing.easeInOutCubic)(T);
  const z = portrait ? 1 + (z0 - 1) * 0.10 : z0;
  const Sc = base * z;
  const scroll = MOTION.glide(0, L.scroll, TM.scrollA, TM.scrollB)(T);
  const toStage = (px, py) => ({ x: W / 2 + (px - fx) * Sc, y: H / 2 + (py - fy) * Sc });

  const appOp = MOTION.enter(0, 1, TM.appIn, TM.appIn + 1.0)(T);
  const soft = clamp(MOTION.glide(0, 1, TM.dim, TM.dim + 1.0)(T)
    - MOTION.glide(0, 1, TM.endVeil, TM.endVeil + 0.8)(T), 0, 1);
  const veil = clamp(1 - MOTION.glide(0, 1, TM.veilOut, TM.veilOut + 1.2)(T)
    + MOTION.glide(0, 1, TM.endVeil, TM.endVeil + 1.1)(T), 0, 1);
  const origin = toStage(0, 0);

  return (
    <div style={{ position: 'absolute', inset: 0, background: C.desk, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', left: origin.x, top: origin.y, width: APP_W, height: APP_H,
        transform: `scale(${Sc})`, transformOrigin: '0 0', background: C.win,
        borderRadius: 14, overflow: 'hidden', opacity: appOp,
        boxShadow: '0 40px 90px rgba(12,14,20,0.28)',
        filter: soft > 0.01 ? `blur(${3 * soft}px)` : 'none',
      }}>
        <Chrome C={C} X={text.ui} />
        <Sidebar C={C} T={T} TM={TM} X={Object.assign({}, text.ui, { header: text.header })}
          wordmark={MOTION.enter(0, 1, TM.swap, TM.swap + 0.2)(T)} />
        <Header C={C} T={T} TM={TM} X={text} />
        <div style={{
          position: 'absolute', left: MAIN_X, top: CHROME_H + HEAD_H,
          width: APP_W - MAIN_X, height: 646, overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', left: -MAIN_X, top: -(CHROME_H + HEAD_H) + scroll,
            width: APP_W, height: 1100,
          }}>
            <UserBubble C={C} T={T} TM={TM} L={L} />
            <Answer C={C} T={T} TM={TM} L={L} />
          </div>
        </div>
        <Composer C={C} T={T} TM={TM} L={L} />
        <Cursor T={T} TM={TM} L={L} />
      </div>
      <Recap T={T} TM={TM} W={W} H={H} steps={text.steps} C={C} />
      <div style={{ position: 'absolute', inset: 0, background: C.veil, opacity: veil }} />
      <Lockup C={C} T={T} TM={TM} W={W} H={H} toStage={toStage} camScale={Sc} text={text} />
    </div>
  );
}

function CapsFor(lang, portrait, cues) {
  const t = LANG[lang] || LANG.IT;
  const A = cues.Apri, S = cues.Scrivi, N = cues.Analisi, F = cues.Trovato, R = cues.Correggi;
  return [
    { at: A + 1.6, until: A + 3.9, text: t.caps[0] },
    { at: S + 1.7, until: S + 7.3, text: t.caps[1] },
    { at: N + 0.7, until: N + 3.7, text: t.caps[2] },
    { at: F + 0.7, until: F + 3.9, text: t.caps[3] },
    { at: F + 4.5, until: F + 8.7, text: t.caps[4] },
    { at: R + 1.7, until: R + 7.1, text: t.caps[5] },
  ];
}

function CaptionTrack(props) {
  const { CUES } = useComposition();
  const portrait = props.portrait;
  return (
    <Captions
      style={{
        left: portrait ? '6%' : '20%', right: portrait ? '6%' : '20%',
        bottom: portrait ? '9%' : '4.5%', font: `600 ${portrait ? 36 : 31}px ${SANS}`,
        color: '#15171c', textShadow: 'none', padding: portrait ? '20px 22px' : '17px 24px',
        background: 'rgba(255,255,255,0.94)', borderRadius: 16,
        border: '1px solid rgba(20,22,26,0.07)', letterSpacing: '-0.005em',
        boxShadow: '0 14px 44px rgba(12,14,20,0.13)', boxSizing: 'border-box',
      }}
      items={CapsFor(props.lang, portrait, CUES)}
    />
  );
}

/* ── Involucro per il sito ──────────────────────────────────────────────
   L'originale prendeva formato, lingua e tema dal pannello dell'editor
   (window.TWEAK_DEFAULTS) e le scene da window.OM_SCENES. Qui sono props e
   una costante, cosi' il componente e' autonomo.
   ─────────────────────────────────────────────────────────────────────── */

/** Le otto sezioni del montaggio. Le durate definiscono anche i cue. */
export const SCENES = [
  { name: 'Logo', dur: 7, desc: 'Il monogramma K si costruisce: asta, diagonali, poi AI e la linea' },
  { name: 'Apri', dur: 4.5, desc: "Il logo scende nella barra laterale mentre l'interfaccia si costruisce" },
  { name: 'Scrivi', dur: 10, desc: "Il cursore entra nella casella, l'utente scrive e incolla codice e stack trace" },
  { name: 'Analisi', dur: 4, desc: 'K AI risponde e analizza il problema' },
  { name: 'Trovato', dur: 9, desc: 'Zoom sulla riga che lancia la NullPointerException, poi la spiegazione della causa' },
  { name: 'Correggi', dur: 10, desc: 'Il codice corretto compare riga per riga e compila' },
  { name: 'Riepilogo', dur: 7, desc: "Tre passaggi in tipografia grande sopra l'app sfumata" },
  { name: 'Chiusura', dur: 8.5, desc: 'Bianco: il logo torna al centro con la tagline' },
];

export const DEMO_DURATION = SCENES.reduce((n, s) => n + s.dur, 0);

export default function KaiIntro(props) {
  const portrait = props.portrait === true;
  const lang = props.lang === 'EN' ? 'EN' : 'IT';
  const tema = props.tema === 'scuro' ? 'scuro' : 'chiaro';
  const C = THEMES[tema] || THEMES.chiaro;

  return (
    <CompositionStage
      width={portrait ? 1080 : 1920}
      height={portrait ? 1920 : 1080}
      scenes={SCENES}
      bg={C.desk}
      playing={props.playing}
      loop={props.loop !== false}
      onTime={props.onTime}
      onEnded={props.onEnded}
      seekTo={props.seekTo}
    >
      <Piece theme={tema} portrait={portrait} lang={lang} />
      {props.captions !== false && <CaptionTrack portrait={portrait} lang={lang} />}
      <ScoreTrack enabled={props.audio !== false} volume={props.volume == null ? 0.8 : props.volume} />
    </CompositionStage>
  );
}
