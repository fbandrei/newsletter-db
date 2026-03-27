import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });

  // Protect /settings/* and /admin/* — redirect to sign-in if unauthenticated
  if (pathname.startsWith("/settings") || pathname.startsWith("/admin")) {
    if (!token) {
      const signInUrl = new URL("/sign-in", req.nextUrl.origin);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  // Protect comment and rating API routes
  if (
    pathname.match(/^\/api\/newsletters\/[^/]+\/comments/) ||
    pathname.match(/^\/api\/newsletters\/[^/]+\/ratings/)
  ) {
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/settings/:path*",
    "/admin/:path*",
    "/api/newsletters/:id/comments/:path*",
    "/api/newsletters/:id/ratings/:path*",
  ],
};
