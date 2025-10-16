import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** GET /api/items?page=1&limit=10&cat=category&q=search */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "10");
  const cat = url.searchParams.get("cat"); // optional category filter
  const q = (url.searchParams.get("q") || "").trim(); // search query

  // Build where clause
  const where: any = {};
  
  if (cat && cat !== "ALL") {
    where.categoryId = cat;
  }
  
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { category: { name: { contains: q, mode: 'insensitive' } } }
    ];
  }

  // Get total count for pagination
  const total = await prisma.item.count({ where });

  // When searching, return all results without pagination
  // Otherwise, use pagination for normal browsing
  const shouldPaginate = !q;
  const skip = shouldPaginate ? (page - 1) * limit : 0;
  const take = shouldPaginate ? limit : undefined;

  // Get results - select only needed fields
  const items = await prisma.item.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      price: true,
      costPrice: true,
      unit: true,
      stockMode: true,
      stock: true,
      createdAt: true,
      updatedAt: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true
        }
      }
    },
    skip,
    take,
  });

  // Convert Decimal -> number for JSON
  const out = items.map((it: any) => ({
    ...it,
    stock: Number(it.stock),
  }));

  // Return different response format based on whether we're searching or paginating
  if (q) {
    // When searching, return all results without pagination info
    const response = NextResponse.json(out);
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    return response;
  } else {
    // When browsing normally, return paginated results
    const response = NextResponse.json({
      data: out,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    return response;
  }
}

/** POST /api/items */
export async function POST(req: Request) {
  const b = await req.json();

  const name = String(b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const price = Math.max(0, Math.floor(Number(b.price ?? 0)));
  const costPrice = Math.max(0, Math.floor(Number(b.costPrice ?? 0)));

  const unit: "PCS" | "KG" = b.unit === "KG" ? "KG" : "PCS";
  const stockMode: "TRACK" | "RESELL" = b.stockMode === "RESELL" ? "RESELL" : "TRACK";

  let stockNum = Number(b.stock ?? 0);
  if (!Number.isFinite(stockNum) || stockNum < 0) stockNum = 0;
  if (stockMode !== "TRACK") stockNum = 0; // resell: do not track stock

  // Category by id or name
  let categoryId: string | undefined = typeof b.categoryId === "string" && b.categoryId ? b.categoryId : undefined;
  const categoryName = typeof b.categoryName === "string" ? b.categoryName.trim() : "";
  if (!categoryId && categoryName) {
    const cat = await prisma.category.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName },
    });
    categoryId = cat.id;
  }

  const created = await prisma.item.create({
    data: {
      name,
      price,
      costPrice,
      unit,
      stockMode,
      stock: stockNum,
      ...(categoryId ? { categoryId } : {}),
    },
    include: { category: true },
  });

  return NextResponse.json(
    {
      ...created,
      stock: Number(created.stock),
    },
    { status: 201 }
  );
}
