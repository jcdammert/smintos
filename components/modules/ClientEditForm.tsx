"use client";

import { useState, useRef, useTransition } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { updateClientAction } from "@/lib/actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Client } from "@/types";

let mapsReady = false;

/** Split "First Last" → { firstName, lastName }. Works for any number of words. */
function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function ClientEditForm({ client }: { client: Client }) {
  const [pending, start] = useTransition();

  const { firstName: initFirst, lastName: initLast } = splitName(client.name);

  // Address state — controlled so Places autocomplete can fill them
  const streetRef = useRef<HTMLInputElement>(null);
  const acInit    = useRef(false);

  const [street,     setStreet]     = useState(client.address    ?? "");
  const [city,       setCity]       = useState(client.city       ?? "");
  const [state,      setState]      = useState(client.state      ?? "");
  const [postalCode, setPostalCode] = useState(client.postal_code ?? "");
  const [country,    setCountry]    = useState(client.country    ?? "US");

  function initPlaces() {
    if (acInit.current || !streetRef.current) return;
    acInit.current = true;

    if (!mapsReady) {
      setOptions({ key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "", v: "weekly" });
      mapsReady = true;
    }

    importLibrary("places").then(() => {
      if (!streetRef.current) return;
      const ac = new google.maps.places.Autocomplete(streetRef.current, {
        types: ["address"],
        fields: ["address_components"],
      });

      ac.addListener("place_changed", () => {
        const components = ac.getPlace().address_components ?? [];
        let num = "", route = "", locality = "", adminL1 = "", zip = "", ctry = "";

        for (const c of components) {
          if (c.types.includes("street_number"))               num      = c.long_name;
          if (c.types.includes("route"))                       route    = c.long_name;
          if (c.types.includes("locality"))                    locality = c.long_name;
          if (c.types.includes("sublocality") && !locality)   locality = c.long_name;
          if (c.types.includes("administrative_area_level_1")) adminL1  = c.short_name;
          if (c.types.includes("postal_code"))                 zip      = c.long_name;
          if (c.types.includes("country"))                     ctry     = c.short_name;
        }

        const full = `${num} ${route}`.trim();
        setStreet(full);
        if (streetRef.current) streetRef.current.value = full;
        if (locality) setCity(locality);
        if (adminL1)  setState(adminL1);
        if (zip)      setPostalCode(zip);
        if (ctry)     setCountry(ctry);
      });
    });
  }

  return (
    <form
      action={(fd) => start(() => updateClientAction(client.id, fd))}
      className="space-y-4"
    >
      {/* Name */}
      <div className="grid grid-cols-2 gap-3">
        <Input id="first_name" name="first_name" label="First name" defaultValue={initFirst} autoComplete="given-name" />
        <Input id="last_name"  name="last_name"  label="Last name"  defaultValue={initLast}  autoComplete="family-name" />
      </div>
      <Input id="business_name" name="business_name" label="Business name" autoComplete="organization" />

      {/* Contact */}
      <Input id="phone" name="phone" type="tel"   label="Phone" defaultValue={client.phone ?? ""} autoComplete="tel" />
      <Input id="email" name="email" type="email" label="Email" defaultValue={client.email ?? ""} autoComplete="email" />

      {/* Address */}
      <div className="space-y-3 pt-1">
        <p className="text-sm font-semibold text-text-primary">Address</p>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-text-primary">Street address</span>
          <input
            ref={streetRef}
            name="address"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            onFocus={initPlaces}
            autoComplete="off"
            className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base text-text-primary outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-text-primary">City</span>
            <input name="city" value={city} onChange={(e) => setCity(e.target.value)}
              className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base text-text-primary outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-text-primary">State</span>
            <input name="state" value={state} onChange={(e) => setState(e.target.value)}
              className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base text-text-primary outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-text-primary">Zip code</span>
            <input name="postal_code" value={postalCode} inputMode="numeric" onChange={(e) => setPostalCode(e.target.value)}
              className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base text-text-primary outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-text-primary">Country</span>
            <input name="country" value={country} onChange={(e) => setCountry(e.target.value)}
              className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base text-text-primary outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30" />
          </label>
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
