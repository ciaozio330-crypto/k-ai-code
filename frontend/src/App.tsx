import { useEffect, useRef, useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { VoxelTopographyGrid } from '@/components/ui/voxel-topography-grid';
import { CodeBlock } from '@/components/ui/code-block';
import { Prose } from '@/components/ui/prose';
import { CommandPalette } from '@/components/ui/command-palette';
import type { Command } from '@/components/ui/command-palette';
import { useToast } from '@/components/ui/toast';
import { PLANS, TEAMS, PLAN_NAMES, FLAVOR_ACCENT } from '@/lib/plans';
import { useI18n, LOCALE_LIST, LOCALES } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/ui/language-switcher';

// La landing è un blocco grosso e indipendente: caricarla a richiesta tiene
// leggero il bundle iniziale per chi è già loggato e va dritto in chat.
const Landing = lazy(() => import('@/components/landing/Landing'));

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const LANG_EXT = {
  javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts', jsx: 'jsx', tsx: 'tsx',
  python: 'py', py: 'py', java: 'java', kotlin: 'kt', kt: 'kt', json: 'json',
  yaml: 'yml', yml: 'yml', xml: 'xml', html: 'html', css: 'css', scss: 'scss',
  rust: 'rs', go: 'go', csharp: 'cs', cs: 'cs', c: 'c', cpp: 'cpp', 'c++': 'cpp',
  sh: 'sh', bash: 'sh', shell: 'sh', sql: 'sql', toml: 'toml', properties: 'properties',
  gradle: 'gradle', groovy: 'groovy', md: 'md', markdown: 'md', php: 'php', ruby: 'rb', rb: 'rb',
  swift: 'swift', dockerfile: 'Dockerfile', dart: 'dart',
};

// Estrae i blocchi di codice da una risposta e ne ricava nomi file plausibili
function extractCodeFiles(text) {
  const files = [];
  const parts = String(text).split('```');
  let idx = 0;
  for (let i = 1; i < parts.length; i += 2) {
    const block = parts[i];
    const nl = block.indexOf('\n');
    const info = (nl > -1 ? block.slice(0, nl) : '').trim();
    const body = (nl > -1 ? block.slice(nl + 1) : block).replace(/\n$/, '');
    if (!body.trim()) continue;
    let lang = info, name = '';
    const sep = info.match(/^(\S+)[:\s]+(.+)$/);
    if (sep) { lang = sep[1]; name = sep[2].trim(); }
    if (!name) {
      const fm = body.match(/^\s*(?:\/\/|#|<!--|--|\/\*)\s*(?:file|filename)\s*[:=]\s*(.+?)\s*(?:\*\/|-->)?\s*$/im);
      if (fm) name = fm[1].trim();
    }
    if (!name) {
      idx++;
      const ext = LANG_EXT[(lang || '').toLowerCase()] || 'txt';
      name = ext === 'Dockerfile' ? 'Dockerfile' : `file-${idx}.${ext}`;
    }
    files.push({ name: name.replace(/^[\\/]+/, ''), content: body });
  }
  return files;
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * JSZip pesa ~850 KB e serve solo a chi preme "Scarica ZIP": importarlo in
 * cima faceva pagare quel peso a ogni visita, anche a chi non esporta mai
 * niente. L'import dinamico lo sposta in un chunk a parte, scaricato al
 * primo click.
 */
async function downloadZip(files, baseName = 'k-ai-code') {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const used = {};
  for (const f of files) {
    let n = f.name;
    if (used[n]) {
      const d = n.lastIndexOf('.');
      n = d > 0 ? `${n.slice(0, d)}-${used[f.name]}${n.slice(d)}` : `${n}-${used[f.name]}`;
    }
    used[f.name] = (used[f.name] || 0) + 1;
    zip.file(n, f.content);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  saveBlob(blob, `${baseName}.zip`);
}

/** Scarica un singolo file di testo senza passare dallo ZIP. */
function downloadFile(name, content) {
  saveBlob(new Blob([content], { type: 'text/plain;charset=utf-8' }), name);
}

function fmtTokens(n) {
  if (n == null) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 ? 1 : 0) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return String(n);
}
function fmtReset(resetAt, soon = "") {
  const ms = Math.max(0, (resetAt || 0) - Date.now());
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) { const d = Math.floor(h / 24); return `${d}g ${h % 24}h`; }
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return soon;
}

const I = {
  chat: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  code: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/></svg>,
  files: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>,
  chart: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>,
  gear: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>,
  plus: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14"/></svg>,
  image: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L5 21"/></svg>,
  zip: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
  search: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.3-4.3"/></svg>,
  send: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12h13M12 5l7 7-7 7"/></svg>,
  chevron: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>,
  down: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>,
  copy: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  check: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
  retry: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 11-3.2-6.9"/><path d="M21 3v6h-6"/></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"/></svg>,
  logout: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17l5-5-5-5M20 12H9M12 3H6a2 2 0 00-2 2v14a2 2 0 002 2h6"/></svg>,
  eye: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.6 10.6 0 0112 5c7 0 10.5 7 10.5 7a15.6 15.6 0 01-3.4 4.4M6.7 6.7C3.4 8.8 1.5 12 1.5 12s3.5 7 10.5 7c1.5 0 2.8-.3 4-.8"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/></svg>,
  back: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  menu: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>,
  stop: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>,
  edit: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>,
};

function Content({ text, streaming }) {
  const parts = text.split('```');
  const out = [];
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      const nl = part.indexOf('\n');
      const info = (nl > -1 ? part.slice(0, nl) : '').trim();
      const body = (nl > -1 ? part.slice(nl + 1) : part).replace(/\n$/, '');

      // L'info string può essere "java" oppure "java src/Main.java":
      // nel secondo caso il percorso diventa il titolo del blocco.
      let lang = info, filename = '';
      const sep = info.match(/^(\S+)[:\s]+(.+)$/);
      if (sep) { lang = sep[1]; filename = sep[2].trim(); }

      const ext = LANG_EXT[(lang || '').toLowerCase()] || 'txt';
      const dlName = filename || `snippet-${Math.floor(i / 2) + 1}.${ext}`;

      out.push(
        <CodeBlock
          key={i}
          code={body}
          lang={lang}
          filename={filename || undefined}
          onDownload={() => downloadFile(dlName, body)}
        />
      );
    } else if (part) {
      out.push(<div className="ai-body" key={i}><Prose text={part} /></div>);
    }
  });
  if (streaming) {
    // Nessun testo ancora arrivato: mostra i puntini invece di un cursore
    // solitario, che sembrerebbe un errore di rendering.
    if (!text) out.push(<div className="ai-typing" key="typing"><span /><span /><span /></div>);
    else out.push(<span className="ai-caret" key="caret" />);
  }
  return <>{out}</>;
}

/* =====================================================================
   AUTENTICAZIONE
   ===================================================================== */

/**
 * POST con scadenza.
 *
 * Senza, una richiesta che non torna lascia l'interfaccia bloccata per
 * sempre: il bottone resta disabilitato su "Attendi…" e sembra che l'app
 * si sia piantata. Succede davvero, perché il servizio va in sospensione
 * quando resta inutilizzato e il primo risveglio può richiedere decine di
 * secondi.
 */
async function postJson(url, body, ms = 45000, errs: { timeout?: string; unreachable?: string } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    let data: any = {};
    try { data = await res.json(); } catch { /* risposta senza corpo */ }
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new Error(errs.timeout || `timeout ${ms}ms`);
    }
    if (e instanceof TypeError) {
      throw new Error(errs.unreachable || `network: ${url}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function Auth({ onAuth, onBack }) {
  const { t } = useI18n();
  const toast = useToast();
  const [mode, setMode] = useState('login');
  const [step, setStep] = useState('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  /** Vero quando l'attesa si allunga: probabile risveglio del server. */
  const [slow, setSlow] = useState(false);
  const slowTimer = useRef(null);

  const beginWait = () => {
    setSlow(false);
    clearTimeout(slowTimer.current);
    // Dopo qualche secondo diciamo che sta ancora lavorando, invece di
    // lasciare l'utente davanti a un bottone spento senza spiegazioni.
    slowTimer.current = setTimeout(() => setSlow(true), 4000);
  };
  const endWait = () => {
    clearTimeout(slowTimer.current);
    setSlow(false);
    setLoading(false);
  };
  useEffect(() => () => clearTimeout(slowTimer.current), []);

  const canStart = !loading && email.trim() !== '' && password !== '';
  const canVerify = !loading && code.length === 6;
  // Le due diagnosi di rete servono a `postJson`, che vive fuori dal
  // componente e non può leggere il dizionario da sé.
  const netErrs = { timeout: t.auth.timeout, unreachable: t.auth.unreachable };

  const start = async () => {
    // La stessa guardia del bottone: Invio non deve poterla scavalcare,
    // altrimenti parte una richiesta coi campi vuoti o una seconda mentre
    // la prima è ancora in volo.
    if (!canStart) return;
    setErr(''); setLoading(true); beginWait();
    try {
      const ep = mode === 'login' ? 'login/start' : 'register/start';
      await postJson(`${API}/auth/${ep}`, { email: email.trim(), password }, 45000, netErrs);
      setStep('code'); setCode('');
      toast.success(t.auth.codeSent, t.auth.checkInbox(email.trim()));
    } catch (e) { setErr(e.message); }
    endWait();
  };

  const verify = async () => {
    if (!canVerify) return;
    setErr(''); setLoading(true); beginWait();
    try {
      const ep = mode === 'login' ? 'login/verify' : 'register/verify';
      const data = await postJson(`${API}/auth/${ep}`, { email: email.trim(), code }, 45000, netErrs);
      localStorage.setItem('token', data.token);
      endWait();
      onAuth(data.token);
      return;
    } catch (e) { setErr(e.message); }
    endWait();
  };

  const switchMode = () => { setMode(mode === 'login' ? 'signup' : 'login'); setStep('form'); setErr(''); };

  return (
    <div className="auth-wrap">
      <div className="auth-bg" aria-hidden="true">
        <VoxelTopographyGrid
          primaryColor="#34d3b8" wireColor="rgba(52, 211, 184, 0.35)"
          bgColor="#020617" speed={0.012} tileSize={38}
        />
      </div>

      <motion.button className="auth-back" onClick={onBack}
        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}
        whileHover={{ x: -3 }}>
        {I.back} {t.auth.backToSite}
      </motion.button>

      <div className="auth-lang"><LanguageSwitcher /></div>

      <div className="auth-card">
        <div className="auth-top">
          <span className="wordmark">K AI</span>
          <span className="tag">Code</span>
        </div>

        {/* Niente AnimatePresence con mode="wait": il pannello successivo si
            monterebbe solo dopo l'uscita del precedente, e quell'animazione
            gira su requestAnimationFrame. Chi preme Invio va quasi sempre a
            controllare la posta — cioè cambia scheda — e in secondo piano
            quel loop si ferma: al ritorno si ritrova il modulo di prima,
            esattamente come se si fosse bloccato. Cambiando `key` React
            monta subito, e resta solo l'animazione d'ingresso. */}
        <div>
          {step === 'form' ? (
            <motion.div key="form" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
              <p className="auth-lead">
                {mode === 'login' ? t.auth.welcomeBack : t.auth.createIntro}
              </p>
              <label className="field">
                <span className="lbl">{t.auth.email}</span>
                <input type="email" autoComplete="email" placeholder={t.auth.emailPlaceholder} value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); start(); } }} />
              </label>
              <label className="field">
                <span className="lbl">{t.auth.password}</span>
                <div className="field-pw">
                  <input type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder={t.auth.passwordPlaceholder} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); start(); } }} />
                  <button type="button" className="field-pw-toggle" onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t.auth.hidePassword : t.auth.showPassword} tabIndex={-1}>
                    {showPassword ? I.eyeOff : I.eye}
                  </button>
                </div>
              </label>
              {err && <p className="err">{err}</p>}
              <button className="btn" style={{ marginTop: 6 }} onClick={start} disabled={!canStart}>
                {loading ? t.auth.waiting : mode === 'login' ? t.auth.signIn : t.auth.createAccount}
              </button>
              {slow && <p className="auth-wait">{t.auth.serverWaking}</p>}
              <div><button className="link" onClick={switchMode}>
                {mode === 'login' ? t.auth.noAccount : t.auth.haveAccount}
              </button></div>
            </motion.div>
          ) : (
            <motion.div key="code" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
              <p className="auth-lead">
                {mode === 'login' ? t.auth.codeIntroLogin : t.auth.codeIntroSignup} <b>{email}</b>.
              </p>
              <label className="field">
                <span className="lbl">{t.auth.codeLabel}</span>
                <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); verify(); } }} />
              </label>
              {err && <p className="err">{err}</p>}
              <button className="btn" style={{ marginTop: 6 }} onClick={verify} disabled={!canVerify}>
                {loading ? t.auth.verifying : t.auth.verify}
              </button>
              {slow && <p className="auth-wait">{t.auth.serverWaking}</p>}
              <div style={{ display: 'flex', gap: 14 }}>
                <button className="link" onClick={() => { setStep('form'); setErr(''); }}>{t.auth.back}</button>
                <button className="link" onClick={start} disabled={loading}>{t.auth.resend}</button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   USO / PIANI
   ===================================================================== */

function UsageBar({ label, used, cap, resetAt, sub }) {
  const { t } = useI18n();
  const pct = cap ? Math.min((used / cap) * 100, 100) : 0;
  const warn = pct > 80;
  return (
    <div className="tok-card">
      <div className="tok-top">
        <span className="tok-label">{label}</span>
        <span className="tok-reset">{t.usage.resetIn(fmtReset(resetAt, t.common.soon))}</span>
      </div>
      <div className="tok-nums">
        <span className="tok-used">{fmtTokens(used)}</span>
        <span className="tok-cap">/ {fmtTokens(cap)} {t.usage.tokens}</span>
      </div>
      <div className={`tok-bar ${warn ? 'warn' : ''}`}><div style={{ width: `${pct}%` }} /></div>
      {sub && <span className="tok-sub">{sub}</span>}
    </div>
  );
}

function UsageView({ user, onUpgrade }) {
  const { t } = useI18n();
  if (!user || !user.usage) return <div className="usage-view" />;
  const { day, week } = user.usage;
  const planId = user.usage.plan || user.plan;

  return (
    <div className="usage-view">
      <div className="u-top">
        <span className="t">{t.usage.title}</span>
        <span className="sub">{t.usage.planLabel(PLAN_NAMES[planId] || planId)}</span>
        <span className="right"><span className="pill">{t.usage.tokens} · K AI</span></span>
      </div>
      <div className="u-body">
        <div className="tok-grid">
          <UsageBar label={t.usage.currentWindow} used={day.used} cap={day.cap} resetAt={day.resetAt}
            sub={t.usage.resetsEvery4h} />
          {week
            ? <UsageBar label={t.usage.weeklyCapTitle} used={week.used} cap={week.cap} resetAt={week.resetAt}
                sub={t.usage.onlyFreeStarter} />
            : <div className="tok-card ghost">
                <div className="tok-top"><span className="tok-label">{t.usage.weeklyCapTitle}</span></div>
                <div className="tok-nofree">{t.usage.noWeeklyCap}</div>
                <span className="tok-sub">{t.usage.noWeeklyCapBody}</span>
              </div>}
        </div>

        <div className="plans-h">{t.usage.choosePlan}</div>
        <motion.div className="plan-grid" initial="hidden" animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
          {PLANS.map((p) => {
            const isCur = p.id === planId;
            const feat = [
              `${fmtTokens(p.cap4h)} ${t.pricing.tokensEvery4h}`,
              p.week ? t.pricing.weeklyCap(fmtTokens(p.week)) : t.pricing.noWeeklyCap,
              t.usage.modelImagesZip,
            ];
            return (
              <motion.div className={`plan-tile ${isCur ? 'cur' : ''} ${p.id === 'pro' ? 'featured' : ''}`} key={p.id}
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                transition={{ type: 'spring', stiffness: 280, damping: 28 }}>
                {p.id === 'pro' && <span className="plan-flag">{t.pricing.recommended}</span>}
                <div className="pt-name">{p.name}</div>
                {p.id === 'free'
                  ? <div className="pt-price"><b>{t.pricing.free}</b></div>
                  : <div className="pt-price"><b>{p.price}</b><span>€ {t.pricing.perMonth}</span></div>}
                <div className="pt-desc">{(t.pricing.planDesc as Record<string, string>)[p.id]}</div>
                <ul className="pt-feats">
                  {feat.map((f) => <li key={f}>{f}</li>)}
                </ul>
                {p.id === 'free'
                  ? <button className="pt-btn cur" disabled>{isCur ? t.usage.currentPlan : t.usage.freeBase}</button>
                  : isCur
                  ? <button className="pt-btn cur" disabled>{t.usage.currentPlan}</button>
                  : <button className="pt-btn" onClick={() => onUpgrade(p.id)}>{t.usage.switchTo(p.name)}</button>}
              </motion.div>
            );
          })}
        </motion.div>

        <div className="team-sec">
          <div className="team-head">
            <div>
              <span className="tb-flag">{t.usage.forTeams}</span>
              <div className="team-title">{t.usage.teamPlans}</div>
              <p className="team-sub">{t.usage.teamSub}</p>
            </div>
          </div>
          <motion.div className="team-grid" initial="hidden" animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
            {TEAMS.map((team) => {
              const isCur = team.id === planId;
              return (
                <motion.div className={`team-tile ${isCur ? 'cur' : ''} ${team.id === 'team_medium' ? 'featured' : ''}`} key={team.id}
                  variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                  transition={{ type: 'spring', stiffness: 280, damping: 28 }}>
                  {team.id === 'team_medium' && <span className="plan-flag">{t.pricing.mostChosen}</span>}
                  <div className="pt-name">{team.name}</div>
                  <div className="pt-price"><b>{team.price}</b><span>€ {t.pricing.perMonth}</span></div>
                  <div className="pt-desc">{(t.pricing.planDesc as Record<string, string>)[team.id]}</div>
                  <ul className="pt-feats">
                    <li>{fmtTokens(team.cap4h)} {t.pricing.tokensEvery4h}</li>
                    <li>{t.pricing.noWeeklyCap}</li>
                    <li>{team.seats} {t.pricing.seats}</li>
                    <li>{t.pricing.oneInvoice} · {t.pricing.prioritySupport}</li>
                  </ul>
                  {isCur
                    ? <button className="pt-btn cur" disabled>{t.usage.currentPlan}</button>
                    : <button className="pt-btn" onClick={() => onUpgrade(team.id)}>{t.usage.switchTo(team.name)}</button>}
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   IMPOSTAZIONI
   ===================================================================== */

/** Solo i campioni di colore: nome e descrizione vengono dal dizionario. */
const THEME_CARDS = [
  { id: 'elegant', sw: ['#12151c', '#5ad6c0', '#e6ad55'] },
  { id: 'vivid', sw: ['#f6f4ef', '#0d9488', '#7c5cff'] },
  { id: 'terminal', sw: ['#0a0f0c', '#3ff0a0', '#1f9d63'] },
] as const;

function SettingsView({ user, prefs, onChange, onGoUsage, onDeleteAccount, onLogout }) {
  const { t, locale } = useI18n();
  const [section, setSection] = useState('generale');
  if (!user) return <div className="settings-view" />;
  const set = (patch) => onChange({ ...prefs, ...patch });
  const SECTIONS = [
    ['generale', t.settings.general], ['account', t.settings.account],
    ['fatturazione', t.settings.billing], ['utilizzo', t.settings.usage],
    ['privacy', t.settings.privacy], ['funzionalita', t.settings.features],
  ];
  const title = (SECTIONS.find((s) => s[0] === section) || SECTIONS[0])[1];
  const day = user.usage?.day;
  const week = user.usage?.week;
  const dayPct = day ? Math.min((day.used / day.cap) * 100, 100) : 0;
  const av = (prefs.callme || prefs.name || user.email).slice(0, 2).toUpperCase();
  return (
    <div className="settings-view">
      <div className="set-nav">
        <div className="h">{t.settings.title}</div>
        <div className="items">
          {SECTIONS.map(([id, label]) => (
            <button key={id} className={`item ${section === id ? 'active' : ''}`} onClick={() => setSection(id)}>{label}</button>
          ))}
        </div>
      </div>
      <div className="set-main">
        <div className="set-top"><span className="t">{title}</span></div>
        <div className="set-body">
          <div className="set-inner">

            {section === 'generale' && (<>
              <div className="set-sec-h">{t.settings.profile}</div>
              <div className="frow"><div className="flabel">{t.settings.avatar}</div><div className="avatar-lg">{av}</div></div>
              <div className="frow"><div className="flabel">{t.settings.fullName}</div>
                <input className="finput" value={prefs.name || ''} placeholder={t.settings.namePlaceholder} onChange={(e) => set({ name: e.target.value })} /></div>
              <div className="frow"><div className="flabel">{t.settings.callYou}</div>
                <input className="finput" value={prefs.callme || ''} placeholder={t.settings.callYouPlaceholder} onChange={(e) => set({ callme: e.target.value })} /></div>
              <div className="frow"><div className="flabel">{t.settings.yourWork}</div>
                <input className="finput" value={prefs.work || ''} placeholder={t.settings.workPlaceholder} onChange={(e) => set({ work: e.target.value })} /></div>
              <div className="fcol">
                <div className="flabel">{t.settings.instructions}</div>
                <div className="fhelp">{t.settings.instructionsHelp}</div>
                <textarea className="set-ta" value={prefs.instructions || ''} placeholder={t.settings.instructionsPlaceholder} onChange={(e) => set({ instructions: e.target.value })} />
              </div>

              <div className="set-sec-h" style={{ marginTop: 10 }}>{t.settings.interfaceLanguage}</div>
              <div className="fhelp" style={{ marginTop: -6 }}>{t.settings.interfaceLanguageHelp}</div>
              <div className="frow">
                <div className="flabel">{LOCALES[locale].label}</div>
                <LanguageSwitcher />
              </div>

              <div className="set-sec-h" style={{ marginTop: 10 }}>{t.settings.theme}</div>
              <div className="fhelp" style={{ marginTop: -6 }}>{t.settings.themeHelp}</div>
              <div className="theme-picker">
                {THEME_CARDS.map(({ id, sw }) => (
                  <button key={id} className={`theme-card ${(prefs.flavor || 'elegant') === id ? 'on' : ''}`} onClick={() => set({ flavor: id })}>
                    <div className="tc-swatch">{sw.map((c, i) => <span key={i} style={{ background: c }} />)}</div>
                    <div className="tc-meta">
                      <span className="tc-name">{t.settings.themes[id].name}</span>
                      <span className="tc-desc">{t.settings.themes[id].desc}</span>
                    </div>
                    <span className="tc-check">{(prefs.flavor || 'elegant') === id ? '✓' : ''}</span>
                  </button>
                ))}
              </div>
              <div className="frow"><div className="flabel">{t.settings.chatFont}</div>
                <select className="fselect" value={prefs.font || 'system'} onChange={(e) => set({ font: e.target.value })}>
                  <option value="system">{t.settings.fontSystem}</option>
                  <option value="mono">{t.settings.fontMono}</option>
                </select>
              </div>
            </>)}

            {section === 'account' && (
              <div className="set-block">
                <div className="lead"><span className="lt">{t.settings.account}</span><span className="ld">{t.settings.accountLead}</span></div>
                <div className="kv"><span className="k2">{t.auth.email}</span><span className="v2">{user.email}</span></div>
                <div className="kv"><span className="k2">{t.settings.plan}</span><span className="v2">{PLAN_NAMES[user.plan] || user.plan}</span></div>
                <div style={{ display: 'flex', gap: 8 }}><button className="btn-line" onClick={onLogout}>{t.settings.signOut}</button></div>
              </div>
            )}

            {section === 'fatturazione' && (
              <div className="set-block">
                <div className="lead"><span className="lt">{t.settings.billing}</span><span className="ld">{t.settings.billingLead}</span></div>
                <div className="kv"><span className="k2">{t.settings.plan}</span><span className="v2">{PLAN_NAMES[user.plan] || user.plan}</span></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-ink" onClick={onGoUsage}>{t.settings.choosePlan}</button>
                  <button className="btn-line" onClick={onGoUsage}>{t.settings.seeUsage}</button>
                </div>
              </div>
            )}

            {section === 'utilizzo' && (
              <div className="set-block">
                <div className="lead"><span className="lt">{t.settings.usage}</span><span className="ld">{t.settings.usageLead}</span></div>
                {day && (<>
                  <div className="kv"><span className="k2">{t.settings.window4h}</span><span className="v2">{fmtTokens(day.used)} / {fmtTokens(day.cap)} {t.usage.tokens}</span></div>
                  <div className={`usage-bar ${dayPct > 80 ? 'warn' : ''}`} style={{ maxWidth: 360 }}><div style={{ width: `${dayPct}%` }} /></div>
                  <div className="kv"><span className="k2">{t.settings.reset4h}</span><span className="v2">{fmtReset(day.resetAt, t.common.soon)}</span></div>
                </>)}
                {week && (
                  <div className="kv"><span className="k2">{t.settings.weekly}</span><span className="v2">{fmtTokens(week.used)} / {fmtTokens(week.cap)} · {t.usage.resetIn(fmtReset(week.resetAt, t.common.soon))}</span></div>
                )}
                <div><button className="btn-line" onClick={onGoUsage}>{t.settings.openUsage}</button></div>
              </div>
            )}

            {section === 'privacy' && (<>
              <div className="set-block">
                <div className="lead"><span className="lt">{t.settings.dataTitle}</span><span className="ld">{t.settings.dataBody}</span></div>
                <button className="btn-line" style={{ alignSelf: 'flex-start' }} onClick={onLogout}>{t.settings.signOutDevice}</button>
              </div>
              <div className="set-block">
                <div className="lead"><span className="lt">{t.settings.deleteAccount}</span><span className="ld">{t.settings.deleteAccountBody}</span></div>
                <button className="danger" onClick={onDeleteAccount}>{t.settings.deleteAccount}</button>
              </div>
            </>)}

            {section === 'funzionalita' && (<>
              <div className="set-block">
                <div className="lead"><span className="lt">{t.settings.replyStyle}</span><span className="ld">{t.settings.replyStyleBody}</span></div>
                <div className="segment">
                  {([['conciso', t.settings.styles.concise], ['bilanciato', t.settings.styles.balanced], ['dettagliato', t.settings.styles.detailed]] as const).map(([v, label]) => (
                    <button key={v} className={prefs.style === v ? 'on' : ''} onClick={() => set({ style: v })}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="set-block">
                <div className="lead"><span className="lt">{t.settings.replyLanguage}</span><span className="ld">{t.settings.replyLanguageBody}</span></div>
                {/* "Come l'interfaccia" è il default: chi non tocca nulla si
                    ritrova risposte nella lingua in cui sta leggendo il sito. */}
                <div className="segment wrap">
                  <button className={!prefs.lang || prefs.lang === 'auto' ? 'on' : ''} onClick={() => set({ lang: 'auto' })}>
                    {t.settings.sameAsInterface}
                  </button>
                  {LOCALE_LIST.map((l) => (
                    <button key={l} className={prefs.lang === l ? 'on' : ''} onClick={() => set({ lang: l })}>
                      {LOCALES[l].label}
                    </button>
                  ))}
                </div>
              </div>
            </>)}

          </div>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   AZIONI SOTTO OGNI RISPOSTA
   ===================================================================== */

function AiActions({ content, onRegenerate, canRegenerate }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const files = useMemo(() => extractCodeFiles(content), [content]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(content); } catch { /* contesto non sicuro */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1700);
  };

  return (
    <div className="ai-actions">
      <button className={copied ? 'act-chip on' : 'act-chip'} onClick={copy}>
        {copied ? I.check : I.copy} {copied ? t.chat.copied : t.chat.copy}
      </button>
      {files.length > 0 && (
        <button className="act-chip zip" onClick={() => downloadZip(files)}>
          {I.zip} {t.chat.downloadZip(files.length)}
        </button>
      )}
      {canRegenerate && (
        <button className="act-chip" onClick={onRegenerate} title={t.chat.regenerate}>
          {I.retry} {t.chat.regenerate}
        </button>
      )}
    </div>
  );
}

/* =====================================================================
   CHAT
   ===================================================================== */

function Chat({ token, onLogout }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('chat');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  /** Cassetto della sidebar: usato solo sotto i 1000px (vedi index.css). */
  const [sideOpen, setSideOpen] = useState(false);
  /** Id della conversazione in corso di rinomina, se presente. */
  const [renaming, setRenaming] = useState(null);
  /** Alzato da Esc per far ignorare il blur successivo. */
  const cancelRenameRef = useRef(false);
  /** Ultimo messaggio inviato, per la funzione "rigenera" */
  const lastSentRef = useRef(null);
  /**
   * Permette di interrompere una risposta in corso. Senza, una generazione
   * lunga e già chiaramente fuori strada va guardata fino in fondo, e i
   * token che consuma vengono comunque addebitati.
   */
  const abortRef = useRef(null);

  const fileRef = useRef(null);
  const endRef = useRef(null);
  const streamRef = useRef(null);
  const taRef = useRef(null);

  const [prefs, setPrefsState] = useState(() => {
    // `lang: 'auto'` significa "come l'interfaccia", che a sua volta viene
    // dalla lingua del browser: chi apre il sito in tedesco riceve risposte in
    // tedesco senza toccare niente.
    const def = { style: 'bilanciato', lang: 'auto', instructions: '', name: '', callme: '', work: '', flavor: 'elegant', font: 'system' };
    try { return { ...def, ...JSON.parse(localStorage.getItem('kai_prefs') || '{}') }; }
    catch { return def; }
  });
  const setPrefs = (p) => { setPrefsState(p); localStorage.setItem('kai_prefs', JSON.stringify(p)); };

  useEffect(() => {
    const flavor = prefs.flavor || 'elegant';
    const root = document.documentElement;
    root.classList.remove('theme-elegant', 'theme-vivid', 'theme-terminal', 'dark', 'landing-mode');
    root.classList.add('theme-' + flavor);
    if (flavor === 'elegant' || flavor === 'terminal') root.classList.add('dark');
    root.classList.toggle('font-mono', prefs.font === 'mono' || flavor === 'terminal');
  }, [prefs.flavor, prefs.font]);

  const H = useMemo(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    [token]
  );

  useEffect(() => {
    fetch(`${API}/user/profile`, { headers: H }).then((r) => (r.ok ? r.json() : Promise.reject())).then(setUser).catch(onLogout);
    initSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll solo se l'utente è già in fondo: se sta rileggendo un
  // messaggio precedente, strapparlo giù a ogni chunk dello stream è ostile.
  useEffect(() => {
    if (atBottom) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, atBottom]);

  const onStreamScroll = useCallback(() => {
    const el = streamRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(gap < 120);
  }, []);

  // Ridimensiona il campo di testo mentre si scrive, fino a un tetto
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 190) + 'px';
  }, [input]);

  const [, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 60000); return () => clearInterval(t); }, []);

  const loadSessions = async () => {
    try {
      const r = await fetch(`${API}/chat/sessions`, { headers: H });
      if (!r.ok) return [];
      const list = await r.json();
      setSessions(list);
      return list;
    } catch { return []; }
  };

  const initSessions = async () => {
    const list = await loadSessions();
    const withMsgs = list.find((s) => !s.empty);
    if (withMsgs) { await openSession(withMsgs.id); }
    else if (list.length) { setSessionId(list[0].id); setMessages([]); }
    else { await newChat(); }
  };

  const openSession = async (id) => {
    setSessionId(id); setView('chat'); setAtBottom(true); setSideOpen(false);
    try {
      const r = await fetch(`${API}/chat/${id}/messages`, { headers: H });
      const msgs = r.ok ? await r.json() : [];
      setMessages(msgs);
    } catch { setMessages([]); }
  };

  const newChat = async () => {
    setSideOpen(false);
    const empty = sessions.find((s) => s.empty);
    if (empty) { setSessionId(empty.id); setMessages([]); setView('chat'); return; }
    try {
      const res = await fetch(`${API}/chat/new`, { method: 'POST', headers: H, body: JSON.stringify({ title: t.chat.newConversation }) });
      const data = await res.json();
      setSessionId(data.sessionId); setMessages([]); setView('chat');
      loadSessions();
    } catch {
      toast.error(t.chat.createFailed, t.chat.createFailedBody);
    }
  };

  const renameSession = async (id, title) => {
    setRenaming(null);
    // Aggiorna subito la lista: aspettare la risposta per un semplice
    // rinomina fa sembrare l'interfaccia lenta.
    setSessions((list) => list.map((s) => (s.id === id ? { ...s, title: title.trim() || s.title } : s)));
    try {
      await fetch(`${API}/chat/${id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ title }) });
      loadSessions();
    } catch {
      toast.error(t.chat.renameFailed, t.chat.renameFailedBody);
      loadSessions();
    }
  };

  const deleteSession = async (id, e) => {
    e?.stopPropagation();
    const ok = await toast.confirm({
      title: t.chat.deleteTitle,
      description: t.chat.deleteBody,
      confirmLabel: t.chat.delete,
      danger: true,
    });
    if (!ok) return;
    try { await fetch(`${API}/chat/${id}`, { method: 'DELETE', headers: H }); } catch { /* ignore */ }
    const list = await loadSessions();
    toast.success(t.chat.deleted);
    if (id === sessionId) {
      const next = list.find((s) => !s.empty) || list[0];
      if (next) openSession(next.id); else newChat();
    }
  };

  const onFiles = (e) => {
    const files: File[] = Array.from(e.target.files || []);
    let rejected = 0;
    files.forEach((file) => {
      if (!file.type.startsWith('image/')) { rejected++; return; }
      // Oltre ~4MB la conversione in base64 gonfia la richiesta e spesso
      // il backend la rifiuta: meglio dirlo subito invece di far fallire l'invio.
      if (file.size > 4 * 1024 * 1024) {
        toast.error(t.chat.imageTooLarge, t.chat.imageTooLargeBody(file.name));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setImages((prev) => [...prev, { name: file.name, dataUrl: reader.result }].slice(0, 6));
      reader.readAsDataURL(file);
    });
    if (rejected) toast.info(t.chat.filesIgnored, t.chat.onlyImages);
    e.target.value = '';
  };

  /** Incolla immagini direttamente dagli appunti (screenshot di errori). */
  const onPaste = (e) => {
    const items: DataTransferItem[] = Array.from(e.clipboardData?.items || []);
    const imgs = items.filter((it) => it.type.startsWith('image/'));
    if (!imgs.length) return;
    e.preventDefault();
    imgs.forEach((it) => {
      const file = it.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setImages((prev) => [...prev, { name: file.name || 'incollata.png', dataUrl: reader.result }].slice(0, 6));
      reader.readAsDataURL(file);
    });
    toast.info(t.chat.imageAttached, t.chat.fromClipboard);
  };

  const runSend = async (text, imgUrls, { replaceLast = false } = {}) => {
    setBusy(true);
    setAtBottom(true);
    lastSentRef.current = { text, imgUrls };

    setMessages((m) => {
      // "Rigenera" riusa la stessa domanda: sostituisce solo la risposta
      const base = replaceLast ? m.slice(0, -1) : [...m, { role: 'user', content: text, images: imgUrls }];
      return [...base, { role: 'assistant', content: '' }];
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API}/chat/message`, {
        method: 'POST', headers: H,
        signal: controller.signal,
        // `regenerate` dice al backend di scartare la risposta precedente
        // invece di salvare di nuovo la stessa domanda.
        // Il backend vuole una lingua concreta: qui `auto` diventa quella
        // effettivamente in uso nell'interfaccia.
        body: JSON.stringify({
          sessionId,
          message: text,
          prefs: { ...prefs, lang: !prefs.lang || prefs.lang === 'auto' ? locale : prefs.lang },
          images: imgUrls,
          regenerate: replaceLast,
        }),
      });

      if (res.status === 429) {
        const d = await res.json();
        setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: d.error }; return c; });
        toast.error(t.chat.quotaTitle, t.chat.quotaBody);
        setBusy(false);
        return;
      }
      if (!res.ok || !res.body) throw new Error(t.chat.badResponse);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n'); buf = parts.pop();
        for (const p of parts) {
          const line = p.replace(/^data: /, '').trim();
          if (!line) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === 'text') {
              setMessages((m) => { const c = [...m]; c[c.length - 1].content += evt.content; return [...c]; });
            } else if (evt.type === 'error') {
              setMessages((m) => { const c = [...m]; c[c.length - 1].content += '\n\n' + evt.error; return [...c]; });
            } else if (evt.type === 'done') {
              if (evt.usage) setUser((u) => (u ? { ...u, usage: evt.usage } : u));
            }
          } catch { /* chunk parziale, arriverà completo al giro dopo */ }
        }
      }
    } catch (e) {
      if (e?.name === 'AbortError') {
        // Interruzione voluta: tieni il testo arrivato fin qui e segnalo,
        // invece di trattarlo come un errore di rete.
        setMessages((m) => {
          const c = [...m];
          const last = c[c.length - 1];
          if (last && last.role === 'assistant') last.stopped = true;
          return [...c];
        });
      } else {
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { role: 'assistant', content: '', failed: true };
          return c;
        });
        toast.error(t.chat.connectionLost, t.chat.replyNotReceived);
      }
    }
    abortRef.current = null;
    setBusy(false);
    loadSessions();
  };

  /** Interrompe la generazione in corso. */
  const stopGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const send = async (preset?: string) => {
    const text = (preset ?? input).trim();
    const imgs = preset ? [] : images;
    if ((!text && imgs.length === 0) || !sessionId || busy) return;
    const imgUrls = imgs.map((i) => i.dataUrl);
    setInput(''); setImages([]);
    await runSend(text, imgUrls);
  };

  const regenerate = () => {
    const last = lastSentRef.current;
    if (!last || busy) return;
    runSend(last.text, last.imgUrls, { replaceLast: true });
  };

  const upgrade = async (plan) => {
    try {
      const res = await fetch(`${API}/billing/create-checkout`, { method: 'POST', headers: H, body: JSON.stringify({ plan }) });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      toast.error(t.usage.paymentUnavailable, data.error || `HTTP ${res.status}`);
    } catch (e) {
      toast.error(t.usage.connectionError, e.message);
    }
  };

  const deleteAccount = async () => {
    const ok = await toast.confirm({
      title: t.settings.deleteAccountConfirm,
      description: t.settings.deleteAccountConfirmBody,
      confirmLabel: t.settings.deleteAll,
      danger: true,
    });
    if (!ok) return;
    try { await fetch(`${API}/account`, { method: 'DELETE', headers: H }); } catch { /* ignore */ }
    onLogout();
  };

  /* ---- palette comandi ---- */
  const commands = useMemo(() => {
    const list = [];
    list.push(
      { id: 'new', group: t.common.actions, title: t.chat.newConversation, shortcut: 'Ctrl N', icon: I.plus, keywords: 'crea chat nuova new', run: newChat },
      { id: 'usage', group: t.common.actions, title: t.chat.navUsage, icon: I.chart, keywords: 'token limiti abbonamento prezzi usage plans', run: () => setView('usage') },
      { id: 'settings', group: t.common.actions, title: t.settings.title, icon: I.gear, keywords: 'preferenze tema profilo settings', run: () => setView('settings') },
      { id: 'logout', group: t.common.actions, title: t.chat.logout, icon: I.logout, keywords: 'logout disconnetti esci', run: onLogout },
    );
    // Cambio tema rapido: è la preferenza che si tocca più spesso
    (['elegant', 'vivid', 'terminal'] as const).forEach((id) => {
      const label = t.settings.themes[id].name;
      list.push({
        id: 'theme-' + id, group: t.settings.theme, title: `${t.settings.theme}: ${label}`, icon: I.gear,
        keywords: 'aspetto colori theme ' + id,
        run: () => { setPrefs({ ...prefs, flavor: id }); toast.success(t.settings.themeUpdated, label); },
      });
    });
    sessions.filter((s) => !s.empty).forEach((s) => {
      list.push({
        id: 'conv-' + s.id, group: t.chat.conversations, title: s.title || t.chat.untitled,
        icon: I.chat, keywords: s.title || '', run: () => openSession(s.id),
      });
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, prefs, t]);

  /* ---- scorciatoie globali ---- */
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((v) => !v); }
      else if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); newChat(); }
      else if (e.key === 'Escape') {
        if (view === 'usage' || view === 'settings') setView('chat');
        else setSideOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, sessions]);

  const day = user?.usage?.day;
  const dayPct = day ? Math.min((day.used / day.cap) * 100, 100) : 0;
  const dayLeft = day ? Math.max(day.cap - day.used, 0) : 0;
  const atCap = day ? day.used >= day.cap : false;
  const initials = user ? user.email.slice(0, 2).toUpperCase() : 'K';
  const planLabel = user ? (PLAN_NAMES[user.plan] || user.plan) : '';
  const convTitle = messages.find((m) => m.role === 'user')?.content?.slice(0, 46) || t.chat.newConversation;
  const accent = FLAVOR_ACCENT[prefs.flavor] || FLAVOR_ACCENT.elegant;
  const visibleSessions = sessions.filter((s) => !s.empty);

  return (
    <div className="app">
      <div className="shell">
        <div className="rail">
          <div className="mono-k">K</div>
          <div className="nav">
            {['chat', 'usage'].map((v) => (
              <button key={v} className={`ico ${view === v ? 'active' : ''}`} onClick={() => setView(v)}
                title={v === 'chat' ? t.chat.navChat : t.chat.navUsage}>
                {view === v && (
                  <motion.span layoutId="rail-indicator" className="ico-indicator" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
                )}
                {v === 'chat' ? I.chat : I.chart}
              </button>
            ))}
          </div>
          <div className="foot">
            <button className={`ico ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')} title={t.settings.title}>{I.gear}</button>
            <div className="avatar" title={user?.email}>{initials}</div>
          </div>
        </div>

        <AnimatePresence>
          {sideOpen && (
            <motion.div className="side-scrim" onClick={() => setSideOpen(false)}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }} aria-hidden="true" />
          )}
        </AnimatePresence>

        <div className={sideOpen ? 'side open' : 'side'}>
          <button className="side-close" onClick={() => setSideOpen(false)} aria-label={t.chat.closeMenu}>×</button>
          <div className="side-head">
            <span className="wordmark">K AI</span>
            <span className="tag">{planLabel}</span>
          </div>
          <div className="side-actions">
            <button className="new-btn" onClick={newChat}>{I.plus} {t.chat.newConversation}</button>
            <button className="search" onClick={() => setPaletteOpen(true)}>
              {I.search}<span>{t.chat.search}</span><span className="kbd">Ctrl K</span>
            </button>
          </div>
          <div className="side-sec">{t.chat.conversations}</div>
          <div className="conv-list">
            {visibleSessions.length === 0 && (
              <div className="conv-empty">{t.chat.noConversations}</div>
            )}
            <AnimatePresence initial={false}>
              {visibleSessions.map((s) => (
                <motion.div key={s.id} layout
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className={`conv-item ${s.id === sessionId ? 'active' : ''}`}
                  onClick={() => renaming !== s.id && openSession(s.id)}>
                  {renaming === s.id ? (
                    <input
                      className="ci-rename"
                      defaultValue={s.title}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        // Esc alza il flag prima di togliere il fuoco: senza,
                        // il blur che segue salverebbe comunque il testo.
                        if (cancelRenameRef.current) { cancelRenameRef.current = false; setRenaming(null); return; }
                        renameSession(s.id, e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        else if (e.key === 'Escape') { cancelRenameRef.current = true; e.currentTarget.blur(); }
                      }}
                    />
                  ) : (
                    <>
                      <span className="ci-title">{s.title}</span>
                      <button className="ci-act" title={t.chat.rename} aria-label={t.chat.rename}
                        onClick={(e) => { e.stopPropagation(); setRenaming(s.id); }}>{I.edit}</button>
                      <button className="ci-act ci-del" onClick={(e) => deleteSession(s.id, e)} title={t.chat.delete} aria-label={t.chat.delete}>×</button>
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="side-foot">
            {user && day && (<>
              <div className="usage-row"><span>{t.chat.tokensWindow}</span><b>{fmtTokens(day.used)}/{fmtTokens(day.cap)}</b></div>
              <div className={`usage-bar ${dayPct > 80 ? 'warn' : ''}`}><div style={{ width: `${dayPct}%` }} /></div>
              <div className="usage-reset">{t.chat.resetIn(fmtReset(day.resetAt, t.common.soon))}</div>
              {atCap && <button className="upg" onClick={() => setView('usage')}>{t.chat.upgrade}</button>}
            </>)}
            <button className="logout" onClick={onLogout}>{t.chat.logout}</button>
          </div>
        </div>

        <div className="main">
          <div className="top">
            <button className="menu-btn" onClick={() => setSideOpen(true)} aria-label={t.chat.openConversations}>
              {I.menu}
            </button>
            <span className="conv">{convTitle}</span>
            <span className="model"><span className="dot" /> K AI {I.chevron}</span>
          </div>

          <div className="stream" ref={streamRef} onScroll={onStreamScroll}>
            {messages.length === 0 ? (
              <div className="welcome-stage">
                <div className="welcome-bg" aria-hidden="true">
                  <VoxelTopographyGrid
                    primaryColor={accent.primary} wireColor={accent.wire} bgColor={accent.bg}
                    speed={0.01} tileSize={42} maxHeight={50} interactive={false}
                  />
                </div>
                <motion.div className="welcome" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
                  <div className="k">K</div>
                  <h2>{t.chat.welcomeTitle}</h2>
                  <p>{t.chat.welcomeSub}</p>
                  <motion.div className="chips" initial="hidden" animate="show"
                    variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } }}>
                    {t.chat.examples.map((ex) => (
                      <motion.button key={ex} className="chip-ex" onClick={() => send(ex)}
                        variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                        whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}>
                        {ex}
                      </motion.button>
                    ))}
                  </motion.div>
                </motion.div>
              </div>
            ) : (
            <div className="stream-inner">
              {messages.map((m, i) => (
                m.role === 'user' ? (
                  <motion.div className="turn-user" key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}>
                    {m.images && m.images.length > 0 && (
                      <div className="u-images">
                        {m.images.map((src, j) => <img key={j} src={src} alt={t.common.attachment} />)}
                      </div>
                    )}
                    {m.content && <div className="u-bubble">{m.content}</div>}
                  </motion.div>
                ) : (
                  <motion.div className="turn-ai" key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}>
                    <div className="ai-head"><span className="k">K</span><span className="meta">K AI</span></div>
                    {m.failed ? (
                      <div className="chat-error">
                        <span><b>{t.chat.replyFailed}</b> {t.chat.replyFailedBody}</span>
                        <button onClick={regenerate}>{t.chat.retry}</button>
                      </div>
                    ) : (
                      <>
                        <Content text={m.content} streaming={busy && i === messages.length - 1} />
                        {m.stopped && <div className="turn-stopped">{t.chat.stopped}</div>}
                      </>
                    )}
                    {m.content && !busy && (
                      <AiActions
                        content={m.content}
                        onRegenerate={regenerate}
                        canRegenerate={i === messages.length - 1 && !!lastSentRef.current}
                      />
                    )}
                  </motion.div>
                )
              ))}
              <div ref={endRef} />
            </div>
            )}

            <AnimatePresence>
              {!atBottom && messages.length > 0 && (
                <motion.button
                  className="scroll-bottom"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                  onClick={() => { setAtBottom(true); endRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
                >
                  {I.down} {t.chat.backToBottom}
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <div className="composer">
            <div className="composer-inner">
              <div className="box">
                {images.length > 0 && (
                  <div className="composer-thumbs">
                    {images.map((im, idx) => (
                      <div className="thumb" key={idx}>
                        <img src={im.dataUrl} alt={im.name} />
                        <button className="thumb-del" onClick={() => setImages(images.filter((_, j) => j !== idx))} aria-label={t.common.remove}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                  ref={taRef}
                  rows={1}
                  placeholder={t.chat.placeholder}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onPaste={onPaste}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                />
                <div className="box-row">
                  <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
                  {/* I chip "Web" e "Tools" erano decorativi: sembravano
                      comandi ma non facevano nulla. Al loro posto un
                      contatore reale degli allegati. */}
                  <button className="tool" onClick={() => fileRef.current?.click()} title={t.chat.attachImages}>{I.image}</button>
                  {images.length > 0 && (
                    <span className="tool-chip">{t.chat.imageCount(images.length)}</span>
                  )}
                  {busy ? (
                    <button className="send stop" onClick={stopGeneration} title={t.chat.stop}>
                      {I.stop} {t.chat.stop}
                    </button>
                  ) : (
                    <button className="send" onClick={() => send()} disabled={!input.trim() && images.length === 0}>
                      {t.chat.send} {I.send}
                    </button>
                  )}
                </div>
              </div>
              <div className="composer-meta">
                <span>
                  <span className="kbd-hint">Enter</span> {t.chat.hintSend} · <span className="kbd-hint">Shift+Enter</span> {t.chat.hintNewline} · <span className="kbd-hint">Ctrl K</span> {t.chat.hintSearch}
                </span>
                <span>{t.chat.tokensLeft(fmtTokens(dayLeft))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />

      <AnimatePresence>
        {(view === 'usage' || view === 'settings') && (
          <motion.div className="modal-backdrop" onClick={() => setView('chat')}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <motion.div className="modal-window" onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
              <button className="modal-close" onClick={() => setView('chat')} aria-label={t.common.close}>×</button>
              {view === 'usage'
                ? <UsageView user={user} onUpgrade={upgrade} />
                : <SettingsView user={user} prefs={prefs} onChange={setPrefs} onGoUsage={() => setView('usage')} onDeleteAccount={deleteAccount} onLogout={onLogout} />}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =====================================================================
   RADICE
   ===================================================================== */

export default function App() {
  const { t } = useI18n();
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  // Chi ha già un token va dritto in chat; gli altri vedono la vetrina.
  const [stage, setStage] = useState(() => (localStorage.getItem('token') ? 'app' : 'landing'));

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setStage('landing');
  };

  const onAuth = (t) => { setToken(t); setStage('app'); };

  // Il tema della landing è fisso; tornando all'app va ripristinato quello scelto.
  useEffect(() => {
    if (stage !== 'landing') return;
    const root = document.documentElement;
    const prev = root.className;
    root.className = 'landing-mode dark theme-elegant';
    return () => { root.className = prev; };
  }, [stage]);

  return (
    <MotionConfig reducedMotion="user">
      {token && stage === 'app' ? (
        <Chat token={token} onLogout={logout} />
      ) : stage === 'auth' ? (
        <Auth onAuth={onAuth} onBack={() => setStage('landing')} />
      ) : (
        <Suspense fallback={<div className="lp-loading" aria-label={t.common.loading} />}>
          <Landing onStart={() => setStage('auth')} />
        </Suspense>
      )}
    </MotionConfig>
  );
}
