import { useEffect, useRef, useState, Fragment } from 'react';
import JSZip from 'jszip';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { VoxelTopographyGrid } from '@/components/ui/voxel-topography-grid';

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

async function downloadZip(files, baseName = 'k-ai-code') {
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${baseName}.zip`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const EXAMPLES = [
  'Porta questo plugin da Spigot a Paper 1.21',
  'Mod Fabric: aggiungi un minerale custom',
  'Perche ottengo NullPointerException qui?',
  'Script Python per backup automatici del server',
];

const PLANS = [
  { id: 'free', name: 'Free', price: '0', cap4h: 15000, week: 50000, desc: 'Per provare. Cap basso con tetto settimanale.' },
  { id: 'starter', name: 'Starter', price: '15', cap4h: 40000, week: 200000, desc: 'Per iniziare. Qualche reset durante la giornata.' },
  { id: 'pro', name: 'Pro', price: '60', cap4h: 120000, week: null, desc: 'Molti token. Lavori quotidiani senza pensieri.' },
  { id: 'enterprise', name: 'Enterprise', price: '140', cap4h: 280000, week: null, desc: 'Lavori complessi senza cap, salvo raffiche intense.' },
];

const TEAMS = [
  { id: 'team_low', name: 'Team Low', price: '200', cap4h: 420000, seats: 3, desc: 'Più potenza dell\'Enterprise, per team piccoli.' },
  { id: 'team_medium', name: 'Team Medium', price: '300', cap4h: 600000, seats: 6, desc: 'Più token del Low, per team in crescita.' },
  { id: 'team_max', name: 'Team Max', price: '400', cap4h: 850000, seats: 10, desc: 'Massima potenza condivisa per tutto il network.' },
];

const PLAN_NAMES = {
  free: 'Free', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise',
  team_low: 'Team Low', team_medium: 'Team Medium', team_max: 'Team Max',
};

const FLAVOR_ACCENT = {
  elegant: { primary: '#34d3b8', wire: 'rgba(52, 211, 184, 0.3)' },
  vivid: { primary: '#6d5cff', wire: 'rgba(109, 92, 255, 0.3)' },
  terminal: { primary: '#3ff0a0', wire: 'rgba(63, 240, 160, 0.3)' },
};

function fmtTokens(n) {
  if (n == null) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 ? 1 : 0) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return String(n);
}
function fmtReset(resetAt) {
  const ms = Math.max(0, (resetAt || 0) - Date.now());
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) { const d = Math.floor(h / 24); return `${d}g ${h % 24}h`; }
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return 'a breve';
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
  search: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9a9ea6" strokeWidth="2.2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.3-4.3"/></svg>,
  send: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4"><path d="M5 12h13M12 5l7 7-7 7"/></svg>,
  chevron: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8f939a" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>,
  monitor: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
  eye: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.6 10.6 0 0112 5c7 0 10.5 7 10.5 7a15.6 15.6 0 01-3.4 4.4M6.7 6.7C3.4 8.8 1.5 12 1.5 12s3.5 7 10.5 7c1.5 0 2.8-.3 4-.8"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/></svg>,
  sun: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>,
  moon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z"/></svg>,
};

function inline(text, kb) {
  const nodes = [];
  let rest = String(text);
  let k = 0;
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/;
  while (rest.length) {
    const m = rest.match(re);
    if (!m) { nodes.push(rest); break; }
    if (m.index > 0) nodes.push(rest.slice(0, m.index));
    const t = m[0];
    if (t[0] === '`') nodes.push(<code className="inl-code" key={kb + '-' + k++}>{t.slice(1, -1)}</code>);
    else if (t.startsWith('**')) nodes.push(<strong key={kb + '-' + k++}>{t.slice(2, -2)}</strong>);
    else nodes.push(<em key={kb + '-' + k++}>{t.slice(1, -1)}</em>);
    rest = rest.slice(m.index + t.length);
  }
  return nodes;
}

function Prose({ text }) {
  const lines = String(text).split('\n');
  const blocks = [];
  let list = null, para = [];
  const flushP = () => { if (para.length) { blocks.push({ t: 'p', v: para }); para = []; } };
  const flushL = () => { if (list) { blocks.push({ t: 'ul', v: list }); list = null; } };
  for (const line of lines) {
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    const h = line.match(/^\s*(#{1,3})\s+(.*)$/);
    if (li || ol) { flushP(); if (!list) list = []; list.push(li ? li[1] : ol[1]); }
    else if (h) { flushP(); flushL(); blocks.push({ t: 'h', lvl: h[1].length, v: h[2] }); }
    else if (line.trim() === '') { flushP(); flushL(); }
    else { flushL(); para.push(line); }
  }
  flushP(); flushL();
  return (
    <>
      {blocks.map((b, i) => {
        if (b.t === 'ul') return <ul className="md-ul" key={i}>{b.v.map((it, j) => <li key={j}>{inline(it, i + '-' + j)}</li>)}</ul>;
        if (b.t === 'h') return <div className={'md-h md-h' + b.lvl} key={i}>{inline(b.v, 'h' + i)}</div>;
        return <p className="md-p" key={i}>{b.v.map((ln, j) => <Fragment key={j}>{inline(ln, i + '-' + j)}{j < b.v.length - 1 ? <br /> : null}</Fragment>)}</p>;
      })}
    </>
  );
}

function Content({ text, streaming }) {
  const parts = text.split('```');
  const out = [];
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      const nl = part.indexOf('\n');
      const lang = nl > -1 ? part.slice(0, nl).trim() : '';
      const body = (nl > -1 ? part.slice(nl + 1) : part).replace(/\n$/, '');
      const lines = body.split('\n');
      out.push(
        <div className="code-card" key={i}>
          <div className="code-head">
            <span className="fn">{lang || 'snippet'}</span>
            <span className="lg">code</span>
            <span className="act"><button className="act-chip" style={{ border: 'none', padding: 0 }} onClick={() => navigator.clipboard?.writeText(body)}>Copy</button></span>
          </div>
          <div className="code-body">
            {lines.map((ln, k) => (
              <div className="cl" key={k}><span className="n">{k + 1}</span><span>{ln || ' '}</span></div>
            ))}
          </div>
        </div>
      );
    } else if (part) {
      out.push(<div className="ai-body" key={i}><Prose text={part} /></div>);
    }
  });
  if (streaming) out.push(<span className="ai-caret" key="caret" />);
  return <>{out}</>;
}

function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [step, setStep] = useState('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const start = async () => {
    setErr(''); setLoading(true);
    try {
      const ep = mode === 'login' ? 'login/start' : 'register/start';
      const res = await fetch(`${API}/auth/${ep}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      setStep('code'); setCode('');
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  const verify = async () => {
    setErr(''); setLoading(true);
    try {
      const ep = mode === 'login' ? 'login/verify' : 'register/verify';
      const res = await fetch(`${API}/auth/${ep}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      localStorage.setItem('token', data.token);
      onAuth(data.token);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  const switchMode = () => { setMode(mode === 'login' ? 'signup' : 'login'); setStep('form'); setErr(''); };

  return (
    <div className="auth-wrap">
      <div className="auth-bg" aria-hidden="true">
        <VoxelTopographyGrid primaryColor="#34d3b8" wireColor="rgba(52, 211, 184, 0.35)" speed={0.012} tileSize={38} />
      </div>
      <motion.button className="demo-btn" onClick={() => setShowDemo(true)}
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 24 }}
        whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}>
        <span className="demo-btn-play">▶</span> Guarda la demo
      </motion.button>
      <AnimatePresence>
        {showDemo && (
          <motion.div className="modal-backdrop" onClick={() => setShowDemo(false)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <motion.div className="video-modal" onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
              <button className="modal-close" onClick={() => setShowDemo(false)} aria-label="Chiudi">×</button>
              <video src="/video/kai-code-intro.mp4" controls autoPlay playsInline />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="auth-card">
        <div className="auth-top">
          <span className="wordmark">K AI</span>
          <span className="tag">Code</span>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {step === 'form' ? (
            <motion.div key="form" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
              <p className="auth-lead">Assistente di programmazione per sviluppatori Minecraft. Plugin, mod e codice in ogni linguaggio.</p>
              <label className="field">
                <span className="lbl">Email</span>
                <input type="email" placeholder="dev@server.net" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="field">
                <span className="lbl">Password</span>
                <div className="field-pw">
                  <input type={showPassword ? 'text' : 'password'} placeholder="La tua password" value={password}
                    onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && start()} />
                  <button type="button" className="field-pw-toggle" onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Nascondi password' : 'Mostra password'} tabIndex={-1}>
                    {showPassword ? I.eyeOff : I.eye}
                  </button>
                </div>
              </label>
              {err && <p className="err">{err}</p>}
              <button className="btn" style={{ marginTop: 6 }} onClick={start} disabled={loading || !email || !password}>
                {loading ? '...' : mode === 'login' ? 'Accedi' : 'Crea account'}
              </button>
              <div><button className="link" onClick={switchMode}>
                {mode === 'login' ? 'Non hai un account? Registrati' : 'Hai gia un account? Accedi'}
              </button></div>
            </motion.div>
          ) : (
            <motion.div key="code" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
              <p className="auth-lead">Ti abbiamo inviato un codice a 6 cifre a <b>{email}</b>. Inseriscilo per {mode === 'login' ? 'accedere' : 'completare la registrazione'}.</p>
              <label className="field">
                <span className="lbl">Codice di verifica</span>
                <input type="text" inputMode="numeric" maxLength={6} placeholder="123456" value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && verify()} />
              </label>
              {err && <p className="err">{err}</p>}
              <button className="btn" style={{ marginTop: 6 }} onClick={verify} disabled={loading || code.length < 6}>
                {loading ? '...' : 'Verifica'}
              </button>
              <div style={{ display: 'flex', gap: 14 }}>
                <button className="link" onClick={() => { setStep('form'); setErr(''); }}>Indietro</button>
                <button className="link" onClick={start} disabled={loading}>Rinvia codice</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function UsageBar({ label, used, cap, resetAt, sub }) {
  const pct = cap ? Math.min((used / cap) * 100, 100) : 0;
  const warn = pct > 80;
  return (
    <div className="tok-card">
      <div className="tok-top">
        <span className="tok-label">{label}</span>
        <span className="tok-reset">reset tra {fmtReset(resetAt)}</span>
      </div>
      <div className="tok-nums">
        <span className="tok-used">{fmtTokens(used)}</span>
        <span className="tok-cap">/ {fmtTokens(cap)} token</span>
      </div>
      <div className={`tok-bar ${warn ? 'warn' : ''}`}><div style={{ width: `${pct}%` }} /></div>
      {sub && <span className="tok-sub">{sub}</span>}
    </div>
  );
}

function UsageView({ user, onUpgrade }) {
  if (!user || !user.usage) return <div className="usage-view" />;
  const { day, week } = user.usage;
  const planId = user.usage.plan || user.plan;
  const cur = PLANS.find((p) => p.id === planId) || TEAMS.find((t) => t.id === planId);
  const isTeam = String(planId).startsWith('team');

  return (
    <div className="usage-view">
      <div className="u-top">
        <span className="t">Uso</span>
        <span className="sub">Piano {PLAN_NAMES[planId] || planId}</span>
        <span className="right"><span className="pill">Token · K AI</span></span>
      </div>
      <div className="u-body">
        <div className="tok-grid">
          <UsageBar label="Finestra corrente (4h)" used={day.used} cap={day.cap} resetAt={day.resetAt}
            sub="Si resetta ogni 4 ore" />
          {week
            ? <UsageBar label="Tetto settimanale" used={week.used} cap={week.cap} resetAt={week.resetAt}
                sub="Solo Free e Starter" />
            : <div className="tok-card ghost">
                <div className="tok-top"><span className="tok-label">Tetto settimanale</span></div>
                <div className="tok-nofree">Nessun tetto settimanale</div>
                <span className="tok-sub">Il tuo piano è limitato solo dalla finestra di 4 ore</span>
              </div>}
        </div>

        <div className="plans-h">Scegli il tuo piano</div>
        <motion.div className="plan-grid" initial="hidden" animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
          {PLANS.map((p) => {
            const isCur = p.id === planId;
            const feat = [
              `${fmtTokens(p.cap4h)} token ogni 4h`,
              p.week ? `Tetto settimanale ${fmtTokens(p.week)}` : 'Nessun tetto settimanale',
              'Modello K AI · immagini · ZIP',
            ];
            return (
              <motion.div className={`plan-tile ${isCur ? 'cur' : ''} ${p.id === 'pro' ? 'featured' : ''}`} key={p.id}
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                transition={{ type: 'spring', stiffness: 280, damping: 28 }}>
                {p.id === 'pro' && <span className="plan-flag">Consigliato</span>}
                <div className="pt-name">{p.name}</div>
                {p.id === 'free'
                  ? <div className="pt-price"><b>Gratis</b></div>
                  : <div className="pt-price"><b>{p.price}</b><span>€ / mese</span></div>}
                <div className="pt-desc">{p.desc}</div>
                <ul className="pt-feats">
                  {feat.map((f) => <li key={f}>{f}</li>)}
                </ul>
                {p.id === 'free'
                  ? <button className="pt-btn cur" disabled>{isCur ? 'Piano attuale' : 'Piano base gratuito'}</button>
                  : isCur
                  ? <button className="pt-btn cur" disabled>Piano attuale</button>
                  : <button className="pt-btn" onClick={() => onUpgrade(p.id)}>Passa a {p.name}</button>}
              </motion.div>
            );
          })}
        </motion.div>

        <div className="team-sec">
          <div className="team-head">
            <div>
              <span className="tb-flag">Per team & network</span>
              <div className="team-title">Piani Team</div>
              <p className="team-sub">Molti più token dell'Enterprise, condivisi tra il team. Fatturazione unica, da 3 a 10 postazioni in base al piano.</p>
            </div>
          </div>
          <motion.div className="team-grid" initial="hidden" animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
            {TEAMS.map((t) => {
              const isCur = t.id === planId;
              return (
                <motion.div className={`team-tile ${isCur ? 'cur' : ''} ${t.id === 'team_medium' ? 'featured' : ''}`} key={t.id}
                  variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                  transition={{ type: 'spring', stiffness: 280, damping: 28 }}>
                  {t.id === 'team_medium' && <span className="plan-flag">Più scelto</span>}
                  <div className="pt-name">{t.name}</div>
                  <div className="pt-price"><b>{t.price}</b><span>€ / mese</span></div>
                  <div className="pt-desc">{t.desc}</div>
                  <ul className="pt-feats">
                    <li>{fmtTokens(t.cap4h)} token ogni 4h</li>
                    <li>Nessun tetto settimanale</li>
                    <li>{t.seats} postazioni incluse</li>
                    <li>Fatturazione unica · supporto dedicato</li>
                  </ul>
                  {isCur
                    ? <button className="pt-btn cur" disabled>Piano attuale</button>
                    : <button className="pt-btn" onClick={() => onUpgrade(t.id)}>Passa a {t.name}</button>}
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ user, prefs, onChange, onGoUsage, onUpgrade, onDeleteAccount, onLogout }) {
  const [section, setSection] = useState('generale');
  if (!user) return <div className="settings-view" />;
  const set = (patch) => onChange({ ...prefs, ...patch });
  const SECTIONS = [['generale', 'Generale'], ['account', 'Account'], ['fatturazione', 'Fatturazione'], ['utilizzo', 'Utilizzo'], ['privacy', 'Privacy'], ['funzionalita', 'Funzionalita']];
  const title = (SECTIONS.find((s) => s[0] === section) || SECTIONS[0])[1];
  const day = user.usage?.day;
  const week = user.usage?.week;
  const dayPct = day ? Math.min((day.used / day.cap) * 100, 100) : 0;
  const av = (prefs.callme || prefs.name || user.email).slice(0, 2).toUpperCase();
  return (
    <div className="settings-view">
      <div className="set-nav">
        <div className="h">Impostazioni</div>
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
              <div className="set-sec-h">Profilo</div>
              <div className="frow"><div className="flabel">Avatar</div><div className="avatar-lg">{av}</div></div>
              <div className="frow"><div className="flabel">Nome completo</div>
                <input className="finput" value={prefs.name || ''} placeholder="Il tuo nome" onChange={(e) => set({ name: e.target.value })} /></div>
              <div className="frow"><div className="flabel">Come vuoi che K AI ti chiami?</div>
                <input className="finput" value={prefs.callme || ''} placeholder="Come preferisci" onChange={(e) => set({ callme: e.target.value })} /></div>
              <div className="frow"><div className="flabel">Che lavoro fai?</div>
                <input className="finput" value={prefs.work || ''} placeholder="Es: admin di server Minecraft" onChange={(e) => set({ work: e.target.value })} /></div>
              <div className="fcol">
                <div className="flabel">Istruzioni per K AI</div>
                <div className="fhelp">K AI ne terra conto in ogni conversazione.</div>
                <textarea className="set-ta" value={prefs.instructions || ''} placeholder="Es: codice per Paper 1.21, commenti in italiano." onChange={(e) => set({ instructions: e.target.value })} />
              </div>

              <div className="set-sec-h" style={{ marginTop: 10 }}>Tema</div>
              <div className="fhelp" style={{ marginTop: -6 }}>Scegli l'aspetto dell'interfaccia.</div>
              <div className="theme-picker">
                {[
                  ['elegant', 'Elegante scuro', 'Raffinato e minimale', ['#12151c', '#5ad6c0', '#e6ad55']],
                  ['vivid', 'Moderno colorato', 'Accenti vivaci, chiaro', ['#f6f4ef', '#0d9488', '#7c5cff']],
                  ['terminal', 'Tech / Terminale', 'Mono, da sviluppatori', ['#0a0f0c', '#3ff0a0', '#1f9d63']],
                ].map(([id, name, desc, sw]) => (
                  <button key={id} className={`theme-card ${(prefs.flavor || 'elegant') === id ? 'on' : ''}`} onClick={() => set({ flavor: id })}>
                    <div className="tc-swatch">{sw.map((c, i) => <span key={i} style={{ background: c }} />)}</div>
                    <div className="tc-meta"><span className="tc-name">{name}</span><span className="tc-desc">{desc}</span></div>
                    <span className="tc-check">{(prefs.flavor || 'elegant') === id ? '✓' : ''}</span>
                  </button>
                ))}
              </div>
              <div className="frow"><div className="flabel">Carattere della chat</div>
                <select className="fselect" value={prefs.font || 'system'} onChange={(e) => set({ font: e.target.value })}>
                  <option value="system">Sistema</option>
                  <option value="mono">Monospace</option>
                </select>
              </div>
            </>)}

            {section === 'account' && (
              <div className="set-block">
                <div className="lead"><span className="lt">Account</span><span className="ld">Il tuo profilo K AI Code.</span></div>
                <div className="kv"><span className="k2">Email</span><span className="v2">{user.email}</span></div>
                <div className="kv"><span className="k2">Piano</span><span className="v2">{PLAN_NAMES[user.plan] || user.plan}</span></div>
                <div style={{ display: 'flex', gap: 8 }}><button className="btn-line" onClick={onLogout}>Esci</button></div>
              </div>
            )}

            {section === 'fatturazione' && (
              <div className="set-block">
                <div className="lead"><span className="lt">Fatturazione</span><span className="ld">Piano e pagamento.</span></div>
                <div className="kv"><span className="k2">Piano</span><span className="v2">{PLAN_NAMES[user.plan] || user.plan}</span></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-ink" onClick={onGoUsage}>Scegli / cambia piano</button>
                  <button className="btn-line" onClick={onGoUsage}>Vedi uso</button>
                </div>
              </div>
            )}

            {section === 'utilizzo' && (
              <div className="set-block">
                <div className="lead"><span className="lt">Utilizzo</span><span className="ld">Consumo a token del tuo piano.</span></div>
                {day && (<>
                  <div className="kv"><span className="k2">Finestra 4h</span><span className="v2">{fmtTokens(day.used)} / {fmtTokens(day.cap)} token</span></div>
                  <div className={`usage-bar ${dayPct > 80 ? 'warn' : ''}`} style={{ maxWidth: 360 }}><div style={{ width: `${dayPct}%` }} /></div>
                  <div className="kv"><span className="k2">Reset 4h</span><span className="v2">tra {fmtReset(day.resetAt)}</span></div>
                </>)}
                {week && (
                  <div className="kv"><span className="k2">Settimanale</span><span className="v2">{fmtTokens(week.used)} / {fmtTokens(week.cap)} · reset tra {fmtReset(week.resetAt)}</span></div>
                )}
                <div><button className="btn-line" onClick={onGoUsage}>Apri pagina Uso</button></div>
              </div>
            )}

            {section === 'privacy' && (<>
              <div className="set-block">
                <div className="lead"><span className="lt">Dati</span><span className="ld">Le conversazioni sono salvate per darti la cronologia.</span></div>
                <button className="btn-line" style={{ alignSelf: 'flex-start' }} onClick={onLogout}>Esci da questo dispositivo</button>
              </div>
              <div className="set-block">
                <div className="lead"><span className="lt">Elimina account</span><span className="ld">Rimuove account, conversazioni e messaggi. Irreversibile.</span></div>
                <button className="danger" onClick={onDeleteAccount}>Elimina account</button>
              </div>
            </>)}

            {section === 'funzionalita' && (<>
              <div className="set-block">
                <div className="lead"><span className="lt">Stile risposte</span><span className="ld">Come K AI struttura le risposte.</span></div>
                <div className="segment">
                  {['conciso', 'bilanciato', 'dettagliato'].map((v) => (
                    <button key={v} className={prefs.style === v ? 'on' : ''} onClick={() => set({ style: v })}>{v[0].toUpperCase() + v.slice(1)}</button>
                  ))}
                </div>
              </div>
              <div className="set-block">
                <div className="lead"><span className="lt">Lingua</span><span className="ld">In quale lingua rispondere.</span></div>
                <div className="segment">
                  <button className={prefs.lang === 'it' ? 'on' : ''} onClick={() => set({ lang: 'it' })}>Italiano</button>
                  <button className={prefs.lang === 'en' ? 'on' : ''} onClick={() => set({ lang: 'en' })}>English</button>
                  <button className={prefs.lang === 'auto' ? 'on' : ''} onClick={() => set({ lang: 'auto' })}>Auto</button>
                </div>
              </div>
            </>)}

          </div>
        </div>
      </div>
    </div>
  );
}

function Chat({ token, onLogout }) {
  const [user, setUser] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [images, setImages] = useState([]);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('chat');
  const [prefs, setPrefsState] = useState(() => {
    const def = { style: 'bilanciato', lang: 'it', instructions: '', name: '', callme: '', work: '', flavor: 'elegant', font: 'system' };
    try { return { ...def, ...JSON.parse(localStorage.getItem('kai_prefs') || '{}') }; }
    catch { return def; }
  });
  const setPrefs = (p) => { setPrefsState(p); localStorage.setItem('kai_prefs', JSON.stringify(p)); };
  useEffect(() => {
    const flavor = prefs.flavor || 'elegant';
    const root = document.documentElement;
    root.classList.remove('theme-elegant', 'theme-vivid', 'theme-terminal', 'dark');
    root.classList.add('theme-' + flavor);
    if (flavor === 'elegant' || flavor === 'terminal') root.classList.add('dark');
    root.classList.toggle('font-mono', prefs.font === 'mono' || flavor === 'terminal');
  }, [prefs.flavor, prefs.font]);
  const endRef = useRef(null);
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/user/profile`, { headers: H }).then((r) => (r.ok ? r.json() : Promise.reject())).then(setUser).catch(onLogout);
    initSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
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

  // All'avvio: apri la conversazione piu recente con messaggi, altrimenti creane una
  const initSessions = async () => {
    const list = await loadSessions();
    const withMsgs = list.find((s) => !s.empty);
    if (withMsgs) { await openSession(withMsgs.id); }
    else if (list.length) { setSessionId(list[0].id); setMessages([]); }
    else { await newChat(); }
  };

  const openSession = async (id) => {
    setSessionId(id); setView('chat');
    try {
      const r = await fetch(`${API}/chat/${id}/messages`, { headers: H });
      const msgs = r.ok ? await r.json() : [];
      setMessages(msgs);
    } catch { setMessages([]); }
  };

  const newChat = async () => {
    // riusa una chat vuota gia esistente invece di accumularne tante
    const empty = sessions.find((s) => s.empty);
    if (empty) { setSessionId(empty.id); setMessages([]); setView('chat'); return; }
    const res = await fetch(`${API}/chat/new`, { method: 'POST', headers: H, body: JSON.stringify({ title: 'Nuova conversazione' }) });
    const data = await res.json();
    setSessionId(data.sessionId); setMessages([]); setView('chat');
    loadSessions();
  };

  const deleteSession = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Eliminare questa conversazione?')) return;
    try { await fetch(`${API}/chat/${id}`, { method: 'DELETE', headers: H }); } catch { /* ignore */ }
    const list = await loadSessions();
    if (id === sessionId) {
      const next = list.find((s) => !s.empty) || list[0];
      if (next) openSession(next.id); else newChat();
    }
  };

  const onFiles = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => setImages((prev) => [...prev, { name: file.name, dataUrl: reader.result }].slice(0, 6));
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const send = async (preset) => {
    const text = (preset ?? input).trim();
    const imgs = preset ? [] : images;
    if ((!text && imgs.length === 0) || !sessionId || busy) return;
    const imgUrls = imgs.map((i) => i.dataUrl);
    setInput(''); setImages([]); setBusy(true);
    setMessages((m) => [...m, { role: 'user', content: text, images: imgUrls }, { role: 'assistant', content: '' }]);
    try {
      const res = await fetch(`${API}/chat/message`, { method: 'POST', headers: H, body: JSON.stringify({ sessionId, message: text, prefs, images: imgUrls }) });
      if (res.status === 429) {
        const d = await res.json();
        setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: d.error }; return c; });
        setBusy(false); return;
      }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n'); buf = parts.pop();
        for (const p of parts) {
          const line = p.replace(/^data: /, '').trim(); if (!line) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === 'text') setMessages((m) => { const c = [...m]; c[c.length - 1].content += evt.content; return [...c]; });
            else if (evt.type === 'error') setMessages((m) => { const c = [...m]; c[c.length - 1].content += '\n\n' + evt.error; return [...c]; });
            else if (evt.type === 'done') { if (evt.usage) setUser((u) => (u ? { ...u, usage: evt.usage } : u)); }
          } catch { /* partial */ }
        }
      }
    } catch { setMessages((m) => { const c = [...m]; c[c.length - 1].content = 'Connessione fallita.'; return c; }); }
    setBusy(false);
    loadSessions();
  };

  const upgrade = async (plan) => {
    try {
      const res = await fetch(`${API}/billing/create-checkout`, { method: 'POST', headers: H, body: JSON.stringify({ plan }) });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      alert('Errore Stripe (' + res.status + '): ' + (data.error || 'sconosciuto'));
    } catch (e) {
      alert('Errore di connessione: ' + e.message);
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm('Eliminare l account? Questa azione e irreversibile.')) return;
    try { await fetch(`${API}/account`, { method: 'DELETE', headers: H }); } catch { /* ignore */ }
    onLogout();
  };

  const day = user?.usage?.day;
  const dayPct = day ? Math.min((day.used / day.cap) * 100, 100) : 0;
  const dayLeft = day ? Math.max(day.cap - day.used, 0) : 0;
  const atCap = day ? day.used >= day.cap : false;
  const initials = user ? user.email.slice(0, 2).toUpperCase() : 'K';
  const planLabel = user ? (PLAN_NAMES[user.plan] || user.plan) : '';
  const convTitle = messages.find((m) => m.role === 'user')?.content?.slice(0, 46) || 'Nuova conversazione';
  const accent = FLAVOR_ACCENT[prefs.flavor] || FLAVOR_ACCENT.elegant;

  return (
    <div className="app">
      <div className="shell">
        <div className="rail">
          <div className="mono-k">K</div>
          <div className="nav">
            {['chat', 'usage'].map((v) => (
              <button key={v} className={`ico ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
                {view === v && (
                  <motion.span layoutId="rail-indicator" className="ico-indicator" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
                )}
                {v === 'chat' ? I.chat : I.chart}
              </button>
            ))}
          </div>
          <div className="foot">
            <button className={`ico ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>{I.gear}</button>
            <div className="avatar">{initials}</div>
          </div>
        </div>

        <div className="side">
          <div className="side-head">
            <span className="wordmark">K AI</span>
            <span className="tag">{planLabel}</span>
          </div>
          <div className="side-actions">
            <button className="new-btn" onClick={newChat}>{I.plus} Nuova conversazione</button>
            <div className="search">{I.search}<span>Cerca</span><span className="kbd">Ctrl K</span></div>
          </div>
          <div className="side-sec">Conversazioni</div>
          <div className="conv-list">
            {sessions.filter((s) => !s.empty).length === 0 && (
              <div className="conv-empty">Nessuna conversazione salvata.</div>
            )}
            <AnimatePresence initial={false}>
              {sessions.filter((s) => !s.empty).map((s) => (
                <motion.div key={s.id} layout
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className={`conv-item ${s.id === sessionId ? 'active' : ''}`} onClick={() => openSession(s.id)}>
                  <span className="ci-title">{s.title}</span>
                  <button className="ci-del" onClick={(e) => deleteSession(s.id, e)} title="Elimina" aria-label="Elimina">×</button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="side-foot">
            {user && day && (<>
              <div className="usage-row"><span>Token · finestra 4h</span><b>{fmtTokens(day.used)}/{fmtTokens(day.cap)}</b></div>
              <div className={`usage-bar ${dayPct > 80 ? 'warn' : ''}`}><div style={{ width: `${dayPct}%` }} /></div>
              <div className="usage-reset">reset tra {fmtReset(day.resetAt)}</div>
              {atCap && <button className="upg" onClick={() => setView('usage')}>Fai upgrade</button>}
            </>)}
            <button className="logout" onClick={onLogout}>Esci</button>
          </div>
        </div>

        <div className="main">
          <div className="top">
            <span className="conv">{convTitle}</span>
            <span className="model"><span className="dot" /> K AI {I.chevron}</span>
          </div>

          <div className="stream">
            {messages.length === 0 ? (
              <div className="welcome-stage">
                <div className="welcome-bg" aria-hidden="true">
                  <VoxelTopographyGrid primaryColor={accent.primary} wireColor={accent.wire} speed={0.01} tileSize={42} maxHeight={50} />
                </div>
                <motion.div className="welcome" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
                  <div className="k">K</div>
                  <h2>Cosa costruiamo oggi?</h2>
                  <p>Plugin, mod, script o debugging in qualsiasi linguaggio. Il codice e monocromatico, la sintassi si legge dal peso.</p>
                  <motion.div className="chips" initial="hidden" animate="show"
                    variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } }}>
                    {EXAMPLES.map((ex) => (
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
                        {m.images.map((src, j) => <img key={j} src={src} alt="allegato" />)}
                      </div>
                    )}
                    {m.content && <div className="u-bubble">{m.content}</div>}
                  </motion.div>
                ) : (
                  <motion.div className="turn-ai" key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}>
                    <div className="ai-head"><span className="k">K</span><span className="meta">K AI</span></div>
                    <Content text={m.content} streaming={busy && i === messages.length - 1} />
                    {m.content && (
                      <div className="ai-actions">
                        <button className="act-chip" onClick={() => navigator.clipboard?.writeText(m.content)}>Copia</button>
                        {(() => {
                          const files = extractCodeFiles(m.content);
                          return files.length > 0 ? (
                            <button className="act-chip zip" onClick={() => downloadZip(files)}>{I.zip} Scarica ZIP · {files.length} file</button>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </motion.div>
                )
              ))}
              <div ref={endRef} />
            </div>
            )}
          </div>

          <div className="composer">
            <div className="composer-inner">
              <div className="box">
                {images.length > 0 && (
                  <div className="composer-thumbs">
                    {images.map((im, idx) => (
                      <div className="thumb" key={idx}>
                        <img src={im.dataUrl} alt={im.name} />
                        <button className="thumb-del" onClick={() => setImages(images.filter((_, j) => j !== idx))} aria-label="Rimuovi">×</button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea placeholder="Scrivi a K AI..." value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
                <div className="box-row">
                  <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
                  <button className="tool" onClick={() => fileRef.current?.click()} title="Allega immagini">{I.image}</button>
                  <span className="tool-chip">Web</span>
                  <span className="tool-chip">Tools</span>
                  <button className="send" onClick={() => send()} disabled={busy || (!input.trim() && images.length === 0)}>Invia {I.send}</button>
                </div>
              </div>
              <div className="composer-meta">
                <span>Invio per inviare - Shift+Invio a capo</span>
                <span>K AI · {fmtTokens(dayLeft)} token nella finestra</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {(view === 'usage' || view === 'settings') && (
          <motion.div className="modal-backdrop" onClick={() => setView('chat')}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <motion.div className="modal-window" onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
              <button className="modal-close" onClick={() => setView('chat')} aria-label="Chiudi">×</button>
              {view === 'usage'
                ? <UsageView user={user} onUpgrade={upgrade} />
                : <SettingsView user={user} prefs={prefs} onChange={setPrefs} onGoUsage={() => setView('usage')} onUpgrade={upgrade} onDeleteAccount={deleteAccount} onLogout={onLogout} />}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const logout = () => { localStorage.removeItem('token'); setToken(null); };
  return (
    <MotionConfig reducedMotion="user">
      {token ? <Chat token={token} onLogout={logout} /> : <Auth onAuth={setToken} />}
    </MotionConfig>
  );
}
