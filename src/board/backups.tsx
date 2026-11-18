import { useEffect, useRef, useState } from "react";
import { isBoard, type Board } from "./storage";
import { Confirmation, containDialogFocus } from "./confirmation";

function parseBackup(text: string): Board {
  const value: unknown = JSON.parse(text);
  // Normalize only editable names/titles; descriptions remain byte-for-byte text.
  if (
    typeof value === "object" &&
    value !== null &&
    "columns" in value &&
    Array.isArray(value.columns)
  ) {
    for (const column of value.columns) {
      if (!column || typeof column !== "object") continue;
      if (typeof column.name === "string") column.name = column.name.trim();
      if (!Array.isArray(column.cards)) continue;
      for (const card of column.cards) {
        if (card && typeof card === "object" && typeof card.title === "string")
          card.title = card.title.trim();
      }
    }
  }
  if (!isBoard(value)) throw new Error("Invalid backup");
  return {
    version: 1,
    columns: value.columns.map((column) => ({
      id: column.id,
      name: column.name,
      cards: column.cards.map((card) => ({
        id: card.id,
        title: card.title,
        ...(card.description !== undefined
          ? { description: card.description }
          : {}),
      })),
    })),
  };
}

function downloadBackup(board: Board) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(board, null, 2)], { type: "application/json" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "doneward-backup.json";
  link.click();
  // Allow the browser to start consuming the download before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Backups({
  board,
  readOnly = false,
  onClose,
  onReplace,
}: {
  board: Board;
  readOnly?: boolean;
  onClose: () => void;
  onReplace: (board: Board) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Board>();
  const [error, setError] = useState<string>();
  const [reading, setReading] = useState(false);
  const selection = useRef(0);
  useEffect(
    () => () => {
      selection.current++;
    },
    []
  );
  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="card-dialog"
      aria-labelledby="backups-heading"
      onKeyDown={containDialogFocus}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-header">
        <h2 id="backups-heading">Board backups</h2>
        <button tabIndex={0} aria-label="Close backups" onClick={onClose}>
          ×
        </button>
      </div>
      <p>
        Clearing browser site data can remove your board. Exported files are
        backups; keep them somewhere safe.
      </p>
      <label htmlFor="backup-file">Import backup</label>
      <input
        ref={input}
        tabIndex={0}
        id="backup-file"
        type="file"
        disabled={readOnly}
        accept=".json,application/json"
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          const current = ++selection.current;
          setPending(undefined);
          setError(undefined);
          if (!file) return;
          setReading(true);
          try {
            const next = parseBackup(await file.text());
            if (current === selection.current) {
              input.current?.focus();
              setPending(next);
            }
          } catch {
            if (current === selection.current)
              setError(
                "This file is not a valid version 1 board backup. Check its structure, unique IDs, and content limits (80-character column names, 200-character titles, 20,000-character descriptions). Your board has not changed."
              );
          } finally {
            if (current === selection.current) setReading(false);
          }
        }}
      />
      {reading && <p role="status">Reading backup…</p>}
      {error && <p role="alert">{error}</p>}
      {!pending && (
        <div className="dialog-actions">
          <button tabIndex={0} onClick={() => downloadBackup(board)}>
            Export backup
          </button>
        </div>
      )}
      {pending && (
        <Confirmation
          title="Replace board?"
          cancelLabel="Cancel"
          confirmLabel="Replace board"
          onCancel={() => setPending(undefined)}
          onConfirm={() => onReplace(pending)}
        >
          <p>
            This replaces your entire board, not merges it. Export your current
            board first if you want to keep it. This cannot be undone.
          </p>
          <button
            tabIndex={0}
            className="backup-toggle"
            onClick={() => downloadBackup(board)}
          >
            Export backup
          </button>
        </Confirmation>
      )}
    </dialog>
  );
}
