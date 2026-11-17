"use client";

import { useEffect, useRef, useState } from "react";
import {
  type Board,
  type Card,
  BoardSaveError,
  loadBoard,
  saveBoard,
} from "./storage";
import { CardEditor } from "./card-editor";

export default function BoardView() {
  const [board, setBoard] = useState<Board>();
  const [failure, setFailure] = useState<string>();
  const [theme, setTheme] = useState<"light" | "dark">();
  const [editor, setEditor] = useState<{ columnId: string; card?: Card }>();
  const [saving, setSaving] = useState(false);
  const pendingFocus = useRef<{
    primary: HTMLElement | null;
    fallback: HTMLElement | null;
  } | null>(null);
  useEffect(() => {
    if (!saving && pendingFocus.current) {
      const { primary, fallback } = pendingFocus.current;
      (primary?.isConnected ? primary : fallback)?.focus();
      pendingFocus.current = null;
    }
  }, [saving]);

  async function commit(next: Board) {
    if (editor)
      pendingFocus.current = {
        primary: editor.card
          ? document.getElementById(`card-${editor.card.id}`)
          : null,
        fallback: document.getElementById(`add-${editor.columnId}`),
      };
    setBoard(next);
    setEditor(undefined);
    setSaving(true);
    try {
      await saveBoard(next);
    } catch {
      setFailure(
        "Your changes could not be saved. Please check browser storage and reload."
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    let active = true;
    loadBoard().then(
      (saved) => {
        if (active) setBoard(saved);
      },
      (error: unknown) => {
        if (active)
          setFailure(
            error instanceof BoardSaveError
              ? "The starter board could not be saved. Please check browser storage and reload."
              : "Your saved board could not be opened. Existing data has not been replaced."
          );
      }
    );
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="app" data-theme={theme}>
      <header className="app-header">
        <h1 className="wordmark">
          <svg aria-hidden="true" viewBox="0 0 36 36" width="36" height="36">
            <rect width="36" height="36" rx="11" fill="#3973d6" />
            <path
              d="m10 18 6 6 11-13"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Doneward<span className="brand-dot">.</span>
        </h1>
        <button
          type="button"
          tabIndex={0}
          className="theme-toggle"
          aria-label="Toggle theme"
          onClick={(event) => {
            const app = event.currentTarget.closest("main")!;
            setTheme(
              getComputedStyle(app).colorScheme === "dark" ? "light" : "dark"
            );
          }}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
            <path
              d="M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </button>
      </header>
      {failure ? (
        <p role="alert">{failure}</p>
      ) : !board ? (
        <p role="status">Opening your board…</p>
      ) : (
        <>
          <div
            className="board"
            role="region"
            aria-label="Board"
            tabIndex={0}
            onKeyDown={(event) => {
              if (
                event.target !== event.currentTarget ||
                !["ArrowLeft", "ArrowRight"].includes(event.key)
              )
                return;
              event.preventDefault();
              event.currentTarget.scrollBy({
                left: event.key === "ArrowRight" ? 160 : -160,
              });
            }}
          >
            {board.columns.map((column) => (
              <section
                className="column"
                key={column.id}
                aria-label={column.name}
              >
                <div className="column-header">
                  <span aria-hidden="true" className="column-dot" />
                  <h2 dir="auto">{column.name}</h2>
                  <span
                    className="card-count"
                    aria-label={`${column.cards.length} cards`}
                  >
                    {column.cards.length}
                  </span>
                  <button
                    id={`add-${column.id}`}
                    disabled={saving}
                    className="add-card-icon"
                    aria-label="Add card"
                    onClick={(event) => {
                      event.currentTarget.focus();
                      setEditor({ columnId: column.id });
                    }}
                  >
                    +
                  </button>
                </div>
                {column.cards.map((card) => (
                  <article className="card" key={card.id}>
                    <button
                      id={`card-${card.id}`}
                      disabled={saving}
                      className="card-open"
                      aria-label={`Edit ${card.title}`}
                      onClick={(event) => {
                        event.currentTarget.focus();
                        setEditor({ columnId: column.id, card });
                      }}
                    />
                    <h3 dir="auto">{card.title}</h3>
                    {card.description && (
                      <div>
                        {card.description
                          .split("\n")
                          .map((paragraph, index, all) => (
                            <p
                              key={index}
                              dir="auto"
                              className="whitespace-pre-wrap"
                            >
                              {paragraph}
                              {index < all.length - 1 ? "\n" : ""}
                            </p>
                          ))}
                      </div>
                    )}
                  </article>
                ))}
                <button
                  disabled={saving}
                  className="add-card"
                  aria-label="Add a card"
                  onClick={(event) => {
                    event.currentTarget.focus();
                    setEditor({ columnId: column.id });
                  }}
                >
                  + Add a card
                </button>
              </section>
            ))}
          </div>
          <p className="save-status" role="status">
            {saving ? "Saving…" : "Saved on this device"}
          </p>
          {editor && (
            <CardEditor
              card={editor.card}
              onClose={() => setEditor(undefined)}
              onDelete={() => {
                void commit({
                  ...board,
                  columns: board.columns.map((column) => ({
                    ...column,
                    cards: column.cards.filter(
                      (card) => card.id !== editor.card?.id
                    ),
                  })),
                });
              }}
              onSave={(card) => {
                void commit({
                  ...board,
                  columns: board.columns.map((column) =>
                    column.id === editor.columnId
                      ? {
                          ...column,
                          cards: editor.card
                            ? column.cards.map((existing) =>
                                existing.id === card.id ? card : existing
                              )
                            : [...column.cards, card],
                        }
                      : column
                  ),
                });
              }}
            />
          )}
        </>
      )}
    </main>
  );
}
