"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importGhlContactsAction } from "@/lib/actions";

export function ImportContactsButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  function runImport() {
    setMsg(null);
    start(async () => {
      const res = await importGhlContactsAction();
      if (res.error) {
        setMsg(`Error: ${res.error}`);
      } else {
        setMsg(`Imported ${res.imported} contact${res.imported === 1 ? "" : "s"} from GoHighLevel.`);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        onClick={runImport}
        disabled={pending}
        className="min-h-[44px] w-full rounded-card border border-line bg-white px-4 text-sm font-semibold text-text-primary transition active:scale-[0.99] disabled:opacity-50"
      >
        {pending ? "Importing from GoHighLevel…" : "↓ Import contacts from GoHighLevel"}
      </button>
      {msg && (
        <p
          className={`text-center text-sm ${
            msg.startsWith("Error") ? "text-danger" : "text-[#067a44]"
          }`}
        >
          {msg}
        </p>
      )}
    </div>
  );
}
