import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config. Contains NO providers that pull in Node-only modules
 * (e.g. nodemailer), so it can be imported by middleware running on the Edge
 * runtime. The full config in lib/auth.ts spreads this and adds the
 * Nodemailer provider + Supabase-backed callbacks (Node runtime only).
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    verifyRequest: "/login?check=1",
  },
  providers: [],
};
