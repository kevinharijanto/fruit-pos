import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: { id: string }}) {
  const body = await req.json(); // { paid?: boolean, delivered?: boolean, inProgress?: boolean }
  const data: any = {};

  if (body.paid === true) data.paidAt = new Date();
  if (body.paid === false) data.paidAt = null;

  if (body.delivered === true) data.deliveredAt = new Date();
  if (body.delivered === false) data.deliveredAt = null;

  if (typeof body.inProgress === 'boolean') data.inProgress = body.inProgress;

  const order = await prisma.order.update({ where: { id: params.id }, data, include: { customer: true, items: { include: { item: true } } } });
  return NextResponse.json(order);
}
