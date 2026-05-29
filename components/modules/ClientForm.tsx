"use client";

import { useTransition } from "react";
import { createClientAction } from "@/lib/actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function ClientForm() {
  const [pending, start] = useTransition();

  return (
    <form
      action={(fd) => start(() => createClientAction(fd))}
      className="space-y-4"
    >
      <Input id="name" name="name" label="Name" required placeholder="Jane Contractor" />
      <Input id="phone" name="phone" type="tel" label="Phone" placeholder="(555) 123-4567" />
      <Input id="email" name="email" type="email" label="Email" placeholder="jane@example.com" />

      <div className="pt-2">
        <p className="mb-2 text-sm font-semibold text-text-primary">Address</p>
        <div className="space-y-3">
          <Input
            id="address"
            name="address"
            label="Street address"
            placeholder="123 Main St"
            autoComplete="address-line1"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="city"
              name="city"
              label="City"
              placeholder="Miami"
              autoComplete="address-level2"
            />
            <Input
              id="state"
              name="state"
              label="State"
              placeholder="FL"
              autoComplete="address-level1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="postal_code"
              name="postal_code"
              label="Zip code"
              inputMode="numeric"
              placeholder="33101"
              autoComplete="postal-code"
            />
            <Input
              id="country"
              name="country"
              label="Country"
              defaultValue="US"
              placeholder="US"
              autoComplete="country"
            />
          </div>
        </div>
      </div>

      <p className="text-xs text-text-secondary">
        Saved clients sync to GoHighLevel as a contact when your account is
        connected.
      </p>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Save client"}
      </Button>
    </form>
  );
}
