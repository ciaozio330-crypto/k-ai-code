/**
 * Sorgente unica per piani, prezzi e contenuti di marketing.
 *
 * Prima questi dati vivevano dentro App.tsx; la landing li usa negli stessi
 * termini, quindi tenerli qui evita che le due pagine mostrino prezzi diversi
 * dopo una modifica fatta a metà.
 */

export interface Plan {
  id: string;
  name: string;
  price: string;
  cap4h: number;
  week: number | null;
  desc: string;
  /** Punti elenco extra mostrati solo nella landing */
  highlights?: string[];
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '0',
    cap4h: 15000,
    week: 50000,
    desc: 'Per provare. Cap basso con tetto settimanale.',
    highlights: ['Nessuna carta richiesta', 'Tutte le funzioni base', 'Export ZIP incluso'],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '15',
    cap4h: 40000,
    week: 200000,
    desc: 'Per iniziare. Qualche reset durante la giornata.',
    highlights: ['Analisi immagini', 'Cronologia illimitata', 'Supporto via email'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '60',
    cap4h: 120000,
    week: null,
    desc: 'Molti token. Lavori quotidiani senza pensieri.',
    highlights: ['Nessun tetto settimanale', 'Risposte prioritarie', 'Progetti multi-file'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '140',
    cap4h: 280000,
    week: null,
    desc: 'Lavori complessi senza cap, salvo raffiche intense.',
    highlights: ['Massimo throughput singolo', 'Supporto prioritario', 'Contesto esteso'],
  },
];

export interface Team {
  id: string;
  name: string;
  price: string;
  cap4h: number;
  seats: number;
  desc: string;
}

export const TEAMS: Team[] = [
  { id: 'team_low', name: 'Team Low', price: '200', cap4h: 420000, seats: 3, desc: 'Più potenza dell\'Enterprise, per team piccoli.' },
  { id: 'team_medium', name: 'Team Medium', price: '300', cap4h: 600000, seats: 6, desc: 'Più token del Low, per team in crescita.' },
  { id: 'team_max', name: 'Team Max', price: '400', cap4h: 850000, seats: 10, desc: 'Massima potenza condivisa per tutto il network.' },
];

export const PLAN_NAMES: Record<string, string> = {
  free: 'Free', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise',
  team_low: 'Team Low', team_medium: 'Team Medium', team_max: 'Team Max',
};

export const FLAVOR_ACCENT: Record<string, { primary: string; wire: string; bg: string }> = {
  elegant: { primary: '#34d3b8', wire: 'rgba(52, 211, 184, 0.3)', bg: '#0a0c0f' },
  vivid: { primary: '#6d5cff', wire: 'rgba(109, 92, 255, 0.28)', bg: '#f6f7f9' },
  terminal: { primary: '#3ff0a0', wire: 'rgba(63, 240, 160, 0.3)', bg: '#060907' },
};

/* ------------------------------------------------------------------ */
/*  Contenuti della landing                                            */
/* ------------------------------------------------------------------ */

export interface Feature {
  icon: string;
  title: string;
  body: string;
  /** Dimensione nella griglia bento */
  span?: 'wide' | 'tall' | 'normal';
}

/**
 * L'ordine e gli `span` non sono casuali: la griglia è a 3 colonne e ogni
 * card `wide` ne occupa 2. Il totale delle unità (9 card, 3 wide = 12) è
 * divisibile per 3, così l'ultima riga risulta piena invece di lasciare
 * un buco. Aggiungendo o togliendo voci va ricontrollata questa somma.
 */
export const FEATURES: Feature[] = [
  {
    icon: 'plugin',
    title: 'Plugin Spigot, Paper e Bukkit',
    body: 'Event handler, comandi, config YAML, GUI a inventario, integrazione database. Conosce le API di ogni versione, dalla 1.8 alla 1.21, e sa quali metodi sono deprecati.',
    span: 'wide',
  },
  {
    icon: 'mod',
    title: 'Mod Fabric e Forge',
    body: 'Blocchi, item, entità, mixin e datagen. Mappature aggiornate e boilerplate corretto al primo colpo.',
  },
  {
    icon: 'bug',
    title: 'Debug dello stack trace',
    body: 'Incolla l\'errore della console: risale alla causa reale, non alla riga che è esplosa.',
  },
  {
    icon: 'zip',
    title: 'Export dei progetti in ZIP',
    body: 'Ogni risposta con più file diventa un archivio scaricabile con la struttura di cartelle già pronta per l\'IDE.',
  },
  {
    icon: 'image',
    title: 'Capisce gli screenshot',
    body: 'Manda la foto di un errore, di una GUI storta o di un blocco di codice: legge le immagini e risponde sul merito.',
  },
  {
    icon: 'lang',
    title: 'Non solo Minecraft',
    body: 'Java, Kotlin, Python, TypeScript, Rust, Go, SQL, shell. Sotto c\'è un modello di programmazione generalista, non un assistente che sa fare una cosa sola.',
    span: 'wide',
  },
  {
    icon: 'shield',
    title: 'Ottimizzazione e sicurezza',
    body: 'Individua query in loop, task sincroni che bloccano il tick, permessi mancanti e falle di validazione input.',
  },
  {
    icon: 'users',
    title: 'Parla italiano, davvero',
    body: 'Spiegazioni e commenti in italiano corrente, senza traduzioni maldestre dei termini tecnici. Se preferisci l\'inglese, si cambia in un click dalle impostazioni.',
    span: 'wide',
  },
  {
    icon: 'bolt',
    title: 'Risposte in streaming',
    body: 'Il testo arriva mentre viene generato. Niente attese davanti a uno spinner.',
  },
];

export interface Step {
  n: string;
  title: string;
  body: string;
}

export const STEPS: Step[] = [
  {
    n: '01',
    title: 'Descrivi cosa ti serve',
    body: 'In italiano, come lo spiegheresti a un collega. "Un plugin che dà kit ai nuovi giocatori con cooldown di 24 ore." Nessuna sintassi speciale da imparare.',
  },
  {
    n: '02',
    title: 'Ricevi codice completo',
    body: 'Non frammenti da incollare a caso: file interi, con package corretto, import risolti, plugin.yml e commenti dove serve capire il perché.',
  },
  {
    n: '03',
    title: 'Scarica, compila, itera',
    body: 'Un click e hai lo ZIP pronto per l\'IDE. Se qualcosa non torna, incolli l\'errore e si continua nella stessa conversazione.',
  },
];

export interface Faq {
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  {
    q: 'Serve saper programmare per usarlo?',
    a: 'Aiuta, ma non è indispensabile. Puoi descrivere cosa vuoi ottenere in italiano corrente e ricevere codice funzionante con le spiegazioni. Detto onestamente: per mettere in produzione un plugin su un server con giocatori veri, saper leggere quello che stai installando resta la cosa più sensata.',
  },
  {
    q: 'Come funzionano esattamente i token?',
    a: 'Ogni messaggio consuma token, in entrata (quello che scrivi tu più il contesto della conversazione) e in uscita (la risposta). Il tuo piano definisce quanti ne hai in una finestra di 4 ore, che si ricarica completamente allo scadere. Free e Starter hanno anche un tetto settimanale; dal Pro in su no.',
  },
  {
    q: 'Che differenza c\'è con ChatGPT o Copilot?',
    a: 'La specializzazione e il formato di output. K AI Code conosce le API di Bukkit, Paper, Fabric e Forge nel dettaglio, sa quali metodi sono deprecati in quale versione, ed esporta progetti multi-file già strutturati in ZIP. Per il codice generalista le differenze si assottigliano.',
  },
  {
    q: 'Il mio codice viene usato per addestrare modelli?',
    a: 'No. Le conversazioni vengono salvate solo per darti la cronologia nel tuo account e puoi cancellarle quando vuoi, singolarmente o eliminando l\'account. Non alimentano alcun addestramento.',
  },
  {
    q: 'Posso cambiare o disdire il piano?',
    a: 'Sì, in qualsiasi momento dalle impostazioni di fatturazione. Il cambio è immediato e non ci sono vincoli di durata minima né penali di uscita.',
  },
  {
    q: 'Supporta versioni vecchie di Minecraft?',
    a: 'Sì. Se lavori su 1.8.8 per un server PvP legacy, dillo nel messaggio o mettilo nelle istruzioni personalizzate: userà le API di quella versione invece di quelle moderne.',
  },
  {
    q: 'Che succede se finisco i token a metà lavoro?',
    a: 'La conversazione resta salvata e riprende esattamente da dov\'era quando la finestra si ricarica. Non perdi niente. Nell\'interfaccia vedi sempre quanti token restano e tra quanto avviene il reset.',
  },
  {
    q: 'Funziona anche per team e network?',
    a: 'Sì, i piani Team includono da 3 a 10 postazioni con un pacchetto di token condiviso e fatturazione unica. È pensato per network dove più sviluppatori lavorano sugli stessi progetti.',
  },
];

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  initials: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote: 'Avevo un memory leak che mi tirava giù il server ogni due giorni. Ho incollato il thread dump e in tre messaggi avevo capito che tenevo riferimenti a entità rimosse in una HashMap statica.',
    name: 'Marco T.',
    role: 'Admin, network survival',
    initials: 'MT',
  },
  {
    quote: 'Il porting da Spigot 1.16 a Paper 1.21 me lo aspettavo come una settimana di lavoro. È diventato un pomeriggio, con l\'export ZIP che mi ha risparmiato tutta la parte noiosa di ricreare la struttura.',
    name: 'Giulia R.',
    role: 'Sviluppatrice plugin freelance',
    initials: 'GR',
  },
  {
    quote: 'Uso il piano Team con altri due sviluppatori. La cosa che ci ha convinti è che risponde in italiano senza tradurre male i termini tecnici, cosa che altri strumenti sbagliano di continuo.',
    name: 'Davide P.',
    role: 'Lead dev, network minigiochi',
    initials: 'DP',
  },
  {
    quote: 'Da mod Fabric non sapevo nulla. Ho chiesto un minerale custom con generazione nel mondo e mi ha dato blocco, item, tag, loot table e datagen. Tutto compilato al primo tentativo.',
    name: 'Luca B.',
    role: 'Sviluppatore mod',
    initials: 'LB',
  },
];

export interface Lang {
  name: string;
  note: string;
}

export const LANGS: Lang[] = [
  { name: 'Java', note: 'Bukkit · Paper · Forge' },
  { name: 'Kotlin', note: 'Plugin moderni' },
  { name: 'Python', note: 'Script e automazioni' },
  { name: 'TypeScript', note: 'Dashboard e bot' },
  { name: 'YAML', note: 'config · plugin.yml' },
  { name: 'SQL', note: 'MySQL · SQLite' },
  { name: 'Rust', note: 'Tool performanti' },
  { name: 'Go', note: 'Proxy e servizi' },
  { name: 'Shell', note: 'Deploy e backup' },
  { name: 'Gradle', note: 'Build multi-modulo' },
];

/** Snippet mostrati nella demo animata della hero. */
export const DEMO_TURNS = [
  {
    user: 'Fammi un plugin Paper 1.21: quando un giocatore rompe un diamante, avvisa lo staff con le coordinate.',
    lang: 'java',
    file: 'DiamondAlert.java',
    code: `@EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
public void onBreak(BlockBreakEvent event) {
    if (event.getBlock().getType() != Material.DIAMOND_ORE) return;

    Player player = event.getPlayer();
    Location loc = event.getBlock().getLocation();

    Component alert = Component.text()
        .append(Component.text("[Ore] ", NamedTextColor.AQUA))
        .append(Component.text(player.getName(), NamedTextColor.WHITE))
        .append(Component.text(" → diamante a ", NamedTextColor.GRAY))
        .append(Component.text(fmt(loc), NamedTextColor.YELLOW))
        .build();

    Bukkit.getOnlinePlayers().stream()
        .filter(p -> p.hasPermission("orealert.notify"))
        .forEach(staff -> staff.sendMessage(alert));
}`,
    note: 'Uso `MONITOR` perché l\'evento va solo osservato, e `ignoreCancelled` così le protezioni WorldGuard hanno la precedenza.',
  },
];
