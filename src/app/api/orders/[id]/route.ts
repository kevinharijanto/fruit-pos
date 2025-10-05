// src/app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

/* ---------- helpers ---------- */
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
  if (unit === "KG") return Math.max(0, Math.round(q * 10) / 10); // 0.1kg step
  return Math.max(0, Math.floor(q)); // integer PCS
}

/* =========================================================
   PATCH /api/orders/[id]

   Body may include:
   - customer?: { name?, address?, whatsapp? }
   - items?: { itemId: string; qty: number }[]   (replaces lines)
   - discount?: number
   - paymentType?: "CASH"|"TRANSFER"|"QRIS"|null
   - deliveryNote?: string
   - inProgress?: boolean
   - paid?: boolean
   - delivered?: boolean

   Behavior:
   - Keeps existing price snapshots for items already on the order
   - New items snapshot current Item.price
   - Normalizes qty by unit (PCS int, KG 0.1)
   - Optionally adjusts stock when delivered toggles (TRACK only)
========================================================= */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> } // Next 15+: await params
) {
  const { id } = await ctx.params;
  const body = await req.json();

  const {
    customer,
    items,                   // optional array to replace lines
    discount: discIn,
    paymentType,
    deliveryNote,
    inProgress,
    paid,
    delivered,
  } = body || {};

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1) Load existing order (with lines + item meta)
      const existing = await tx.order.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              item: { select: { unit: true, stockMode: true } },
            },
          },
          customer: true,
        },
      });
      if (!existing) {
        throw new Error("Order not found");
      }

      const deliveredBefore = !!existing.deliveredAt;
      const paidBefore = !!existing.paidAt;

      // Map existing lines by itemId (merge if duplicates)
      const existByItem = new Map<
        string,
        { lineIds: string[]; qty: number; price: number; unit: "PCS" | "KG"; stockMode: "TRACK" | "RESELL" }
      >();
      for (const li of existing.items) {
        const key = li.itemId;
        const unit = (li.item?.unit as "PCS" | "KG") || "PCS";
        const stockMode = (li.item?.stockMode as "TRACK" | "RESELL") || "TRACK";
        const qtyNum = Number(li.qty);
        if (!existByItem.has(key)) {
          existByItem.set(key, { lineIds: [li.id], qty: qtyNum, price: li.price, unit, stockMode });
        } else {
          const e = existByItem.get(key)!;
          e.lineIds.push(li.id);
          e.qty += qtyNum;
        }
      }

      // 2) If items provided, compute desired normalized lines
      let desired: { itemId: string; qty: number; price: number; unit: "PCS" | "KG"; stockMode: "TRACK" | "RESELL" }[] =
        [];

      if (Array.isArray(items)) {
        const wantedIds = Array.from(new Set(items.map((x: any) => String(x.itemId)).filter(Boolean)));

        // fetch meta for wanted items (unit/price/stockMode)
        const metas = await tx.item.findMany({
          where: { id: { in: wantedIds } },
          select: { id: true, unit: true, price: true, stockMode: true },
        });
        const metaById = new Map(
          metas.map((m) => [
            m.id,
            {
              unit: (m.unit as "PCS" | "KG") || "PCS",
              price: m.price,
              stockMode: (m.stockMode as "TRACK" | "RESELL") || "TRACK",
            },
          ])
        );

        for (const raw of items) {
          const itemId = String(raw.itemId);
          const prev = existByItem.get(itemId);
          const meta = prev || metaById.get(itemId);
          if (!meta) throw new Error("Invalid item");

          // normalize qty based on unit
          const qty = qtyForUnit(raw.qty, meta.unit);

          if (qty <= 0) continue;

          // price snapshot rule:
          // - if it existed before, keep previous price
          // - if it's a new item, snapshot current item.price
          const price = prev ? prev.price : meta.price;

          desired.push({ itemId, qty, price, unit: meta.unit, stockMode: meta.stockMode });
        }

        // Replace lines to match 'desired'
        // (a) If delivered was true and will become false, restore stock for current lines first.
        const deliveredAfter = delivered === true ? true : delivered === false ? false : deliveredBefore;

        if (deliveredBefore && !deliveredAfter) {
          // return stock for all TRACK items on existing order
          for (const li of existing.items) {
            const mode = (li.item?.stockMode as "TRACK" | "RESELL") || "TRACK";
            if (mode === "TRACK") {
              await tx.item.update({
                where: { id: li.itemId },
                data: { stock: { increment: new Prisma.Decimal(li.qty) } },
              });
            }
          }
        }

        // (b) Update order items to match desired
        //    - update 1 line per itemId; delete extras; delete missing; create new
        const desiredMap = new Map(desired.map((d) => [d.itemId, d]));

        // Update / delete existing
        for (const [itemId, e] of existByItem.entries()) {
          const d = desiredMap.get(itemId);
          if (!d) {
            // remove all lines for this item
            await tx.orderItem.deleteMany({ where: { orderId: id, itemId } });
          } else {
            // keep one line with snapshot price; set qty to new value; delete dups
            const keepId = e.lineIds[0];
            await tx.orderItem.update({
              where: { id: keepId },
              data: {
                qty: d.qty.toString(), // Decimal
                // keep price snapshot from existing e.price
                price: e.price,
              },
            });
            if (e.lineIds.length > 1) {
              await tx.orderItem.deleteMany({ where: { id: { in: e.lineIds.slice(1) } } });
            }
            // remove from desiredMap so we don't create it again
            desiredMap.delete(itemId);
          }
        }

        // Create new for remaining desired
        for (const d of desiredMap.values()) {
          await tx.orderItem.create({
            data: {
              orderId: id,
              itemId: d.itemId,
              qty: d.qty.toString(), // Decimal
              price: d.price, // snapshot now
            },
          });
        }

        // (c) If delivered becomes true now (and was false), deduct stock for TRACK items on the *new* lines
        if (!deliveredBefore && deliveredAfter) {
          const freshLines = await tx.orderItem.findMany({
            where: { orderId: id },
            include: { item: { select: { stockMode: true } } },
          });
          for (const li of freshLines) {
            const mode = (li.item?.stockMode as "TRACK" | "RESELL") || "TRACK";
            if (mode === "TRACK") {
              await tx.item.update({
                where: { id: li.itemId },
                data: { stock: { decrement: new Prisma.Decimal(li.qty) } },
              });
            }
          }
        }
      } else {
        // items not provided -> keep existing lines; desired unused
      }

      // 3) Recompute totals (use current order lines, keeping their snapshot prices)
      const linesNow = await tx.orderItem.findMany({
        where: { orderId: id },
        select: { qty: true, price: true },
      });
      const subtotal = linesNow.reduce((s, li) => s + Math.round(Number(li.qty) * li.price), 0);

      // discount: keep if not provided
      const newDiscount =
        typeof discIn === "number" ? Math.max(0, Math.floor(discIn)) : existing.discount;
      const total = Math.max(0, subtotal - newDiscount);

      // 4) Customer relation update (optional)
      let customerUpdate: any = undefined;
      if (customer && (customer.name || customer.address || customer.whatsapp)) {
        const name = String(customer.name || "");
        const address = customer.address ? String(customer.address) : null;
        const whatsapp = customer.whatsapp ? String(customer.whatsapp) : undefined;

        if (whatsapp) {
          const existingCust = await tx.customer.findUnique({ where: { whatsapp } });
          if (existingCust) {
            // connect & refresh their info
            customerUpdate = { connect: { id: existingCust.id } };
            await tx.customer.update({
              where: { id: existingCust.id },
              data: { name: name || existingCust.name, address: address ?? existingCust.address },
            });
          } else {
            customerUpdate = { create: { name, address, whatsapp } };
          }
        } else {
          customerUpdate = { create: { name, address } };
        }
      }

      // 5) Status timestamps
      const setPaidAt =
        paid === true ? new Date()
        : paid === false ? null
        : existing.paidAt;

      const deliveredAfter =
        delivered === true ? new Date()
        : delivered === false ? null
        : existing.deliveredAt;

      // 6) Update order record
      await tx.order.update({
        where: { id },
        data: {
          inProgress: typeof inProgress === "boolean" ? inProgress : existing.inProgress,
          paidAt: setPaidAt,
          deliveredAt: deliveredAfter,
          paymentType: typeof paymentType === "string" || paymentType === null ? paymentType : existing.paymentType,
          deliveryNote: typeof deliveryNote === "string" ? deliveryNote : existing.deliveryNote,
          discount: newDiscount,
          subtotal,
          total,
          ...(customerUpdate ? { customer: customerUpdate } : {}),
        },
      });

      return { ok: true };
    });

    return NextResponse.json(result);
  } catch (e: any) {
    console.error("PATCH /api/orders/[id] failed:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

/* =========================================================
   DELETE /api/orders/[id]
   - Restores stock if order had been delivered (TRACK only)
========================================================= */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: { include: { item: { select: { stockMode: true } } } } },
      });
      if (!order) throw new Error("Order not found");

      // If delivered, restore stock for TRACK items
      if (order.deliveredAt) {
        for (const li of order.items) {
          const mode = (li.item?.stockMode as "TRACK" | "RESELL") || "TRACK";
          if (mode === "TRACK") {
            await tx.item.update({
              where: { id: li.itemId },
              data: { stock: { increment: new Prisma.Decimal(li.qty) } },
            });
          }
        }
      }

      // Remove lines then order
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.order.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("DELETE /api/orders/[id] failed:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
