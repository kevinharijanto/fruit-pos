import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function normalizeWA(raw?: string | null) {
  if (!raw) return null;
  const d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) return `62${d.slice(1)}`;
  if (d.startsWith("8")) return `62${d}`;
  if (d.startsWith("62")) return d;
  return d;
}

// GET /api/customers?q=...&page=1&limit=10
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const wa = (url.searchParams.get("wa") || "").replace(/\D/g, ""); // exact WA match
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "10");
  const skip = (page - 1) * limit;

  const select = { id: true, name: true, address: true, whatsapp: true, createdAt: true };

  // Exact WA lookup (for autofill)
  if (wa) {
    const c = await prisma.customer.findFirst({ where: { whatsapp: wa }, select });
    return NextResponse.json(c ? [c] : []);
  }

  // Build where clause for search
  const where = q ? {
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { address: { contains: q, mode: 'insensitive' } },
      { whatsapp: { contains: q } }
    ]
  } : {};

  // Get total count for pagination
  const total = await prisma.customer.count({ where });

  // Get paginated results
  const list = await prisma.customer.findMany({
    where,
    select,
    orderBy: { name: "asc" },
    skip,
    take: limit,
  });

  // Disable caching to ensure fresh data
  const response = NextResponse.json({
    data: list,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    }
  });
  
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  return response;
}

// POST /api/customers
// body: { name?: string, address?: string, whatsapp?: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = (body?.name ?? "").trim();
    const address = (body?.address ?? "").trim() || null;
    const whatsapp = normalizeWA(body?.whatsapp);

    if (!name && !whatsapp) {
      return NextResponse.json(
        { error: "Name or WhatsApp is required" },
        { status: 400 }
      );
    }

    // If WA provided, upsert by WA (requires a unique index on whatsapp)
    const customer = whatsapp
      ? await prisma.customer.upsert({
          where: { whatsapp }, // make whatsapp unique in your schema
          create: { name: name || whatsapp, address, whatsapp },
          update: { name: name || undefined, address: address ?? undefined },
        })
      : await prisma.customer.create({
          data: { name, address, whatsapp: null },
        });

    return NextResponse.json(customer, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to create customer" },
      { status: 400 }
    );
  }
}
