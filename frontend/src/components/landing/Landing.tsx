import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { VoxelTopographyGrid } from '@/components/ui/voxel-topography-grid';
import { CodeBlock } from '@/components/ui/code-block';
import { Icon } from '@/components/ui/icons';
import type { IconName } from '@/components/ui/icons';
import {
  PLANS, TEAMS, FEATURES, STEPS, FAQS, TESTIMONIALS, LANGS, DEMO_TURNS,
} from '@/lib/plans';
import { useReveal, useScrollSpy, useScrolled, useCountUp, useLockBodyScroll } from '@/lib/hooks';

/* =====================================================================
   Utility di presentazione
   ===================================================================== */

function fmtTokens(n: number | null) {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return String(n);
}

/** Wrapper che anima l'ingresso di una sezione quando entra nel viewport. */
function Reveal({
  children,
  delay = 0,
  y = 26,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'header';
}) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const MotionTag = motion[Tag] as typeof motion.div;
  return (
    <MotionTag
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </MotionTag>
  );
}

/** Etichetta di sezione (kicker) + titolo + sottotitolo. */
function SectionHead({
  kicker,
  title,
  sub,
  center = true,
}: {
  kicker: string;
  title: React.ReactNode;
  sub?: string;
  center?: boolean;
}) {
  return (
    <Reveal className={center ? 'sec-head center' : 'sec-head'}>
      <span className="kicker">{kicker}</span>
      <h2 className="sec-title">{title}</h2>
      {sub && <p className="sec-sub">{sub}</p>}
    </Reveal>
  );
}

/* =====================================================================
   NAVIGAZIONE
   ===================================================================== */

const NAV_LINKS = [
  { id: 'funzioni', label: 'Funzioni' },
  { id: 'demo', label: 'Demo' },
  { id: 'come-funziona', label: 'Come funziona' },
  { id: 'prezzi', label: 'Prezzi' },
  { id: 'domande', label: 'Domande' },
];

function Nav({ onStart, onDemo }: { onStart: () => void; onDemo: () => void }) {
  const scrolled = useScrolled(20);
  const active = useScrollSpy(NAV_LINKS.map((l) => l.id));
  const [open, setOpen] = useState(false);
  useLockBodyScroll(open);

  const go = (id: string) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <header className={scrolled ? 'lp-nav scrolled' : 'lp-nav'}>
        <div className="lp-nav-inner">
          <button className="lp-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span className="lp-logo-mark">K</span>
            <span className="lp-logo-text">
              K AI <em>Code</em>
            </span>
          </button>

          <nav className="lp-nav-links" aria-label="Sezioni">
            {NAV_LINKS.map((l) => (
              <button
                key={l.id}
                className={active === l.id ? 'lp-nav-link on' : 'lp-nav-link'}
                onClick={() => go(l.id)}
              >
                {l.label}
                {active === l.id && (
                  <motion.span
                    layoutId="nav-underline"
                    className="lp-nav-underline"
                    transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                  />
                )}
              </button>
            ))}
          </nav>

          <div className="lp-nav-cta">
            <button className="lp-ghost-btn hide-sm" onClick={onDemo}>
              {Icon.play} Demo
            </button>
            <button className="lp-ghost-btn" onClick={onStart}>
              Accedi
            </button>
            <button className="lp-primary-btn sm" onClick={onStart}>
              Inizia gratis
            </button>
            <button
              className="lp-burger"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? 'Chiudi menu' : 'Apri menu'}
              aria-expanded={open}
            >
              {open ? Icon.close : Icon.menu}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="lp-mobile-menu"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {NAV_LINKS.map((l) => (
              <button key={l.id} onClick={() => go(l.id)}>
                {l.label}
              </button>
            ))}
            <div className="lp-mobile-sep" />
            <button onClick={() => { setOpen(false); onDemo(); }}>Guarda la demo</button>
            <button className="accent" onClick={() => { setOpen(false); onStart(); }}>
              Inizia gratis
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* =====================================================================
   HERO
   ===================================================================== */

/**
 * Riproduce una conversazione: scrive la domanda, mostra i puntini di
 * "sta pensando", poi rivela la risposta. Serve a far vedere il prodotto
 * in funzione senza obbligare l'utente a registrarsi prima.
 */
function DemoReplay() {
  const reduced = useReducedMotion();
  const turn = DEMO_TURNS[0];
  const [phase, setPhase] = useState<'typing' | 'thinking' | 'answer'>('typing');
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (reduced) {
      setTyped(turn.user);
      setPhase('answer');
      return;
    }
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;

    const typeNext = () => {
      i++;
      setTyped(turn.user.slice(0, i));
      if (i < turn.user.length) {
        // Velocità leggermente variabile: la digitazione a passo fisso
        // si riconosce subito come finta.
        timer = setTimeout(typeNext, 16 + Math.random() * 26);
      } else {
        timer = setTimeout(() => {
          setPhase('thinking');
          timer = setTimeout(() => setPhase('answer'), 1100);
        }, 420);
      }
    };
    timer = setTimeout(typeNext, 700);
    return () => clearTimeout(timer);
  }, [reduced, turn.user]);

  return (
    <div className="demo-window">
      <div className="demo-chrome">
        <span className="demo-dots"><i /><i /><i /></span>
        <span className="demo-title">K AI Code — conversazione</span>
        <span className="demo-badge"><span className="demo-live-dot" /> live</span>
      </div>

      <div className="demo-scroll">
        <div className="demo-turn-user">
          <div className="demo-bubble">
            {typed}
            {phase === 'typing' && <span className="demo-caret" />}
          </div>
        </div>

        <AnimatePresence>
          {phase !== 'typing' && (
            <motion.div
              className="demo-turn-ai"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="demo-ai-head">
                <span className="demo-k">K</span>
                <span>K AI</span>
              </div>

              {phase === 'thinking' ? (
                <div className="demo-thinking">
                  <span /><span /><span />
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.35 }}
                  className="demo-answer"
                >
                  <p className="demo-note">
                    Ecco l'handler. Ho aggiunto un filtro sui permessi così l'avviso
                    arriva solo allo staff:
                  </p>
                  <CodeBlock code={turn.code} lang={turn.lang} filename={turn.file} maxHeight={260} />
                  <p className="demo-note small">{turn.note}</p>
                  <div className="demo-actions">
                    <span className="demo-chip">Copia</span>
                    <span className="demo-chip accent">{Icon.zip} Scarica ZIP · 2 file</span>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatItem({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { ref, visible } = useReveal<HTMLDivElement>({ threshold: 0.4 });
  const n = useCountUp(value, visible);
  return (
    <div className="hero-stat" ref={ref}>
      <span className="hero-stat-num">
        {n.toLocaleString('it-IT')}
        {suffix}
      </span>
      <span className="hero-stat-label">{label}</span>
    </div>
  );
}

function Hero({ onStart, onDemo }: { onStart: () => void; onDemo: () => void }) {
  return (
    <section className="lp-hero" id="top">
      <div className="lp-hero-bg" aria-hidden="true">
        <VoxelTopographyGrid
          primaryColor="#34d3b8"
          wireColor="rgba(52, 211, 184, 0.32)"
          bgColor="#020617"
          speed={0.011}
          tileSize={40}
          maxHeight={62}
          interactive={false}
        />
      </div>

      <div className="lp-hero-inner">
        <motion.div
          className="hero-copy"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } } }}
        >
          <motion.a
            className="hero-badge"
            href="#funzioni"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('funzioni')?.scrollIntoView({ behavior: 'smooth' });
            }}
            variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
          >
            <span className="hero-badge-dot" />
            Specializzato su Paper, Spigot, Fabric e Forge
            <span className="hero-badge-arrow">{Icon.arrow}</span>
          </motion.a>

          <motion.h1
            className="hero-title"
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
          >
            Scrivi il plugin.
            <br />
            <span className="hero-grad">Non la documentazione.</span>
          </motion.h1>

          <motion.p
            className="hero-sub"
            variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}
          >
            L'assistente di programmazione che conosce le API di Minecraft versione per
            versione. Descrivi cosa ti serve in italiano, ricevi file completi e
            compilabili, scaricali in ZIP. Dallo stack trace alla patch, nella stessa
            conversazione.
          </motion.p>

          <motion.div
            className="hero-cta"
            variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
          >
            <button className="lp-primary-btn lg" onClick={onStart}>
              Inizia gratis
              <span className="btn-arrow">{Icon.arrow}</span>
            </button>
            <button className="lp-outline-btn lg" onClick={onDemo}>
              {Icon.play} Guarda la demo
            </button>
          </motion.div>

          <motion.p
            className="hero-fineprint"
            variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
          >
            Piano Free senza carta di credito · 15k token ogni 4 ore
          </motion.p>

          <motion.div
            className="hero-stats"
            variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
          >
            <StatItem value={1} suffix="M" label="token di contesto" />
            <StatItem value={40} suffix="+" label="linguaggi supportati" />
            <StatItem value={12} suffix="" label="versioni MC coperte" />
          </motion.div>
        </motion.div>

        <motion.div
          className="hero-demo"
          initial={{ opacity: 0, y: 34, rotateX: 6 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <DemoReplay />
        </motion.div>
      </div>

      <div className="lp-hero-fade" aria-hidden="true" />
    </section>
  );
}

/* =====================================================================
   STRISCIA LINGUAGGI (marquee)
   ===================================================================== */

function LangStrip() {
  // Duplicata una volta: l'animazione scorre del 50% e il secondo blocco
  // copre il vuoto, dando un ciclo continuo senza salti.
  const doubled = [...LANGS, ...LANGS];
  return (
    <div className="lang-strip" aria-label="Linguaggi supportati">
      <div className="lang-track">
        {doubled.map((l, i) => (
          <div className="lang-pill" key={i} aria-hidden={i >= LANGS.length}>
            <span className="lang-name">{l.name}</span>
            <span className="lang-note">{l.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =====================================================================
   FUNZIONI (bento grid)
   ===================================================================== */

function Features() {
  return (
    <section className="lp-section" id="funzioni">
      <div className="lp-container">
        <SectionHead
          kicker="Cosa sa fare"
          title={<>Costruito per chi sviluppa <span className="accent-text">sul serio</span></>}
          sub="Non un chatbot generico con un prompt di sistema a tema. Uno strumento che conosce il dominio e produce output che compila."
        />

        <div className="bento">
          {FEATURES.map((f, i) => (
            <Reveal
              key={f.title}
              delay={(i % 3) * 0.07}
              className={`bento-card ${f.span === 'wide' ? 'wide' : ''}`}
            >
              <span className="bento-icon">{Icon[f.icon as IconName]}</span>
              <h3 className="bento-title">{f.title}</h3>
              <p className="bento-body">{f.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =====================================================================
   DEMO / SHOWCASE
   ===================================================================== */

const SHOWCASE = [
  {
    tab: 'Debug',
    label: 'Dallo stack trace alla causa',
    prompt: 'Il server crasha quando un giocatore esce. Ecco l\'errore.',
    code: `// PRIMA — NPE quando il giocatore è già uscito
@EventHandler
public void onQuit(PlayerQuitEvent e) {
    Player p = e.getPlayer();
    scoreboard.getTeam(p.getName()).removeEntry(p.getName());
    //             ^^^ getTeam() torna null se il team è stato smontato
}

// DOPO — controllo esplicito, nessun crash
@EventHandler
public void onQuit(PlayerQuitEvent e) {
    Player p = e.getPlayer();
    Team team = scoreboard.getTeam(p.getName());
    if (team != null) {
        team.removeEntry(p.getName());
    }
    cache.remove(p.getUniqueId());  // evita anche il memory leak
}`,
    lang: 'java',
    file: 'QuitListener.java',
    note: 'Il crash arrivava da `getTeam()` che torna null dopo un reload dello scoreboard. Ho aggiunto anche la pulizia della cache: tenevi l\'oggetto Player in memoria dopo il logout.',
  },
  {
    tab: 'Config',
    label: 'YAML con validazione',
    prompt: 'Aggiungi un config.yml per il plugin dei kit, con default sensati.',
    code: `# config.yml — ricaricabile a caldo con /kit reload
settings:
  cooldown-seconds: 86400      # 24h; 0 = nessun cooldown
  broadcast-on-claim: true
  sound: ENTITY_PLAYER_LEVELUP

kits:
  starter:
    permission: kit.starter
    cooldown-override: 0       # una tantum
    items:
      - material: STONE_SWORD
        amount: 1
        enchants: { DAMAGE_ALL: 1 }
      - material: BREAD
        amount: 16
  vip:
    permission: kit.vip
    items:
      - material: DIAMOND_SWORD
        name: "&bLama del VIP"
        enchants: { DAMAGE_ALL: 3, DURABILITY: 2 }`,
    lang: 'yaml',
    file: 'config.yml',
    note: 'I `cooldown-override` a livello di kit vincono su quello globale. Ho lasciato i commenti in italiano perché li leggerà chi gestisce il server, non chi scrive il codice.',
  },
  {
    tab: 'Ottimizzazione',
    label: 'Query fuori dal main thread',
    prompt: 'Questo listener fa lag spike a ogni join. Perché?',
    code: `// Il problema: query SQL sul thread principale a ogni join.
// A 40 player connessi = 40 blocchi del tick loop.

@EventHandler
public void onJoin(PlayerJoinEvent event) {
    Player player = event.getPlayer();

    // Async: la query esce dal main thread
    CompletableFuture
        .supplyAsync(() -> stats.load(player.getUniqueId()), dbPool)
        .thenAcceptAsync(data -> {
            // Rientro sul main thread SOLO per toccare l'API di Bukkit
            Bukkit.getScheduler().runTask(plugin, () -> {
                if (!player.isOnline()) return;   // uscito nel frattempo
                scoreboard.render(player, data);
            });
        })
        .exceptionally(err -> {
            plugin.getLogger().warning("Stats non caricate: " + err.getMessage());
            return null;
        });
}`,
    lang: 'java',
    file: 'JoinListener.java',
    note: 'Regola d\'oro: l\'I/O va in async, le chiamate all\'API di Bukkit tornano sul main thread. Il controllo `isOnline()` evita di scrivere su un giocatore già uscito.',
  },
];

function Showcase() {
  const [tab, setTab] = useState(0);
  const item = SHOWCASE[tab];

  return (
    <section className="lp-section alt" id="demo">
      <div className="lp-container">
        <SectionHead
          kicker="In azione"
          title={<>Tre problemi veri, <span className="accent-text">tre risposte</span></>}
          sub="Esempi reali di conversazione. Nessuno di questi è uno snippet inventato per la vetrina: sono i casi che si incontrano gestendo un server."
        />

        <Reveal className="showcase">
          <div className="showcase-tabs" role="tablist">
            {SHOWCASE.map((s, i) => (
              <button
                key={s.tab}
                role="tab"
                aria-selected={tab === i}
                className={tab === i ? 'showcase-tab on' : 'showcase-tab'}
                onClick={() => setTab(i)}
              >
                {tab === i && (
                  <motion.span
                    layoutId="showcase-pill"
                    className="showcase-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                  />
                )}
                <span className="showcase-tab-label">{s.tab}</span>
              </button>
            ))}
          </div>

          {/* Nessun AnimatePresence: `mode="wait"` obbligherebbe a completare
              l'uscita prima di montare il nuovo pannello, e un tab che risponde
              dopo 300ms sembra rotto. Cambiando `key` React rimonta subito e la
              sola animazione d'ingresso fa il lavoro. */}
          <div className="showcase-body-wrap">
            <motion.div
              key={tab}
              className="showcase-body"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="showcase-prompt">
                <span className="showcase-you">Tu</span>
                <p>{item.prompt}</p>
              </div>
              <div className="showcase-label">{item.label}</div>
              <CodeBlock code={item.code} lang={item.lang} filename={item.file} maxHeight={420} />
              <p className="showcase-note">
                <span className="showcase-k">K</span>
                {item.note}
              </p>
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* =====================================================================
   COME FUNZIONA
   ===================================================================== */

function HowItWorks() {
  return (
    <section className="lp-section" id="come-funziona">
      <div className="lp-container">
        <SectionHead
          kicker="Come funziona"
          title={<>Dalla frase al file, <span className="accent-text">in tre passi</span></>}
        />
        <div className="steps">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.12} className="step">
              <span className="step-n">{s.n}</span>
              <h3 className="step-title">{s.title}</h3>
              <p className="step-body">{s.body}</p>
              {i < STEPS.length - 1 && <span className="step-line" aria-hidden="true" />}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =====================================================================
   PREZZI
   ===================================================================== */

function Pricing({ onStart }: { onStart: () => void }) {
  const [annual, setAnnual] = useState(false);
  const [showTeams, setShowTeams] = useState(false);

  // Sconto annuale: due mesi in omaggio, arrotondato all'euro.
  const priceOf = (monthly: string) => {
    const m = Number(monthly);
    if (!m) return '0';
    return annual ? String(Math.round((m * 10) / 12)) : monthly;
  };

  return (
    <section className="lp-section alt" id="prezzi">
      <div className="lp-container">
        <SectionHead
          kicker="Prezzi"
          title={<>Paghi i token, <span className="accent-text">non le postazioni</span></>}
          sub="Ogni piano definisce quanti token puoi usare in una finestra di 4 ore. Allo scadere si ricarica interamente. Cambi o disdici quando vuoi."
        />

        <Reveal className="price-toggles">
          <div className="billing-switch">
            <button className={!annual ? 'on' : ''} onClick={() => setAnnual(false)}>
              Mensile
            </button>
            <button className={annual ? 'on' : ''} onClick={() => setAnnual(true)}>
              Annuale <span className="save-badge">−17%</span>
            </button>
          </div>
          <div className="billing-switch">
            <button className={!showTeams ? 'on' : ''} onClick={() => setShowTeams(false)}>
              Individuale
            </button>
            <button className={showTeams ? 'on' : ''} onClick={() => setShowTeams(true)}>
              Team
            </button>
          </div>
        </Reveal>

        {/* Come per i tab dello showcase: swap immediato, anima solo l'ingresso. */}
        <div className="price-grid-wrap">
          {!showTeams ? (
            <motion.div
              key="plans"
              className="price-grid"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              {PLANS.map((p) => (
                <div
                  key={p.id}
                  className={`price-card ${p.id === 'pro' ? 'featured' : ''}`}
                >
                  {p.id === 'pro' && <span className="price-flag">Il più scelto</span>}
                  <h3 className="price-name">{p.name}</h3>
                  <div className="price-amount">
                    {p.id === 'free' ? (
                      <b>Gratis</b>
                    ) : (
                      <>
                        <span className="cur">€</span>
                        <b>{priceOf(p.price)}</b>
                        <span className="per">/mese</span>
                      </>
                    )}
                  </div>
                  {annual && p.id !== 'free' && (
                    <span className="price-annual-note">
                      fatturati {Number(p.price) * 10}€ all'anno
                    </span>
                  )}
                  <p className="price-desc">{p.desc}</p>
                  <ul className="price-feats">
                    <li>
                      <span className="pf-check">{Icon.check}</span>
                      <b>{fmtTokens(p.cap4h)}</b> token ogni 4 ore
                    </li>
                    <li>
                      <span className="pf-check">{Icon.check}</span>
                      {p.week ? `Tetto settimanale ${fmtTokens(p.week)}` : 'Nessun tetto settimanale'}
                    </li>
                    {p.highlights?.map((h) => (
                      <li key={h}>
                        <span className="pf-check">{Icon.check}</span>
                        {h}
                      </li>
                    ))}
                  </ul>
                  <button
                    className={p.id === 'pro' ? 'lp-primary-btn full' : 'lp-outline-btn full'}
                    onClick={onStart}
                  >
                    {p.id === 'free' ? 'Inizia gratis' : `Scegli ${p.name}`}
                  </button>
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="teams"
              className="price-grid teams"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              {TEAMS.map((t) => (
                <div
                  key={t.id}
                  className={`price-card ${t.id === 'team_medium' ? 'featured' : ''}`}
                >
                  {t.id === 'team_medium' && <span className="price-flag">Consigliato</span>}
                  <h3 className="price-name">{t.name}</h3>
                  <div className="price-amount">
                    <span className="cur">€</span>
                    <b>{priceOf(t.price)}</b>
                    <span className="per">/mese</span>
                  </div>
                  {annual && (
                    <span className="price-annual-note">
                      fatturati {Number(t.price) * 10}€ all'anno
                    </span>
                  )}
                  <p className="price-desc">{t.desc}</p>
                  <ul className="price-feats">
                    <li>
                      <span className="pf-check">{Icon.check}</span>
                      <b>{fmtTokens(t.cap4h)}</b> token ogni 4 ore
                    </li>
                    <li>
                      <span className="pf-check">{Icon.check}</span>
                      <b>{t.seats}</b> postazioni incluse
                    </li>
                    <li>
                      <span className="pf-check">{Icon.check}</span>
                      Nessun tetto settimanale
                    </li>
                    <li>
                      <span className="pf-check">{Icon.check}</span>
                      Fatturazione unica
                    </li>
                    <li>
                      <span className="pf-check">{Icon.check}</span>
                      Supporto dedicato
                    </li>
                  </ul>
                  <button
                    className={t.id === 'team_medium' ? 'lp-primary-btn full' : 'lp-outline-btn full'}
                    onClick={onStart}
                  >
                    Scegli {t.name}
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        <Reveal className="price-footnote">
          Tutti i piani includono analisi immagini, export ZIP, cronologia delle
          conversazioni e i tre temi dell'interfaccia. Nessun vincolo di durata.
        </Reveal>
      </div>
    </section>
  );
}

/* =====================================================================
   TESTIMONIANZE
   ===================================================================== */

function Testimonials() {
  return (
    <section className="lp-section">
      <div className="lp-container">
        <SectionHead
          kicker="Chi lo usa"
          title={<>Sviluppatori, admin, <span className="accent-text">network interi</span></>}
        />
        <div className="quotes">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={(i % 2) * 0.1} className="quote-card">
              <span className="quote-mark" aria-hidden="true">"</span>
              <p className="quote-text">{t.quote}</p>
              <div className="quote-author">
                <span className="quote-av">{t.initials}</span>
                <span className="quote-meta">
                  <b>{t.name}</b>
                  <em>{t.role}</em>
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =====================================================================
   FAQ
   ===================================================================== */

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="lp-section alt" id="domande">
      <div className="lp-container narrow">
        <SectionHead
          kicker="Domande"
          title={<>Le cose che <span className="accent-text">chiedono tutti</span></>}
        />
        <div className="faq-list">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={f.q} delay={i * 0.04} className={isOpen ? 'faq-item open' : 'faq-item'}>
                <button
                  className="faq-q"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span>{f.q}</span>
                  <motion.span
                    className="faq-chev"
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {Icon.chevron}
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      className="faq-a-wrap"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <p className="faq-a">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* =====================================================================
   CTA FINALE + FOOTER
   ===================================================================== */

function FinalCta({ onStart }: { onStart: () => void }) {
  return (
    <section className="lp-cta-section">
      <div className="lp-cta-bg" aria-hidden="true">
        <VoxelTopographyGrid
          primaryColor="#34d3b8"
          wireColor="rgba(52, 211, 184, 0.28)"
          bgColor="#020617"
          speed={0.009}
          tileSize={46}
          maxHeight={52}
          interactive={false}
        />
      </div>
      <Reveal className="lp-cta-inner">
        <span className="kicker light">Pronto?</span>
        <h2 className="lp-cta-title">
          Il prossimo plugin lo scrivi
          <br />
          <span className="hero-grad">in un pomeriggio.</span>
        </h2>
        <p className="lp-cta-sub">
          Piano Free attivo subito, senza carta di credito. Se non ti convince,
          hai perso il tempo di scrivere una email.
        </p>
        <div className="lp-cta-actions">
          <button className="lp-primary-btn lg" onClick={onStart}>
            Crea il tuo account
            <span className="btn-arrow">{Icon.arrow}</span>
          </button>
        </div>
      </Reveal>
    </section>
  );
}

function Footer({ onStart }: { onStart: () => void }) {
  const year = new Date().getFullYear();
  return (
    <footer className="lp-footer">
      <div className="lp-container">
        <div className="footer-grid">
          <div className="footer-brand">
            <button className="lp-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <span className="lp-logo-mark">K</span>
              <span className="lp-logo-text">K AI <em>Code</em></span>
            </button>
            <p>
              Assistente di programmazione per sviluppatori Minecraft e non solo.
              Plugin, mod, script e debugging in ogni linguaggio.
            </p>
          </div>

          <div className="footer-col">
            <h4>Prodotto</h4>
            <button onClick={() => document.getElementById('funzioni')?.scrollIntoView({ behavior: 'smooth' })}>Funzioni</button>
            <button onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}>Demo</button>
            <button onClick={() => document.getElementById('prezzi')?.scrollIntoView({ behavior: 'smooth' })}>Prezzi</button>
            <button onClick={onStart}>Accedi</button>
          </div>

          <div className="footer-col">
            <h4>Risorse</h4>
            <button onClick={() => document.getElementById('come-funziona')?.scrollIntoView({ behavior: 'smooth' })}>Come funziona</button>
            <button onClick={() => document.getElementById('domande')?.scrollIntoView({ behavior: 'smooth' })}>Domande frequenti</button>
            <button onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}>Esempi di codice</button>
          </div>

          <div className="footer-col">
            <h4>Inizia</h4>
            <button className="footer-cta" onClick={onStart}>Crea account gratis</button>
            <span className="footer-note">15k token ogni 4 ore, senza carta.</span>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {year} K AI Code</span>
          <span className="footer-dot">·</span>
          <span>Fatto per chi sviluppa su Minecraft</span>
        </div>
      </div>
    </footer>
  );
}

/* =====================================================================
   MODALE VIDEO
   ===================================================================== */

/**
 * La demo non è più un mp4 ma l'animazione vera, che gira dal vivo con la
 * sua colonna sonora. Caricata a richiesta: chi non la apre non ne scarica
 * né il codice né i font.
 */
const DemoPlayer = lazy(() => import('@/components/demo/DemoPlayer'));

function VideoModal({ onClose }: { onClose: () => void }) {
  useLockBodyScroll(true);

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      <motion.div
        className="video-modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      >
        <button className="modal-close" onClick={onClose} aria-label="Chiudi">×</button>
        <Suspense fallback={<div className="dm-loading" aria-label="Caricamento della demo" />}>
          <DemoPlayer onClose={onClose} />
        </Suspense>
      </motion.div>
    </motion.div>
  );
}

/* =====================================================================
   COMPOSIZIONE
   ===================================================================== */

export default function Landing({ onStart }: { onStart: () => void }) {
  const [video, setVideo] = useState(false);

  // La classe `landing-mode` su <html> la imposta App: averla anche qui
  // significava due effetti che si salvavano e ripristinavano a vicenda
  // `className`, con l'ordine dei cleanup che lasciava la classe attaccata
  // passando al login — e `landing-mode` azzera l'altezza di html/body,
  // facendo collassare la schermata di accesso.
  const openDemo = useMemo(() => () => setVideo(true), []);

  return (
    <div className="lp">
      <a className="skip-link" href="#funzioni">Vai al contenuto</a>
      <Nav onStart={onStart} onDemo={openDemo} />
      <main>
        <Hero onStart={onStart} onDemo={openDemo} />
        <LangStrip />
        <Features />
        <Showcase />
        <HowItWorks />
        <Pricing onStart={onStart} />
        <Testimonials />
        <Faq />
        <FinalCta onStart={onStart} />
      </main>
      <Footer onStart={onStart} />

      <AnimatePresence>{video && <VideoModal onClose={() => setVideo(false)} />}</AnimatePresence>
    </div>
  );
}
