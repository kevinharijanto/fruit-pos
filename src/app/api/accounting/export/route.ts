import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function csvEscape(v: any) {
  const s = (v ?? "").toString();
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * GET /api/accounting/export[?excel=1][&from=...&to=...&type=...]
 * - excel=1  → phone numbers are emitted as ="<digits>" so Excel preserves them as text
 * - from/to  → date range filter (ISO strings)
 * - type     → filter by "seller" | "customer" | "all"
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const excel = searchParams.get("excel") === "1";
  const type = (searchParams.get("type") || "all").trim();
  
  // Date range handling
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const dateFilter: any = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);
  
  const hasDateFilter = Object.keys(dateFilter).length > 0;

  try {
    // Get seller orders
    const sellerOrdersWhere: any = {};
    if (hasDateFilter) sellerOrdersWhere.createdAt = dateFilter;
    
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
    });

    // Get paid customer orders
    const customerOrdersWhere: any = { paymentStatus: "paid" };
    if (hasDateFilter) customerOrdersWhere.createdAt = dateFilter;
    
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
    });

    // Format data for CSV
    const formatOrder = (order: any, orderType: "seller" | "customer") => {
      const party = orderType === "seller" ? order.seller : order.customer;
      const partyWa = party?.whatsapp ?? "";
      const waOut = excel && partyWa ? `="${partyWa}"` : csvEscape(partyWa);
      
      return {
        "Order ID": order.id,
        "Type": orderType === "seller" ? "Seller" : "Customer",
        "Date": order.createdAt.toISOString().split('T')[0],
        "Party Name": csvEscape(party?.name ?? ""),
        "Party WhatsApp": waOut,
        "Party Address": csvEscape(party?.address ?? ""),
        "Payment Status": order.paymentStatus,
        "Delivery Status": order.deliveryStatus,
        "Payment Type": order.paymentType ?? "",
        "Paid At": order.paidAt ? order.paidAt.toISOString().split('T')[0] : "",
        "Delivered At": order.deliveredAt ? order.deliveredAt.toISOString().split('T')[0] : "",
        "Delivery Note": csvEscape(order.deliveryNote ?? ""),
        "Subtotal": order.subtotal,
        "Discount": order.discount,
        "Delivery Fee": order.deliveryFee,
        "Total": order.total,
        "Items": order.items.map((item: any) => 
          `${item.item?.name || ""} (${Number(item.qty)} ${item.item?.unit || "PCS"})`
        ).join("; "),
      };
    };

    let rows: any[] = [];
    
    if (type === "all" || type === "seller") {
      rows = rows.concat(sellerOrders.map((o: any) => formatOrder(o, "seller")));
    }
    
    if (type === "all" || type === "customer") {
      rows = rows.concat(customerOrders.map((o: any) => formatOrder(o, "customer")));
    }

    // Sort by date
    rows.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());

    // Generate CSV
    const header = Object.keys(rows[0] || {});
    const body = rows.map(row => 
      header.map(col => {
        const value = row[col];
        // Handle numbers (don't escape them)
        if (typeof value === "number") return value.toString();
        // Handle everything else
        return csvEscape(value);
      }).join(",")
    ).join("\n");

    const csv = [header.join(","), body].join("\n");
    const filename = `accounting-${type}-${excel ? "excel-" : ""}${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("GET /api/accounting/export failed:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}