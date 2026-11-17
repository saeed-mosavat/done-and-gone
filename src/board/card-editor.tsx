import { useEffect, useRef, useState } from "react";
import type { Card } from "./storage";
import { Confirmation, containDialogFocus } from "./confirmation";

export function CardEditor({
  card,
  onClose,
  onSave,
  onDelete,
}: {
  card?: Card;
  onClose: () => void;
  onSave: (card: Card) => void;
  onDelete: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [validation, setValidation] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  function dismiss() {
    if (
      title !== (card?.title ?? "") ||
      description !== (card?.description ?? "")
    )
      setConfirmDiscard(true);
    else onClose();
  }
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
      aria-labelledby="editor-heading"
      onKeyDown={containDialogFocus}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            dismiss();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim() || title.trim().length > 200) {
            setValidation("Title must contain 1–200 characters.");
            dialog.current!.querySelector("input")!.focus();
            return;
          }
          if (description.length > 20000) {
            setValidation("Description must be at most 20,000 characters.");
            dialog.current!.querySelector("textarea")!.focus();
            return;
          }
          onSave({
            id: card?.id ?? crypto.randomUUID(),
            title: title.trim(),
            description,
          });
        }}
      >
        <div className="dialog-header">
          <h2 id="editor-heading">{card ? "Edit card" : "New card"}</h2>
          <button type="button" aria-label="Close" onClick={dismiss}>
            ×
          </button>
        </div>
        <label htmlFor="card-title">Title</label>
        <input
          id="card-title"
          autoFocus
          dir="auto"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <label htmlFor="card-description">Description</label>
        <textarea
          id="card-description"
          dir="auto"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        {validation && <p role="alert">{validation}</p>}
        <div className="dialog-actions">
          {card && (
            <button
              className="danger"
              type="button"
              onClick={() => setConfirmDelete(true)}
            >
              Delete card
            </button>
          )}
          <button type="button" onClick={dismiss}>
            Cancel
          </button>
          <button className="primary" type="submit">
            Save
          </button>
        </div>
      </form>
      {confirmDiscard && (
        <Confirmation
          title="Discard unsaved edits?"
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={onClose}
        >
          <p>Your unsaved changes will be lost.</p>
        </Confirmation>
      )}
      {confirmDelete && (
        <Confirmation
          title="Delete card?"
          confirmLabel="Delete permanently"
          cancelLabel="Cancel"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={onDelete}
        >
          <p>
            Delete <bdi dir="auto">{card!.title}</bdi>? This cannot be undone.
          </p>
        </Confirmation>
      )}
    </dialog>
  );
}
