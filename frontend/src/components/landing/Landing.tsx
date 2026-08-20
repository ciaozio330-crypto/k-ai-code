import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { VoxelTopographyGrid } from '@/components/ui/voxel-topography-grid';
import { CodeBlock } from '@/components/ui/code-block';
import { Icon } from '@/components/ui/icons';
import type { IconName } from '@/components/ui/icons';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import {
  PLANS, TEAMS, FEATURE_META, TESTIMONIAL_PEOPLE, LANG_KEYS, LANG_LABELS,
  DEMO_TURN, SHOWCASE_SOURCES,
} from '@/lib/plans';
import { useI18n } from '@/lib/i18n';
import type { Dict } from '@/locales/it';
import { useReveal, useScrollSpy, useScrolled, useCountUp, useLockBodyScroll } from '@/lib/hooks';
import {
  tEnter, tSection, tQuick, springSnappy, staggerParent, staggerChild,
} from '@/lib/motion';

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
      transition={{ ...tSection, delay }}
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

/**
 * Titolo di sezione in due tempi: la seconda metà accentata.
 *
 * Le lingue non mettono l'enfasi nello stesso punto della frase, quindi lo
 * spezzone accentato è una chiave separata del dizionario invece che una
 * sottostringa individuata a runtime.
 */
function splitTitle(a: string, b: string) {
  return (
    <>
      {a} <span className="accent-text">{b}</span>
    </>
  );
}

/* =====================================================================
   NAVIGAZIONE
   ===================================================================== */

const NAV_IDS = ['funzioni', 'demo', 'come-funziona', 'prezzi', 'domande'] as const;

function navLinks(t: Dict) {
  return [
    { id: 'funzioni', label: t.nav.features },
    { id: 'demo', label: t.nav.demo },
    { id: 'come-funziona', label: t.nav.how },
    { id: 'prezzi', label: t.nav.pricing },
    { id: 'domande', label: t.nav.faq },
  ];
}

function Nav({ onStart, onDemo }: { onStart: () => void; onDemo: () => void }) {
  const { t } = useI18n();
  const scrolled = useScrolled(20);
  const active = useScrollSpy(NAV_IDS as unknown as string[]);
  const [open, setOpen] = useState(false);
  useLockBodyScroll(open);

  const links = navLinks(t);

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

          <nav className="lp-nav-links" aria-label={t.nav.sections}>
            {links.map((l) => (
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
                    transition={springSnappy}
                  />
                )}
              </button>
            ))}
          </nav>

          <div className="lp-nav-cta">
            <LanguageSwitcher />
            <button className="lp-ghost-btn hide-sm" onClick={onDemo}>
              {Icon.play} {t.nav.demo}
            </button>
            <button className="lp-ghost-btn" onClick={onStart}>
              {t.nav.login}
            </button>
            <button className="lp-primary-btn sm" onClick={onStart}>
              {t.nav.start}
            </button>
            <button
              className="lp-burger"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
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
            transition={tQuick}
          >
            {links.map((l) => (
              <button key={l.id} onClick={() => go(l.id)}>
                {l.label}
              </button>
            ))}
            <div className="lp-mobile-sep" />
            <button onClick={() => { setOpen(false); onDemo(); }}>{t.nav.watchDemo}</button>
            <button className="accent" onClick={() => { setOpen(false); onStart(); }}>
              {t.nav.start}
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
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const prompt = t.hero.demoPrompt;
  const [phase, setPhase] = useState<'typing' | 'thinking' | 'answer'>('typing');
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (reduced) {
      setTyped(prompt);
      setPhase('answer');
      return;
    }
    // Cambiando lingua la frase è un'altra: si riparte da capo invece di
    // continuare a scrivere sopra i caratteri della precedente.
    setTyped('');
    setPhase('typing');

    let i = 0;
    let timer: ReturnType<typeof setTimeout>;

    const typeNext = () => {
      i++;
      setTyped(prompt.slice(0, i));
      if (i < prompt.length) {
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
  }, [reduced, prompt]);

  return (
    <div className="demo-window">
      <div className="demo-chrome">
        <span className="demo-dots"><i /><i /><i /></span>
        <span className="demo-title">K AI Code — {t.hero.conversation}</span>
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
                  <p className="demo-note">{t.hero.replyNote}</p>
                  <CodeBlock
                    code={DEMO_TURN.code}
                    lang={DEMO_TURN.lang}
                    filename={DEMO_TURN.file}
                    maxHeight={260}
                  />
                  <p className="demo-note small">{t.hero.demoNote}</p>
                  <div className="demo-actions">
                    <span className="demo-chip">{t.hero.copy}</span>
                    <span className="demo-chip accent">{Icon.zip} {t.hero.downloadZip}</span>
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
  const { locale } = useI18n();
  const { ref, visible } = useReveal<HTMLDivElement>({ threshold: 0.4 });
  const n = useCountUp(value, visible);
  return (
    <div className="hero-stat" ref={ref}>
      <span className="hero-stat-num">
        {n.toLocaleString(locale)}
        {suffix}
      </span>
      <span className="hero-stat-label">{label}</span>
    </div>
  );
}

function Hero({ onStart, onDemo }: { onStart: () => void; onDemo: () => void }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  // Parallasse: il terreno scorre più lentamente del testo che gli sta sopra.
  // È ciò che fa leggere le colonne come sfondo lontano invece che come un
  // motivo incollato alla pagina. Disattivata con "riduci animazioni", dove
  // un fondale che si muove da solo è esattamente ciò che dà fastidio.
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', reduced ? '0%' : '14%']);
  const copyY = useTransform(scrollYProgress, [0, 1], ['0%', reduced ? '0%' : '-6%']);
  const copyFade = useTransform(scrollYProgress, [0, 0.75], [1, reduced ? 1 : 0.25]);

  return (
    <section className="lp-hero" id="top" ref={ref}>
      <motion.div className="lp-hero-bg" aria-hidden="true" style={{ y: bgY }}>
        <VoxelTopographyGrid
          primaryColor="#34d3b8"
          wireColor="rgba(52, 211, 184, 0.32)"
          bgColor="#020617"
          speed={0.011}
          tileSize={62}
          maxHeight={120}
          interactive={false}
          horizon={0.3}
        />
      </motion.div>

      <div className="lp-hero-inner">
        <motion.div
          className="hero-copy"
          initial="hidden"
          animate="show"
          style={{ y: copyY, opacity: copyFade }}
          variants={staggerParent(0.08)}
        >
          <motion.a
            className="hero-badge"
            href="#funzioni"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('funzioni')?.scrollIntoView({ behavior: 'smooth' });
            }}
            variants={staggerChild}
          >
            <span className="hero-badge-dot" />
            {t.hero.badge}
            <span className="hero-badge-arrow">{Icon.arrow}</span>
          </motion.a>

          <motion.h1 className="hero-title" variants={staggerChild}>
            {t.hero.titleA}
            <br />
            <span className="hero-grad">{t.hero.titleB}</span>
          </motion.h1>

          <motion.p className="hero-sub" variants={staggerChild}>
            {t.hero.sub}
          </motion.p>

          <motion.div className="hero-cta" variants={staggerChild}>
            <button className="lp-primary-btn lg" onClick={onStart}>
              {t.hero.ctaPrimary}
              <span className="btn-arrow">{Icon.arrow}</span>
            </button>
            <button className="lp-outline-btn lg" onClick={onDemo}>
              {Icon.play} {t.hero.ctaSecondary}
            </button>
          </motion.div>

          <motion.p className="hero-fineprint" variants={staggerChild}>
            {t.hero.fineprint}
          </motion.p>

          <motion.div className="hero-stats" variants={staggerChild}>
            <StatItem value={1} suffix="M" label={t.hero.statContext} />
            <StatItem value={40} suffix="+" label={t.hero.statLangs} />
            <StatItem value={12} suffix="" label={t.hero.statVersions} />
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
  const { t } = useI18n();
  // Duplicata una volta: l'animazione scorre del 50% e il secondo blocco
  // copre il vuoto, dando un ciclo continuo senza salti.
  const doubled = [...LANG_KEYS, ...LANG_KEYS];
  return (
    <div className="lang-strip" aria-label={t.langs.supported}>
      <div className="lang-track">
        {doubled.map((k, i) => (
          <div className="lang-pill" key={i} aria-hidden={i >= LANG_KEYS.length}>
            <span className="lang-name">{LANG_LABELS[k]}</span>
            <span className="lang-note">{t.langs[k]}</span>
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
  const { t } = useI18n();
  return (
    <section className="lp-section" id="funzioni">
      <div className="lp-container">
        <SectionHead
          kicker={t.features.kicker}
          title={splitTitle(t.features.titleA, t.features.titleB)}
          sub={t.features.sub}
        />

        <div className="bento">
          {t.features.items.map((f, i) => {
            const meta = FEATURE_META[i];
            return (
              <Reveal
                key={f.title}
                delay={(i % 3) * 0.07}
                className={`bento-card ${meta?.span === 'wide' ? 'wide' : ''}`}
              >
                <span className="bento-icon">{Icon[(meta?.icon || 'bolt') as IconName]}</span>
                <h3 className="bento-title">{f.title}</h3>
                <p className="bento-body">{f.body}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* =====================================================================
   DEMO / SHOWCASE
   ===================================================================== */

function Showcase() {
  const { t } = useI18n();
  const [tab, setTab] = useState(0);
  const src = SHOWCASE_SOURCES[tab];

  return (
    <section className="lp-section alt" id="demo">
      <div className="lp-container">
        <SectionHead
          kicker={t.showcase.kicker}
          title={splitTitle(t.showcase.titleA, t.showcase.titleB)}
          sub={t.showcase.sub}
        />

        <Reveal className="showcase">
          <div className="showcase-tabs" role="tablist">
            {t.showcase.tabs.map((label, i) => (
              <button
                key={label}
                role="tab"
                aria-selected={tab === i}
                className={tab === i ? 'showcase-tab on' : 'showcase-tab'}
                onClick={() => setTab(i)}
              >
                {tab === i && (
                  <motion.span
                    layoutId="showcase-pill"
                    className="showcase-pill"
                    transition={springSnappy}
                  />
                )}
                <span className="showcase-tab-label">{label}</span>
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
              transition={tEnter}
            >
              <div className="showcase-prompt">
                <span className="showcase-you">{t.showcase.you}</span>
                <p>{t.showcase.prompts[tab]}</p>
              </div>
              <div className="showcase-label">{t.showcase.labels[tab]}</div>
              <CodeBlock code={src.code} lang={src.lang} filename={src.file} maxHeight={420} />
              <p className="showcase-note">
                <span className="showcase-k">K</span>
                {t.showcase.notes[tab]}
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
  const { t } = useI18n();
  return (
    <section className="lp-section" id="come-funziona">
      <div className="lp-container">
        <SectionHead
          kicker={t.how.kicker}
          title={splitTitle(t.how.titleA, t.how.titleB)}
        />
        <div className="steps">
          {t.how.steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.12} className="step">
              <span className="step-n">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="step-title">{s.title}</h3>
              <p className="step-body">{s.body}</p>
              {i < t.how.steps.length - 1 && <span className="step-line" aria-hidden="true" />}
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
  const { t } = useI18n();
  const [annual, setAnnual] = useState(false);
  const [showTeams, setShowTeams] = useState(false);

  // Sconto annuale: due mesi in omaggio, arrotondato all'euro.
  const priceOf = (monthly: string) => {
    const m = Number(monthly);
    if (!m) return '0';
    return annual ? String(Math.round((m * 10) / 12)) : monthly;
  };

  const desc = t.pricing.planDesc as Record<string, string>;
  const bullets = t.pricing.planHighlights as Record<string, string[]>;

  return (
    <section className="lp-section alt" id="prezzi">
      <div className="lp-container">
        <SectionHead
          kicker={t.pricing.kicker}
          title={splitTitle(t.pricing.titleA, t.pricing.titleB)}
          sub={t.pricing.sub}
        />

        <Reveal className="price-toggles">
          <div className="billing-switch">
            <button className={!annual ? 'on' : ''} onClick={() => setAnnual(false)}>
              {t.pricing.monthly}
            </button>
            <button className={annual ? 'on' : ''} onClick={() => setAnnual(true)}>
              {t.pricing.yearly} <span className="save-badge">−17%</span>
            </button>
          </div>
          <div className="billing-switch">
            <button className={!showTeams ? 'on' : ''} onClick={() => setShowTeams(false)}>
              {t.pricing.individual}
            </button>
            <button className={showTeams ? 'on' : ''} onClick={() => setShowTeams(true)}>
              {t.pricing.team}
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
              transition={tEnter}
            >
              {PLANS.map((p) => (
                <div
                  key={p.id}
                  className={`price-card ${p.id === 'pro' ? 'featured' : ''}`}
                >
                  {p.id === 'pro' && <span className="price-flag">{t.pricing.mostChosen}</span>}
                  <h3 className="price-name">{p.name}</h3>
                  <div className="price-amount">
                    {p.id === 'free' ? (
                      <b>{t.pricing.free}</b>
                    ) : (
                      <>
                        <span className="cur">€</span>
                        <b>{priceOf(p.price)}</b>
                        <span className="per">{t.pricing.perMonth}</span>
                      </>
                    )}
                  </div>
                  {annual && p.id !== 'free' && (
                    <span className="price-annual-note">
                      {t.pricing.billedYearly(Number(p.price) * 10)}
                    </span>
                  )}
                  <p className="price-desc">{desc[p.id]}</p>
                  <ul className="price-feats">
                    <li>
                      <span className="pf-check">{Icon.check}</span>
                      <b>{fmtTokens(p.cap4h)}</b> {t.pricing.tokensEvery4h}
                    </li>
                    <li>
                      <span className="pf-check">{Icon.check}</span>
                      {p.week ? t.pricing.weeklyCap(fmtTokens(p.week)) : t.pricing.noWeeklyCap}
                    </li>
                    {bullets[p.id]?.map((h) => (
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
                    {p.id === 'free' ? t.pricing.startFree : t.pricing.choose(p.name)}
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
              transition={tEnter}
            >
              {TEAMS.map((team) => (
                <div
                  key={team.id}
                  className={`price-card ${team.id === 'team_medium' ? 'featured' : ''}`}
                >
                  {team.id === 'team_medium' && (
                    <span className="price-flag">{t.pricing.recommended}</span>
                  )}
                  <h3 className="price-name">{team.name}</h3>
                  <div className="price-amount">
                    <span className="cur">€</span>
                    <b>{priceOf(team.price)}</b>
                    <span className="per">{t.pricing.perMonth}</span>
                  </div>
                  {annual && (
                    <span className="price-annual-note">
                      {t.pricing.billedYearly(Number(team.price) * 10)}
                    </span>
                  )}
                  <p className="price-desc">{desc[team.id]}</p>
                  <ul className="price-feats">
                    <li>
                      <span className="pf-check">{Icon.check}</span>
                      <b>{fmtTokens(team.cap4h)}</b> {t.pricing.tokensEvery4h}
                    </li>
                    <li>
                      <span className="pf-check">{Icon.check}</span>
                      <b>{team.seats}</b> {t.pricing.seats}
                    </li>
                    <li>
                      <span className="pf-check">{Icon.check}</span>
                      {t.pricing.noWeeklyCap}
                    </li>
                    <li>
                      <span className="pf-check">{Icon.check}</span>
                      {t.pricing.oneInvoice}
                    </li>
                    <li>
                      <span className="pf-check">{Icon.check}</span>
                      {t.pricing.prioritySupport}
                    </li>
                  </ul>
                  <button
                    className={team.id === 'team_medium' ? 'lp-primary-btn full' : 'lp-outline-btn full'}
                    onClick={onStart}
                  >
                    {t.pricing.choose(team.name)}
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        <Reveal className="price-footnote">{t.pricing.footnote}</Reveal>
      </div>
    </section>
  );
}

/* =====================================================================
   TESTIMONIANZE
   ===================================================================== */

function Testimonials() {
  const { t } = useI18n();
  return (
    <section className="lp-section">
      <div className="lp-container">
        <SectionHead
          kicker={t.testimonials.kicker}
          title={splitTitle(t.testimonials.titleA, t.testimonials.titleB)}
        />
        <div className="quotes">
          {t.testimonials.items.map((q, i) => {
            const who = TESTIMONIAL_PEOPLE[i];
            return (
              <Reveal key={who.name} delay={(i % 2) * 0.1} className="quote-card">
                <span className="quote-mark" aria-hidden="true">"</span>
                <p className="quote-text">{q.quote}</p>
                <div className="quote-author">
                  <span className="quote-av">{who.initials}</span>
                  <span className="quote-meta">
                    <b>{who.name}</b>
                    <em>{q.role}</em>
                  </span>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* =====================================================================
   FAQ
   ===================================================================== */

function Faq() {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="lp-section alt" id="domande">
      <div className="lp-container narrow">
        <SectionHead
          kicker={t.faq.kicker}
          title={splitTitle(t.faq.titleA, t.faq.titleB)}
        />
        <div className="faq-list">
          {t.faq.items.map((f, i) => {
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
                    transition={tQuick}
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
                      transition={tEnter}
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
  const { t } = useI18n();
  return (
    <section className="lp-cta-section">
      <div className="lp-cta-bg" aria-hidden="true">
        <VoxelTopographyGrid
          primaryColor="#34d3b8"
          wireColor="rgba(52, 211, 184, 0.28)"
          bgColor="#020617"
          speed={0.009}
          tileSize={58}
          maxHeight={104}
          interactive={false}
          horizon={0.32}
        />
      </div>
      <Reveal className="lp-cta-inner">
        <span className="kicker light">{t.cta.kicker}</span>
        <h2 className="lp-cta-title">
          {t.cta.titleA}
          <br />
          <span className="hero-grad">{t.cta.titleB}</span>
        </h2>
        <p className="lp-cta-sub">{t.cta.sub}</p>
        <div className="lp-cta-actions">
          <button className="lp-primary-btn lg" onClick={onStart}>
            {t.cta.button}
            <span className="btn-arrow">{Icon.arrow}</span>
          </button>
        </div>
      </Reveal>
    </section>
  );
}

function Footer({ onStart }: { onStart: () => void }) {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  const jump = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <footer className="lp-footer">
      <div className="lp-container">
        <div className="footer-grid">
          <div className="footer-brand">
            <button className="lp-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <span className="lp-logo-mark">K</span>
              <span className="lp-logo-text">K AI <em>Code</em></span>
            </button>
            <p>{t.footer.about}</p>
            <LanguageSwitcher compact />
          </div>

          <div className="footer-col">
            <h4>{t.footer.product}</h4>
            <button onClick={() => jump('funzioni')}>{t.nav.features}</button>
            <button onClick={() => jump('demo')}>{t.nav.demo}</button>
            <button onClick={() => jump('prezzi')}>{t.nav.pricing}</button>
            <button onClick={onStart}>{t.nav.login}</button>
          </div>

          <div className="footer-col">
            <h4>{t.footer.resources}</h4>
            <button onClick={() => jump('come-funziona')}>{t.nav.how}</button>
            <button onClick={() => jump('domande')}>{t.nav.faq}</button>
            <button onClick={() => jump('demo')}>{t.footer.codeExamples}</button>
          </div>

          <div className="footer-col">
            <h4>{t.footer.getStarted}</h4>
            <button className="footer-cta" onClick={onStart}>{t.footer.createAccount}</button>
            <span className="footer-note">{t.footer.note}</span>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {year} K AI Code</span>
          <span className="footer-dot">·</span>
          <span>{t.footer.madeFor}</span>
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
  const { t } = useI18n();
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
        transition={springSnappy}
      >
        <button className="modal-close" onClick={onClose} aria-label={t.common.close}>×</button>
        <Suspense fallback={<div className="dm-loading" aria-label={t.demoPlayer.loading} />}>
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
  const { t } = useI18n();
  const [video, setVideo] = useState(false);

  // La classe `landing-mode` su <html> la imposta App: averla anche qui
  // significava due effetti che si salvavano e ripristinavano a vicenda
  // `className`, con l'ordine dei cleanup che lasciava la classe attaccata
  // passando al login — e `landing-mode` azzera l'altezza di html/body,
  // facendo collassare la schermata di accesso.
  const openDemo = useMemo(() => () => setVideo(true), []);

  return (
    <div className="lp">
      <a className="skip-link" href="#funzioni">{t.common.skipToContent}</a>
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
