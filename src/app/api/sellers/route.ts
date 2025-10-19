// src/app/api/sellers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/* ---------------------------
   GET /api/sellers
--------------------------- */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get("limit") || "10")));
    const search = (url.searchParams.get("q") || "").trim();
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { whatsapp: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
      ];
    }

    const [sellers, total] = await Promise.all([
      prisma.seller.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.seller.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Serialize to plain JSON (Date -> ISO)
    const data = sellers.map((s: any) => ({
      id: s.id,
      name: s.name,
      whatsapp: s.whatsapp,
      address: s.address,
      createdAt: s.createdAt.toISOString(),
    }));

    // For backward compatibility, return array directly if no pagination params
    if (!url.searchParams.has("page") && !url.searchParams.has("limit")) {
      const response = NextResponse.json(data);
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return response;
    }

    const response = NextResponse.json({
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
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return response;
  } catch (e: any) {
    console.error("GET /api/sellers failed:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

/* ---------------------------
   POST /api/sellers
--------------------------- */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, address, whatsapp } = body || {};

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Clean WhatsApp number
    let cleanWhatsapp = null;
    if (whatsapp) {
      cleanWhatsapp = String(whatsapp).replace(/\D/g, "");
      if (cleanWhatsapp && !cleanWhatsapp.startsWith("62")) {
        cleanWhatsapp = "62" + cleanWhatsapp.replace(/^0/, "");
      }
    }

    // Check if seller with same whatsapp already exists
    if (cleanWhatsapp) {
      const existing = await prisma.seller.findUnique({
        where: { whatsapp: cleanWhatsapp }
      });
      if (existing) {
        return NextResponse.json({ error: "Seller with this WhatsApp number already exists" }, { status: 400 });
      }
    }

    const seller = await prisma.seller.create({
      data: {
        name: name.trim(),
        address: address?.trim() || null,
        whatsapp: cleanWhatsapp,
      },
    });

    return NextResponse.json({
      id: seller.id,
      name: seller.name,
      whatsapp: seller.whatsapp,
      address: seller.address,
      createdAt: seller.createdAt.toISOString(),
    }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/sellers failed:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}