import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Item = { kind: "card" | "column"; id: string; title: string };
type Drop =
  { kind: "delete" } | { kind: "place"; columnId: string; beforeId?: string };
type Drag = Item & {
  x: number;
  y: number;
  width: number;
  height: number;
  grabX: number;
  grabY: number;
  drop?: Drop;
};

// Pointer gestures do not mutate the board until a valid release. Touch uses
// handles only, leaving the rest of the board available for native scrolling.
export function useBoardDrag(
  disabled: boolean,
  onDrop: (item: Item, drop: Drop) => void
) {
  const [drag, setDrag] = useState<Drag>();
  const cleanup = useRef<() => void>(() => {});
  const suppressClick = useRef(false);
  useEffect(() => () => cleanup.current(), []);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Suppression belongs only to the previous gesture's generated click.
    // A fresh press, including on a non-draggable control, starts clean.
    suppressClick.current = false;
    if (disabled || event.button !== 0 || !event.isPrimary) return;
    const target = event.target as HTMLElement;
    const handle = target.closest<HTMLElement>("[data-drag-kind]");
    const card = target.closest<HTMLElement>("[data-card-id]");
    if (
      !handle &&
      (event.pointerType !== "mouse" || !target.closest(".card-open"))
    )
      return;
    const element =
      handle?.dataset.dragKind === "column"
        ? handle.closest<HTMLElement>("[data-column-id]")
        : card;
    if (!element) return;
    const item: Item =
      handle?.dataset.dragKind === "column"
        ? {
            kind: "column",
            id: element.dataset.columnId!,
            title: element.querySelector("h2")!.textContent!,
          }
        : {
            kind: "card",
            id: element.dataset.cardId!,
            title: element.querySelector("h3")!.textContent!,
          };
    const board = event.currentTarget;
    const pointerId = event.pointerId;
    const origin = { x: event.clientX, y: event.clientY };
    const rect = element.getBoundingClientRect();
    const geometry = {
      width: rect.width,
      height: rect.height,
      grabX: origin.x - rect.left,
      grabY: origin.y - rect.top,
    };
    let x = origin.x;
    let y = origin.y;
    let active = false;
    let drop: Drop | undefined;
    let frame = 0;

    function update() {
      const hit = document.elementFromPoint(x, y);
      drop = undefined;
      if (item.kind === "card" && hit?.closest(".delete-drop-zone")) {
        drop = { kind: "delete" };
      } else {
        const column = hit?.closest<HTMLElement>("[data-column-id]");
        if (column && board.contains(column)) {
          if (item.kind === "column") {
            const columns = [
              ...board.querySelectorAll<HTMLElement>("[data-column-id]"),
            ].filter((entry) => entry.dataset.columnId !== item.id);
            const before = columns.find((entry) => {
              const rect = entry.getBoundingClientRect();
              return x < rect.x + rect.width / 2;
            });
            drop = {
              kind: "place",
              columnId: column.dataset.columnId!,
              beforeId: before?.dataset.columnId,
            };
          } else {
            const cards = [
              ...column.querySelectorAll<HTMLElement>("[data-card-id]"),
            ].filter((entry) => entry.dataset.cardId !== item.id);
            const before = cards.find((entry) => {
              const rect = entry.getBoundingClientRect();
              return y < rect.y + rect.height / 2;
            });
            drop = {
              kind: "place",
              columnId: column.dataset.columnId!,
              beforeId: before?.dataset.cardId,
            };
          }
        }
      }
      setDrag({ ...item, ...geometry, x, y, drop });
    }
    function tick() {
      if (active) {
        const rect = board.getBoundingClientRect();
        if (y >= rect.top && y <= rect.bottom) {
          if (x > rect.right - 44) board.scrollLeft += 12;
          else if (x < rect.left + 44) board.scrollLeft -= 12;
        }
        if (y > window.innerHeight - 40) window.scrollBy(0, 10);
        else if (y < 40) window.scrollBy(0, -10);
        update();
      }
      frame = requestAnimationFrame(tick);
    }
    function move(event: PointerEvent) {
      if (event.pointerId !== pointerId) return;
      x = event.clientX;
      y = event.clientY;
      if (!active && Math.hypot(x - origin.x, y - origin.y) >= 6) {
        active = true;
        suppressClick.current = true;
        board.setPointerCapture(pointerId);
        document.getSelection()?.removeAllRanges();
      }
      if (active) {
        event.preventDefault();
        update();
      }
    }
    function stop() {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", cancel);
      if (board.hasPointerCapture(pointerId))
        board.releasePointerCapture(pointerId);
      setDrag(undefined);
    }
    function cancel() {
      stop();
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        stop();
      }
    }
    function up(event: PointerEvent) {
      if (event.pointerId !== pointerId) return;
      x = event.clientX;
      y = event.clientY;
      if (active) update();
      stop();
      if (active && drop) onDrop(item, drop);
    }
    cleanup.current();
    cleanup.current = stop;
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key);
    window.addEventListener("blur", cancel);
    frame = requestAnimationFrame(tick);
  }
  return {
    drag,
    onPointerDown,
    onClickCapture(event: React.MouseEvent) {
      if (suppressClick.current && event.detail !== 0) {
        event.preventDefault();
        event.stopPropagation();
        suppressClick.current = false;
      }
    },
  };
}
