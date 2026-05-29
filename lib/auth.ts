import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { SupabaseAdapter } from "@auth/supabase-adapter";
import { authConfig } from "@/lib/auth.config";
import { createServiceSupabase } from "@/lib/supabase";

/**
 * Full NextAuth v5 config — magic-link (email) login via Nodemailer.
 * Runs on the Node runtime (API routes, server components, server actions).
 * Middleware uses the edge-safe authConfig directly instead.
 *
 * On first sign-in we ensure a row exists in the Supabase `users` table so the
 * rest of the app can attach GHL credentials and scope data by user id.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Stores magic-link verification tokens (and auth users/sessions) in the
  // `next_auth` schema of your Supabase project. Required by the email provider.
  adapter: SupabaseAdapter({
    // Placeholder fallbacks keep the build from failing when env vars are
    // absent (e.g. local CI build). Real values come from Vercel env at runtime.
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-role-key",
  }),
  providers: [
    Nodemailer({
      // Fallbacks keep the provider valid during build (when env vars may be
      // absent). Real SMTP credentials are injected at runtime via Vercel env.
      server: process.env.EMAIL_SERVER || "smtp://user:pass@localhost:587",
      from: process.env.EMAIL_FROM || "Smintos <no-reply@smintos.app>",
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const supabase = createServiceSupabase();
      const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();

      if (!existing) {
        await supabase.from("users").insert({ email: user.email });
      }
      return true;
    },
    async jwt({ token, user }) {
      // On initial sign-in, copy the email off the adapter user onto the token.
      if (user?.email) token.email = user.email;
      if (token.email && !token.uid) {
        const supabase = createServiceSupabase();
        const { data } = await supabase
          .from("users")
          .select("id")
          .eq("email", token.email)
          .maybeSingle();
        if (data) token.uid = data.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid && session.user) {
        session.user.id = token.uid as string;
      }
      return session;
    },
  },
});
