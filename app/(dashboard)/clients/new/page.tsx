import Link from "next/link";
import { createClientAction } from "@/lib/actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

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

      <form action={createClientAction} className="space-y-4">
        <Input id="name" name="name" label="Name" required placeholder="Jane Contractor" />
        <Input id="phone" name="phone" type="tel" label="Phone" placeholder="(555) 123-4567" />
        <Input id="email" name="email" type="email" label="Email" placeholder="jane@example.com" />
        <Input id="address" name="address" label="Address" placeholder="123 Main St" />
        <p className="text-xs text-text-secondary">
          Saved clients sync to GoHighLevel as a contact when your account is
          connected.
        </p>
        <Button type="submit" size="lg">
          Save client
        </Button>
      </form>
    </div>
  );
}
