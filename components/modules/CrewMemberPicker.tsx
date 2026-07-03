"use client";

import { useState, useEffect, useTransition } from "react";
import { fetchCrewMembersAction, addCrewMemberAction } from "@/lib/actions";

export function CrewMemberPicker({ defaultValue }: { defaultValue?: string }) {
  const [value, setValue]         = useState(defaultValue ?? "");
  const [open, setOpen]           = useState(false);
  const [crew, setCrew]           = useState<string[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [newName, setNewName]     = useState("");
  const [addPending, startAdd]    = useTransition();

  useEffect(() => {
    fetchCrewMembersAction().then((names) => {
      setCrew(names);
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = value.trim()
    ? crew.filter((n) => n.toLowerCase().includes(value.toLowerCase()))
    : crew;

  function pick(name: string) {
    setValue(name);
    setOpen(false);
    setShowAdd(false);
    setNewName("");
  }

  function handleAdd() {
    if (!newName.trim()) return;
    startAdd(async () => {
      await addCrewMemberAction(newName.trim());
      const added = newName.trim();
      setCrew((prev) => [...prev, added].sort());
      pick(added);
    });
  }

  function closeDropdown() { setOpen(false); setShowAdd(false); }

  return (
    <div className="relative">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-text-primary">Assigned to</span>
        <input
          name="assigned_to"
          value={value}
          onChange={(e) => { setValue(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Select crew member…"
          autoComplete="off"
          className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base text-text-primary outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30 placeholder:text-text-secondary"
        />
      </label>

      {open && (
        <>
          <div className="fixed inset-0 z-[70]" onClick={closeDropdown} />
          <div className="absolute left-0 right-0 top-full z-[80] mt-1 max-h-60 overflow-y-auto rounded-card border border-line bg-white shadow-xl">
            {loading ? (
              <p className="px-4 py-3 text-sm text-text-secondary">Loading…</p>
            ) : (
              <>
                {filtered.length === 0 && !showAdd && (
                  <p className="px-4 py-3 text-sm text-text-secondary">
                    {crew.length === 0 ? "No crew members yet." : "No matches."}
                  </p>
                )}
                {filtered.map((name) => (
                  <button key={name} type="button" onClick={() => pick(name)}
                    className={`flex w-full px-4 py-2.5 text-left text-sm font-medium text-text-primary transition active:bg-bg ${value === name ? "bg-mint/10" : ""}`}
                  >
                    {name}
                  </button>
                ))}

                {!showAdd ? (
                  <button type="button" onClick={() => setShowAdd(true)}
                    className="flex w-full items-center gap-2 border-t border-line px-4 py-3 text-sm font-semibold text-mint-dark transition active:bg-mint/5"
                  >
                    <span className="text-lg font-bold leading-none">+</span> Add crew member
                  </button>
                ) : (
                  <div className="border-t border-line p-3 space-y-2">
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
                      placeholder="Crew member name"
                      autoFocus
                      className="min-h-[40px] w-full rounded-lg border border-line px-3 text-sm text-text-primary outline-none focus:border-mint focus:ring-2 focus:ring-mint/30"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => { setShowAdd(false); setNewName(""); }}
                        className="min-h-[36px] rounded-lg border border-line text-sm font-semibold text-text-secondary transition active:scale-[0.98]">
                        Cancel
                      </button>
                      <button type="button" onClick={handleAdd} disabled={addPending || !newName.trim()}
                        className="min-h-[36px] rounded-lg bg-mint text-sm font-semibold text-ink transition active:scale-[0.98] disabled:opacity-50">
                        {addPending ? "…" : "Add"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
