import { useState } from "react";
import { Confirmation } from "../board/confirmation";

export function UpdateNotice({
  apply,
  protectDraft = false,
  disabled = false,
}: {
  apply: () => void;
  protectDraft?: boolean;
  disabled?: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <div
        className="update-notice"
        role="note"
        aria-label="Application update"
        aria-live="polite"
      >
        <span>Update available</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => (protectDraft ? setConfirm(true) : apply())}
        >
          Reload to update
        </button>
      </div>
      {confirm && (
        <Confirmation
          title="Discard edits and update?"
          confirmLabel="Discard and reload"
          cancelLabel="Keep editing"
          onCancel={() => setConfirm(false)}
          onConfirm={apply}
        >
          <p>Unsaved edits will be lost. Keep editing to save them first.</p>
        </Confirmation>
      )}
    </>
  );
}
