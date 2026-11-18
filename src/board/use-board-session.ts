import { useEffect, useRef, useState } from "react";
import { type Board, BoardSaveError, loadBoard, saveBoard } from "./storage";

// Web Locks own exclusivity; messages only invalidate readers' saved snapshots.
function openBoardSession(
  onBoard: (board: Board) => void,
  onOwnership: (editing: boolean) => void,
  onFailure: (message: string) => void
) {
  const abort = new AbortController();
  const channel = new BroadcastChannel("doneward-board");
  let active = true;
  let ownsLock = false;
  let editing = false;
  let failed = false;
  let pending: Promise<void> = Promise.resolve();
  let release: (() => void) | undefined;
  let revision = 0;

  async function refresh(initialize: boolean) {
    const current = ++revision;
    try {
      const board = await loadBoard(initialize);
      if (active && current === revision && board) onBoard(board);
    } catch (error) {
      if (!active || current !== revision) return;
      failed = true;
      onFailure(
        error instanceof BoardSaveError
          ? "The starter board could not be saved. Please check browser storage and reload."
          : "Your saved board could not be opened. Existing data has not been replaced."
      );
    }
  }

  channel.onmessage = () => {
    if (!ownsLock) void refresh(false);
  };
  void refresh(false);
  void navigator.locks
    .request(
      "doneward-board-editor",
      { mode: "exclusive", signal: abort.signal },
      async () => {
        if (!active) return;
        ownsLock = true;
        // Reload inside the lock, before exposing any editing controls.
        await refresh(true);
        if (!active) return;
        editing = !failed;
        onOwnership(editing);
        if (editing) channel.postMessage("saved");
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        // Never hand off while a write is still in flight.
        await pending;
      }
    )
    .catch((error: unknown) => {
      if (
        active &&
        !(error instanceof DOMException && error.name === "AbortError")
      )
        onFailure("Editing access could not be acquired. Please reload.");
    });

  return {
    save(board: Board) {
      if (!active || !editing || failed)
        return Promise.reject(
          new Error("This tab does not have editing access")
        );
      pending = pending.then(async () => {
        try {
          await saveBoard(board);
          if (active) channel.postMessage("saved");
        } catch (error) {
          failed = true;
          throw error;
        }
      });
      // The lock must drain failed writes too, without rejecting its callback.
      const result = pending;
      pending = result.catch(() => {});
      return result;
    },
    close() {
      active = false;
      editing = false;
      revision++;
      abort.abort();
      release?.();
      channel.close();
    },
  };
}

export function useBoardSession() {
  const [board, setBoard] = useState<Board>();
  const [failure, setFailure] = useState<string>();
  const [editing, setEditing] = useState(false);
  const session = useRef<ReturnType<typeof openBoardSession>>(undefined);

  useEffect(() => {
    function start() {
      if (!navigator.locks || !window.BroadcastChannel) {
        setFailure(
          "This browser cannot coordinate editing access. Please use a browser with Web Locks and BroadcastChannel support."
        );
        return;
      }
      session.current = openBoardSession(setBoard, setEditing, setFailure);
    }
    function stop() {
      session.current?.close();
      session.current = undefined;
      setEditing(false);
    }
    function restore(event: PageTransitionEvent) {
      if (event.persisted) start();
    }
    start();
    window.addEventListener("pagehide", stop);
    window.addEventListener("pageshow", restore);
    return () => {
      stop();
      window.removeEventListener("pagehide", stop);
      window.removeEventListener("pageshow", restore);
    };
  }, []);

  return {
    board,
    setBoard,
    failure,
    setFailure,
    editing,
    save: (next: Board) =>
      session.current?.save(next) ??
      Promise.reject(new Error("Editing access is unavailable")),
  };
}
