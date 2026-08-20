import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';

/** Testi mostrati quando il render fallisce. */
interface Strings {
  title: string;
  body: string;
  reload: string;
  retry: string;
}

interface Props {
  children: ReactNode;
  /** Etichetta della zona protetta, mostrata nel messaggio di errore. */
  area?: string;
  strings: Strings;
}

interface State {
  error: Error | null;
}

/**
 * Confine di errore.
 *
 * Senza, una singola eccezione durante il render (una risposta con markdown
 * malformato, un campo mancante arrivato dall'API) smonta l'intero albero
 * React e lascia una pagina bianca, senza nemmeno un modo per ricaricare.
 *
 * Deve restare una classe: React non offre un equivalente con gli hook. Per
 * la stessa ragione non può chiamare `useI18n()` da sé, e i testi le arrivano
 * come prop dall'involucro qui sotto.
 */
class ErrorBoundaryInner extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In produzione non c'è un servizio di raccolta errori: la console è
    // l'unico posto dove questo resta consultabile.
    console.error('[K AI Code] errore di render', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    const { strings } = this.props;
    if (!error) return this.props.children;

    return (
      <div className="err-boundary" role="alert">
        <div className="err-box">
          <span className="err-mark" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
              <path d="M12 8.5v5M12 17v.5" />
              <circle cx="12" cy="12" r="9" strokeWidth="1.6" />
            </svg>
          </span>
          <h2>{strings.title}</h2>
          <p>{strings.body}</p>
          <pre className="err-detail">{error.message || String(error)}</pre>
          <div className="err-actions">
            <button className="err-primary" onClick={() => window.location.reload()}>
              {strings.reload}
            </button>
            <button className="err-secondary" onClick={() => this.setState({ error: null })}>
              {strings.retry}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Il confine sta dentro `I18nProvider`, quindi il dizionario è leggibile —
 * ma solo da un componente a funzione. Questo involucro fa da tramite.
 *
 * Il campo `area` non compare più nel testo: comporre "errore in X" con una
 * zona scritta in italiano dentro una frase tradotta produceva frasi ibride.
 * Resta accettato perché i punti di innesto lo passano, e finisce nel log.
 */
export function ErrorBoundary({ children, area }: { children: ReactNode; area?: string }) {
  const { t } = useI18n();
  return (
    <ErrorBoundaryInner
      area={area}
      strings={{
        title: t.common.somethingBroke,
        body: t.common.errorBody,
        reload: t.common.reloadPage,
        retry: t.common.retryNoReload,
      }}
    >
      {children}
    </ErrorBoundaryInner>
  );
}

export default ErrorBoundary;
