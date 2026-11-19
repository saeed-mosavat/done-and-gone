"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import lightLogo from "../brand/done-and-gone-horizontal-light.png";
import darkLogo from "../brand/done-and-gone-horizontal-dark.png";
import { type Board, type Card, type Column } from "./storage";
import { useBoardSession } from "./use-board-session";
import { CardEditor } from "./card-editor";
import { ColumnEditor } from "./column-editor";
import { ColumnDeletion } from "./column-deletion";
import { placeCard, placeColumn } from "./movement";
import { Confirmation } from "./confirmation";
import { useBoardDrag } from "./use-board-drag";
import { Backups } from "./backups";
import { useAppUpdate } from "../offline/use-app-update";
import { UpdateNotice } from "../offline/update-notice";

function CardContent({ card }: { card: Card }) {
  return (
    <>
      <h3 dir="auto">{card.title}</h3>
      {card.description && (
        <div>
          {card.description.split("\n").map((paragraph, index, all) => (
            <p key={index} dir="auto" className="whitespace-pre-wrap">
              {paragraph}
              {index < all.length - 1 ? "\n" : ""}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

export default function BoardView() {
  const update = useAppUpdate();
  const { board, setBoard, failure, setFailure, editing, save } =
    useBoardSession();
  const [theme, setTheme] = useState<"light" | "dark">();
  const [editor, setEditor] = useState<{ columnId: string; card?: Card }>();
  const [columnEditor, setColumnEditor] = useState<{ column?: Column }>();
  const [deletingColumn, setDeletingColumn] = useState<Column>();
  const [saving, setSaving] = useState(false);
  const [backupsOpen, setBackupsOpen] = useState(false);
  const [dragDeletion, setDragDeletion] = useState<{
    card: Card;
    columnId: string;
  }>();
  const { drag, ...dragHandlers } = useBoardDrag(
    !editing ||
      saving ||
      !!failure ||
      !!editor ||
      !!columnEditor ||
      !!deletingColumn ||
      backupsOpen ||
      !!dragDeletion,
    (item, drop) => {
      if (!editing || !board || saving || failure) return;
      if (item.kind === "card") {
        const source = board.columns.find((column) =>
          column.cards.some((card) => card.id === item.id)
        )!;
        const card = source.cards.find((card) => card.id === item.id)!;
        if (drop.kind === "delete") {
          document.getElementById(`card-${card.id}`)?.focus();
          setDragDeletion({ card, columnId: source.id });
        } else {
          const destination = board.columns.find(
            (column) => column.id === drop.columnId
          )!;
          const cards = destination.cards.filter(
            (existing) => existing.id !== card.id
          );
          const index = drop.beforeId
            ? cards.findIndex((existing) => existing.id === drop.beforeId)
            : cards.length;
          void commit(placeCard(board, card, destination.id, index), {
            primary: `card-${card.id}`,
            fallback: `add-${destination.id}`,
          });
        }
      } else if (drop.kind === "place") {
        const column = board.columns.find((column) => column.id === item.id)!;
        const columns = board.columns.filter(
          (existing) => existing.id !== item.id
        );
        const index = drop.beforeId
          ? columns.findIndex((existing) => existing.id === drop.beforeId)
          : columns.length;
        void commit(placeColumn(board, column.id, index), {
          primary: `column-actions-${column.id}`,
          fallback: "board-add-column",
        });
      }
    }
  );
  const pendingFocus = useRef<{
    primary?: string;
    fallback: string;
  } | null>(null);
  useEffect(() => {
    // A back/forward-cache restoration must not revive drafts from an old lease.
    function closeDrafts() {
      setEditor(undefined);
      setColumnEditor(undefined);
      setDeletingColumn(undefined);
      setDragDeletion(undefined);
      setBackupsOpen(false);
    }
    window.addEventListener("pagehide", closeDrafts);
    return () => window.removeEventListener("pagehide", closeDrafts);
  }, []);
  useEffect(() => {
    function closeOutsideMenus(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      for (const menu of document.querySelectorAll<HTMLDetailsElement>(
        ".column-actions[open]"
      )) {
        if (!menu.contains(event.target)) menu.open = false;
      }
    }
    document.addEventListener("pointerdown", closeOutsideMenus);
    return () => document.removeEventListener("pointerdown", closeOutsideMenus);
  }, []);
  useEffect(() => {
    if (!saving && pendingFocus.current) {
      const { primary, fallback } = pendingFocus.current;
      (
        document.getElementById(primary ?? "") ??
        document.getElementById(fallback)
      )?.focus();
      pendingFocus.current = null;
    }
  }, [saving]);

  async function commit(
    next: Board,
    focus?: { primary?: string; fallback: string }
  ) {
    if (!editing || saving || failure) return;
    if (focus) pendingFocus.current = focus;
    else if (editor)
      pendingFocus.current = {
        primary: editor.card ? `card-${editor.card.id}` : undefined,
        fallback: `add-${editor.columnId}`,
      };
    setBoard(next);
    setEditor(undefined);
    setColumnEditor(undefined);
    setDeletingColumn(undefined);
    setSaving(true);
    try {
      await save(next);
    } catch {
      setFailure(
        "Your changes could not be saved. Please check browser storage and reload."
      );
    } finally {
      setSaving(false);
    }
  }

  const draggedCard =
    drag?.kind === "card"
      ? board?.columns
          .flatMap((column) => column.cards)
          .find((card) => card.id === drag.id)
      : undefined;

  return (
    <main className="app" data-theme={theme}>
      <header className="app-header">
        <h1 className="wordmark" aria-label="Done & Gone">
          <Image
            className="brand-light"
            src={lightLogo}
            alt=""
            unoptimized
            loading="eager"
          />
          <Image
            className="brand-dark"
            src={darkLogo}
            alt=""
            unoptimized
            loading="eager"
          />
        </h1>
        <div className="header-actions">
          <button
            type="button"
            className="backup-toggle"
            tabIndex={0}
            id="board-backups"
            disabled={!board || saving || !!failure}
            onClick={(event) => {
              event.currentTarget.focus();
              setBackupsOpen(true);
            }}
          >
            Backups
          </button>
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
        </div>
      </header>
      {update.available && !editor && !columnEditor && (
        <UpdateNotice
          apply={update.apply}
          disabled={saving || !!failure || !!drag}
        />
      )}
      {failure ? (
        <p role="alert">{failure}</p>
      ) : !board ? (
        <p role="status">Opening your board…</p>
      ) : (
        <>
          {!editing && (
            <p className="ownership-status" role="note">
              Read-only: another tab has editing access. This tab will take over
              automatically when it closes or leaves.
            </p>
          )}
          <div
            className="board"
            {...dragHandlers}
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
            {board.columns.map((column, columnIndex) => (
              <section
                className="column"
                data-column-id={column.id}
                data-drop={
                  drag?.drop?.kind === "place" &&
                  drag.drop.columnId === column.id
                    ? drag.kind
                    : undefined
                }
                key={column.id}
                aria-label={column.name}
              >
                <div className="column-header">
                  <span aria-hidden="true" className="column-dot" />
                  <h2 dir="auto">{column.name}</h2>
                  <button
                    className="drag-handle column-drag-handle"
                    data-drag-kind="column"
                    disabled={!editing || saving}
                    aria-label={`Drag column ${column.name}`}
                    title="Drag column; or use Column actions to reorder"
                    onClick={() => {
                      const summary = document.getElementById(
                        `column-actions-${column.id}`
                      )!;
                      summary.closest("details")!.open = true;
                      summary.focus();
                    }}
                  >
                    <span aria-hidden="true">⠿</span>
                  </button>
                  <span
                    className="card-count"
                    aria-label={`${column.cards.length} cards`}
                  >
                    {column.cards.length}
                  </span>
                  <button
                    id={`add-${column.id}`}
                    disabled={!editing || saving}
                    className="add-card-icon"
                    aria-label="Add card"
                    onClick={(event) => {
                      event.currentTarget.focus();
                      setEditor({ columnId: column.id });
                    }}
                  >
                    +
                  </button>
                  <details className="column-actions">
                    <summary
                      tabIndex={0}
                      id={`column-actions-${column.id}`}
                      aria-label="Column actions"
                    >
                      ⋯
                    </summary>
                    <div
                      className="column-actions-panel"
                      role="group"
                      aria-label="Column options"
                    >
                      <button
                        tabIndex={0}
                        disabled={!editing || saving}
                        onClick={(event) => {
                          event.currentTarget.closest("details")!.open = false;
                          document
                            .getElementById(`column-actions-${column.id}`)!
                            .focus();
                          setColumnEditor({ column });
                        }}
                      >
                        <svg
                          aria-hidden="true"
                          focusable="false"
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m16 3 5 5-12 12-6 1 1-6L16 3Z M13 6l5 5" />
                        </svg>
                        Rename column
                      </button>
                      <button
                        tabIndex={0}
                        disabled={
                          !editing || saving || board.columns.length === 1
                        }
                        onClick={(event) => {
                          event.currentTarget.closest("details")!.open = false;
                          document
                            .getElementById(`column-actions-${column.id}`)!
                            .focus();
                          setDeletingColumn(column);
                        }}
                      >
                        <svg
                          aria-hidden="true"
                          focusable="false"
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
                        </svg>
                        Delete column
                      </button>
                      {board.columns.length === 1 && (
                        <p className="column-action-hint">
                          Keep at least one column.
                        </p>
                      )}
                      {[-1, 1].map((offset) => (
                        <button
                          key={offset}
                          disabled={
                            !editing ||
                            saving ||
                            columnIndex + offset < 0 ||
                            columnIndex + offset >= board.columns.length
                          }
                          onClick={(event) => {
                            event.currentTarget.closest("details")!.open =
                              false;
                            void commit(
                              placeColumn(
                                board,
                                column.id,
                                columnIndex + offset
                              ),
                              {
                                primary: `column-actions-${column.id}`,
                                fallback: "board-add-column",
                              }
                            );
                          }}
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                          >
                            <path
                              d={
                                offset === -1
                                  ? "m14 5-7 7 7 7"
                                  : "m10 5 7 7-7 7"
                              }
                            />
                          </svg>
                          Move column {offset === -1 ? "left" : "right"}
                        </button>
                      ))}
                    </div>
                  </details>
                </div>
                {column.cards.map((card) => (
                  <article
                    className="card"
                    key={card.id}
                    data-card-id={card.id}
                    data-dragging={
                      (drag?.id === card.id && drag.kind === "card") ||
                      undefined
                    }
                    data-drop-before={
                      (drag?.kind === "card" &&
                        drag.drop?.kind === "place" &&
                        drag.drop.beforeId === card.id) ||
                      undefined
                    }
                  >
                    <button
                      id={`card-${card.id}`}
                      disabled={!editing || saving}
                      className="card-open"
                      aria-label={`Edit ${card.title}`}
                      onClick={(event) => {
                        event.currentTarget.focus();
                        setEditor({ columnId: column.id, card });
                      }}
                    />
                    <CardContent card={card} />
                  </article>
                ))}
                <button
                  disabled={!editing || saving}
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
            <button
              id="board-add-column"
              className="add-column"
              aria-label="Add column"
              disabled={!editing || saving}
              onClick={(event) => {
                event.currentTarget.focus();
                setColumnEditor({});
              }}
            >
              <svg
                aria-hidden="true"
                focusable="false"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>Add column</span>
            </button>
          </div>
          {drag && (
            <>
              {drag.kind === "card" && (
                <div
                  className="delete-drop-zone"
                  data-active={drag.drop?.kind === "delete"}
                  role="region"
                  aria-label="Delete drop zone"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                  >
                    <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
                  </svg>
                  {drag.drop?.kind === "delete"
                    ? "Release to delete"
                    : "Drop here to delete"}
                </div>
              )}
              <div
                className={draggedCard ? "card drag-preview" : "drag-preview"}
                data-over-delete={drag.drop?.kind === "delete" || undefined}
                aria-hidden="true"
                style={
                  draggedCard
                    ? {
                        left: drag.x - drag.grabX,
                        top: drag.y - drag.grabY,
                        width: drag.width,
                        height: drag.height,
                      }
                    : { left: drag.x, top: drag.y }
                }
              >
                {draggedCard ? (
                  <>
                    <CardContent card={draggedCard} />
                  </>
                ) : (
                  <bdi dir="auto">{drag.title}</bdi>
                )}
              </div>
            </>
          )}
          {dragDeletion && (
            <Confirmation
              title="Delete card?"
              confirmLabel="Delete permanently"
              cancelLabel="Cancel"
              onCancel={() => setDragDeletion(undefined)}
              onConfirm={() => {
                const { card, columnId } = dragDeletion;
                setDragDeletion(undefined);
                void commit(
                  {
                    ...board,
                    columns: board.columns.map((column) => ({
                      ...column,
                      cards: column.cards.filter(
                        (existing) => existing.id !== card.id
                      ),
                    })),
                  },
                  { fallback: `add-${columnId}` }
                );
              }}
            >
              <p>
                Delete <bdi dir="auto">{dragDeletion.card.title}</bdi>? This
                cannot be undone.
              </p>
            </Confirmation>
          )}
          <p className="save-status" role="status">
            {!editing
              ? "Read-only · Saved on this device"
              : saving
                ? "Saving…"
                : "Saved on this device"}
          </p>
          {backupsOpen && (
            <Backups
              board={board}
              readOnly={!editing}
              onClose={() => setBackupsOpen(false)}
              onReplace={(next) => {
                setBackupsOpen(false);
                void commit(next, { fallback: "board-backups" });
              }}
            />
          )}
          {editor && (
            <CardEditor
              update={
                update.available ? (
                  <UpdateNotice apply={update.apply} protectDraft />
                ) : undefined
              }
              columns={board.columns}
              columnId={editor.columnId}
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
              onSave={(card, destination, position) => {
                void commit(
                  editor.card
                    ? placeCard(board, card, destination, position)
                    : {
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
                      }
                );
              }}
            />
          )}
          {columnEditor && (
            <ColumnEditor
              update={
                update.available ? (
                  <UpdateNotice apply={update.apply} protectDraft />
                ) : undefined
              }
              initialName={columnEditor.column?.name}
              onClose={() => setColumnEditor(undefined)}
              onSave={(name) => {
                const column: Column = columnEditor.column
                  ? { ...columnEditor.column, name }
                  : { id: crypto.randomUUID(), name, cards: [] };
                void commit(
                  {
                    ...board,
                    columns: columnEditor.column
                      ? board.columns.map((existing) =>
                          existing.id === column.id ? column : existing
                        )
                      : [...board.columns, column],
                  },
                  {
                    primary: columnEditor.column
                      ? `column-actions-${column.id}`
                      : `add-${column.id}`,
                    fallback: "board-add-column",
                  }
                );
              }}
            />
          )}
          {deletingColumn && (
            <ColumnDeletion
              column={deletingColumn}
              columns={board.columns}
              onCancel={() => setDeletingColumn(undefined)}
              onConfirm={(destinationId) => {
                if (
                  board.columns.length === 1 ||
                  (destinationId &&
                    !board.columns.some(
                      (column) =>
                        column.id === destinationId &&
                        column.id !== deletingColumn.id
                    ))
                )
                  return;
                void commit(
                  {
                    ...board,
                    columns: board.columns
                      .filter((column) => column.id !== deletingColumn.id)
                      .map((column) =>
                        column.id === destinationId
                          ? {
                              ...column,
                              cards: [...column.cards, ...deletingColumn.cards],
                            }
                          : column
                      ),
                  },
                  {
                    primary: destinationId
                      ? `column-actions-${destinationId}`
                      : undefined,
                    fallback: "board-add-column",
                  }
                );
              }}
            />
          )}
        </>
      )}
    </main>
  );
}
