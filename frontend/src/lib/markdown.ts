/**
 * Parser Markdown per le risposte del modello.
 *
 * Il renderer precedente gestiva solo paragrafi, titoli e un unico tipo di
 * elenco: le liste numerate finivano nello stesso contenitore di quelle
 * puntate e uscivano con i pallini, i link restavano testo grezzo e le
 * tabelle si sfaldavano in righe di pipe. Sono tutte cose che un assistente
 * di programmazione produce di continuo.
 *
 * Restituisce un albero di nodi, non HTML: il rendering resta in React, così
 * non serve `dangerouslySetInnerHTML` e non c'è superficie per XSS quando il
 * modello riporta testo altrui (uno stack trace, un README, l'output di un
 * comando).
 */

/* ------------------------------------------------------------------ */
/*  Inline                                                             */
/* ------------------------------------------------------------------ */

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong'; children: InlineNode[] }
  | { type: 'em'; children: InlineNode[] }
  | { type: 'del'; children: InlineNode[] }
  | { type: 'link'; href: string; children: InlineNode[] };

/**
 * Protocolli ammessi nei link.
 *
 * `javascript:` e `data:` restano fuori: un modello che riporta contenuto di
 * terzi potrebbe ripeterli, e diventerebbero eseguibili al click.
 */
const SAFE_PROTOCOL = /^(https?:|mailto:|tel:|#|\/)/i;

function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (!href) return null;
  if (SAFE_PROTOCOL.test(href)) return href;
  // Un dominio nudo tipo "esempio.it/pagina" è comodo da linkare
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(href)) return 'https://' + href;
  return null;
}

/**
 * Trova la chiusura di un delimitatore tenendo conto dell'annidamento e
 * saltando il codice inline (dove `*` e `_` sono caratteri letterali).
 */
function findClose(src: string, from: number, marker: string): number {
  let i = from;
  while (i < src.length) {
    if (src[i] === '`') {
      const end = src.indexOf('`', i + 1);
      i = end === -1 ? src.length : end + 1;
      continue;
    }
    if (src.startsWith(marker, i)) return i;
    i++;
  }
  return -1;
}

export function parseInline(src: string): InlineNode[] {
  const out: InlineNode[] = [];
  let buf = '';
  let i = 0;

  const flush = () => {
    if (buf) { out.push({ type: 'text', value: buf }); buf = ''; }
  };

  while (i < src.length) {
    const ch = src[i];

    // --- codice inline: vince su tutto il resto ---
    if (ch === '`') {
      const end = src.indexOf('`', i + 1);
      if (end > i) {
        flush();
        out.push({ type: 'code', value: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    // --- link [testo](url) ---
    if (ch === '[') {
      const close = src.indexOf(']', i + 1);
      if (close > i && src[close + 1] === '(') {
        const paren = src.indexOf(')', close + 2);
        if (paren > close) {
          const href = safeHref(src.slice(close + 2, paren));
          if (href) {
            flush();
            out.push({ type: 'link', href, children: parseInline(src.slice(i + 1, close)) });
            i = paren + 1;
            continue;
          }
        }
      }
    }

    // --- grassetto ** e __ ---
    if ((ch === '*' && src[i + 1] === '*') || (ch === '_' && src[i + 1] === '_')) {
      const marker = src.slice(i, i + 2);
      const end = findClose(src, i + 2, marker);
      if (end > i + 2) {
        flush();
        out.push({ type: 'strong', children: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    // --- barrato ~~ ---
    if (ch === '~' && src[i + 1] === '~') {
      const end = findClose(src, i + 2, '~~');
      if (end > i + 2) {
        flush();
        out.push({ type: 'del', children: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    // --- corsivo * e _ ---
    // `_` solo a bordo di parola: altrimenti spezzerebbe nomi_come_questo,
    // che in codice e nei log sono ovunque.
    if (ch === '*' || (ch === '_' && (i === 0 || /[\s(]/.test(src[i - 1])))) {
      const end = findClose(src, i + 1, ch);
      if (end > i + 1 && src[end - 1] !== ' ') {
        flush();
        out.push({ type: 'em', children: parseInline(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    // --- URL nudi ---
    if ((ch === 'h' || ch === 'w') && /^(https?:\/\/|www\.)/i.test(src.slice(i))) {
      const m = /^(https?:\/\/|www\.)[^\s<>()[\]]+/i.exec(src.slice(i));
      if (m) {
        // La punteggiatura finale appartiene alla frase, non all'indirizzo
        const url = m[0].replace(/[.,;:!?]+$/, '');
        const href = safeHref(url);
        if (href) {
          flush();
          out.push({ type: 'link', href, children: [{ type: 'text', value: url }] });
          i += url.length;
          continue;
        }
      }
    }

    buf += ch;
    i++;
  }

  flush();
  return out;
}

/* ------------------------------------------------------------------ */
/*  Blocchi                                                            */
/* ------------------------------------------------------------------ */

export interface ListItem {
  children: InlineNode[];
  /** Sotto-elenco annidato, se presente */
  sub?: BlockNode;
}

export type BlockNode =
  | { type: 'paragraph'; lines: InlineNode[][] }
  | { type: 'heading'; level: number; children: InlineNode[] }
  | { type: 'list'; ordered: boolean; start: number; items: ListItem[] }
  | { type: 'quote'; blocks: BlockNode[] }
  | { type: 'table'; head: InlineNode[][]; rows: InlineNode[][][]; align: Align[] }
  | { type: 'hr' };

export type Align = 'left' | 'center' | 'right';

const RE_HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RE_BULLET = /^(\s*)[-*+]\s+(.*)$/;
const RE_ORDERED = /^(\s*)(\d{1,9})[.)]\s+(.*)$/;
const RE_QUOTE = /^ {0,3}>\s?(.*)$/;
const RE_HR = /^ {0,3}([-*_])\s*(?:\1\s*){2,}$/;
const RE_TABLE_SEP = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/;

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (s[i] === '|') { cells.push(cur.trim()); cur = ''; continue; }
    cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
}

function parseAlign(sep: string): Align[] {
  return splitRow(sep).map((c) => {
    const left = c.startsWith(':');
    const right = c.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    return 'left';
  });
}

/** Indentazione in colonne, con il tab che vale 4 spazi. */
function indentOf(ws: string): number {
  let n = 0;
  for (const c of ws) n += c === '\t' ? 4 : 1;
  return n;
}

export function parseBlocks(src: string): BlockNode[] {
  const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
  const blocks: BlockNode[] = [];
  let i = 0;
  let para: InlineNode[][] = [];

  const flushPara = () => {
    if (para.length) { blocks.push({ type: 'paragraph', lines: para }); para = []; }
  };

  while (i < lines.length) {
    const line = lines[i];

    // riga vuota
    if (!line.trim()) { flushPara(); i++; continue; }

    // linea orizzontale
    if (RE_HR.test(line)) { flushPara(); blocks.push({ type: 'hr' }); i++; continue; }

    // titolo
    const h = RE_HEADING.exec(line);
    if (h) {
      flushPara();
      blocks.push({ type: 'heading', level: h[1].length, children: parseInline(h[2]) });
      i++;
      continue;
    }

    // tabella: intestazione + riga di separazione
    if (line.includes('|') && i + 1 < lines.length && RE_TABLE_SEP.test(lines[i + 1])) {
      flushPara();
      const head = splitRow(line).map(parseInline);
      const align = parseAlign(lines[i + 1]);
      i += 2;
      const rows: InlineNode[][][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        const cells = splitRow(lines[i]).map(parseInline);
        // Normalizza al numero di colonne dell'intestazione: una riga più
        // corta o più lunga sfalserebbe la tabella.
        while (cells.length < head.length) cells.push([]);
        rows.push(cells.slice(0, head.length));
        i++;
      }
      blocks.push({ type: 'table', head, rows, align });
      continue;
    }

    // citazione
    if (RE_QUOTE.test(line)) {
      flushPara();
      const inner: string[] = [];
      while (i < lines.length) {
        const m = RE_QUOTE.exec(lines[i]);
        if (m) { inner.push(m[1]); i++; continue; }
        // una riga non vuota senza '>' continua la citazione (lazy)
        if (lines[i].trim() && !RE_HEADING.test(lines[i]) && !RE_BULLET.test(lines[i])) {
          inner.push(lines[i]); i++; continue;
        }
        break;
      }
      blocks.push({ type: 'quote', blocks: parseBlocks(inner.join('\n')) });
      continue;
    }

    // elenchi
    const bullet = RE_BULLET.exec(line);
    const ordered = RE_ORDERED.exec(line);
    if (bullet || ordered) {
      flushPara();
      const isOrdered = !!ordered;
      const baseIndent = indentOf((bullet ? bullet[1] : ordered![1]));
      const start = isOrdered ? parseInt(ordered![2], 10) : 1;
      const items: ListItem[] = [];

      while (i < lines.length) {
        const b = RE_BULLET.exec(lines[i]);
        const o = RE_ORDERED.exec(lines[i]);
        if (!b && !o) {
          // riga vuota seguita da un'altra voce: l'elenco prosegue
          if (!lines[i].trim() && i + 1 < lines.length &&
              (RE_BULLET.test(lines[i + 1]) || RE_ORDERED.test(lines[i + 1]))) {
            i++; continue;
          }
          break;
        }
        const ind = indentOf(b ? b[1] : o![1]);
        // Meno indentato del livello corrente: l'elenco è finito, torna al
        // chiamante che chiuderà il proprio.
        if (ind < baseIndent) break;

        if (ind > baseIndent) {
          // Raccogli il blocco annidato e passalo a una nuova parsata
          const subLines: string[] = [];
          while (i < lines.length) {
            const sb = RE_BULLET.exec(lines[i]);
            const so = RE_ORDERED.exec(lines[i]);
            if (!sb && !so) break;
            if (indentOf(sb ? sb[1] : so![1]) <= baseIndent) break;
            subLines.push(lines[i].slice(baseIndent + 1));
            i++;
          }
          const sub = parseBlocks(subLines.join('\n'))[0];
          if (items.length && sub) items[items.length - 1].sub = sub;
          continue;
        }

        // Un elenco puntato dentro uno numerato (o viceversa) è un elenco
        // nuovo, non la continuazione di questo.
        if (!!o !== isOrdered) break;

        items.push({ children: parseInline(b ? b[2] : o![3]) });
        i++;
      }

      blocks.push({ type: 'list', ordered: isOrdered, start, items });
      continue;
    }

    // paragrafo
    para.push(parseInline(line));
    i++;
  }

  flushPara();
  return blocks;
}
