"use client";

import { useState, useRef, useTransition } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { createClientAction } from "@/lib/actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

let mapsReady = false;

export function ClientForm() {
  const [pending, start] = useTransition();

  // Address fields — controlled so Places can auto-fill them
  const streetRef = useRef<HTMLInputElement>(null);
  const acInit = useRef(false);

  const [street,     setStreet]     = useState("");
  const [city,       setCity]       = useState("");
  const [state,      setState]      = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country,    setCountry]    = useState("US");

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
          if (c.types.includes("street_number"))           num      = c.long_name;
          if (c.types.includes("route"))                   route    = c.long_name;
          if (c.types.includes("locality"))                locality = c.long_name;
          if (c.types.includes("sublocality") && !locality) locality = c.long_name;
          if (c.types.includes("administrative_area_level_1")) adminL1 = c.short_name;
          if (c.types.includes("postal_code"))             zip      = c.long_name;
          if (c.types.includes("country"))                 ctry     = c.short_name;
        }

        const full = `${num} ${route}`.trim();
        setStreet(full);
        if (streetRef.current) streetRef.current.value = full;
        if (locality)  setCity(locality);
        if (adminL1)   setState(adminL1);
        if (zip)       setPostalCode(zip);
        if (ctry)      setCountry(ctry);
      });
    });
  }

  return (
    <form
      action={(fd) => start(() => createClientAction(fd))}
      className="space-y-4"
    >
      {/* Name fields */}
      <div className="grid grid-cols-2 gap-3">
        <Input id="first_name" name="first_name" label="First name" autoComplete="given-name" />
        <Input id="last_name"  name="last_name"  label="Last name"  autoComplete="family-name" />
      </div>
      <Input id="business_name" name="business_name" label="Business name" autoComplete="organization" />

      {/* Contact */}
      <Input id="phone" name="phone" type="tel"   label="Phone" autoComplete="tel" />
      <Input id="email" name="email" type="email" label="Email" autoComplete="email" />

      {/* Address */}
      <div className="space-y-3 pt-1">
        <p className="text-sm font-semibold text-text-primary">Address</p>

        {/* Street — autocomplete-enabled controlled input */}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-text-primary">Street address</span>
          <input
            ref={streetRef}
            name="address"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            onFocus={initPlaces}
            autoComplete="off"
            className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base text-text-primary outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30 placeholder:text-text-secondary"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-text-primary">City</span>
            <input name="city"  value={city}  onChange={(e) => setCity(e.target.value)}
              className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base text-text-primary outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-text-primary">State</span>
            <input name="state" value={state} onChange={(e) => setState(e.target.value)}
              className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base text-text-primary outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-text-primary">Zip code</span>
            <input name="postal_code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)}
              inputMode="numeric"
              className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base text-text-primary outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-text-primary">Country</span>
            <input name="country" value={country} onChange={(e) => setCountry(e.target.value)}
              className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base text-text-primary outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30"
            />
          </label>
        </div>
      </div>

      <p className="text-xs text-text-secondary">
        Saved clients sync to GoHighLevel as a contact when your account is connected.
      </p>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Save client"}
      </Button>
    </form>
  );
}
