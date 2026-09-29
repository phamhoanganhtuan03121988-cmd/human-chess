import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface ModalProps {
  /** id of the element that labels the dialog. */
  labelledBy: string;
  onClose?: () => void;
  className?: string;
  /** Close when the backdrop (outside the panel) is clicked. */
  closeOnBackdrop?: boolean;
  testId?: string;
  children: ReactNode;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog: moves focus inside, keeps Tab within the dialog,
 * closes on Escape (if onClose is given) and restores focus on close.
 */
export function Modal({ labelledBy, onClose, className, closeOnBackdrop = false, testId, children }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();
    return () => previous?.focus?.();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && onClose) {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className={['modal-backdrop', className].filter(Boolean).join(' ')}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if (closeOnBackdrop && onClose && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        data-testid={testId}
      >
        {children}
      </div>
    </div>
  );
}
