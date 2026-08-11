import { useEffect, useRef, useState, Fragment } from 'react';

const API = import.meta.env.VITE_API_URL || 'https://k-ai-code.onrender.com';

const EXAMPLES = [
  'Porta questo plugin da Spigot a Paper 1.21',
  'Mod Fabric: aggiungi un minerale custom',
  'Perche ottengo NullPointerException qui?',
  'Script Python per backup automatici del server',
];

const PLANS = [
  { id: 'starter', name: 'Starter', price: '14,99 EUR', limit: 60, desc: '60 richieste al mese. Per iniziare.' },
  { id: 'pro', name: 'Pro', price: '39,99 EUR', limit: 300, desc: '300 richieste al mese. Per team piccoli.' },
  { id: 'enterprise', name: 'Enterprise', price: '149,99 EUR', limit: 1200, desc: '1.200 richieste/mese (fair use). Per network.' },
];

const I = {
  chat: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  code: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/></svg>,
  files: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>,
  chart: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>,
  gear: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>,
  plus: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14"/></svg>,
  search: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9a9ea6" strokeWidth="2.2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.3-4.3"/></svg>,
  send: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4"><path d="M5 12h13M12 5l7 7-7 7"/></svg>,
  chevron: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8f939a" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>,
  monitor: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
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
      <div className="auth-card">
        <div className="auth-top">
          <span className="wordmark">K AI</span>
          <span className="tag">Code / Fable 5</span>
        </div>

        {step === 'form' ? (<>
          <p className="auth-lead">Assistente di programmazione per sviluppatori Minecraft. Plugin, mod e codice in ogni linguaggio.</p>
          <label className="field">
            <span className="lbl">Email</span>
            <input type="email" placeholder="dev@server.net" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span className="lbl">Password</span>
            <input type="password" placeholder="La tua password" value={password}
              onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && start()} />
          </label>
          {err && <p className="err">{err}</p>}
          <button className="btn" style={{ marginTop: 6 }} onClick={start} disabled={loading || !email || !password}>
            {loading ? '...' : mode === 'login' ? 'Accedi' : 'Crea account'}
          </button>
          <div><button className="link" onClick={switchMode}>
            {mode === 'login' ? 'Non hai un account? Registrati' : 'Hai gia un account? Accedi'}
          </button></div>
        </>) : (<>
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
        </>)}
      </div>
    </div>
  );
}

function UsageView({ user, onUpgrade }) {
  if (!user) return <div className="usage-view" />;
  const pct = Math.min((user.queries_used / user.queries_limit) * 100, 100);
  const left = Math.max(user.queries_limit - user.queries_used, 0);
  const cur = PLANS.find((p) => p.id === user.plan) || PLANS[0];
  const next = user.plan === 'starter' ? 'pro' : 'enterprise';
  return (
    <div className="usage-view">
      <div className="u-top">
        <span className="t">Uso</span>
        <span className="sub">Piano {user.plan}</span>
        <span className="right"><span className="pill">Questo mese</span></span>
      </div>
      <div className="u-body">
        <div className="stat-grid">
          <div className="stat">
            <span className="lbl">Richieste usate</span>
            <span className="num">{user.queries_used}</span>
            <span className="cap">di {user.queries_limit}</span>
            <div className={`mini ${pct > 80 ? 'warn' : ''}`}><div style={{ width: `${pct}%` }} /></div>
          </div>
          <div className="stat">
            <span className="lbl">Rimaste</span>
            <span className="num">{left}</span>
            <span className="cap">nel ciclo corrente</span>
          </div>
          <div className="stat">
            <span className="lbl">Limite piano</span>
            <span className="num">{user.queries_limit}</span>
            <span className="cap">richieste / mese</span>
          </div>
          <div className="stat">
            <span className="lbl">Piano</span>
            <span className="num" style={{ fontSize: 26 }}>{cur.name}</span>
            <span className="cap">{cur.price} / mese</span>
          </div>
        </div>

        <div className="plan-row">
          <div className="plans">
            <div className="h">Piani</div>
            {PLANS.map((p) => (
              <div className={`plan-line ${p.id === user.plan ? 'cur' : ''}`} key={p.id}>
                <span className="pn">{p.name}</span>
                <span className="pd">{p.desc}</span>
                {p.id === user.plan && <span className="badge-cur">Attivo</span>}
                <span className="pp">{p.price}</span>
              </div>
            ))}
          </div>
          <div className="plan-card">
            <div className="name">{cur.name}</div>
            <div className="desc">{cur.desc}</div>
            <div className="price"><b>{cur.price}</b><span>/ mese</span></div>
            <div className="acts">
              {user.plan !== 'enterprise' && <button className="primary" onClick={() => onUpgrade(next)}>Fai upgrade</button>}
              <button className="ghost" onClick={() => onUpgrade(next)}>Cambia piano</button>
            </div>
          </div>
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
  const pct = Math.min((user.queries_used / user.queries_limit) * 100, 100);
  const left = Math.max(user.queries_limit - user.queries_used, 0);
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

              <div className="set-sec-h" style={{ marginTop: 10 }}>Preferenze</div>
              <div className="frow"><div className="flabel">Aspetto</div>
                <div className="seg-icons">
                  <button className={(prefs.theme || 'system') === 'system' ? 'on' : ''} onClick={() => set({ theme: 'system' })} title="Sistema">{I.monitor}</button>
                  <button className={prefs.theme === 'light' ? 'on' : ''} onClick={() => set({ theme: 'light' })} title="Chiaro">{I.sun}</button>
                  <button className={prefs.theme === 'dark' ? 'on' : ''} onClick={() => set({ theme: 'dark' })} title="Scuro">{I.moon}</button>
                </div>
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
                <div className="kv"><span className="k2">Piano</span><span className="v2">{user.plan}</span></div>
                <div style={{ display: 'flex', gap: 8 }}><button className="btn-line" onClick={onLogout}>Esci</button></div>
              </div>
            )}

            {section === 'fatturazione' && (
              <div className="set-block">
                <div className="lead"><span className="lt">Fatturazione</span><span className="ld">Piano e pagamento.</span></div>
                <div className="kv"><span className="k2">Piano</span><span className="v2">{user.plan}</span></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {user.plan !== 'enterprise' && <button className="btn-ink" onClick={() => onUpgrade(user.plan === 'starter' ? 'pro' : 'enterprise')}>Fai upgrade</button>}
                  <button className="btn-line" onClick={onGoUsage}>Vedi uso</button>
                </div>
              </div>
            )}

            {section === 'utilizzo' && (
              <div className="set-block">
                <div className="lead"><span className="lt">Utilizzo</span><span className="ld">Consumo del ciclo corrente.</span></div>
                <div className="kv"><span className="k2">Usate</span><span className="v2">{user.queries_used} / {user.queries_limit}</span></div>
                <div className="kv"><span className="k2">Rimaste</span><span className="v2">{left}</span></div>
                <div className={`usage-bar ${pct > 80 ? 'warn' : ''}`} style={{ maxWidth: 360 }}><div style={{ width: `${pct}%` }} /></div>
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
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('chat');
  const [prefs, setPrefsState] = useState(() => {
    const def = { style: 'bilanciato', lang: 'it', instructions: '', name: '', callme: '', work: '', theme: 'system', font: 'system' };
    try { return { ...def, ...JSON.parse(localStorage.getItem('kai_prefs') || '{}') }; }
    catch { return def; }
  });
  const setPrefs = (p) => { setPrefsState(p); localStorage.setItem('kai_prefs', JSON.stringify(p)); };
  useEffect(() => {
    const t = prefs.theme || 'system';
    const dark = t === 'dark' || (t === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('font-mono', prefs.font === 'mono');
  }, [prefs.theme, prefs.font]);
  const endRef = useRef(null);
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/user/profile`, { headers: H }).then((r) => (r.ok ? r.json() : Promise.reject())).then(setUser).catch(onLogout);
    newChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const newChat = async () => {
    const res = await fetch(`${API}/chat/new`, { method: 'POST', headers: H, body: JSON.stringify({ title: 'Nuova conversazione' }) });
    const data = await res.json();
    setSessionId(data.sessionId); setMessages([]); setView('chat');
  };

  const send = async (preset) => {
    const text = (preset ?? input).trim();
    if (!text || !sessionId || busy) return;
    setInput(''); setBusy(true);
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    try {
      const res = await fetch(`${API}/chat/message`, { method: 'POST', headers: H, body: JSON.stringify({ sessionId, message: text, prefs }) });
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
            else if (evt.type === 'done') setUser((u) => (u ? { ...u, queries_used: u.queries_used + 1 } : u));
          } catch { /* partial */ }
        }
      }
    } catch { setMessages((m) => { const c = [...m]; c[c.length - 1].content = 'Connessione fallita.'; return c; }); }
    setBusy(false);
  };

  const upgrade = async (plan) => {
    const res = await fetch(`${API}/billing/create-checkout`, { method: 'POST', headers: H, body: JSON.stringify({ plan }) });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else alert('I pagamenti non sono ancora configurati (Stripe).');
  };

  const deleteAccount = async () => {
    if (!window.confirm('Eliminare l account? Questa azione e irreversibile.')) return;
    try { await fetch(`${API}/account`, { method: 'DELETE', headers: H }); } catch { /* ignore */ }
    onLogout();
  };

  const pct = user ? Math.min((user.queries_used / user.queries_limit) * 100, 100) : 0;
  const left = user ? Math.max(user.queries_limit - user.queries_used, 0) : 0;
  const initials = user ? user.email.slice(0, 2).toUpperCase() : 'K';
  const convTitle = messages.find((m) => m.role === 'user')?.content?.slice(0, 46) || 'Nuova conversazione';

  return (
    <div className="app">
      <div className="shell">
        <div className="rail">
          <div className="mono-k">K</div>
          <div className="nav">
            <button className={`ico ${view === 'chat' ? 'active' : ''}`} onClick={() => setView('chat')}>{I.chat}</button>
            <button className={`ico ${view === 'usage' ? 'active' : ''}`} onClick={() => setView('usage')}>{I.chart}</button>
          </div>
          <div className="foot">
            <button className={`ico ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>{I.gear}</button>
            <div className="avatar">{initials}</div>
          </div>
        </div>

        <div className="side">
          <div className="side-head">
            <span className="wordmark">K AI</span>
            <span className="tag">{user ? user.plan : ''}</span>
          </div>
          <div className="side-actions">
            <button className="new-btn" onClick={newChat}>{I.plus} Nuova conversazione</button>
            <div className="search">{I.search}<span>Cerca</span><span className="kbd">Ctrl K</span></div>
          </div>
          <div className="side-sec">Linguaggi</div>
          <div className="langs">
            <span className="lang">Java</span><span className="lang">Kotlin</span><span className="lang">Python</span>
            <span className="lang">TypeScript</span><span className="lang">SQL</span><span className="lang dim">+ molti</span>
          </div>
          <div className="side-foot">
            {user && (<>
              <div className="usage-row"><span>Uso ({user.plan})</span><b>{user.queries_used}/{user.queries_limit}</b></div>
              <div className={`usage-bar ${pct > 80 ? 'warn' : ''}`}><div style={{ width: `${pct}%` }} /></div>
              {user.queries_used >= user.queries_limit &&
                <button className="upg" onClick={() => upgrade(user.plan === 'starter' ? 'pro' : 'enterprise')}>Fai upgrade</button>}
            </>)}
            <button className="logout" onClick={onLogout}>Esci</button>
          </div>
        </div>

        <div className="main">
          <div className="top">
            <span className="conv">{convTitle}</span>
            <span className="model"><span className="dot" /> Fable 5 {I.chevron}</span>
          </div>

          <div className="stream">
            <div className="stream-inner">
              {messages.length === 0 ? (
                <div className="welcome">
                  <div className="k">K</div>
                  <h2>Cosa costruiamo oggi?</h2>
                  <p>Plugin, mod, script o debugging in qualsiasi linguaggio. Il codice e monocromatico, la sintassi si legge dal peso.</p>
                  <div className="chips">
                    {EXAMPLES.map((ex) => <button key={ex} className="chip-ex" onClick={() => send(ex)}>{ex}</button>)}
                  </div>
                </div>
              ) : messages.map((m, i) => (
                m.role === 'user' ? (
                  <div className="turn-user" key={i}><div className="u-bubble">{m.content}</div></div>
                ) : (
                  <div className="turn-ai" key={i}>
                    <div className="ai-head"><span className="k">K</span><span className="meta">Fable 5</span></div>
                    <Content text={m.content} streaming={busy && i === messages.length - 1} />
                    {m.content && (
                      <div className="ai-actions">
                        <button className="act-chip" onClick={() => navigator.clipboard?.writeText(m.content)}>Copia</button>
                      </div>
                    )}
                  </div>
                )
              ))}
              <div ref={endRef} />
            </div>
          </div>

          <div className="composer">
            <div className="composer-inner">
              <div className="box">
                <textarea placeholder="Scrivi a K AI..." value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
                <div className="box-row">
                  <button className="tool">{I.plus}</button>
                  <span className="tool-chip">Web</span>
                  <span className="tool-chip">Tools</span>
                  <button className="send" onClick={() => send()} disabled={busy || !input.trim()}>Invia {I.send}</button>
                </div>
              </div>
              <div className="composer-meta">
                <span>Invio per inviare - Shift+Invio a capo</span>
                <span>Fable 5 - {left} richieste rimaste</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {(view === 'usage' || view === 'settings') && (
        <div className="modal-backdrop" onClick={() => setView('chat')}>
          <div className="modal-window" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setView('chat')} aria-label="Chiudi">×</button>
            {view === 'usage'
              ? <UsageView user={user} onUpgrade={upgrade} />
              : <SettingsView user={user} prefs={prefs} onChange={setPrefs} onGoUsage={() => setView('usage')} onUpgrade={upgrade} onDeleteAccount={deleteAccount} onLogout={onLogout} />}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const logout = () => { localStorage.removeItem('token'); setToken(null); };
  return token ? <Chat token={token} onLogout={logout} /> : <Auth onAuth={setToken} />;
}
