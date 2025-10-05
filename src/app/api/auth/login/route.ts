import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const input = String(body?.password || "");

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
  if (!ADMIN_PASSWORD || input !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: "pos_admin",
    value: "1",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
