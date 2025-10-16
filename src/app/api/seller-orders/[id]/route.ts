// src/app/api/seller-orders/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/* ---------------------------
   Helpers
--------------------------- */
function toNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function qtyForUnit(rawQty: unknown, unit: "PCS" | "KG"): number {
  let q = toNumber(rawQty, 0);
  if (unit === "KG") {
    // keep 0.001 kg precision; clamp >= 0
    q = Math.max(0, Math.round(q * 1000) / 1000);
  } else {
    // PCS: integer only
    q = Math.max(0, Math.floor(q));
  }
  return q;
}

/* ---------------------------
   GET /api/seller-orders/[id]
--------------------------- */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const t0 = Date.now();
    const { id } = await params;

    const order = await prisma.sellerOrder.findUnique({
      where: { id },
      select: {
        id: true,
        paymentStatus: true,
        deliveryStatus: true,
        paidAt: true,
        deliveredAt: true,
        deliveryNote: true,
        paymentType: true,
        subtotal: true,
        discount: true,
        deliveryFee: true,
        total: true,
        createdAt: true,
        seller: {
          select: { name: true, whatsapp: true, address: true }
        },
        items: {
          select: {
            id: true,
            itemId: true,
            qty: true,
            price: true,
            item: { select: { name: true, unit: true } },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Serialize to plain JSON (Decimal -> number, Date -> ISO)
    const data = {
      id: order.id,
      paymentStatus: order.paymentStatus,
      deliveryStatus: order.deliveryStatus,
      paidAt: order.paidAt ? order.paidAt.toISOString() : null,
      deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
      deliveryNote: order.deliveryNote ?? null,
      paymentType: (order.paymentType ?? null) as "CASH" | "TRANSFER" | "QRIS" | null,
      subtotal: order.subtotal,
      discount: order.discount,
      deliveryFee: order.deliveryFee,
      total: order.total,
      createdAt: order.createdAt.toISOString(),
      seller: order.seller
        ? {
            name: order.seller.name ?? null,
            whatsapp: order.seller.whatsapp ?? null,
            address: order.seller.address ?? null,
          }
        : null,
      items: order.items.map((li: any) => ({
        id: li.id,
        itemId: li.itemId,
        qty: Number(li.qty),
        price: li.price,
        item: { 
          name: li.item?.name ?? "",
          unit: li.item?.unit ?? "PCS"
        },
      })),
    };

    const resp = NextResponse.json(data);
    console.log("GET /api/seller-orders/%s took %dms", id, Date.now() - t0);
    return resp;
  } catch (e: any) {
    console.error("GET /api/seller-orders/[id] failed:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

/* ---------------------------
   PUT /api/seller-orders/[id]
--------------------------- */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const t0 = Date.now();
    const { id } = await params;
    const body = await req.json();
    const {
      paymentStatus,
      deliveryStatus,
      paymentType,
      deliveryNote,
      discount,
      deliveryFee,
      seller,
      items,
    } = body || {};

    // Get the existing order (for status deltas and fallback totals)
    const existingOrder = await prisma.sellerOrder.findUnique({
      where: { id },
      select: {
        id: true,
        paymentStatus: true,
        deliveryStatus: true,
        items: { select: { id: true, itemId: true, qty: true, price: true } },
      },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // timing removed
    const updated = await prisma.$transaction(async (tx: any) => {
      // Enums
      let payEnum = existingOrder.paymentStatus;
      if (paymentStatus) {
        const payKey = String(paymentStatus).toLowerCase().trim();
        payEnum = payKey === "paid" ? "paid" : payKey === "refunded" ? "refunded" : "unpaid";
      }

      let shipEnum = existingOrder.deliveryStatus;
      if (deliveryStatus) {
        const shipKey = String(deliveryStatus).toLowerCase().trim();
        shipEnum = shipKey === "delivered" ? "delivered" : shipKey === "failed" ? "failed" : "pending";
      }

      const disc = Math.max(0, Math.floor(toNumber(discount, 0)));
      const fee  = Math.max(0, Math.floor(toNumber(deliveryFee, 0)));

      // Seller relation (connect/update/create)
      let sellerRel: any = undefined;
      if (seller && (seller.name || seller.address || seller.whatsapp)) {
        const name = String(seller.name || "");
        const address = seller.address ? String(seller.address) : null;
        const whatsapp = seller.whatsapp ? String(seller.whatsapp) : undefined;

        if (whatsapp) {
          const ex = await tx.seller.findUnique({ where: { whatsapp } });
          if (ex) {
            sellerRel = { connect: { id: ex.id } };
            // keep their data fresh (optional)
            await tx.seller.update({
              where: { id: ex.id },
              data: { name: name || ex.name, address: address ?? ex.address },
            });
          } else {
            sellerRel = { create: { name, address, whatsapp } };
          }
        } else {
          sellerRel = { create: { name, address } };
        }
      }

      // Items: one catalog fetch, normalized quantities, price snapshot
      let newItems: { itemId: string; qty: number; price: number }[] | null = null;
      if (items && Array.isArray(items)) {
        const itemIds = items.map((l: any) => String(l.itemId)).filter(Boolean);
        // timing removed
        const catalog = await tx.item.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, unit: true, price: true },
        });
        // timing removed
        const byId = new Map(
          catalog.map((i: any) => [i.id, { unit: (i.unit as "PCS" | "KG") || "PCS", price: i.price }]),
        );

        newItems = items.map((l: any) => {
          const meta = byId.get(String(l.itemId));
          if (!meta) throw new Error("Invalid item");
          const qtyNorm = qtyForUnit(l.qty, (meta as any).unit);
          return { itemId: String(l.itemId), qty: qtyNorm, price: (meta as any).price };
        });
      }

      const subtotal = (newItems ?? existingOrder.items.map((li: any) => ({ qty: Number(li.qty), price: li.price })))
        .reduce((s: number, li: any) => s + Math.round(Number(li.qty) * Number(li.price)), 0);
      const total = Math.max(0, subtotal - disc + fee);

      // Update order
      const updatedOrder = await tx.sellerOrder.update({
        where: { id },
        data: {
          paymentStatus: payEnum,
          deliveryStatus: shipEnum,
          paidAt: payEnum === "paid" && existingOrder.paymentStatus !== "paid" ? new Date() : undefined,
          deliveredAt: shipEnum === "delivered" && existingOrder.deliveryStatus !== "delivered" ? new Date() : undefined,
          paymentType: paymentType ?? undefined,
          deliveryNote: deliveryNote ?? undefined,
          subtotal,
          discount: disc,
          deliveryFee: fee,
          total,
          seller: sellerRel,
        },
        select: { id: true },
      });

      // Replace items only if items were provided
      if (newItems) {
        await tx.sellerOrderItem.deleteMany({ where: { orderId: id } });
        await tx.sellerOrderItem.createMany({
          data: newItems.map((li) => ({
            orderId: id,
            itemId: li.itemId,
            qty: Number(li.qty).toString(),
            price: li.price,
          })),
        });
      }

      return updatedOrder;
    });
    const resp = NextResponse.json({ id: updated.id });
    console.log("PUT /api/seller-orders/%s took %dms (replaceItems=%s)", id, Date.now() - t0, Array.isArray(items) && items.length > 0);
    return resp;
  } catch (e: any) {
    console.error("PUT /api/seller-orders/[id] failed:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

/* ---------------------------
   DELETE /api/seller-orders/[id]
--------------------------- */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const t0 = Date.now();
    const { id } = await params;

    // Check if order exists
    const existingOrder = await prisma.sellerOrder.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Delete the order (cascade will delete order items)
    await prisma.sellerOrder.delete({
      where: { id },
    });

    const resp = NextResponse.json({ success: true });
    console.log("DELETE /api/seller-orders/%s took %dms", id, Date.now() - t0);
    return resp;
  } catch (e: any) {
    console.error("DELETE /api/seller-orders/[id] failed:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}