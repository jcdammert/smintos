import { getCurrentUser } from "@/lib/session";
import { GhlTestPanel } from "@/components/modules/GhlTestPanel";

export const dynamic = "force-dynamic";

export default async function GhlTestPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold text-text-primary">
          GHL Connection Test
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Test each GHL API endpoint and see the raw response.
        </p>
      </header>
      <GhlTestPanel userId={user.id} />
    </div>
  );
}
