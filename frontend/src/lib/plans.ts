/**
 * Sorgente unica per piani, prezzi e struttura dei contenuti di marketing.
 *
 * Qui resta solo ciò che NON si traduce: identificativi, prezzi, soglie di
 * token, nomi propri, icone e sorgenti di codice. Ogni testo destinato a
 * essere letto vive nei dizionari in `src/locales`, indicizzato per `id` o
 * per posizione — così aggiungere una lingua non richiede di toccare questo
 * file, e cambiare un prezzo non richiede di toccarne sei.
 */

export interface Plan {
  id: string;
  name: string;
  price: string;
  cap4h: number;
  week: number | null;
}

export const PLANS: Plan[] = [
  { id: 'free', name: 'Free', price: '0', cap4h: 15000, week: 50000 },
  { id: 'starter', name: 'Starter', price: '15', cap4h: 40000, week: 200000 },
  { id: 'pro', name: 'Pro', price: '60', cap4h: 120000, week: null },
  { id: 'enterprise', name: 'Enterprise', price: '140', cap4h: 280000, week: null },
];

export interface Team {
  id: string;
  name: string;
  price: string;
  cap4h: number;
  seats: number;
}

export const TEAMS: Team[] = [
  { id: 'team_low', name: 'Team Low', price: '200', cap4h: 420000, seats: 3 },
  { id: 'team_medium', name: 'Team Medium', price: '300', cap4h: 600000, seats: 6 },
  { id: 'team_max', name: 'Team Max', price: '400', cap4h: 850000, seats: 10 },
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
/*  Struttura dei contenuti della landing                              */
/* ------------------------------------------------------------------ */

/**
 * Icona e taglia di ogni card della griglia bento, nello stesso ordine di
 * `features.items` nei dizionari.
 *
 * L'ordine e gli `span` non sono casuali: la griglia è a 3 colonne e ogni
 * card `wide` ne occupa 2. Il totale delle unità (9 card, 3 wide = 12) è
 * divisibile per 3, così l'ultima riga risulta piena invece di lasciare
 * un buco. Aggiungendo o togliendo voci va ricontrollata questa somma.
 */
export interface FeatureMeta {
  icon: string;
  span?: 'wide' | 'tall' | 'normal';
}

export const FEATURE_META: FeatureMeta[] = [
  { icon: 'plugin', span: 'wide' },
  { icon: 'mod' },
  { icon: 'bug' },
  { icon: 'zip' },
  { icon: 'image' },
  { icon: 'lang', span: 'wide' },
  { icon: 'shield' },
  { icon: 'users', span: 'wide' },
  { icon: 'bolt' },
];

/** I nomi restano identici in ogni lingua; la nota accanto no. */
export const TESTIMONIAL_PEOPLE = [
  { name: 'Marco T.', initials: 'MT' },
  { name: 'Giulia R.', initials: 'GR' },
  { name: 'Davide P.', initials: 'DP' },
  { name: 'Luca B.', initials: 'LB' },
];

/** Chiavi di `langs` nel dizionario, nell'ordine in cui scorrono nel marquee. */
export const LANG_KEYS = [
  'java', 'kotlin', 'python', 'typescript', 'yaml',
  'sql', 'rust', 'go', 'shell', 'gradle',
] as const;

export const LANG_LABELS: Record<(typeof LANG_KEYS)[number], string> = {
  java: 'Java', kotlin: 'Kotlin', python: 'Python', typescript: 'TypeScript',
  yaml: 'YAML', sql: 'SQL', rust: 'Rust', go: 'Go', shell: 'Shell', gradle: 'Gradle',
};

/** Snippet mostrato nella demo animata della hero. Il codice non si traduce. */
export const DEMO_TURN = {
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
};

/** Sorgenti dei tre casi dello showcase, nell'ordine di `showcase.tabs`. */
export const SHOWCASE_SOURCES = [
  {
    lang: 'java',
    file: 'QuitListener.java',
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
  },
  {
    lang: 'yaml',
    file: 'config.yml',
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
  },
  {
    lang: 'java',
    file: 'JoinListener.java',
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
  },
];
