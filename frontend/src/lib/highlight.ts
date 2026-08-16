/**
 * Evidenziatore di sintassi leggero, senza dipendenze.
 *
 * Perché non Prism/Shiki: entrambi pesano centinaia di KB e questo progetto
 * mostra codice in streaming (token dopo token), quindi il tokenizer viene
 * rieseguito molte volte al secondo. Serviva qualcosa di O(n) su una sola
 * passata, senza allocazioni inutili e senza blocare il main thread.
 *
 * Copertura: le famiglie sintattiche che coprono ~tutto ciò che un dev
 * Minecraft incontra (Java/Kotlin, JS/TS, Python, YAML/JSON, SQL, shell).
 */

export type TokenKind =
  | 'plain'
  | 'comment'
  | 'string'
  | 'number'
  | 'keyword'
  | 'type'
  | 'func'
  | 'annotation'
  | 'operator'
  | 'punct'
  | 'property'
  | 'constant';

export interface Token {
  kind: TokenKind;
  value: string;
}

/** Parole chiave di controllo/dichiarazione, unione delle famiglie supportate. */
const KEYWORDS = new Set([
  // controllo di flusso — comune a quasi tutti i linguaggi
  'if', 'else', 'elif', 'for', 'while', 'do', 'switch', 'case', 'default',
  'break', 'continue', 'return', 'goto', 'yield', 'match', 'when',
  // gestione errori
  'try', 'catch', 'except', 'finally', 'throw', 'throws', 'raise', 'ensure', 'rescue',
  // dichiarazioni
  'class', 'interface', 'enum', 'record', 'struct', 'trait', 'impl', 'object',
  'function', 'fun', 'def', 'fn', 'func', 'var', 'let', 'const', 'val', 'lateinit',
  'type', 'typedef', 'namespace', 'module', 'package', 'import', 'from', 'export',
  'require', 'include', 'using', 'use', 'extends', 'implements', 'inherits',
  // modificatori
  'public', 'private', 'protected', 'internal', 'static', 'final', 'abstract',
  'override', 'open', 'sealed', 'virtual', 'synchronized', 'transient', 'volatile',
  'async', 'await', 'suspend', 'inline', 'operator', 'data', 'companion',
  'readonly', 'declare', 'extern', 'unsafe', 'mut', 'pub', 'crate',
  // operatori-parola
  'new', 'delete', 'instanceof', 'typeof', 'in', 'is', 'as', 'not', 'and', 'or',
  'with', 'pass', 'lambda', 'global', 'nonlocal', 'del', 'assert', 'where',
  // SQL (maiuscole gestite a parte, qui le minuscole)
  'select', 'insert', 'update', 'delete', 'where', 'join', 'group', 'order', 'having',
]);

/** Tipi primitivi e tipi standard riconosciuti trasversalmente. */
const TYPES = new Set([
  'int', 'long', 'short', 'byte', 'char', 'float', 'double', 'boolean', 'bool',
  'void', 'string', 'String', 'Integer', 'Long', 'Short', 'Byte', 'Character',
  'Float', 'Double', 'Boolean', 'Object', 'Number', 'BigInt', 'Symbol',
  'List', 'ArrayList', 'Map', 'HashMap', 'Set', 'HashSet', 'Array', 'Collection',
  'Optional', 'Stream', 'Iterable', 'Iterator', 'Comparable', 'Runnable',
  'Any', 'Unit', 'Nothing', 'Never', 'unknown', 'never', 'any', 'undefined',
  'Promise', 'Record', 'Partial', 'Readonly', 'Pick', 'Omit', 'Exclude',
  'usize', 'isize', 'u8', 'u16', 'u32', 'u64', 'i8', 'i16', 'i32', 'i64', 'f32', 'f64',
  'str', 'Vec', 'Box', 'Rc', 'Arc', 'Result', 'Option', 'Self',
]);

/** Costanti/letterali riservati. */
const CONSTANTS = new Set([
  'true', 'false', 'null', 'nil', 'None', 'True', 'False', 'undefined',
  'NaN', 'Infinity', 'this', 'self', 'super', 'it', 'NULL',
]);

const IDENT_START = /[A-Za-z_$]/;
const IDENT_PART = /[A-Za-z0-9_$]/;
const DIGIT = /[0-9]/;

/**
 * Tokenizza una singola riga.
 *
 * `inBlockComment` permette di propagare lo stato di un commento multi-riga
 * tra chiamate successive: la funzione ritorna anche lo stato di uscita, così
 * il chiamante può passarlo alla riga seguente senza rifare il parsing.
 */
export function tokenizeLine(
  line: string,
  inBlockComment = false
): { tokens: Token[]; inBlockComment: boolean } {
  const tokens: Token[] = [];
  const len = line.length;
  let i = 0;
  let block = inBlockComment;

  // Buffer per accumulare testo "plain" e non creare un token per carattere
  let plainStart = -1;
  const flushPlain = (end: number) => {
    if (plainStart >= 0 && end > plainStart) {
      tokens.push({ kind: 'plain', value: line.slice(plainStart, end) });
    }
    plainStart = -1;
  };
  const push = (kind: TokenKind, value: string) => {
    if (value) tokens.push({ kind, value });
  };

  // Continuazione di un commento a blocco aperto in una riga precedente
  if (block) {
    const close = line.indexOf('*/');
    if (close === -1) {
      return { tokens: [{ kind: 'comment', value: line }], inBlockComment: true };
    }
    push('comment', line.slice(0, close + 2));
    i = close + 2;
    block = false;
  }

  while (i < len) {
    const ch = line[i];
    const next = line[i + 1];

    // --- commenti di riga: // # -- ---
    if ((ch === '/' && next === '/') || ch === '#' || (ch === '-' && next === '-')) {
      flushPlain(i);
      push('comment', line.slice(i));
      i = len;
      break;
    }

    // --- commenti a blocco: /* ... */ ---
    if (ch === '/' && next === '*') {
      flushPlain(i);
      const close = line.indexOf('*/', i + 2);
      if (close === -1) {
        push('comment', line.slice(i));
        return { tokens, inBlockComment: true };
      }
      push('comment', line.slice(i, close + 2));
      i = close + 2;
      continue;
    }

    // --- stringhe: " ' ` con escape ---
    if (ch === '"' || ch === "'" || ch === '`') {
      flushPlain(i);
      const quote = ch;
      let j = i + 1;
      while (j < len) {
        if (line[j] === '\\') { j += 2; continue; }
        if (line[j] === quote) { j++; break; }
        j++;
      }
      push('string', line.slice(i, Math.min(j, len)));
      i = j;
      continue;
    }

    // --- annotazioni/decoratori: @EventHandler, @Override ---
    if (ch === '@' && next && IDENT_START.test(next)) {
      flushPlain(i);
      let j = i + 1;
      while (j < len && IDENT_PART.test(line[j])) j++;
      push('annotation', line.slice(i, j));
      i = j;
      continue;
    }

    // --- numeri: 42, 3.14, 0xFF, 1e-9, 100L, 0b1010 ---
    if (DIGIT.test(ch) || (ch === '.' && next && DIGIT.test(next))) {
      flushPlain(i);
      let j = i;
      if (ch === '0' && (next === 'x' || next === 'X' || next === 'b' || next === 'B')) {
        j += 2;
        while (j < len && /[0-9a-fA-F_]/.test(line[j])) j++;
      } else {
        while (j < len && /[0-9._]/.test(line[j])) j++;
        // esponente scientifico
        if (j < len && (line[j] === 'e' || line[j] === 'E')) {
          let k = j + 1;
          if (k < len && (line[k] === '+' || line[k] === '-')) k++;
          if (k < len && DIGIT.test(line[k])) {
            j = k;
            while (j < len && DIGIT.test(line[j])) j++;
          }
        }
      }
      // suffissi di tipo: L, f, d, u...
      while (j < len && /[LlFfDdUu]/.test(line[j])) j++;
      push('number', line.slice(i, j));
      i = j;
      continue;
    }

    // --- identificatori / parole chiave / chiamate di funzione ---
    if (IDENT_START.test(ch)) {
      flushPlain(i);
      let j = i;
      while (j < len && IDENT_PART.test(line[j])) j++;
      const word = line.slice(i, j);

      // guarda avanti saltando gli spazi: se segue '(' è una chiamata
      let k = j;
      while (k < len && line[k] === ' ') k++;
      const isCall = line[k] === '(';

      // guarda indietro: se preceduto da '.' è una proprietà/metodo
      let p = i - 1;
      while (p >= 0 && line[p] === ' ') p--;
      const isMember = p >= 0 && line[p] === '.';

      if (KEYWORDS.has(word)) push('keyword', word);
      else if (CONSTANTS.has(word)) push('constant', word);
      else if (isCall) push('func', word);
      else if (TYPES.has(word)) push('type', word);
      // SQL in maiuscolo (SELECT, FROM) o costanti tipo MAX_SIZE
      else if (word.length > 1 && word === word.toUpperCase() && /[A-Z]/.test(word)) push('constant', word);
      // Convenzione: PascalCase = tipo
      else if (/^[A-Z][a-z]/.test(word)) push('type', word);
      else if (isMember) push('property', word);
      else push('plain', word);

      i = j;
      continue;
    }

    // --- operatori ---
    if ('+-*/%=<>!&|^~?:'.includes(ch)) {
      flushPlain(i);
      let j = i;
      while (j < len && '+-*/%=<>!&|^~?:'.includes(line[j])) j++;
      push('operator', line.slice(i, j));
      i = j;
      continue;
    }

    // --- punteggiatura strutturale ---
    if ('()[]{},;.'.includes(ch)) {
      flushPlain(i);
      push('punct', ch);
      i++;
      continue;
    }

    // --- resto: accumula come plain ---
    if (plainStart < 0) plainStart = i;
    i++;
  }

  flushPlain(len);
  return { tokens, inBlockComment: block };
}

/**
 * Tokenizza un blocco intero mantenendo lo stato dei commenti tra le righe.
 * Ritorna un array di righe, ognuna come array di token.
 */
export function tokenizeBlock(code: string): Token[][] {
  const lines = code.split('\n');
  const out: Token[][] = [];
  let block = false;
  for (const line of lines) {
    const res = tokenizeLine(line, block);
    block = res.inBlockComment;
    out.push(res.tokens);
  }
  return out;
}

/** Estensione file → etichetta leggibile del linguaggio. */
export const LANG_LABEL: Record<string, string> = {
  js: 'JavaScript', javascript: 'JavaScript', jsx: 'JSX',
  ts: 'TypeScript', typescript: 'TypeScript', tsx: 'TSX',
  java: 'Java', kt: 'Kotlin', kotlin: 'Kotlin',
  py: 'Python', python: 'Python',
  json: 'JSON', yml: 'YAML', yaml: 'YAML', xml: 'XML', toml: 'TOML',
  html: 'HTML', css: 'CSS', scss: 'SCSS',
  sql: 'SQL', sh: 'Shell', bash: 'Shell', shell: 'Shell',
  go: 'Go', rs: 'Rust', rust: 'Rust', rb: 'Ruby', ruby: 'Ruby',
  php: 'PHP', cs: 'C#', csharp: 'C#', c: 'C', cpp: 'C++', 'c++': 'C++',
  swift: 'Swift', dart: 'Dart', gradle: 'Gradle', groovy: 'Groovy',
  md: 'Markdown', markdown: 'Markdown', properties: 'Properties',
  dockerfile: 'Dockerfile',
};

export function langLabel(lang: string): string {
  if (!lang) return 'Codice';
  return LANG_LABEL[lang.toLowerCase()] || lang;
}
