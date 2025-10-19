// src/app/api/accounting/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/* ---------------------------
   GET /api/accounting
   Returns accounting data for seller orders and paid customer orders
   Query params:
   - from: ISO date string (start date)
   - to: ISO date string (end date)
   - page: pagination page
   - limit: items per page
   - search: search term
   - type: "all" | "seller" | "customer" (filter by order type)
--------------------------- */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get("limit") || "50")));
    const search = (url.searchParams.get("search") || "").trim();
    const type = (url.searchParams.get("type") || "all").trim();
    const skip = (page - 1) * limit;
    
    // Date range handling
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // Build search conditions
    const searchCondition = search ? {
      OR: [
        { seller: { name: { contains: search, mode: "insensitive" } } },
        { seller: { whatsapp: { contains: search, mode: "insensitive" } } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { customer: { whatsapp: { contains: search, mode: "insensitive" } } },
        { deliveryNote: { contains: search, mode: "insensitive" } },
      ]
    } : {};

    const t0 = Date.now();
    
    // Get seller orders (all of them for accounting purposes)
    const sellerOrdersWhere: any = {};
    if (hasDateFilter) sellerOrdersWhere.createdAt = dateFilter;
    if (search) Object.assign(sellerOrdersWhere, searchCondition);
    
    const sellerOrders = await prisma.sellerOrder.findMany({
      where: sellerOrdersWhere,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        paymentStatus: true,
        deliveryStatus: true,
        paidAt: true,
        deliveredAt: true,
        deliveryNote: true,
        paymentType: true,
        subtotal: true,
        discount: true,
        deliveryFee: true,
        total: true,
        createdAt: true,
        seller: {
          select: { name: true, whatsapp: true, address: true }
        },
        items: {
          select: {
            id: true,
            itemId: true,
            qty: true,
            price: true,
            item: { select: { name: true, unit: true } },
          },
        },
      },
      skip: type === "customer" ? 0 : skip,
      take: type === "customer" ? 0 : limit,
    });

    // Get paid customer orders
    const customerOrdersWhere: any = { paymentStatus: "paid" };
    if (hasDateFilter) customerOrdersWhere.createdAt = dateFilter;
    if (search) Object.assign(customerOrdersWhere, searchCondition);
    
    const customerOrders = await prisma.order.findMany({
      where: customerOrdersWhere,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        paymentStatus: true,
        deliveryStatus: true,
        paidAt: true,
        deliveredAt: true,
        deliveryNote: true,
        paymentType: true,
        subtotal: true,
        discount: true,
        deliveryFee: true,
        total: true,
        createdAt: true,
        customer: {
          select: { name: true, whatsapp: true, address: true }
        },
        items: {
          select: {
            id: true,
            itemId: true,
            qty: true,
            price: true,
            item: { select: { name: true, unit: true } },
          },
        },
      },
      skip: type === "seller" ? 0 : skip,
      take: type === "seller" ? 0 : limit,
    });

    // Get counts for pagination
    const [sellerOrdersCount, customerOrdersCount] = await Promise.all([
      type === "customer" ? 0 : prisma.sellerOrder.count({ where: sellerOrdersWhere }),
      type === "seller" ? 0 : prisma.order.count({ where: customerOrdersWhere }),
    ]);

    console.log("GET /api/accounting page=%s limit=%s took %ms", page, limit, Date.now() - t0);

    // Serialize and format data
    const formattedSellerOrders = sellerOrders.map((o: any) => ({
      id: o.id,
      type: "seller",
      paymentStatus: o.paymentStatus,
      deliveryStatus: o.deliveryStatus,
      paidAt: o.paidAt ? o.paidAt.toISOString() : null,
      deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
      deliveryNote: o.deliveryNote ?? null,
      paymentType: (o.paymentType ?? null) as "CASH" | "TRANSFER" | "QRIS" | null,
      subtotal: o.subtotal,
      discount: o.discount,
      deliveryFee: o.deliveryFee,
      total: o.total,
      createdAt: o.createdAt.toISOString(),
      party: o.seller
        ? {
            name: o.seller.name ?? null,
            whatsapp: o.seller.whatsapp ?? null,
            address: o.seller.address ?? null,
          }
        : null,
      items: o.items.map((li: any) => ({
        id: li.id,
        itemId: li.itemId,
        qty: Number(li.qty),
        price: li.price,
        item: {
          name: li.item?.name ?? "",
          unit: (li.item?.unit ?? "PCS") as "PCS" | "KG",
        },
      })),
    }));

    const formattedCustomerOrders = customerOrders.map((o: any) => ({
      id: o.id,
      type: "customer",
      paymentStatus: o.paymentStatus,
      deliveryStatus: o.deliveryStatus,
      paidAt: o.paidAt ? o.paidAt.toISOString() : null,
      deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
      deliveryNote: o.deliveryNote ?? null,
      paymentType: (o.paymentType ?? null) as "CASH" | "TRANSFER" | "QRIS" | null,
      subtotal: o.subtotal,
      discount: o.discount,
      deliveryFee: o.deliveryFee,
      total: o.total,
      createdAt: o.createdAt.toISOString(),
      party: o.customer
        ? {
            name: o.customer.name ?? null,
            whatsapp: o.customer.whatsapp ?? null,
            address: o.customer.address ?? null,
          }
        : null,
      items: o.items.map((li: any) => ({
        id: li.id,
        itemId: li.itemId,
        qty: Number(li.qty),
        price: li.price,
        item: {
          name: li.item?.name ?? "",
          unit: (li.item?.unit ?? "PCS") as "PCS" | "KG",
        },
      })),
    }));

    // Combine and sort by date
    let allOrders = [...formattedSellerOrders, ...formattedCustomerOrders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Filter by type if specified
    if (type !== "all") {
      allOrders = allOrders.filter(order => order.type === type);
    }

    // Apply pagination for combined results
    const totalCount = type === "seller" ? sellerOrdersCount : 
                      type === "customer" ? customerOrdersCount : 
                      sellerOrdersCount + customerOrdersCount;
    const totalPages = Math.ceil(totalCount / limit);
    
    const paginatedOrders = type === "all" ? 
      allOrders.slice(skip, skip + limit) : 
      allOrders;

    // Calculate summary statistics
    const sellerOrdersTotal = formattedSellerOrders.reduce((sum: number, order: any) => sum + order.total, 0);
    const customerOrdersTotal = formattedCustomerOrders.reduce((sum: number, order: any) => sum + order.total, 0);
    const totalRevenue = customerOrdersTotal;
    const totalCosts = sellerOrdersTotal;
    const grossProfit = totalRevenue - totalCosts;

    return NextResponse.json({
      data: paginatedOrders,
      summary: {
        sellerOrdersCount: formattedSellerOrders.length,
        customerOrdersCount: formattedCustomerOrders.length,
        sellerOrdersTotal,
        customerOrdersTotal,
        totalRevenue,
        totalCosts,
        grossProfit,
      },
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    }, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    });
  } catch (e: any) {
    console.error("GET /api/accounting failed:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}