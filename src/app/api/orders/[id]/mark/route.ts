import { NextRequest, NextResponse } from "next/server";
 import { prisma } from "@/lib/prisma";
 import { PaymentStatus, DeliveryStatus } from "@prisma/client";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json(); // { paymentStatus?, deliveryStatus?, paid?, delivered? }
  const data: any = {};

  if (typeof body.paymentStatus === 'string') {
    const map = { unpaid: PaymentStatus.unpaid, paid: PaymentStatus.paid, refunded: PaymentStatus.refunded } as const;
    data.paymentStatus = map[body.paymentStatus as keyof typeof map];
    data.paidAt = body.paymentStatus === 'paid' ? new Date() : null;
  } else if (typeof body.paid === 'boolean') {
    data.paymentStatus = body.paid ? PaymentStatus.paid : PaymentStatus.unpaid;
    data.paidAt = body.paid ? new Date() : null;
  }

  if (typeof body.deliveryStatus === 'string') {
    const map = { pending: DeliveryStatus.pending, delivered: DeliveryStatus.delivered, failed: DeliveryStatus.failed } as const;
    data.deliveryStatus = map[body.deliveryStatus as keyof typeof map];
    data.deliveredAt = body.deliveryStatus === 'delivered' ? new Date() : null;
  } else if (typeof body.delivered === 'boolean') {
    data.deliveryStatus = body.delivered ? DeliveryStatus.delivered : DeliveryStatus.pending;
    data.deliveredAt = body.delivered ? new Date() : null;
  }

  const order = await prisma.order.update({ where: { id }, data, include: { customer: true, items: { include: { item: true } } } });
  return NextResponse.json(order);
}
