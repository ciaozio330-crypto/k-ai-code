import { parseBlocks, parseInline } from '../src/lib/markdown.ts';

let pass = 0, fail = 0;
const t = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; }
  else { fail++; console.log(`FAIL ${name}\n  atteso: ${e}\n  ottenuto: ${a}`); }
};

// --- liste ordinate vs puntate (il bug originale) ---
const ol = parseBlocks('1. primo\n2. secondo\n3. terzo')[0];
t('lista ordinata riconosciuta', ol.type + ':' + ol.ordered, 'list:true');
t('lista ordinata: voci', ol.items.length, 3);
const ul = parseBlocks('- a\n- b')[0];
t('lista puntata resta puntata', ul.ordered, false);
t('numerazione parte da 3', parseBlocks('3. tre\n4. quattro')[0].start, 3);

// --- link ---
const lk = parseInline('vedi [la guida](https://esempio.it/x) qui');
t('link testo+href', [lk[1].type, lk[1].href], ['link','https://esempio.it/x']);
const bad = parseInline('[click](javascript:alert(1))');
t('javascript: rifiutato', bad.every(n => n.type !== 'link'), true);
const bare = parseInline('vai su https://paper.io/docs.');
t('url nudo, punto escluso', bare.find(n=>n.type==='link')?.href, 'https://paper.io/docs');

// --- inline vari ---
t('grassetto', parseInline('**forte**')[0].type, 'strong');
t('barrato', parseInline('~~via~~')[0].type, 'del');
t('codice inline vince', parseInline('`a*b*c`')[0].value, 'a*b*c');
const snake = parseInline('la var my_nome_var qui');
t('underscore in identificatori non e corsivo', snake.every(n=>n.type!=='em'), true);

// --- tabella ---
const tb = parseBlocks('| Metodo | Da |\n|---|---:|\n| getX | 1.8 |\n| getY | 1.13 |')[0];
t('tabella riconosciuta', tb.type, 'table');
t('tabella: colonne', tb.head.length, 2);
t('tabella: righe', tb.rows.length, 2);
t('allineamento destro', tb.align[1], 'right');

// --- citazione, hr, titoli ---
t('citazione', parseBlocks('> nota importante')[0].type, 'quote');
t('linea orizzontale', parseBlocks('---')[0].type, 'hr');
t('titolo livello 3', parseBlocks('### Titolo')[0].level, 3);

// --- annidamento ---
const nested = parseBlocks('- padre\n  - figlio\n- altro')[0];
t('sotto-elenco agganciato', !!nested.items[0].sub, true);
t('voci di primo livello', nested.items.length, 2);

// --- robustezza: input che non deve rompere ---
t('vuoto', parseBlocks('').length, 0);
t('pipe solitaria non e tabella', parseBlocks('a | b')[0].type, 'paragraph');
t('asterisco spaiato', parseBlocks('2 * 3 = 6')[0].type, 'paragraph');
t('parentesi quadra sola', parseInline('array[0] vale 5').every(n=>n.type!=='link'), true);

console.log(`\n${pass} passati, ${fail} falliti`);
process.exit(fail ? 1 : 0);
