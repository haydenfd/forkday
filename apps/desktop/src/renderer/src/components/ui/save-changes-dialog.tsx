import { useEffect, useRef, useState } from 'react';
import { Button } from './button';

export function SaveChangesDialog({
  section,
  onSave,
  onDiscard,
  onCancel,
}: {
  section: string;
  onSave: () => Promise<string | undefined>;
  onDiscard: () => void;
  onCancel: () => void;
}): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="save-changes-title"
      aria-describedby="save-changes-description"
      className="fixed m-auto w-[min(30rem,calc(100vw-2rem))] max-w-none rounded-xl border bg-card p-6 text-foreground shadow-xl backdrop:bg-black/60"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id="save-changes-title" className="text-lg font-semibold">
        Save changes?
      </h2>
      <p
        id="save-changes-description"
        className="mt-2 text-sm text-muted-foreground"
      >
        You have unsaved changes in {section}.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button
          autoFocus
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={onCancel}
        >
          Keep editing
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onDiscard}
        >
          Discard
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setError(await onSave());
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </dialog>
  );
}
