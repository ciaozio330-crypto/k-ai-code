import { memo, useMemo, useState } from 'react';
import { tokenizeBlock, langLabel } from '@/lib/highlight';
import { useCopy } from '@/lib/hooks';

interface CodeBlockProps {
  code: string;
  lang?: string;
  /** Nome file mostrato al posto dell'etichetta linguaggio */
  filename?: string;
  /** Nasconde i numeri di riga (utile per snippet di una riga) */
  noLineNumbers?: boolean;
  /** Righe da evidenziare, 1-indexed */
  highlightLines?: number[];
  /** Altezza massima prima dello scroll interno */
  maxHeight?: number;
  onDownload?: () => void;
}

/**
 * Blocco di codice con evidenziazione della sintassi.
 *
 * `memo` + `useMemo` sulla tokenizzazione sono importanti qui: durante lo
 * streaming di una risposta il componente padre ri-renderizza a ogni chunk,
 * ma i blocchi di codice già completi non cambiano e non vanno ri-tokenizzati.
 */
export const CodeBlock = memo(function CodeBlock({
  code,
  lang = '',
  filename,
  noLineNumbers = false,
  highlightLines,
  maxHeight,
  onDownload,
}: CodeBlockProps) {
  const { copied, copy } = useCopy();
  const [wrapped, setWrapped] = useState(false);

  const lines = useMemo(() => tokenizeBlock(code), [code]);
  const hl = useMemo(() => new Set(highlightLines || []), [highlightLines]);
  const label = filename || langLabel(lang);
  const lineCount = lines.length;

  return (
    <div className="code-card">
      <div className="code-head">
        <span className="code-dots" aria-hidden="true">
          <i /><i /><i />
        </span>
        <span className="fn">{label}</span>
        {!filename && lang && <span className="lg">{lineCount} righe</span>}
        <span className="act">
          <button
            className="code-btn"
            onClick={() => setWrapped((w) => !w)}
            title={wrapped ? 'Non andare a capo' : 'Vai a capo'}
            aria-pressed={wrapped}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M3 12h13a4 4 0 010 8h-3M3 18h4" />
              <path d="M16 16l-3 2 3 2" />
            </svg>
          </button>
          {onDownload && (
            <button className="code-btn" onClick={onDownload} title="Scarica questo file">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
            </button>
          )}
          <button
            className={copied ? 'code-btn copied' : 'code-btn'}
            onClick={() => copy(code)}
            title="Copia il codice"
          >
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Copiato
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="12" height="12" rx="2.5" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                Copia
              </>
            )}
          </button>
        </span>
      </div>

      <div
        className={wrapped ? 'code-body wrap' : 'code-body'}
        style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
      >
        {lines.map((tokens, i) => (
          <div className={hl.has(i + 1) ? 'cl hl' : 'cl'} key={i}>
            {!noLineNumbers && <span className="n">{i + 1}</span>}
            <span className="ln">
              {tokens.length === 0
                ? ' '
                : tokens.map((t, j) => (
                    <span className={`t-${t.kind}`} key={j}>
                      {t.value}
                    </span>
                  ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

export default CodeBlock;
