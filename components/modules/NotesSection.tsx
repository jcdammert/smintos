"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createNoteAction, deleteNoteAction, importGhlNotesAction } from "@/lib/actions";
import { formatDate, formatTime } from "@/lib/format";
import type { Note } from "@/types";

export function NotesSection({
  clientId,
  notes,
  tz,
}: {
  clientId: string;
  notes: Note[];
  tz: string;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [importPending, startImport] = useTransition();
  const router = useRouter();

  function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    start(async () => {
      const res = await createNoteAction(clientId, body);
      if (!res.ok) {
        setError(res.error ?? "Failed to save note.");
      } else {
        setBody("");
        router.refresh();
      }
    });
  }

  function runImport() {
    setImportMsg(null);
    startImport(async () => {
      const res = await importGhlNotesAction(clientId);
      if (res.error) {
        setImportMsg(`Error: ${res.error}`);
      } else {
        setImportMsg(
          res.imported > 0
            ? `Imported ${res.imported} note${res.imported === 1 ? "" : "s"} from GoHighLevel.`
            : "No new notes found in GoHighLevel.",
        );
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-text-primary">
          Notes
        </h2>
        <button
          onClick={runImport}
          disabled={importPending}
          className="text-xs font-semibold text-mint-dark disabled:opacity-50"
        >
          {importPending ? "Importing…" : "↓ Sync from GHL"}
        </button>
      </div>

      {importMsg && (
        <p
          className={`text-xs ${
            importMsg.startsWith("Error") ? "text-danger" : "text-[#067a44]"
          }`}
        >
          {importMsg}
        </p>
      )}

      {/* Add note form */}
      <form onSubmit={addNote} className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note… (syncs to GoHighLevel)"
          rows={3}
          className="w-full resize-y rounded-card border border-line bg-white px-3 py-2 text-sm outline-none focus:border-mint focus:ring-2 focus:ring-mint/30 placeholder:text-text-secondary"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="min-h-[44px] w-full rounded-card bg-mint text-sm font-semibold text-ink transition active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save note"}
        </button>
      </form>

      {/* Notes list */}
      {notes.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-white p-4 text-center text-sm text-text-secondary">
          No notes yet. Add one above or sync from GoHighLevel.
        </p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              clientId={clientId}
              tz={tz}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function NoteCard({
  note,
  clientId,
  tz,
}: {
  note: Note;
  clientId: string;
  tz: string;
}) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    start(async () => {
      await deleteNoteAction(note.id, clientId);
      router.refresh();
    });
  }

  return (
    <div className="rounded-card border border-line bg-white p-3">
      <p className="whitespace-pre-wrap text-sm text-text-primary">
        {note.body}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-[11px] text-text-secondary">
          {formatDate(note.created_at, tz)} · {formatTime(note.created_at, tz)}
          {note.ghl_note_id && (
            <span className="ml-1 text-mint-dark">· GHL ✓</span>
          )}
        </p>
        <button
          onClick={handleDelete}
          disabled={pending}
          className={`text-[11px] font-semibold transition ${
            confirming ? "text-danger" : "text-text-secondary"
          } disabled:opacity-50`}
        >
          {pending ? "Deleting…" : confirming ? "Tap again to confirm" : "Delete"}
        </button>
      </div>
    </div>
  );
}
