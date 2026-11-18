import type { Board, Card } from "./storage";

// Position is an index in the destination after removing the moving card.
export function placeCard(
  board: Board,
  card: Card,
  columnId: string,
  position: number
): Board {
  return {
    ...board,
    columns: board.columns.map((column) => {
      const cards = column.cards.filter((existing) => existing.id !== card.id);
      if (column.id === columnId) cards.splice(position, 0, card);
      return { ...column, cards };
    }),
  };
}

export function placeColumn(
  board: Board,
  columnId: string,
  position: number
): Board {
  const column = board.columns.find((existing) => existing.id === columnId)!;
  const columns = board.columns.filter((existing) => existing.id !== columnId);
  columns.splice(position, 0, column);
  return { ...board, columns };
}
