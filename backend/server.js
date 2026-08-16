import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import Stripe from 'stripe';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const app = express();

// Stripe webhook needs the raw body, so mount it BEFORE express.json()
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Billing not configured' });
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
    const sub = event.data.object;
    const priceId = sub.items?.data?.[0]?.price?.id;
    const planMap = {
      [process.env.STRIPE_PRICE_STARTER]: 'starter',
      [process.env.STRIPE_PRICE_PRO]: 'pro',
      [process.env.STRIPE_PRICE_ENTERPRISE]: 'enterprise',
      [process.env.STRIPE_PRICE_TEAM_LOW]: 'team_low',
      [process.env.STRIPE_PRICE_TEAM_MEDIUM]: 'team_medium',
      [process.env.STRIPE_PRICE_TEAM_MAX]: 'team_max',
    };
    const plan = planMap[priceId] || 'starter';
    const now = Date.now();
    db.prepare('UPDATE users SET plan = ?, tokens_4h_used = 0, window_4h_start = ?, tokens_week_used = 0, week_start = ? WHERE stripe_customer_id = ?')
      .run(plan, now, now, sub.customer);
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    db.prepare('UPDATE users SET plan = ? WHERE stripe_customer_id = ?')
      .run('free', sub.customer);
  }

  res.json({ received: true });
});

app.use(express.json({ limit: '25mb' }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || 'claude-fable-5';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const SYSTEM_PROMPT = `You are K AI Code, an expert coding assistant for Minecraft server developers and general programming.
You write clean, correct, well-documented code in any language. You are especially strong with:
- Paper/Spigot/Bukkit plugins (Java), Fabric/Forge mods (Java/Kotlin)
- Maven/Gradle build configuration
- General software in Python, JavaScript/TypeScript, Rust, Go, C#, and more
Prefer complete, working code over fragments. Explain briefly, then give the code. When the user shows an error, diagnose the root cause before proposing a fix.
When you output code that belongs in files, begin each code block's info string with the language followed by the file path, e.g. \`\`\`java src/main/java/com/example/Main.java so the files can be exported. If the user sends images, analyze them carefully.`;

// Prompt caching: without this, every message resends the ENTIRE conversation
// history to the API at full price, so a long chat gets quadratically expensive
// as it grows. Marking the last stable turn as a cache breakpoint means each
// new message only pays full price for what's new since the last turn - the
// rest is served from cache at a fraction of the cost (and doesn't count fully
// against the user's token quota either, since we bill input+output tokens and
// cached reads report separately).
function cacheBreakpoint(text) {
  return [{ type: 'text', text: String(text), cache_control: { type: 'ephemeral' } }];
}
function withHistoryCache(history) {
  if (history.length < 2) return history;
  const cutIdx = history.length - 2; // last turn that's now fixed and won't change again
  return history.map((m, i) => (i === cutIdx && typeof m.content === 'string')
    ? { role: m.role, content: cacheBreakpoint(m.content) }
    : m);
}

function buildSystem(prefs) {
  let s = SYSTEM_PROMPT;
  if (prefs) {
    const bits = [];
    if (prefs.name) bits.push('L utente si chiama ' + String(prefs.name).slice(0, 80) + '.');
    if (prefs.callme) bits.push('Chiamalo "' + String(prefs.callme).slice(0, 40) + '".');
    if (prefs.work) bits.push('Contesto lavorativo: ' + String(prefs.work).slice(0, 120) + '.');
    if (bits.length) s += '\n' + bits.join(' ');
    if (prefs.style === 'conciso') s += '\nSii conciso: vai dritto al codice, spiegazioni minime.';
    if (prefs.style === 'dettagliato') s += '\nSii dettagliato: spiega le scelte e le alternative.';
    if (prefs.lang === 'it') s += '\nRispondi sempre in italiano.';
    if (prefs.lang === 'en') s += '\nAlways respond in English.';
    if (prefs.instructions) s += '\nIstruzioni permanenti dell utente: ' + String(prefs.instructions).slice(0, 800);
  }
  return s;
}

// ---------- Database ----------
const db = new Database(process.env.DB_PATH || 'app.db');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    plan TEXT DEFAULT 'free',
    queries_used INTEGER DEFAULT 0,
    queries_limit INTEGER DEFAULT 10,
    stripe_customer_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS email_codes (
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    purpose TEXT NOT NULL,
    password_hash TEXT,
    expires_at INTEGER NOT NULL
  );
`);

// ---------- Sistema a TOKEN con finestre (4h + settimanale) ----------
const WINDOW_4H = 4 * 60 * 60 * 1000;
const WINDOW_WEEK = 7 * 24 * 60 * 60 * 1000;

// cap4h: token per finestra di 4 ore (si resetta ogni 4h)
// week: tetto settimanale (solo free & starter), null = nessun tetto settimanale
const PLAN_LIMITS = {
  free:        { cap4h: 15000,   week: 50000 },
  starter:     { cap4h: 40000,   week: 200000 },
  pro:         { cap4h: 120000,  week: null },
  enterprise:  { cap4h: 280000,  week: null },
  team_low:    { cap4h: 420000,  week: null },
  team_medium: { cap4h: 600000,  week: null },
  team_max:    { cap4h: 850000,  week: null },
};
function planCfg(plan) { return PLAN_LIMITS[plan] || PLAN_LIMITS.free; }

// migrazione: aggiunge le colonne token se mancano
function ensureColumn(table, col, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.find((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}
ensureColumn('users', 'tokens_4h_used', 'INTEGER DEFAULT 0');
ensureColumn('users', 'window_4h_start', 'INTEGER DEFAULT 0');
ensureColumn('users', 'tokens_week_used', 'INTEGER DEFAULT 0');
ensureColumn('users', 'week_start', 'INTEGER DEFAULT 0');

// resetta le finestre scadute e restituisce i contatori aggiornati
function refreshWindows(user) {
  const now = Date.now();
  let w4 = user.window_4h_start || 0;
  let t4 = user.tokens_4h_used || 0;
  let wk = user.week_start || 0;
  let tw = user.tokens_week_used || 0;
  let changed = false;
  if (now - w4 >= WINDOW_4H) { w4 = now; t4 = 0; changed = true; }
  if (now - wk >= WINDOW_WEEK) { wk = now; tw = 0; changed = true; }
  if (changed) {
    db.prepare('UPDATE users SET window_4h_start=?, tokens_4h_used=?, week_start=?, tokens_week_used=? WHERE id=?')
      .run(w4, t4, wk, tw, user.id);
  }
  return { w4, t4, wk, tw };
}

// stato di utilizzo normalizzato per il client
function usageFor(user) {
  const w = refreshWindows(user);
  const cfg = planCfg(user.plan);
  return {
    plan: user.plan,
    day: { used: w.t4, cap: cfg.cap4h, resetAt: w.w4 + WINDOW_4H },
    week: cfg.week != null ? { used: w.tw, cap: cfg.week, resetAt: w.wk + WINDOW_WEEK } : null,
  };
}

// verifica se l'utente può fare una richiesta
function checkQuota(user) {
  const u = usageFor(user);
  if (u.day.used >= u.day.cap) return { ok: false, kind: 'day', resetAt: u.day.resetAt };
  if (u.week && u.week.used >= u.week.cap) return { ok: false, kind: 'week', resetAt: u.week.resetAt };
  return { ok: true };
}

function quotaMsg(q) {
  if (q.kind === 'week') return 'Hai esaurito i token settimanali del tuo piano. Passa a un piano superiore o attendi il reset settimanale.';
  return 'Hai esaurito i token della finestra di 4 ore. Attendi il reset o passa a un piano superiore.';
}

// accredita i token consumati (4h sempre, settimanale solo se il piano ha il tetto)
function addTokens(userId, plan, n) {
  const cfg = planCfg(plan);
  const amount = Math.max(0, Math.round(n || 0));
  if (cfg.week != null) {
    db.prepare('UPDATE users SET tokens_4h_used = tokens_4h_used + ?, tokens_week_used = tokens_week_used + ? WHERE id=?').run(amount, amount, userId);
  } else {
    db.prepare('UPDATE users SET tokens_4h_used = tokens_4h_used + ? WHERE id=?').run(amount, userId);
  }
}

// ---------- Email (Resend) ----------
function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

function codeHtml(code, action) {
  return `<div style="font-family:sans-serif;max-width:440px;margin:0 auto;padding:24px;color:#16181c">
    <h2 style="font-weight:600">K AI Code</h2>
    <p>Il tuo codice per ${action}:</p>
    <p style="font-size:30px;font-weight:700;letter-spacing:6px;margin:18px 0">${code}</p>
    <p style="color:#6f747c;font-size:13px">Scade tra 10 minuti. Se non hai richiesto tu questo codice, ignora questa email.</p>
  </div>`;
}

async function sendEmail(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log(`\n[DEV EMAIL] a ${to} | ${subject}\n${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}\n`); return true; }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || 'K AI Code <noreply@k-ai-support.it>', to, subject, html }),
    });
    if (!r.ok) console.error('Resend error:', r.status, await r.text());
    return r.ok;
  } catch (e) { console.error('Resend fetch error:', e.message); return false; }
}

// ---------- Auth middleware ----------
function auth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.split(' ')[1];
  if (!token) return res.sendStatus(401);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.sendStatus(403);
  }
}

// ---------- Health ----------
app.get('/', (_req, res) => res.json({ ok: true, service: 'k-ai-code', model: MODEL }));

// ---------- Auth routes ----------
app.post('/auth/signup', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'User already exists' });
  const id = randomUUID();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, email, password_hash, plan, queries_limit) VALUES (?, ?, ?, ?, ?)').run(id, email, hash, 'free', 10);
  const token = jwt.sign({ id, email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token });
});

const loginHandler = (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.email.split('@')[0],
      plan: user.plan,
      queriesUsed: user.queries_used,
      queriesLimit: user.queries_limit,
    },
  });
};

app.post('/auth/login', loginHandler);
app.post('/api/auth/login', loginHandler);

// ---------- Auth con verifica email (2 passi) ----------
// Registrazione: passo 1 - invia codice
app.post('/auth/register/start', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email e password richiesti' });
  if (password.length < 6) return res.status(400).json({ error: 'Password troppo corta (min 6)' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email gia registrata' });
  const code = genCode();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('DELETE FROM email_codes WHERE email = ? AND purpose = ?').run(email, 'register');
  db.prepare('INSERT INTO email_codes (email, code, purpose, password_hash, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(email, code, 'register', hash, Date.now() + 10 * 60 * 1000);
  await sendEmail(email, 'Il tuo codice di verifica - K AI Code', codeHtml(code, 'verificare la registrazione'));
  res.json({ pending: true });
});

// Registrazione: passo 2 - verifica codice e crea account
app.post('/auth/register/verify', (req, res) => {
  const { email, code } = req.body || {};
  const row = db.prepare('SELECT * FROM email_codes WHERE email = ? AND purpose = ? ORDER BY expires_at DESC').get(email, 'register');
  if (!row || row.code !== String(code || '').trim()) return res.status(400).json({ error: 'Codice errato' });
  if (Date.now() > row.expires_at) return res.status(400).json({ error: 'Codice scaduto' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email gia registrata' });
  const id = randomUUID();
  db.prepare('INSERT INTO users (id, email, password_hash, plan, queries_limit) VALUES (?, ?, ?, ?, ?)').run(id, email, row.password_hash, 'free', 10);
  db.prepare('DELETE FROM email_codes WHERE email = ? AND purpose = ?').run(email, 'register');
  const token = jwt.sign({ id, email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token });
});

// Login: passo 1 - verifica password e invia codice
app.post('/auth/login/start', async (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenziali non valide' });
  }
  const code = genCode();
  db.prepare('DELETE FROM email_codes WHERE email = ? AND purpose = ?').run(email, 'login');
  db.prepare('INSERT INTO email_codes (email, code, purpose, expires_at) VALUES (?, ?, ?, ?)')
    .run(email, code, 'login', Date.now() + 10 * 60 * 1000);
  await sendEmail(email, 'Il tuo codice di accesso - K AI Code', codeHtml(code, 'accedere'));
  res.json({ mfa: true });
});

// Login: passo 2 - verifica codice
app.post('/auth/login/verify', (req, res) => {
  const { email, code } = req.body || {};
  const row = db.prepare('SELECT * FROM email_codes WHERE email = ? AND purpose = ? ORDER BY expires_at DESC').get(email, 'login');
  if (!row || row.code !== String(code || '').trim()) return res.status(400).json({ error: 'Codice errato' });
  if (Date.now() > row.expires_at) return res.status(400).json({ error: 'Codice scaduto' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });
  db.prepare('DELETE FROM email_codes WHERE email = ? AND purpose = ?').run(email, 'login');
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token });
});

// ---------- User ----------
app.get('/user/profile', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.sendStatus(404);
  res.json({ id: user.id, email: user.email, plan: user.plan, usage: usageFor(user) });
});

// Alias per CLI: restituisce i dati dell'utente autenticato
app.get('/api/me', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.sendStatus(404);
  res.json({
    id: user.id,
    email: user.email,
    username: user.email.split('@')[0],
    plan: user.plan,
    usage: usageFor(user),
  });
});

// ---------- Chat (CLI endpoint - senza salvare sessione) ----------
// POST /api/chat: per la CLI, non salva la sessione, restituisce direttamente la risposta
app.post('/api/chat', auth, async (req, res) => {
  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const q = checkQuota(user);
  if (!q.ok) {
    return res.status(402).json({ error: quotaMsg(q), kind: q.kind, resetAt: q.resetAt });
  }

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: cacheBreakpoint(SYSTEM_PROMPT),
      messages: withHistoryCache(messages),
    });

    let reply = '';
    if (response.content && response.content.length > 0) {
      // Cerca il primo block di tipo 'text' (potrebbe avere thinking blocks prima)
      const textBlock = response.content.find(block => block.type === 'text');
      if (textBlock) {
        reply = textBlock.text;
      } else {
        // Se non c'è un block di testo, mostra i tipi disponibili per debug
        reply = `(Risposta ricevuta ma senza testo. Tipi: ${response.content.map(b => b.type).join(', ')})`;
      }
    } else {
      reply = '(nessun contenuto nella risposta)';
    }

    // Accredita i token realmente consumati
    const usedTok = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
    addTokens(req.user.id, user.plan, usedTok);
    const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    res.json({ reply, usage: usageFor(fresh) });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Chat (Web app endpoint - con sessioni salvate) ----------
app.post('/chat/new', auth, (req, res) => {
  const id = randomUUID();
  db.prepare('INSERT INTO chat_sessions (id, user_id, title) VALUES (?, ?, ?)')
    .run(id, req.user.id, (req.body && req.body.title) || 'Nuova chat');
  res.json({ sessionId: id });
});

// Lista conversazioni dell'utente (piu recenti prima, con anteprima titolo)
app.get('/chat/sessions', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT s.id, s.title, s.created_at,
      (SELECT content FROM messages m WHERE m.session_id = s.id AND m.role = 'user' ORDER BY m.created_at ASC LIMIT 1) AS first_msg,
      (SELECT MAX(created_at) FROM messages m WHERE m.session_id = s.id) AS last_at,
      (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) AS n
    FROM chat_sessions s
    WHERE s.user_id = ?
    ORDER BY COALESCE(last_at, s.created_at) DESC
  `).all(req.user.id);
  res.json(rows.map((r) => ({
    id: r.id,
    title: (r.first_msg && r.first_msg.slice(0, 60)) || r.title || 'Nuova conversazione',
    empty: r.n === 0,
  })));
});

// Elimina una conversazione (e i suoi messaggi)
app.delete('/chat/:sessionId', auth, (req, res) => {
  const session = db.prepare('SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?').get(req.params.sessionId, req.user.id);
  if (!session) return res.sendStatus(404);
  db.prepare('DELETE FROM messages WHERE session_id = ?').run(req.params.sessionId);
  db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(req.params.sessionId);
  res.json({ deleted: true });
});

app.get('/chat/:sessionId/messages', auth, (req, res) => {
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?')
    .get(req.params.sessionId, req.user.id);
  if (!session) return res.sendStatus(404);
  const msgs = db.prepare('SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(req.params.sessionId);
  res.json(msgs);
});

app.post('/chat/message', auth, async (req, res) => {
  const { sessionId, prefs } = req.body || {};
  const message = (req.body && req.body.message ? String(req.body.message) : '').trim();
  const images = Array.isArray(req.body && req.body.images) ? req.body.images.slice(0, 6) : [];
  if (!sessionId || (!message && images.length === 0)) return res.status(400).json({ error: 'sessionId and message required' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const q = checkQuota(user);
  if (!q.ok) {
    return res.status(429).json({ error: quotaMsg(q), kind: q.kind, resetAt: q.resetAt });
  }
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?')
    .get(sessionId, req.user.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  // "Rigenera" rimanda la stessa domanda per ottenere una risposta diversa.
  // Senza questo ramo il messaggio dell'utente verrebbe salvato una seconda
  // volta e la vecchia risposta resterebbe in archivio: ricaricando la
  // conversazione si vedrebbe la domanda doppia con due risposte.
  const isRegenerate = !!(req.body && req.body.regenerate);

  if (isRegenerate) {
    const lastAssistant = db.prepare(
      "SELECT id FROM messages WHERE session_id = ? AND role = 'assistant' ORDER BY created_at DESC LIMIT 1"
    ).get(sessionId);
    if (lastAssistant) db.prepare('DELETE FROM messages WHERE id = ?').run(lastAssistant.id);
  } else {
    // Save user message and rebuild conversation history for context
    const savedText = message || (images.length ? '[immagini allegate]' : '');
    db.prepare('INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)')
      .run(randomUUID(), sessionId, 'user', savedText);
  }

  const history = db.prepare('SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(sessionId)
    .map((m) => ({ role: m.role, content: m.content }))
    // scarta eventuali messaggi con content vuoto: l'API Anthropic li rifiuta
    // e farebbero fallire l'intera richiesta (sintomo: "non risponde piu")
    .filter((m) => (typeof m.content === 'string' ? m.content.trim().length > 0 : true));

  // Attach images to the current (last) user turn as image blocks for the model
  if (images.length) {
    const last = history[history.length - 1];
    if (last && last.role === 'user') {
      const blocks = [];
      for (const dataUrl of images) {
        const mm = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(String(dataUrl));
        if (mm) blocks.push({ type: 'image', source: { type: 'base64', media_type: mm[1], data: mm[2] } });
      }
      blocks.push({ type: 'text', text: message || 'Analizza le immagini allegate.' });
      last.content = blocks;
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let full = '';
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      system: cacheBreakpoint(buildSystem(prefs)),
      messages: withHistoryCache(history),
    });

    stream.on('text', (delta) => {
      full += delta;
      res.write(`data: ${JSON.stringify({ type: 'text', content: delta })}\n\n`);
    });

    const finalMsg = await stream.finalMessage();

    // Fallback: se lo stream non ha emesso testo (es. risposta con solo blocco
    // "thinking"), ricostruisci il testo dai blocchi text della risposta finale.
    if (!full.trim() && Array.isArray(finalMsg?.content)) {
      const reconstructed = finalMsg.content
        .filter((b) => b && b.type === 'text' && b.text)
        .map((b) => b.text)
        .join('\n')
        .trim();
      if (reconstructed) {
        full = reconstructed;
        res.write(`data: ${JSON.stringify({ type: 'text', content: full })}\n\n`);
      }
    }
    // Non salvare mai un assistant vuoto: avvelenerebbe i turni successivi.
    if (!full.trim()) {
      full = 'Non sono riuscito a generare una risposta questa volta. Riprova pure.';
      res.write(`data: ${JSON.stringify({ type: 'text', content: full })}\n\n`);
    }

    db.prepare('INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)')
      .run(randomUUID(), sessionId, 'assistant', full);

    // Accredita i token realmente consumati (input + output)
    const usedTok = (finalMsg?.usage?.input_tokens || 0) + (finalMsg?.usage?.output_tokens || 0);
    addTokens(req.user.id, user.plan, usedTok);
    const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    res.write(`data: ${JSON.stringify({ type: 'done', usage: usageFor(fresh) })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Chat error:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    res.end();
  }
});

// ---------- Billing ----------
app.post('/billing/create-checkout', auth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Billing not configured' });
  const { plan } = req.body || {};
  const priceMap = {
    starter: process.env.STRIPE_PRICE_STARTER,
    pro: process.env.STRIPE_PRICE_PRO,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
    team_low: process.env.STRIPE_PRICE_TEAM_LOW,
    team_medium: process.env.STRIPE_PRICE_TEAM_MEDIUM,
    team_max: process.env.STRIPE_PRICE_TEAM_MAX,
  };
  if (!priceMap[plan]) return res.status(400).json({ error: 'Invalid plan' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  try {
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } });
      customerId = customer.id;
      db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, user.id);
    }
    const checkout = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceMap[plan], quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/?billing=success`,
      cancel_url: `${process.env.FRONTEND_URL}/?billing=cancel`,
    });
    res.json({ url: checkout.url });
  } catch (err) {
    console.error('Billing error:', err);
    res.status(500).json({ error: 'Billing error' });
  }
});

// ---------- Account ----------
app.delete('/account', auth, (req, res) => {
  const sessions = db.prepare('SELECT id FROM chat_sessions WHERE user_id = ?').all(req.user.id);
  const del = db.prepare('DELETE FROM messages WHERE session_id = ?');
  for (const s of sessions) del.run(s.id);
  db.prepare('DELETE FROM chat_sessions WHERE user_id = ?').run(req.user.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  res.json({ deleted: true });
});

// ---------- Billing checkout ----------
app.post('/billing/create-checkout', auth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Billing not configured' });
  const { plan } = req.body || {};
  const priceMap = {
    starter: process.env.STRIPE_PRICE_STARTER,
    pro: process.env.STRIPE_PRICE_PRO,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
    team_low: process.env.STRIPE_PRICE_TEAM_LOW,
    team_medium: process.env.STRIPE_PRICE_TEAM_MEDIUM,
    team_max: process.env.STRIPE_PRICE_TEAM_MAX,
  };
  if (!priceMap[plan]) return res.status(400).json({ error: 'Invalid plan' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  try {
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } });
      customerId = customer.id;
      db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, user.id);
    }
    const checkout = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceMap[plan], quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/?billing=success`,
      cancel_url: `${process.env.FRONTEND_URL}/?billing=cancel`,
    });
    res.json({ url: checkout.url });
  } catch (err) {
    console.error('Billing error:', err);
    res.status(500).json({ error: 'Billing error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`K AI Code backend on :${PORT} (model ${MODEL})`));