import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(categories);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load categories" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name } = await req.json().catch(() => ({}));
    const clean = String(name || "").trim();
    if (!clean) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const cat = await prisma.category.upsert({
      where: { name: clean },
      update: {}, // idempotent
      create: { name: clean },
    });

    return NextResponse.json(cat, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to create category" }, { status: 500 });
  }
}
