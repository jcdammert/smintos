import Link from "next/link";
import { ClientForm } from "@/components/modules/ClientForm";

export default function NewClientPage() {
  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Link
          href="/clients"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white"
          aria-label="Back"
        >
          ←
        </Link>
        <h1 className="font-display text-2xl font-bold text-text-primary">
          New client
        </h1>
      </header>

      <ClientForm />
    </div>
  );
}
