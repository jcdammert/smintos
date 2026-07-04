"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  addContactTagAction,
  removeContactTagAction,
  fetchLocationTagsAction,
} from "@/lib/actions";

export function ContactTags({
  ghlContactId,
  initialTags,
}: {
  ghlContactId: string;
  initialTags: string[];
}) {
  const [tags, setTags] = useState(initialTags);
  const [locationTags, setLocationTags] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load location tags once for autocomplete
  useEffect(() => {
    fetchLocationTagsAction().then((r) => {
      if (r.ok) setLocationTags(r.tags);
    });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const trimmed = input.trim();

  const suggestions = locationTags.filter(
    (t) =>
      !tags.includes(t) &&
      t.toLowerCase().includes(trimmed.toLowerCase()),
  );

  const isNew =
    trimmed.length > 0 &&
    !locationTags.some((t) => t.toLowerCase() === trimmed.toLowerCase()) &&
    !tags.some((t) => t.toLowerCase() === trimmed.toLowerCase());

  function addTag(tag: string) {
    const clean = tag.trim();
    if (!clean || tags.includes(clean)) return;
    setInput("");
    setOpen(false);
    setError(null);
    start(async () => {
      const res = await addContactTagAction(ghlContactId, clean);
      if (!res.ok) {
        setError(res.error ?? "Failed to add tag");
      } else {
        setTags(res.tags.length > 0 ? res.tags : [...tags, clean]);
      }
    });
  }

  function removeTag(tag: string) {
    setError(null);
    start(async () => {
      const res = await removeContactTagAction(ghlContactId, tag);
      if (!res.ok) {
        setError(res.error ?? "Failed to remove tag");
      } else {
        setTags(res.tags);
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Existing tag pills */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-mint/10 px-2.5 py-0.5 text-xs font-semibold text-mint-dark"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={pending}
                className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-mint-dark/60 transition hover:bg-mint/20 hover:text-mint-dark disabled:opacity-40"
                aria-label={`Remove ${tag}`}
              >
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 1l10 10M11 1L1 11" strokeLinecap="round" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input + dropdown */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (suggestions[0]) addTag(suggestions[0]);
              else if (isNew) addTag(trimmed);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Add a tag…"
          disabled={pending}
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm placeholder:text-text-secondary/50 focus:border-mint focus:outline-none disabled:opacity-50"
        />

        {open && (suggestions.length > 0 || isNew) && (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-white shadow-lg"
          >
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addTag(s); }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-text-primary transition hover:bg-mint/5 active:bg-mint/10"
              >
                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-mint/40" />
                {s}
              </button>
            ))}
            {isNew && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addTag(trimmed); }}
                className="flex w-full items-center gap-2 border-t border-line px-3 py-2.5 text-sm font-semibold text-mint-dark transition hover:bg-mint/5 active:bg-mint/10"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                </svg>
                Add &ldquo;{trimmed}&rdquo;
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
