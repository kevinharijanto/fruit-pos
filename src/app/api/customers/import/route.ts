import { prisma } from "@/lib/prisma";

/** tiny CSV parser (handles quotes, escaped quotes) */
function parseCSV(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        field = "";
        row = [];
      } else if (ch !== "\r") {
        field += ch;
      }
    }
  }
  row.push(field);
  rows.push(row);

  const headers = rows.shift() || [];
  return { headers, rows };
}

function normWA(raw: string | null | undefined) {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("62")) return d;
  if (d.startsWith("0")) return "62" + d.slice(1);
  return d; // assume already international without +
}

export const runtime = "nodejs";

/**
 * POST /api/customers/import[?replace=1]
 * Form-data: file=<csv>
 * - Columns supported: name, whatsapp, address (headers are case-insensitive)
 * - No need for id or createdAt (DB will create them automatically)
 * - If ?replace=1: after importing rows, delete all existing customers whose
 *   whatsapp is NOT in the CSV (customers with NULL whatsapp are kept).
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const replace = url.searchParams.get("replace") === "1";

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file 'file' in form-data." }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return Response.json({ error: "File too large (max 5MB)." }, { status: 413 });
  }

  const text = new TextDecoder("utf-8").decode(await file.arrayBuffer());
  const { headers, rows } = parseCSV(text);

  const idx = {
    name: headers.findIndex((h) => h.trim().toLowerCase() === "name"),
    whatsapp: headers.findIndex((h) => h.trim().toLowerCase() === "whatsapp"),
    address: headers.findIndex((h) => h.trim().toLowerCase() === "address"),
  };
  if (idx.name < 0 && idx.whatsapp < 0 && idx.address < 0) {
    return Response.json(
      { error: "CSV must include at least one of: name, whatsapp, address (header row required)." },
      { status: 400 }
    );
  }

  let created = 0,
    updated = 0,
    skipped = 0,
    deleted = 0;
  const errors: { line: number; message: string }[] = [];

  // Track which whatsapp numbers exist in CSV (for replace mode)
  const keepWA = new Set<string>();

  // Import pass (upsert by whatsapp when present)
  for (let i = 0; i < rows.length; i++) {
    try {
      const r = rows[i];
      const name = idx.name >= 0 ? (r[idx.name] || "").trim() : "";
      const address = idx.address >= 0 ? (r[idx.address] || "").trim() : "";
      const whatsapp = normWA(idx.whatsapp >= 0 ? (r[idx.whatsapp] || "").trim() : "");

      if (!name && !address && !whatsapp) {
        skipped++;
        continue;
      }

      if (whatsapp) {
        keepWA.add(whatsapp);
        const found = await prisma.customer.findFirst({ where: { whatsapp } });
        if (found) {
          await prisma.customer.update({
            where: { id: found.id },
            data: {
              name: name || found.name,
              address: address || found.address,
              whatsapp,
            },
          });
          updated++;
        } else {
          await prisma.customer.create({
            data: { name: name || "", address: address || null, whatsapp },
          });
          created++;
        }
      } else {
        // No whatsapp → always create a new row (cannot match deterministically)
        await prisma.customer.create({
          data: { name: name || "", address: address || null, whatsapp: null },
        });
        created++;
      }
    } catch (e: any) {
      errors.push({ line: i + 2, message: e?.message || "Unknown error" }); // 1-based + header
    }
  }

  // Replace pass (delete customers NOT present in CSV by whatsapp)
  if (replace) {
    // Only delete rows that have a whatsapp in DB and that whatsapp not in CSV
    const res = await prisma.customer.deleteMany({
      where: {
        whatsapp: {
          notIn: Array.from(keepWA),
          // keep records that don't have whatsapp at all (null)
          // you can change this if you want to also delete those:
          // NOT: { whatsapp: null }
        },
        NOT: { whatsapp: null },
      },
    });
    deleted = res.count;
  }

  return Response.json({ created, updated, skipped, deleted, errors, replace });
}
