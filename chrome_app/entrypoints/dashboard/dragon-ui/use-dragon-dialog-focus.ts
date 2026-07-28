import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

export type DragonDialogFocusOptions = {
  dialogRef: RefObject<HTMLElement>;
  initialFocusRef?: RefObject<HTMLElement>;
  onClose?: () => void;
  closeOnEscape?: boolean;
  restoreFocus?: boolean;
  lockBodyScroll?: boolean;
};

function isElementVisible(element: HTMLElement) {
  return Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

function isFocusableElement(element: HTMLElement) {
  if (element.getAttribute('aria-hidden') === 'true') return false;
  if (element.hasAttribute('disabled')) return false;
  return isElementVisible(element);
}

export function getDragonDialogFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isFocusableElement);
}

export function getDragonDialogTabTarget(container: HTMLElement, activeElement: Element | null, shiftKey: boolean) {
  const focusable = getDragonDialogFocusableElements(container);
  if (!focusable.length) return container;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (!activeElement || !container.contains(activeElement)) {
    return shiftKey ? last : first;
  }

  if (shiftKey && activeElement === first) return last;
  if (!shiftKey && activeElement === last) return first;
  return null;
}

function focusWithoutScroll(element: HTMLElement) {
  element.focus({ preventScroll: true });
}

export function useDragonDialogFocus({
  dialogRef,
  initialFocusRef,
  onClose,
  closeOnEscape = true,
  restoreFocus = true,
  lockBodyScroll = true
}: DragonDialogFocusOptions) {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const ownerDocument = dialog.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    const previouslyFocused =
      ownerWindow && ownerDocument.activeElement instanceof ownerWindow.HTMLElement ? ownerDocument.activeElement : null;
    const previousBodyOverflow = ownerDocument.body.style.overflow;
    const firstFocusable = getDragonDialogFocusableElements(dialog)[0];
    const initialTarget = initialFocusRef?.current ?? firstFocusable ?? dialog;

    if (lockBodyScroll) ownerDocument.body.style.overflow = 'hidden';
    focusWithoutScroll(initialTarget);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (closeOnEscape && onClose) {
          event.preventDefault();
          onClose();
        }
        return;
      }

      if (event.key !== 'Tab') return;

      const target = getDragonDialogTabTarget(dialog, ownerDocument.activeElement, event.shiftKey);
      if (!target) return;

      event.preventDefault();
      focusWithoutScroll(target);
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (ownerWindow && event.target instanceof ownerWindow.Node && dialog.contains(event.target)) return;
      const target = getDragonDialogFocusableElements(dialog)[0] ?? dialog;
      focusWithoutScroll(target);
    };

    ownerDocument.addEventListener('keydown', handleKeyDown);
    ownerDocument.addEventListener('focusin', handleFocusIn);

    return () => {
      ownerDocument.removeEventListener('keydown', handleKeyDown);
      ownerDocument.removeEventListener('focusin', handleFocusIn);
      if (lockBodyScroll) ownerDocument.body.style.overflow = previousBodyOverflow;
      if (restoreFocus && previouslyFocused && ownerDocument.contains(previouslyFocused)) {
        focusWithoutScroll(previouslyFocused);
      }
    };
  }, [closeOnEscape, dialogRef, initialFocusRef, lockBodyScroll, onClose, restoreFocus]);
}
