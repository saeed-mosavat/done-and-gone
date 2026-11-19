import { useEffect, useRef, useState } from "react";
import type { Card, Column } from "./storage";
import { Confirmation, containDialogFocus } from "./confirmation";

export function CardEditor({
  card,
  onClose,
  onSave,
  onDelete,
  columns,
  columnId,
  update,
}: {
  card?: Card;
  onClose: () => void;
  onSave: (card: Card, columnId: string, position: number) => void;
  onDelete: () => void;
  columns: Column[];
  columnId: string;
  update?: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [validation, setValidation] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const initialPosition = card
    ? columns
        .find((column) => column.id === columnId)!
        .cards.findIndex((existing) => existing.id === card.id)
    : 0;
  const [destination, setDestination] = useState(columnId);
  const [position, setPosition] = useState(initialPosition);
  const destinationCards = columns
    .find((column) => column.id === destination)!
    .cards.filter((existing) => existing.id !== card?.id);
  function dismiss() {
    if (
      title !== (card?.title ?? "") ||
      description !== (card?.description ?? "") ||
      destination !== columnId ||
      position !== initialPosition
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
      {update}
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
          onSave(
            {
              id: card?.id ?? crypto.randomUUID(),
              title: title.trim(),
              description,
            },
            destination,
            position
          );
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
        {card && (
          <>
            <label htmlFor="card-column">Column</label>
            <select
              id="card-column"
              value={destination}
              onChange={(event) => {
                const id = event.target.value;
                setDestination(id);
                setPosition(
                  columns
                    .find((column) => column.id === id)!
                    .cards.filter((existing) => existing.id !== card.id).length
                );
              }}
            >
              {columns.map((column, index) => (
                <option key={column.id} value={column.id} dir="auto">
                  {index + 1}. {column.name}
                </option>
              ))}
            </select>
            <label htmlFor="card-position">Position</label>
            <select
              id="card-position"
              value={position}
              onChange={(event) => setPosition(Number(event.target.value))}
            >
              {Array.from(
                { length: destinationCards.length + 1 },
                (_, index) => (
                  <option key={index} value={index}>
                    {index + 1}
                    {index === 0
                      ? " (first)"
                      : index === destinationCards.length
                        ? " (last)"
                        : ""}
                  </option>
                )
              )}
            </select>
          </>
        )}
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
