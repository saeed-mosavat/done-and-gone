import { useEffect, useRef, useState } from "react";
import { containDialogFocus } from "./confirmation";

export function ColumnEditor({
  initialName = "",
  onClose,
  onSave,
}: {
  initialName?: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(initialName);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    const element = dialog.current!;
    const opener = document.activeElement;
    element.showModal();
    element.querySelector("input")!.focus();
    return () => {
      element.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="card-dialog"
      aria-labelledby="column-editor-heading"
      onKeyDown={containDialogFocus}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim() || name.trim().length > 80) {
            setInvalid(true);
            dialog.current!.querySelector("input")!.focus();
            return;
          }
          onSave(name.trim());
        }}
      >
        <div className="dialog-header">
          <h2 id="column-editor-heading">
            {initialName ? "Rename column" : "New column"}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <label htmlFor="column-name">Column name</label>
        <input
          id="column-name"
          dir="auto"
          autoFocus
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? "column-name-error" : undefined}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setInvalid(false);
          }}
        />
        {invalid && (
          <p role="alert" id="column-name-error">
            Column name must contain 1–80 characters.
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
