import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function csvEscape(v: any) {
  const s = (v ?? "").toString();
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const runtime = "nodejs";

/**
 * GET /api/customers/export[?simple=1][&excel=1]
 * - simple=1 → columns: name,whatsapp,address
 * - excel=1  → whatsapp is emitted as =\"<digits>\" so Excel preserves it as text
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const simple = searchParams.get("simple") === "1";
  const excel = searchParams.get("excel") === "1";

  const rows = await prisma.customer.findMany({
    select: { id: true, name: true, whatsapp: true, address: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }],
    take: 10_000,
  });

  const header = simple
    ? ["name", "whatsapp", "address"]
    : ["id", "name", "whatsapp", "address", "createdAt"];

  const body = rows
    .map((r) => {
      const wa = r.whatsapp ?? "";
      // Excel-safe: = "628..." (Excel treats it as a formula returning TEXT, so digits are preserved)
      const waOut = excel && wa ? `="${wa}"` : csvEscape(wa);

      if (simple) {
        return [csvEscape(r.name), waOut, csvEscape(r.address)].join(",");
      }
      return [
        csvEscape(r.id),
        csvEscape(r.name),
        waOut,
        csvEscape(r.address),
        csvEscape(r.createdAt?.toISOString?.() ?? ""),
      ].join(",");
    })
    .join("\n");

  const csv = [header.join(","), body].join("\n");
  const filename = `customers-${simple ? "simple-" : ""}${excel ? "excel-" : ""}${new Date()
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
}
