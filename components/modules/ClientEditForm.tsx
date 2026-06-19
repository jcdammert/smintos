"use client";

import { useTransition } from "react";
import { updateClientAction } from "@/lib/actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Client } from "@/types";

export function ClientEditForm({ client }: { client: Client }) {
  const [pending, start] = useTransition();

  return (
    <form
      action={(fd) => start(() => updateClientAction(client.id, fd))}
      className="space-y-4"
    >
      <Input
        id="name"
        name="name"
        label="Name"
        required
        defaultValue={client.name}
      />
      <Input
        id="phone"
        name="phone"
        type="tel"
        label="Phone"
        defaultValue={client.phone ?? ""}
      />
      <Input
        id="email"
        name="email"
        type="email"
        label="Email"
        defaultValue={client.email ?? ""}
      />

      <div className="pt-2">
        <p className="mb-2 text-sm font-semibold text-text-primary">Address</p>
        <div className="space-y-3">
          <Input
            id="address"
            name="address"
            label="Street address"
            defaultValue={client.address ?? ""}
            autoComplete="address-line1"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="city"
              name="city"
              label="City"
              defaultValue={client.city ?? ""}
              autoComplete="address-level2"
            />
            <Input
              id="state"
              name="state"
              label="State"
              defaultValue={client.state ?? ""}
              autoComplete="address-level1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="postal_code"
              name="postal_code"
              label="Zip code"
              inputMode="numeric"
              defaultValue={client.postal_code ?? ""}
              autoComplete="postal-code"
            />
            <Input
              id="country"
              name="country"
              label="Country"
              defaultValue={client.country ?? "US"}
              autoComplete="country"
            />
          </div>
        </div>
      </div>

      <p className="text-xs text-text-secondary">
        Changes sync to GoHighLevel automatically when connected.
      </p>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
