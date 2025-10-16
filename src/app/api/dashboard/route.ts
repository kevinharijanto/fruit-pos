// src/app/api/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    // Add cache control for dashboard metrics (2 minutes for metrics, 5 minutes for historical data)
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const search = (url.searchParams.get("search") || "").trim();

    const dateFilter: any = {};
    if (from && to) {
      dateFilter.createdAt = {
        gte: new Date(from),
        lte: new Date(to),
      };
    }

    const where: any = { ...dateFilter };
    
    if (search) {
      where.OR = [
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { customer: { whatsapp: { contains: search, mode: "insensitive" } } },
        { customer: { address: { contains: search, mode: "insensitive" } } },
        { deliveryNote: { contains: search, mode: "insensitive" } },
      ];
    }

    // Use optimized queries with better selectivity
    const [
      metrics,
      unpaidOrders,
      undeliveredOrders,
      items,
      paidOrdersData,
      sellerDeliveryFeesAgg,
      totalOrdersCount
    ] = await Promise.all([
      // Omzet (paid orders only)
      prisma.order.aggregate({
        where: {
          ...where,
          paymentStatus: "paid",
        },
        _count: { id: true },
        _sum: { total: true },
      }),
      
      // Recent unpaid orders
      prisma.order.findMany({
        where: { ...where, paymentStatus: "unpaid" },
        select: {
          id: true,
          total: true,
          createdAt: true,
          customer: { select: { name: true } },
          deliveryStatus: true,
          deliveredAt: true
        },
        orderBy: { createdAt: "desc" },
        take: 10
      }),
      
      // Recent undelivered orders
      prisma.order.findMany({
        where: { ...where, deliveryStatus: { not: "delivered" } },
        select: {
          id: true,
          total: true,
          createdAt: true,
          customer: { select: { name: true } },
          paymentStatus: true,
          paidAt: true
        },
        orderBy: { createdAt: "desc" },
        take: 10
      }),
      
      // Items for mapping (cached data)
      prisma.item.findMany({
        select: { id: true, name: true, costPrice: true, unit: true },
        orderBy: { name: 'asc' }
      }),
      
      // Paid orders with items for net profit calculation
      prisma.order.findMany({
        where: { ...where, paymentStatus: "paid" },
        select: {
          total: true,
          items: {
            select: {
              itemId: true,
              qty: true,
              price: true
            }
          },
          customer: { select: { name: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 300
      }),
      
      // Sum of seller-order delivery fees within the selected date range
      prisma.sellerOrder.aggregate({
        where: { ...dateFilter },
        _sum: { deliveryFee: true }
      }),
      
      // Total orders should include paid + unpaid (exclude refunded)
      prisma.order.count({
        where: {
          ...where,
          OR: [
            { paymentStatus: "paid" },
            { paymentStatus: "unpaid" },
          ]
        }
      })
    ]);

    // Extract metrics from aggregation
    const totalOrders = Number(totalOrdersCount || 0);
    const totalRevenue = Number(metrics._sum.total || 0);
    // Sum of seller delivery fees (seller orders)
    const sellerDeliveryFeeTotal = Number((sellerDeliveryFeesAgg?._sum?.deliveryFee) || 0);
    
    // Create item cost map once
    const itemCostMap = new Map(items.map((i: any) => [i.id, Number(i.costPrice)]));
    
    // Single pass through paid orders to calculate all aggregations
    let totalProfit = 0;
    const itemQuantities = new Map<string, { qty: number; revenue: number }>();
    const customerSpends = new Map<string, { orders: number; spend: number }>();
    
    paidOrdersData.forEach((order: any) => {
      const customerName = order.customer?.name || 'Walk-in';
      
      // Update customer spends
      const existingCustomer = customerSpends.get(customerName) || { orders: 0, spend: 0 };
      customerSpends.set(customerName, {
        orders: existingCustomer.orders + 1,
        spend: existingCustomer.spend + Number(order.total)
      });
      
      // Process items for profit and quantities
      order.items.forEach((item: any) => {
        const qty = Number(item.qty);
        const price = Number(item.price);
        const revenue = qty * price;
        const cost = itemCostMap.get(item.itemId) || 0;
        
        // Add to profit
        totalProfit += Number(qty) * (Number(price) - Number(cost));
        
        // Update item quantities
        const existingItem = itemQuantities.get(item.itemId) || { qty: 0, revenue: 0 };
        itemQuantities.set(item.itemId, {
          qty: existingItem.qty + qty,
          revenue: existingItem.revenue + revenue
        });
      });
    });
    
    // Count unpaid orders separately for accuracy
    const unpaidCount = unpaidOrders.length;

    // Format the response data
    const topItems = Array.from(itemQuantities.entries())
      .map(([itemId, data]) => ({
        id: itemId,
        name: items.find((i: any) => i.id === itemId)?.name || "Unknown Item",
        qty: data.qty,
        revenue: data.revenue,
        unit: items.find((i: any) => i.id === itemId)?.unit || "pcs"
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);

    const topCustomers = Array.from(customerSpends.entries())
      .map(([name, data]) => ({
        name,
        orders: data.orders,
        spend: data.spend
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 8);

    return NextResponse.json({
      metrics: {
        totalOrders,
        omzet: totalRevenue,
        netProfit: totalProfit,
        unpaidOrders: unpaidCount,
        sellerDeliveryFeeTotal
      },
      recentUnpaid: unpaidOrders.map((o: any) => ({
        id: o.id,
        total: Number(o.total),
        createdAt: o.createdAt.toISOString(),
        customer: { name: o.customer?.name },
        deliveryStatus: o.deliveryStatus,
        deliveredAt: o.deliveredAt?.toISOString()
      })),
      recentUndelivered: undeliveredOrders.map((o: any) => ({
        id: o.id,
        total: Number(o.total),
        createdAt: o.createdAt.toISOString(),
        customer: { name: o.customer?.name },
        paymentStatus: o.paymentStatus,
        paidAt: o.paidAt?.toISOString()
      })),
      topItems,
      topCustomers,
      items: items.map((i: any) => ({
        id: i.id,
        name: i.name,
        costPrice: Number(i.costPrice),
        unit: i.unit as "PCS" | "KG"
      }))
    }, {
      // Apply proper cache control on the actual response
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' }
    });
  } catch (e: any) {
    console.error("GET /api/dashboard failed:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}