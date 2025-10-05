import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Public paths
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/images")
  ) {
    return NextResponse.next();
  }

  // Check cookie
  const session = req.cookies.get("pos_admin")?.value;
  if (session === "1") return NextResponse.next();

  // Redirect to /login?next=<current>
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + (search || ""))}`;
  return NextResponse.redirect(url);
}

// Run middleware for everything except static files
export const config = {
  matcher: ["/((?!.+\\.[\\w]+$).*)", "/"],
};
