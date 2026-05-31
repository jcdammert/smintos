import { cache } from "react";
import { getCurrentUser } from "@/lib/session";

/**
 * Resolves the current user's timezone, cached per request so multiple
 * server components in the same render share one DB lookup.
 *
 * Falls back to Eastern time if the user hasn't picked one (matches the
 * most common Smintos client at MVP launch).
 */
export const getUserTimezone = cache(async (): Promise<string> => {
  const user = await getCurrentUser();
  return user?.timezone ?? "America/New_York";
});

/**
 * IANA timezone list for the Settings picker. Uses the runtime's full set
 * when available; falls back to a curated list otherwise.
 */
export function getAllTimezones(): string[] {
  const intlWithSupported = Intl as typeof Intl & {
    supportedValuesOf?: (key: "timeZone") => string[];
  };
  if (typeof intlWithSupported.supportedValuesOf === "function") {
    return intlWithSupported.supportedValuesOf("timeZone");
  }
  // Conservative fallback (mostly US + a handful international).
  return [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Phoenix",
    "America/Los_Angeles",
    "America/Anchorage",
    "Pacific/Honolulu",
    "America/Toronto",
    "America/Vancouver",
    "America/Mexico_City",
    "Europe/London",
    "Europe/Paris",
    "Australia/Sydney",
    "UTC",
  ];
}
