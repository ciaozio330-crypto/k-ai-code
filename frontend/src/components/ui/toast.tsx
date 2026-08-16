import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';

/**
 * Sistema di notifiche.
 *
 * Sostituisce le chiamate a `alert()`/`confirm()` sparse nell'app: quelle
 * bloccano il thread, non sono stilabili e su mobile sono invasive. Qui le
 * notifiche sono impilabili, si auto-chiudono e rispettano il tema corrente.
 */

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  /** ms prima della chiusura automatica; 0 = resta finché non la si chiude */
  duration: number;
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  toast: (t: Omit<ToastItem, 'id' | 'duration'> & { duration?: number }) => number;
  success: (title: string, description?: string) => number;
  error: (title: string, description?: string) => number;
  info: (title: string, description?: string) => number;
  dismiss: (id: number) => void;
  /** Conferma non bloccante: risolve true/false invece di usare window.confirm */
  confirm: (opts: {
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
  }) => Promise<boolean>;
}

const Ctx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast va usato dentro <ToastProvider>');
  return ctx;
}

const ICONS: Record<ToastKind, ReactNode> = {
  success: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 8v5M12 16.5v.5" />
      <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 11v5M12 7.5v.5" />
      <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
    </svg>
  ),
};

interface ConfirmState {
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  resolve: (v: boolean) => void;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const toast = useCallback<ToastApi['toast']>((input) => {
    const id = nextId.current++;
    const duration = input.duration ?? 4200;
    const item: ToastItem = { id, duration, ...input };
    // Tetto a 4 notifiche: oltre diventa rumore e copre l'interfaccia
    setItems((list) => [...list.slice(-3), item]);
    if (duration > 0) {
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
    }
    return id;
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    toast,
    dismiss,
    success: (title, description) => toast({ kind: 'success', title, description }),
    error: (title, description) => toast({ kind: 'error', title, description, duration: 6000 }),
    info: (title, description) => toast({ kind: 'info', title, description }),
    confirm: (opts) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({
          title: opts.title,
          description: opts.description,
          confirmLabel: opts.confirmLabel || 'Conferma',
          cancelLabel: opts.cancelLabel || 'Annulla',
          danger: !!opts.danger,
          resolve,
        });
      }),
  }), [toast, dismiss]);

  const closeConfirm = (value: boolean) => {
    confirmState?.resolve(value);
    setConfirmState(null);
  };

  return (
    <Ctx.Provider value={api}>
      {children}

      <div className="toast-stack" role="region" aria-live="polite" aria-label="Notifiche">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              className={`toast toast-${t.kind}`}
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            >
              <span className="toast-ico">{ICONS[t.kind]}</span>
              <div className="toast-body">
                <span className="toast-title">{t.title}</span>
                {t.description && <span className="toast-desc">{t.description}</span>}
                {t.action && (
                  <button
                    className="toast-action"
                    onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button className="toast-x" onClick={() => dismiss(t.id)} aria-label="Chiudi notifica">
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {confirmState && (
          <motion.div
            className="confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => closeConfirm(false)}
          >
            <motion.div
              className="confirm-box"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            >
              <h3 id="confirm-title" className="confirm-title">{confirmState.title}</h3>
              {confirmState.description && (
                <p className="confirm-desc">{confirmState.description}</p>
              )}
              <div className="confirm-actions">
                <button className="confirm-cancel" onClick={() => closeConfirm(false)} autoFocus>
                  {confirmState.cancelLabel}
                </button>
                <button
                  className={confirmState.danger ? 'confirm-ok danger' : 'confirm-ok'}
                  onClick={() => closeConfirm(true)}
                >
                  {confirmState.confirmLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}
