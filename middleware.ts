import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Edge-safe NextAuth instance — uses authConfig only (no nodemailer / Node APIs).
const { auth } = NextAuth(authConfig);

/**
 * Protect all dashboard routes. The dashboard lives at the root via the
 * (dashboard) route group, so we guard "/" and each module path.
 * Unauthenticated users are redirected to /login.
 */
export default auth((req) => {
  const isLoggedIn = !!req.auth;

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

/**
 * Matcher covers every dashboard path but excludes /login, /api, and static
 * assets so auth + magic-link flows stay public.
 */
export const config = {
  matcher: [
    "/",
    "/clients/:path*",
    "/estimates/:path*",
    "/invoices/:path*",
    "/schedule/:path*",
    "/settings/:path*",
  ],
};
