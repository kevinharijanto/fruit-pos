// src/app/api/sellers/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/* ---------------------------
   GET /api/sellers/[id]
--------------------------- */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const seller = await prisma.seller.findUnique({
      where: { id },
    });

    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: seller.id,
      name: seller.name,
      whatsapp: seller.whatsapp,
      address: seller.address,
      createdAt: seller.createdAt.toISOString(),
    });
  } catch (e: any) {
    console.error("GET /api/sellers/[id] failed:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

/* ---------------------------
   PATCH /api/sellers/[id]
--------------------------- */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { name, address, whatsapp } = body || {};

    // Check if seller exists
    const existingSeller = await prisma.seller.findUnique({
      where: { id },
    });

    if (!existingSeller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    // Clean WhatsApp number
    let cleanWhatsapp = existingSeller.whatsapp;
    if (whatsapp !== undefined) {
      if (whatsapp) {
        cleanWhatsapp = String(whatsapp).replace(/\D/g, "");
        if (cleanWhatsapp && !cleanWhatsapp.startsWith("62")) {
          cleanWhatsapp = "62" + cleanWhatsapp.replace(/^0/, "");
        }
      } else {
        cleanWhatsapp = null;
      }
    }

    // Check if another seller with same whatsapp already exists
    if (cleanWhatsapp && cleanWhatsapp !== existingSeller.whatsapp) {
      const duplicate = await prisma.seller.findFirst({
        where: { 
          whatsapp: cleanWhatsapp,
          id: { not: id }
        }
      });
      if (duplicate) {
        return NextResponse.json({ error: "Seller with this WhatsApp number already exists" }, { status: 400 });
      }
    }

    const updatedSeller = await prisma.seller.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : existingSeller.name,
        address: address !== undefined ? (address?.trim() || null) : existingSeller.address,
        whatsapp: cleanWhatsapp,
      },
    });

    return NextResponse.json({
      id: updatedSeller.id,
      name: updatedSeller.name,
      whatsapp: updatedSeller.whatsapp,
      address: updatedSeller.address,
      createdAt: updatedSeller.createdAt.toISOString(),
    });
  } catch (e: any) {
    console.error("PATCH /api/sellers/[id] failed:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

/* ---------------------------
   DELETE /api/sellers/[id]
--------------------------- */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Check if seller exists
    const existingSeller = await prisma.seller.findUnique({
      where: { id },
    });

    if (!existingSeller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    // Check if seller has any orders
    const orderCount = await prisma.sellerOrder.count({
      where: { sellerId: id }
    });

    if (orderCount > 0) {
      return NextResponse.json({ 
        error: `Cannot delete seller. This seller has ${orderCount} order(s). Please delete the orders first.` 
      }, { status: 400 });
    }

    // Delete the seller
    await prisma.seller.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("DELETE /api/sellers/[id] failed:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}