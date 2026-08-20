import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { it } from '@/locales/it';
import type { Dict } from '@/locales/it';

/**
 * Lingua dell'interfaccia.
 *
 * PERCHÉ NON LA NAZIONALITÀ
 * La tentazione è geolocalizzare l'IP, ma la nazione non è la lingua: un
 * italiano a Berlino vuole comunque l'italiano, e uno svizzero può volerne
 * tre diverse. `navigator.languages` è invece la preferenza che l'utente ha
 * già dichiarato al browser, in ordine di gradimento. È più accurata, non
 * richiede servizi esterni né latenza, e non tocca dati personali.
 *
 * Una scelta esplicita vince sempre sul rilevamento e viene ricordata: chi
 * ha cambiato lingua a mano non se la vede riscrivere al ritorno.
 */

export const LOCALES = {
  it: { label: 'Italiano', flag: 'IT' },
  en: { label: 'English', flag: 'EN' },
  es: { label: 'Español', flag: 'ES' },
  fr: { label: 'Français', flag: 'FR' },
  de: { label: 'Deutsch', flag: 'DE' },
  pt: { label: 'Português', flag: 'PT' },
} as const;

export type Locale = keyof typeof LOCALES;
export const LOCALE_LIST = Object.keys(LOCALES) as Locale[];

const STORAGE_KEY = 'kai_locale';

/** Inglese come ripiego: per una lingua non coperta è la scelta che esclude meno persone. */
const FALLBACK: Locale = 'en';

/**
 * Prima lingua preferita dal browser fra quelle disponibili.
 *
 * Confronta solo la parte primaria del tag: `pt-BR` e `pt-PT` puntano
 * entrambi a `pt`, che è il comportamento atteso — le differenze regionali
 * non giustificano due traduzioni separate qui.
 */
export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return FALLBACK;
  const wanted = navigator.languages?.length
    ? navigator.languages
    : [navigator.language || ''];
  for (const tag of wanted) {
    const primary = String(tag).toLowerCase().split('-')[0];
    if ((LOCALE_LIST as string[]).includes(primary)) return primary as Locale;
  }
  return FALLBACK;
}

function storedLocale(): Locale | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && (LOCALE_LIST as string[]).includes(v) ? (v as Locale) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */

interface I18nValue {
  locale: Locale;
  /** Il dizionario della lingua attiva. */
  t: Dict;
  setLocale: (l: Locale) => void;
  /** true se la lingua viene dal browser e non da una scelta dell'utente. */
  auto: boolean;
}

const Ctx = createContext<I18nValue | null>(null);

/**
 * I dizionari diversi dall'italiano si caricano a richiesta.
 *
 * Metterli tutti nel bundle iniziale significherebbe far scaricare a ognuno
 * sei traduzioni per usarne una. Italiano è incluso perché serve da tipo di
 * riferimento e da ripiego immediato mentre l'altro arriva.
 */
const loaders: Record<Locale, () => Promise<{ default: Dict }>> = {
  it: async () => ({ default: it }),
  en: () => import('@/locales/en').then((m) => ({ default: m.en })),
  es: () => import('@/locales/es').then((m) => ({ default: m.es })),
  fr: () => import('@/locales/fr').then((m) => ({ default: m.fr })),
  de: () => import('@/locales/de').then((m) => ({ default: m.de })),
  pt: () => import('@/locales/pt').then((m) => ({ default: m.pt })),
};

const cache: Partial<Record<Locale, Dict>> = { it };

export function I18nProvider({ children }: { children: ReactNode }) {
  const chosen = storedLocale();
  const [locale, setLocaleState] = useState<Locale>(() => chosen || detectLocale());
  const [auto, setAuto] = useState(!chosen);
  const [dict, setDict] = useState<Dict>(() => cache[locale] || it);

  useEffect(() => {
    let alive = true;
    if (cache[locale]) { setDict(cache[locale]!); return; }
    loaders[locale]()
      .then((m) => {
        cache[locale] = m.default;
        // La lingua può essere cambiata di nuovo mentre il file arrivava.
        if (alive) setDict(m.default);
      })
      .catch(() => { /* resta il dizionario corrente */ });
    return () => { alive = false; };
  }, [locale]);

  // `lang` sul documento serve a screen reader, sillabazione e traduttori.
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    setAuto(false);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* modalità privata */ }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ locale, t: dict, setLocale, auto }),
    [locale, dict, setLocale, auto]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n() va usato dentro <I18nProvider>');
  return ctx;
}

/** Scorciatoia per il solo dizionario, che è il caso più frequente. */
export function useT(): Dict {
  return useI18n().t;
}
