import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';

export interface Command {
  id: string;
  title: string;
  subtitle?: string;
  group: string;
  icon?: ReactNode;
  keywords?: string;
  shortcut?: string;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

/**
 * Punteggio di corrispondenza fuzzy.
 *
 * Non è un fuzzy match completo alla fzf: privilegia i prefissi e le
 * corrispondenze di parola, che è ciò che serve quando le voci sono titoli
 * di conversazione e nomi di azioni. Ritorna -1 se non c'è corrispondenza.
 */
function score(text: string, query: string): number {
  if (!query) return 0;
  const t = text.toLowerCase();
  const q = query.toLowerCase();

  const idx = t.indexOf(q);
  if (idx === 0) return 1000;                       // prefisso esatto
  if (idx > 0) {
    // bonus se la corrispondenza inizia a inizio parola
    const boundary = idx > 0 && /[\s\-_/.]/.test(t[idx - 1]);
    return (boundary ? 700 : 500) - idx;
  }

  // fallback: tutti i caratteri della query in ordine, non contigui
  let ti = 0;
  let hits = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return -1;
    ti = found + 1;
    hits++;
  }
  return 200 - (ti - hits);
}

export function CommandPalette({ open, onClose, commands }: Props) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Reset a ogni apertura: riaprire la palette deve dare uno stato pulito
  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      // requestAnimationFrame: l'input esiste solo dopo il primo paint
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) return commands;
    return commands
      .map((c) => ({ c, s: Math.max(score(c.title, query), score(c.keywords || '', query) - 60) }))
      .filter((r) => r.s > -1)
      .sort((a, b) => b.s - a.s)
      .map((r) => r.c);
  }, [commands, query]);

  // Il cursore non deve restare oltre la fine dopo un filtro più stretto
  useEffect(() => { setCursor(0); }, [query]);

  // Tiene la voce selezionata dentro l'area visibile durante la navigazione
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('.cmdk-item.on');
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor, results.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => (results.length ? (c + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => (results.length ? (c - 1 + results.length) % results.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = results[cursor];
        if (cmd) { onClose(); cmd.run(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, results, cursor, onClose]);

  // Raggruppa mantenendo l'ordine di comparsa dei gruppi nei risultati
  const grouped = useMemo(() => {
    const map = new Map<string, { cmd: Command; index: number }[]>();
    results.forEach((cmd, index) => {
      const arr = map.get(cmd.group) || [];
      arr.push({ cmd, index });
      map.set(cmd.group, arr);
    });
    return [...map.entries()];
  }, [results]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cmdk-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onClick={onClose}
        >
          <motion.div
            className="cmdk"
            role="dialog"
            aria-modal="true"
            aria-label="Palette comandi"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.97, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -6 }}
            transition={{ type: 'spring', stiffness: 460, damping: 36 }}
          >
            <div className="cmdk-search">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-4.3-4.3" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca conversazioni o esegui un'azione…"
                aria-label="Cerca"
                autoComplete="off"
                spellCheck={false}
              />
              <span className="cmdk-esc">esc</span>
            </div>

            <div className="cmdk-list" ref={listRef}>
              {results.length === 0 ? (
                <div className="cmdk-empty">Nessun risultato per «{query}»</div>
              ) : (
                grouped.map(([group, entries]) => (
                  <div key={group}>
                    <div className="cmdk-group">{group}</div>
                    {entries.map(({ cmd, index }) => (
                      <button
                        key={cmd.id}
                        className={index === cursor ? 'cmdk-item on' : 'cmdk-item'}
                        onMouseEnter={() => setCursor(index)}
                        onClick={() => { onClose(); cmd.run(); }}
                      >
                        {cmd.icon && <span className="cmdk-ico">{cmd.icon}</span>}
                        <span className="cmdk-text">
                          <span className="cmdk-title">{cmd.title}</span>
                          {cmd.subtitle && <span className="cmdk-sub">{cmd.subtitle}</span>}
                        </span>
                        {cmd.shortcut && <span className="cmdk-kbd">{cmd.shortcut}</span>}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>

            <div className="cmdk-foot">
              <span className="cmdk-hint"><b>↑</b><b>↓</b> naviga</span>
              <span className="cmdk-hint"><b>↵</b> apri</span>
              <span className="cmdk-hint"><b>esc</b> chiudi</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CommandPalette;
