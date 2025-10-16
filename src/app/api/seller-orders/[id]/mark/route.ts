// src/app/api/seller-orders/[id]/mark/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/* ---------------------------
   PATCH /api/seller-orders/[id]/mark
   Body: { paymentStatus?: string, deliveryStatus?: string }
--------------------------- */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { paymentStatus, deliveryStatus } = body || {};

    // Check if order exists
    const existingOrder = await prisma.sellerOrder.findUnique({
      where: { id },
      select: { 
        id: true, 
        paymentStatus: true, 
        deliveryStatus: true,
        paidAt: true,
        deliveredAt: true
      }
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Process enum values
    let payEnum = existingOrder.paymentStatus;
    let paidAt = existingOrder.paidAt;
    
    if (paymentStatus) {
      const payKey = String(paymentStatus).toLowerCase().trim();
      payEnum =
        payKey === "paid" ? "paid"
        : payKey === "refunded" ? "refunded"
        : "unpaid";
      
      // Set paidAt if status changed to paid and it wasn't paid before
      if (payEnum === "paid" && existingOrder.paymentStatus !== "paid") {
        paidAt = new Date();
      }
    }

    let shipEnum = existingOrder.deliveryStatus;
    let deliveredAt = existingOrder.deliveredAt;
    
    if (deliveryStatus) {
      const shipKey = String(deliveryStatus).toLowerCase().trim();
      shipEnum =
        shipKey === "delivered" ? "delivered"
        : shipKey === "failed" ? "failed"
        : "pending";
      
      // Set deliveredAt if status changed to delivered and it wasn't delivered before
      if (shipEnum === "delivered" && existingOrder.deliveryStatus !== "delivered") {
        deliveredAt = new Date();
      }
    }

    // Update the order
    const updatedOrder = await prisma.sellerOrder.update({
      where: { id },
      data: {
        paymentStatus: payEnum,
        deliveryStatus: shipEnum,
        paidAt,
        deliveredAt,
      },
      select: { 
        id: true,
        paymentStatus: true,
        deliveryStatus: true,
        paidAt: true,
        deliveredAt: true
      },
    });

    // Serialize to plain JSON (Date -> ISO)
    const data = {
      id: updatedOrder.id,
      paymentStatus: updatedOrder.paymentStatus,
      deliveryStatus: updatedOrder.deliveryStatus,
      paidAt: updatedOrder.paidAt ? updatedOrder.paidAt.toISOString() : null,
      deliveredAt: updatedOrder.deliveredAt ? updatedOrder.deliveredAt.toISOString() : null,
    };

    return NextResponse.json(data);
  } catch (e: any) {
    console.error("PATCH /api/seller-orders/[id]/mark failed:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}