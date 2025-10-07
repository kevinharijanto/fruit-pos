import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

/** GET /api/items */
export async function GET() {
  const items = await prisma.item.findMany({
    orderBy: { name: "asc" },
    include: { category: true },
  });

  // Convert Decimal -> number for JSON
  const out = items.map((it) => ({
    ...it,
    stock: Number(it.stock),
  }));

  return NextResponse.json(out);
}

/** POST /api/items */
export async function POST(req: Request) {
  const b = await req.json();

  const name = String(b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const price = Math.max(0, Math.floor(Number(b.price ?? 0)));
  const costPrice = Math.max(0, Math.floor(Number(b.costPrice ?? 0)));

  const unit: "PCS" | "KG" = b.unit === "KG" ? "KG" : "PCS";
  const stockMode: "TRACK" | "RESELL" = b.stockMode === "RESELL" ? "RESELL" : "TRACK";

  let stockNum = Number(b.stock ?? 0);
  if (!Number.isFinite(stockNum) || stockNum < 0) stockNum = 0;
  if (stockMode !== "TRACK") stockNum = 0; // resell: do not track stock

  // Category by id or name
  let categoryId: string | undefined = typeof b.categoryId === "string" && b.categoryId ? b.categoryId : undefined;
  const categoryName = typeof b.categoryName === "string" ? b.categoryName.trim() : "";
  if (!categoryId && categoryName) {
    const cat = await prisma.category.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName },
    });
    categoryId = cat.id;
  }

  const created = await prisma.item.create({
    data: {
      name,
      price,
      costPrice,
      unit,
      stockMode,
      stock: new Prisma.Decimal(stockNum),
      ...(categoryId ? { categoryId } : {}),
    },
    include: { category: true },
  });

  return NextResponse.json(
    {
      ...created,
      stock: Number(created.stock),
    },
    { status: 201 }
  );
}
