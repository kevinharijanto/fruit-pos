// src/app/api/orders/route.ts
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
    // keep one decimal place (0.1 kg steps); clamp >= 0
    q = Math.max(0, Math.round(q * 1000) / 1000);
  } else {
    // PCS: integer only
    q = Math.max(0, Math.floor(q));
  }
  return q;
}

/* ---------------------------
   GET /api/orders
--------------------------- */
export async function GET(req: NextRequest) {
  try {
    // Add cache control for slightly stale data (30 seconds for orders, 5 minutes for items)
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get("limit") || "25")));
    const search = (url.searchParams.get("search") || "").trim();
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (search) {
      where.OR = [
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { customer: { whatsapp: { contains: search, mode: "insensitive" } } },
        { customer: { address: { contains: search, mode: "insensitive" } } },
        { deliveryNote: { contains: search, mode: "insensitive" } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
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
          customer: {
            select: { name: true, whatsapp: true, address: true }
          },
          items: {
            select: {
              id: true,
              itemId: true,
              qty: true,
              price: true,
              item: { select: { name: true } },
            },
          },
        },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Serialize to plain JSON (Decimal -> number, Date -> ISO)
    const data = orders.map((o: any) => ({
      id: o.id,
      paymentStatus: o.paymentStatus,
      deliveryStatus: o.deliveryStatus,
      paidAt: o.paidAt ? o.paidAt.toISOString() : null,
      deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
      deliveryNote: o.deliveryNote ?? null,
      paymentType: (o.paymentType ?? null) as "CASH" | "TRANSFER" | "QRIS" | null,
      subtotal: o.subtotal,
      discount: o.discount,
      deliveryFee: o.deliveryFee,
      total: o.total,
      createdAt: o.createdAt.toISOString(),
      customer: o.customer
        ? {
            name: o.customer.name ?? null,
            whatsapp: o.customer.whatsapp ?? null,
            address: o.customer.address ?? null,
          }
        : null,
      items: o.items.map((li: any) => ({
        id: li.id,
        itemId: li.itemId,
        // qty is Decimal in DB -> convert for client
        qty: Number(li.qty),
        price: li.price,
        item: { name: li.item?.name ?? "" },
      })),
    }));

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
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
    deliveryFee: feeIn,
    paymentType,
    deliveryNote,
    paymentStatus,
    deliveryStatus,
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
      catalog.map((i: any) => [i.id, { unit: (i.unit as "PCS" | "KG") || "PCS", price: i.price }]),
    );

    // 2) Build order lines with normalized qty (PCS int, KG one decimal), and snapshot price
    const lines = items.map((l: any) => {
      const meta = byId.get(String(l.itemId));
      if (!meta) throw new Error("Invalid item");
      const qty = qtyForUnit(l.qty, (meta as any).unit);
      return {
        itemId: String(l.itemId),
        qty,
        price: (meta as any).price, // snapshot current price
      };
    });

    // 3) Totals (money stays integer)
    const subtotal = lines.reduce((s, l) => s + Math.round(Number(l.qty) * l.price), 0);
    const discount = Math.max(0, Math.floor(toNumber(discIn, 0)));
    const deliveryFee = Math.max(0, Math.floor(toNumber(feeIn, 0)));
    const total = Math.max(0, subtotal - discount + deliveryFee);

    // 4) Customer relation (connect by WA if exists)
    let customerRel: any;
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
    // Map strings -> enum values
    // Pick enums via direct conditionals (no object lookup)
    const rawPay  = paymentStatus ?? (paid ? "paid" : "unpaid");
    const rawShip = deliveryStatus ?? (delivered ? "delivered" : "pending");
    const payKey  = String(rawPay).toLowerCase().trim();
    const shipKey = String(rawShip).toLowerCase().trim();
    const payEnum  =
      payKey === "paid"      ? "paid"
    : payKey === "refunded"  ? "refunded"
    :                          "unpaid";
    const shipEnum =
      shipKey === "delivered" ? "delivered"
    : shipKey === "failed"    ? "failed"
    :                           "pending";


    const order = await prisma.order.create({
      data: {
        paymentStatus:  payEnum,
        deliveryStatus: shipEnum,
        paidAt:        payEnum  === "paid"        ? new Date() : null,
        deliveredAt:   shipEnum === "delivered"  ? new Date() : null,
        paymentType: (paymentType as any) ?? null,
        deliveryNote: deliveryNote ?? null,
        subtotal,
        discount,
        deliveryFee,
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
