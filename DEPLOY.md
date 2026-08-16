# K AI Code — come metterlo online

Repo diviso in due cartelle:
- `backend/`  → **Render** (attivo su `https://k-ai-code.onrender.com`)
- `frontend/` → **Vercel** (attivo su `https://k-ai-code-ujbf.vercel.app`)

Entrambi fanno redeploy da soli a ogni push su `main`: non serve nessun
comando manuale.

> Le istruzioni qui sotto parlano di Railway perché è lì che era stato
> messo il backend all'inizio. Il servizio ora gira su Render: la procedura
> è la stessa (root directory `backend`, stesse variabili d'ambiente),
> cambia solo il pannello.

---

## 1. Push su GitHub

Sostituisci il vecchio repo con queste due cartelle, oppure crea un repo nuovo:

```
git init
git add .
git commit -m "K AI Code"
git branch -M main
git remote add origin https://github.com/TUO_USER/k-ai-code.git
git push -u origin main
```

---

## 2. Backend → Railway

1. railway.app → New Project → Deploy from GitHub repo → scegli il repo
2. Settings → **Root Directory = `backend`**  (questo è il punto chiave)
3. Variables → aggiungi:
   - `ANTHROPIC_API_KEY` = la tua key (sk-ant-...)
   - `CLAUDE_MODEL` = `claude-fable-5`
   - `JWT_SECRET` = una stringa random lunga (es. output di `openssl rand -hex 32`)
   - `FRONTEND_URL` = per ora metti `*`, lo cambi dopo con l'URL Vercel
   - (Stripe: aggiungili solo quando vuoi i pagamenti — vedi punto 4)
4. Deploy. Quando è Online, copia l'URL: `https://...up.railway.app`

Test veloce: apri quell'URL nel browser, devi vedere `{"ok":true,...}`.

---

## 3. Frontend → Vercel

1. vercel.com → Add New Project → scegli lo stesso repo
2. **Root Directory = `frontend`**
3. Framework: Vite (rilevato in automatico). Build e output li lascia di default.
4. Environment Variables:
   - `VITE_API_URL` = l'URL Railway del punto 2
5. Deploy. Copia l'URL Vercel: `https://....vercel.app`

Poi torna su **Railway → Variables** e metti `FRONTEND_URL` = l'URL Vercel. Redeploy.

A questo punto l'app funziona: apri l'URL Vercel, registrati, chatti. I pagamenti sono opzionali.

---

## 4. Stripe (opzionale, quando vuoi vendere)

L'app gira anche senza. Quando vuoi attivare gli abbonamenti:

1. Stripe → crea 2 prodotti ricorrenti (Pro, Enterprise) → copia i due Price ID
2. Railway Variables: aggiungi `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE`
3. Stripe → Webhooks → Add endpoint:
   - URL: `https://TUO-BACKEND.up.railway.app/webhooks/stripe`
   - Eventi: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - copia il Signing secret → Railway var `STRIPE_WEBHOOK_SECRET` → redeploy

---

## Locale (per provarlo sul tuo PC prima)

```
# terminale 1
cd backend
cp .env.example .env    # metti almeno ANTHROPIC_API_KEY e JWT_SECRET
npm install
npm run dev

# terminale 2
cd frontend
cp .env.example .env    # VITE_API_URL=http://localhost:5000
npm install
npm run dev
```

Apri http://localhost:5173

---

## Note oneste

- Ho usato l'**API Messages** con `claude-fable-5`, non i Managed Agents del Console: per una chat di coding è più semplice, più economica e meno soggetta a errori. L'agente che avevi creato nel Console non serve.
- Il piano di default è "starter" con 50 richieste. I limiti/prezzi sono numeri di partenza: verifica tu i costi reali di Fable 5 sulla pagina prezzi Anthropic prima di fissare gli abbonamenti, perché cambiano.
- Database SQLite: ok per iniziare. Con molti utenti in parallelo conviene passare a Postgres (Railway lo offre).
