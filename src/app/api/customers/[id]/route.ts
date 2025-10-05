import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizeWA(raw?: string | null) {
  if (!raw) return null;
  const d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) return `62${d.slice(1)}`;
  if (d.startsWith("8")) return `62${d}`;
  if (d.startsWith("62")) return d;
  return d;
}

export const runtime = "nodejs";

// PATCH /api/customers/:id
// body: any subset of { name?: string, address?: string, whatsapp?: string }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const body = await req.json();

  const data: any = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.address === "string") data.address = body.address.trim();
  if (typeof body.whatsapp === "string") data.whatsapp = normalizeWA(body.whatsapp);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    // if whatsapp unique constraint exists, Prisma will throw properly
    const updated = await prisma.customer.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to update customer" }, { status: 400 });
  }
}

// DELETE /api/customers/:id
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  try {
    const used = await prisma.order.count({ where: { customerId: id } });
    if (used > 0) {
      return NextResponse.json(
        { error: `Cannot delete: used in ${used} order${used > 1 ? "s" : ""}.` },
        { status: 400 }
      );
    }
    await prisma.customer.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to delete customer" }, { status: 400 });
  }
}
