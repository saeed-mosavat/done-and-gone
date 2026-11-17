import { useState } from "react";
import type { Column } from "./storage";
import { Confirmation } from "./confirmation";

export function ColumnDeletion({
  column,
  columns,
  onCancel,
  onConfirm,
}: {
  column: Column;
  columns: Column[];
  onCancel: () => void;
  onConfirm: (destinationId?: string) => void;
}) {
  const [choice, setChoice] = useState<"move" | "delete">();
  const [destinationId, setDestinationId] = useState("");
  const populated = column.cards.length > 0;
  return (
    <Confirmation
      title="Delete column?"
      cancelLabel="Cancel"
      confirmLabel="Delete column"
      confirmDisabled={
        populated && (!choice || (choice === "move" && !destinationId))
      }
      onCancel={onCancel}
      onConfirm={() => {
        if (populated && (!choice || (choice === "move" && !destinationId)))
          return;
        onConfirm(choice === "move" ? destinationId : undefined);
      }}
    >
      <p>
        Delete <bdi dir="auto">{column.name}</bdi>? This cannot be undone.
      </p>
      {populated && (
        <fieldset className="column-deletion-choices">
          <legend>
            What should happen to its {column.cards.length} cards?
          </legend>
          <label>
            <input
              type="radio"
              name="column-deletion"
              checked={choice === "move"}
              onChange={() => setChoice("move")}
            />{" "}
            Move cards to another column
          </label>
          {choice === "move" && (
            <>
              <label htmlFor="destination-column">Destination column</label>
              <select
                id="destination-column"
                dir="auto"
                value={destinationId}
                onChange={(event) => setDestinationId(event.target.value)}
              >
                <option value="">Choose a column</option>
                {columns.map(
                  (destination, index) =>
                    destination.id !== column.id && (
                      <option
                        key={destination.id}
                        value={destination.id}
                        dir="auto"
                      >
                        {index + 1}. {destination.name}
                      </option>
                    )
                )}
              </select>
              <p className="column-action-hint">
                Cards will be appended after the destination&apos;s existing
                cards.
              </p>
            </>
          )}
          <label>
            <input
              type="radio"
              name="column-deletion"
              checked={choice === "delete"}
              onChange={() => setChoice("delete")}
            />{" "}
            Delete column and all its cards
          </label>
        </fieldset>
      )}
    </Confirmation>
  );
}
