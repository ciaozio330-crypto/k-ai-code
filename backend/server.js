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
      [process.env.STRIPE_PRICE_PRO]: 'pro',
      [process.env.STRIPE_PRICE_ENTERPRISE]: 'enterprise',
      [process.env.STRIPE_PRICE_TEAM]: 'team',
    };
    const plan = planMap[priceId] || 'starter';
    const limits = { free: 10, starter: 60, pro: 300, enterprise: 1200, team: 3000 };
    db.prepare('UPDATE users SET plan = ?, queries_limit = ?, queries_used = 0 WHERE stripe_customer_id = ?')
      .run(plan, limits[plan], sub.customer);
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    db.prepare('UPDATE users SET plan = ?, queries_limit = ? WHERE stripe_customer_id = ?')
      .run('free', 10, sub.customer);
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
  const user = db.prepare('SELECT id, email, plan, queries_used, queries_limit FROM users WHERE id = ?')
    .get(req.user.id);
  if (!user) return res.sendStatus(404);
  res.json(user);
});

// Alias per CLI: restituisce i dati dell'utente autenticato
app.get('/api/me', auth, (req, res) => {
  const user = db.prepare('SELECT id, email, plan, queries_used, queries_limit FROM users WHERE id = ?')
    .get(req.user.id);
  if (!user) return res.sendStatus(404);
  res.json({
    id: user.id,
    email: user.email,
    username: user.email.split('@')[0],
    plan: user.plan,
    queriesUsed: user.queries_used,
    queriesLimit: user.queries_limit,
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
  if (user.queries_used >= user.queries_limit) {
    return res.status(402).json({ error: 'Limite di richieste raggiunto. Fai upgrade del piano.' });
  }

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: messages,
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
    
    // Incrementa il contatore di richieste
    db.prepare('UPDATE users SET queries_used = queries_used + 1 WHERE id = ?').run(req.user.id);

    res.json({ reply, user: { plan: user.plan, queriesUsed: user.queries_used + 1, queriesLimit: user.queries_limit } });
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
  if (user.queries_used >= user.queries_limit) {
    return res.status(429).json({ error: 'Limite di richieste raggiunto. Fai upgrade del piano.' });
  }
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?')
    .get(sessionId, req.user.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  // Save user message and rebuild conversation history for context
  const savedText = message || (images.length ? '[immagini allegate]' : '');
  db.prepare('INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), sessionId, 'user', savedText);

  const history = db.prepare('SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(sessionId)
    .map((m) => ({ role: m.role, content: m.content }));

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
      system: buildSystem(prefs),
      messages: history,
    });

    stream.on('text', (delta) => {
      full += delta;
      res.write(`data: ${JSON.stringify({ type: 'text', content: delta })}\n\n`);
    });

    await stream.finalMessage();

    db.prepare('INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)')
      .run(randomUUID(), sessionId, 'assistant', full);
    db.prepare('UPDATE users SET queries_used = queries_used + 1 WHERE id = ?').run(req.user.id);

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
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
    team: process.env.STRIPE_PRICE_TEAM,
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
    team: process.env.STRIPE_PRICE_TEAM,
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