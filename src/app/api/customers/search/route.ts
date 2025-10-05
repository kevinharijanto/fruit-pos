import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const wa = new URL(req.url).searchParams.get("wa") || "";
  if (!wa) return NextResponse.json(null);
  const customer = await prisma.customer.findUnique({ where: { whatsapp: wa } }).catch(()=>null);
  return NextResponse.json(customer);
}
