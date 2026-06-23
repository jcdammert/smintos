import { getCurrentUser } from "@/lib/session";
import { updateSettingsAction } from "@/lib/actions";
import { signOut } from "@/lib/auth";
import { getAllTimezones } from "@/lib/timezone";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const keyPlaceholder = user.ghl_api_key
    ? "•".repeat(20) + " (saved)"
    : "Paste your GHL API key";

  const timezones = getAllTimezones();
  const currentTz = user.timezone ?? "America/New_York";

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold text-text-primary">
          Account
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage your business and GoHighLevel connection.
        </p>
      </header>

      <form action={updateSettingsAction} className="space-y-4">
        <Card>
          <div className="space-y-4">
            <Input
              id="business_name"
              name="business_name"
              label="Business name"
              defaultValue={user.business_name ?? ""}
              placeholder="Acme Pressure Washing"
            />
            <Input
              id="email"
              name="email"
              label="Email"
              type="email"
              defaultValue={user.email}
              disabled
              hint="Your login email can't be changed here."
            />

            <label htmlFor="timezone" className="block">
              <span className="mb-1.5 block text-sm font-medium text-text-primary">
                Time zone
              </span>
              <select
                id="timezone"
                name="timezone"
                defaultValue={currentTz}
                className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base outline-none focus:border-mint focus:ring-2 focus:ring-mint/30"
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-text-secondary">
                All dates and times in the app will display in this zone.
              </span>
            </label>
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <p className="text-sm font-semibold text-text-primary">
              GoHighLevel connection
            </p>
            <Input
              id="ghl_location_id"
              name="ghl_location_id"
              label="GHL Location ID"
              defaultValue={user.ghl_location_id ?? ""}
              placeholder="e.g. ve9EPM428h8vShlRW1KT"
            />
            <Input
              id="ghl_api_key"
              name="ghl_api_key"
              label="GHL API Key"
              type="password"
              placeholder={keyPlaceholder}
              hint="Leave blank to keep your current key. Never shown after saving."
            />
            <p className="text-xs text-text-secondary">
              {user.ghl_location_id && user.ghl_api_key
                ? "✓ Connected — contacts, invoices, and calendar events sync to GHL."
                : "Not connected. The pipeline still works locally until you connect."}
            </p>
            {user.ghl_location_id && user.ghl_api_key && (
              <a href="/settings/ghl-test" className="text-xs font-semibold text-mint-dark">
                → Test GHL connection & scopes
              </a>
            )}
          </div>
        </Card>

        <Button type="submit" size="lg">
          Save changes
        </Button>
      </form>

      <form action={signOutAction}>
        <Button type="submit" variant="outline" size="lg">
          Sign out
        </Button>
      </form>

      <p className="pb-2 text-center text-xs text-text-secondary">
        Smintos · Powered by Scale Mint
      </p>
    </div>
  );
}
