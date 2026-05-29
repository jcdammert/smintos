import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { check?: string; error?: string };
}) {
  const checkEmail = searchParams.check === "1";
  const hasError = Boolean(searchParams.error);

  async function sendMagicLink(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    if (!email) return;
    await signIn("nodemailer", { email, redirectTo: "/" });
  }

  return (
    <main className="flex min-h-screen flex-col bg-ink px-6 py-12 text-white">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-card bg-mint text-xl font-bold text-ink">
            S
          </div>
          <h1 className="font-display text-3xl font-bold">Smintos</h1>
          <p className="mt-2 text-sm text-white/60">
            Field service operations, one login.
          </p>
        </div>

        {checkEmail ? (
          <div className="rounded-card border border-mint/30 bg-mint/10 p-6 text-center">
            <p className="font-display text-lg font-semibold text-mint">
              Check your email
            </p>
            <p className="mt-2 text-sm text-white/70">
              We sent you a magic link. Tap it to sign in — no password needed.
            </p>
          </div>
        ) : (
          <form action={sendMagicLink} className="space-y-4">
            <div className="rounded-card bg-white p-4">
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@business.com"
                label="Work email"
                autoComplete="email"
              />
            </div>
            {hasError && (
              <p className="text-sm text-red-300">
                Something went wrong sending your link. Try again.
              </p>
            )}
            <Button type="submit" variant="primary" size="lg">
              Send magic link
            </Button>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-white/40">
          Powered by Scale Mint
        </p>
      </div>
    </main>
  );
}
