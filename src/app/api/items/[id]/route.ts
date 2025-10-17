import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

/** PATCH /api/items/:id */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const b = await req.json();

  const data: any = {};

  if (typeof b.name === "string") data.name = b.name.trim();
  if (typeof b.price === "number") data.price = Math.max(0, Math.floor(b.price));
  if (typeof b.costPrice === "number") data.costPrice = Math.max(0, Math.floor(b.costPrice));

  if (b.unit === "PCS" || b.unit === "KG") data.unit = b.unit;
  if (b.stockMode === "TRACK" || b.stockMode === "RESELL") data.stockMode = b.stockMode;

  // Stock only if tracking
  if (typeof b.stock === "number" && (data.stockMode ? data.stockMode === "TRACK" : undefined)) {
    const num = Math.max(0, b.stock);
    data.stock = new Prisma.Decimal(num);
  }
  // If the caller flips to RESELL, we can force stock to 0 (optional but tidy)
  if (data.stockMode === "RESELL") {
    data.stock = new Prisma.Decimal(0);
  }

  // Category: id or name
  if (typeof b.categoryId === "string") {
    data.categoryId = b.categoryId || null;
  }
  if (typeof b.categoryName === "string") {
    const name = b.categoryName.trim();
    if (name) {
      const cat = await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
      data.categoryId = cat.id;
    } else {
      data.categoryId = null;
    }
  }

  const updated = await prisma.item.update({
    where: { id },
    data,
    include: { category: true },
  });

  return NextResponse.json({
    ...updated,
    stock: Number(updated.stock),
  });
}

/** DELETE /api/items/:id */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  
  // Check if item is referenced in any orders
  const orderItemsCount = await prisma.orderItem.count({
    where: { itemId: id }
  });
  
  const sellerOrderItemsCount = await prisma.sellerOrderItem.count({
    where: { itemId: id }
  });
  
  if (orderItemsCount > 0 || sellerOrderItemsCount > 0) {
    return NextResponse.json(
      {
        error: "Cannot delete item that is referenced in orders. Please remove the item from all orders first.",
        orderItemsCount,
        sellerOrderItemsCount
      },
      { status: 400 }
    );
  }
  
  // Safe to delete the item
  await prisma.item.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
