import type { ReactNode } from 'react';

/**
 * Set di icone SVG inline.
 *
 * Inline invece di lucide-react per le icone usate nella landing: evita di
 * caricare un pacchetto intero per una dozzina di glifi, e ogni icona eredita
 * `currentColor` così segue automaticamente il tema attivo.
 */

const s = (children: ReactNode, size = 20, stroke = 1.7) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const Icon = {
  plugin: s(<><path d="M9 3v4M15 3v4" /><path d="M6 7h12v6a6 6 0 01-12 0z" /><path d="M12 19v3" /></>),
  mod: s(<><path d="M12 2l8 4.5v9L12 20l-8-4.5v-9z" /><path d="M12 20V11M4 6.5l8 4.5 8-4.5" /></>),
  bug: s(<><rect x="8" y="7" width="8" height="12" rx="4" /><path d="M8 11H4M20 11h-4M8 16H4.5M20 16h-3.5M9 7l-1.5-3M15 7l1.5-3" /></>),
  zip: s(<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" /></>),
  image: s(<><rect x="3" y="3" width="18" height="18" rx="2.5" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></>),
  lang: s(<><path d="M8 7l-5 5 5 5M16 7l5 5-5 5" /><path d="M13.5 4l-3 16" /></>),
  shield: s(<><path d="M12 3l8 3v6c0 4.5-3.2 8.3-8 9.5C7.2 20.3 4 16.5 4 12V6z" /><path d="M9.5 12l1.8 1.8 3.5-3.6" /></>),
  bolt: s(<><path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z" /></>),
  check: s(<path d="M20 6L9 17l-5-5" />, 20, 2.4),
  arrow: s(<><path d="M5 12h13" /><path d="M12 5l7 7-7 7" /></>),
  chevron: s(<path d="M6 9l6 6 6-6" />, 20, 2.2),
  play: s(<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none" />),
  sparkle: s(<><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" /><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></>),
  terminal: s(<><rect x="2.5" y="4" width="19" height="16" rx="2.5" /><path d="M7 9.5l3 2.5-3 2.5M13 15h4" /></>),
  layers: s(<><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5M3 17l9 5 9-5" /></>),
  clock: s(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.2 2" /></>),
  users: s(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0" /><path d="M16 5.2a3.5 3.5 0 010 5.6M18 20a6.5 6.5 0 00-2-4.7" /></>),
  lock: s(<><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 018 0v3" /></>),
  menu: s(<path d="M4 7h16M4 12h16M4 17h16" />, 22, 2),
  close: s(<path d="M6 6l12 12M18 6L6 18" />, 22, 2),
  github: s(
    <path
      d="M12 2a10 10 0 00-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 015 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0012 2z"
      fill="currentColor"
      stroke="none"
    />
  ),
  discord: s(
    <path
      d="M19.3 5.4A16.5 16.5 0 0015.2 4l-.3.6a12.5 12.5 0 00-5.8 0L8.8 4a16.5 16.5 0 00-4.1 1.4C2 9.5 1.3 13.5 1.7 17.4a16.6 16.6 0 005 2.6l.6-1.1a10.8 10.8 0 01-1.9-.9l.5-.4a11.8 11.8 0 0010.2 0l.5.4c-.6.4-1.2.7-1.9.9l.6 1.1a16.5 16.5 0 005-2.6c.5-4.5-.6-8.5-2.9-12zM8.7 14.9c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"
      fill="currentColor"
      stroke="none"
    />
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof Icon;
