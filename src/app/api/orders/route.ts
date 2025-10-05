// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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
    // keep one decimal place (0.1 kg steps); clamp >= 0
    q = Math.max(0, Math.round(q * 10) / 10);
  } else {
    // PCS: integer only
    q = Math.max(0, Math.floor(q));
  }
  return q;
}

/* ---------------------------
   GET /api/orders
--------------------------- */
export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true, whatsapp: true, address: true } },
        items: {
          include: {
            item: { select: { name: true } },
          },
        },
      },
      take: 1000,
    });

    // Serialize to plain JSON (Decimal -> number, Date -> ISO)
    const data = orders.map((o) => ({
      id: o.id,
      inProgress: o.inProgress,
      paidAt: o.paidAt ? o.paidAt.toISOString() : null,
      deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
      deliveryNote: o.deliveryNote ?? null,
      paymentType: (o.paymentType ?? null) as "CASH" | "TRANSFER" | "QRIS" | null,
      subtotal: o.subtotal,
      discount: o.discount,
      total: o.total,
      createdAt: o.createdAt.toISOString(),
      customer: o.customer
        ? {
            name: o.customer.name ?? null,
            whatsapp: o.customer.whatsapp ?? null,
            address: o.customer.address ?? null,
          }
        : null,
      items: o.items.map((li) => ({
        id: li.id,
        itemId: li.itemId,
        // qty is Decimal in DB -> convert for client
        qty: Number(li.qty),
        price: li.price,
        item: { name: li.item?.name ?? "" },
      })),
    }));

    return NextResponse.json(data);
  } catch (e: any) {
    console.error("GET /api/orders failed:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

/* ---------------------------
   POST /api/orders
   Body:
   {
     customer?: { name?: string; address?: string; whatsapp?: string; },
     items: { itemId: string; qty: number }[],
     discount?: number,
     paymentType?: "CASH" | "TRANSFER" | "QRIS" | null,
     deliveryNote?: string,
     inProgress?: boolean,
     paid?: boolean,
     delivered?: boolean
   }
--------------------------- */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    customer,
    items = [],
    discount: discIn,
    paymentType,
    deliveryNote,
    inProgress = true,
    paid = false,
    delivered = false,
  } = body || {};

  try {
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items." }, { status: 400 });
    }

    // 1) Load item catalog (for unit & price snapshot)
    const itemIds = items.map((l: any) => String(l.itemId)).filter(Boolean);
    const catalog = await prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, unit: true, price: true },
    });
    const byId = new Map(
      catalog.map((i) => [i.id, { unit: (i.unit as "PCS" | "KG") || "PCS", price: i.price }]),
    );

    // 2) Build order lines with normalized qty (PCS int, KG one decimal), and snapshot price
    const lines = items.map((l: any) => {
      const meta = byId.get(String(l.itemId));
      if (!meta) throw new Error("Invalid item");
      const qty = qtyForUnit(l.qty, meta.unit);
      return {
        itemId: String(l.itemId),
        qty,
        price: meta.price, // snapshot current price
      };
    });

    // 3) Totals (money stays integer)
    const subtotal = lines.reduce((s, l) => s + Math.round(Number(l.qty) * l.price), 0);
    const discount = Math.max(0, Math.floor(toNumber(discIn, 0)));
    const total = Math.max(0, subtotal - discount);

    // 4) Customer relation (connect by WA if exists)
    let customerRel: Prisma.OrderCreateInput["customer"] | undefined;
    if (customer && (customer.name || customer.address || customer.whatsapp)) {
      const name = String(customer.name || "");
      const address = customer.address ? String(customer.address) : null;
      const whatsapp = customer.whatsapp ? String(customer.whatsapp) : undefined;

      if (whatsapp) {
        const existing = await prisma.customer.findUnique({ where: { whatsapp } });
        if (existing) {
          customerRel = { connect: { id: existing.id } };
          // Keep their data fresh (optional)
          await prisma.customer.update({
            where: { id: existing.id },
            data: {
              name: name || existing.name,
              address: address ?? existing.address,
            },
          });
        } else {
          customerRel = { create: { name, address, whatsapp } };
        }
      } else {
        customerRel = { create: { name, address } };
      }
    }

    // 5) Create order + nested items (pass Decimal as string to be safe)
    const order = await prisma.order.create({
      data: {
        inProgress: Boolean(inProgress),
        paidAt: paid ? new Date() : null,
        deliveredAt: delivered ? new Date() : null,
        paymentType: (paymentType as any) ?? null,
        deliveryNote: deliveryNote ?? null,
        subtotal,
        discount,
        total,
        customer: customerRel,
        items: {
          create: lines.map((l) => ({
            itemId: l.itemId,
            qty: l.qty.toString(), // Decimal column
            price: l.price,        // snapshot price
          })),
        },
      },
      select: { id: true },
    });

    return NextResponse.json({ id: order.id }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/orders failed:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
