export type Card = { id: string; title: string; description?: string };
export type Column = { id: string; name: string; cards: Card[] };
export type Board = { version: 1; columns: Column[] };
export class BoardSaveError extends Error {}

export function isBoard(value: unknown): value is Board {
  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    value.version !== 1 ||
    !("columns" in value) ||
    !Array.isArray(value.columns) ||
    !value.columns.length
  )
    return false;
  const columnIds = new Set<string>();
  const cardIds = new Set<string>();
  for (const column of value.columns) {
    if (
      !column ||
      typeof column !== "object" ||
      typeof column.id !== "string" ||
      !column.id.trim() ||
      columnIds.has(column.id) ||
      typeof column.name !== "string" ||
      !column.name.trim() ||
      column.name.length > 80 ||
      !Array.isArray(column.cards)
    )
      return false;
    columnIds.add(column.id);
    for (const card of column.cards) {
      if (
        !card ||
        typeof card !== "object" ||
        typeof card.id !== "string" ||
        !card.id.trim() ||
        cardIds.has(card.id) ||
        typeof card.title !== "string" ||
        !card.title.trim() ||
        card.title.length > 200 ||
        (card.description !== undefined &&
          (typeof card.description !== "string" ||
            card.description.length > 20_000))
      )
        return false;
      cardIds.add(card.id);
    }
  }
  return true;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("doneward", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("boards");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Storage is blocked"));
  });
}

export async function saveBoard(board: Board): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("boards", "readwrite");
      transaction.objectStore("boards").put(board, "current");
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function loadBoard(): Promise<Board> {
  const database = await openDatabase();
  let saved: { exists: boolean; value: unknown };
  try {
    saved = await new Promise((resolve, reject) => {
      const transaction = database.transaction("boards", "readonly");
      const request = transaction.objectStore("boards").get("current");
      const key = transaction.objectStore("boards").getKey("current");
      transaction.oncomplete = () =>
        resolve({ exists: key.result !== undefined, value: request.result });
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
  if (saved.exists) {
    if (!isBoard(saved.value)) throw new Error("Invalid saved board");
    return saved.value;
  }
  const board: Board = {
    version: 1,
    columns: [
      {
        id: "todo",
        name: "Todo",
        cards: [
          {
            id: "welcome",
            title: "Welcome to Doneward",
            description:
              "Make room for what matters. Your board is saved on this device.",
          },
        ],
      },
      { id: "doing", name: "Doing", cards: [] },
      { id: "done", name: "Done", cards: [] },
    ],
  };
  try {
    await saveBoard(board);
  } catch (cause) {
    throw new BoardSaveError("The starter board could not be saved.", {
      cause,
    });
  }
  return board;
}
