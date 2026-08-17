import { Fragment, memo, useMemo } from 'react';
import type { ReactNode } from 'react';
import { parseBlocks } from '@/lib/markdown';
import type { BlockNode, InlineNode } from '@/lib/markdown';

/**
 * Rende l'albero prodotto da `parseBlocks`.
 *
 * Tutto passa da elementi React: nessun `dangerouslySetInnerHTML`, quindi
 * il testo che il modello riporta da fonti esterne non può iniettare markup.
 */

function renderInline(nodes: InlineNode[], keyBase: string): ReactNode[] {
  return nodes.map((n, i) => {
    const key = `${keyBase}-${i}`;
    switch (n.type) {
      case 'text':
        return <Fragment key={key}>{n.value}</Fragment>;
      case 'code':
        return <code className="inl-code" key={key}>{n.value}</code>;
      case 'strong':
        return <strong key={key}>{renderInline(n.children, key)}</strong>;
      case 'em':
        return <em key={key}>{renderInline(n.children, key)}</em>;
      case 'del':
        return <del key={key}>{renderInline(n.children, key)}</del>;
      case 'link':
        return (
          <a
            key={key}
            href={n.href}
            // I link nelle risposte puntano fuori dall'app: aprirli nella
            // stessa scheda farebbe perdere la conversazione in corso.
            // `noopener` impedisce alla pagina di destinazione di toccare
            // questa via `window.opener`.
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="md-link"
          >
            {renderInline(n.children, key)}
          </a>
        );
      default:
        return null;
    }
  });
}

function renderBlock(b: BlockNode, key: string): ReactNode {
  switch (b.type) {
    case 'heading': {
      // Livello visivo, non semantico: dentro la chat i titoli della risposta
      // non devono competere con la gerarchia dei titoli della pagina.
      const lvl = Math.min(b.level, 4);
      return (
        <div className={`md-h md-h${lvl}`} key={key} role="heading" aria-level={lvl + 2}>
          {renderInline(b.children, key)}
        </div>
      );
    }

    case 'paragraph':
      return (
        <p className="md-p" key={key}>
          {b.lines.map((ln, j) => (
            <Fragment key={j}>
              {renderInline(ln, `${key}-${j}`)}
              {j < b.lines.length - 1 ? <br /> : null}
            </Fragment>
          ))}
        </p>
      );

    case 'list': {
      const items = b.items.map((it, j) => (
        <li key={j}>
          {renderInline(it.children, `${key}-${j}`)}
          {it.sub ? renderBlock(it.sub, `${key}-${j}-sub`) : null}
        </li>
      ));
      return b.ordered ? (
        <ol className="md-ol" start={b.start} key={key}>{items}</ol>
      ) : (
        <ul className="md-ul" key={key}>{items}</ul>
      );
    }

    case 'quote':
      return (
        <blockquote className="md-quote" key={key}>
          {b.blocks.map((inner, j) => renderBlock(inner, `${key}-${j}`))}
        </blockquote>
      );

    case 'table':
      return (
        // Il wrapper scorre da solo: una tabella larga deve scorrere dentro
        // di sé, non allargare la colonna della conversazione.
        <div className="md-table-wrap" key={key}>
          <table className="md-table">
            <thead>
              <tr>
                {b.head.map((cell, j) => (
                  <th key={j} style={{ textAlign: b.align[j] || 'left' }}>
                    {renderInline(cell, `${key}-h${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} style={{ textAlign: b.align[c] || 'left' }}>
                      {renderInline(cell, `${key}-${r}-${c}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'hr':
      return <hr className="md-hr" key={key} />;

    default:
      return null;
  }
}

/**
 * `memo` + `useMemo`: durante lo streaming il componente padre ri-renderizza
 * a ogni chunk, ma i turni già completi non cambiano e non vanno ri-parsati.
 */
export const Prose = memo(function Prose({ text }: { text: string }) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  return <>{blocks.map((b, i) => renderBlock(b, String(i)))}</>;
});

export default Prose;
