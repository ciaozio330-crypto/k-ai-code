import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LOCALES, LOCALE_LIST, useI18n } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';
import { tQuick } from '@/lib/motion';

/**
 * Selettore di lingua.
 *
 * Il menu è un semplice popover invece di una `<select>` nativa perché deve
 * stare accanto agli altri bottoni della barra senza portarsi dietro il
 * widget di sistema, che su Windows non si lascia ridisegnare. In cambio
 * vanno gestiti a mano Escape, il click fuori e il ritorno del focus.
 *
 * L'etichetta di ogni voce è scritta nella lingua stessa, non tradotta: chi
 * ha aperto il sito nella lingua sbagliata sta cercando "Deutsch", non
 * "Tedesco".
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (l: Locale) => {
    setLocale(l);
    setOpen(false);
    btnRef.current?.focus();
  };

  return (
    <div className={compact ? 'lang-switch compact' : 'lang-switch'} ref={boxRef}>
      <button
        ref={btnRef}
        type="button"
        className="lang-switch-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={LOCALES[locale].label}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" />
        </svg>
        <span className="lang-switch-code">{LOCALES[locale].flag}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            className="lang-menu"
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={tQuick}
          >
            {LOCALE_LIST.map((l) => (
              <li key={l}>
                <button
                  type="button"
                  role="option"
                  aria-selected={l === locale}
                  className={l === locale ? 'lang-opt on' : 'lang-opt'}
                  onClick={() => pick(l)}
                >
                  <span className="lang-opt-code">{LOCALES[l].flag}</span>
                  <span className="lang-opt-label">{LOCALES[l].label}</span>
                  {l === locale && (
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export default LanguageSwitcher;
