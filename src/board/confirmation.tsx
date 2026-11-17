import { useEffect, useRef } from "react";

export function containDialogFocus(
  event: React.KeyboardEvent<HTMLDialogElement>
) {
  if (
    event.key !== "Tab" ||
    (event.target as HTMLElement).closest("dialog") !== event.currentTarget
  )
    return;
  const controls = event.currentTarget.querySelectorAll<HTMLElement>(
    "button, input, textarea"
  );
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

export function Confirmation({
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current!;
    const opener = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="card-dialog"
      onKeyDown={containDialogFocus}
      aria-labelledby="confirmation-heading"
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
    >
      <h2 id="confirmation-heading" className="dialog-header">
        {title}
      </h2>
      {children}
      <div className="dialog-actions">
        <button autoFocus onClick={onCancel}>
          {cancelLabel}
        </button>
        <button className="danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
