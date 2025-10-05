import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = "nodejs";

function toCSV(rows: any[]): string {
  if (!rows.length) return '';
  const header = Object.keys(rows[0]).join(',');
  const escape = (v: any) => `"${String(v).replace(/"/g, '""')}`;
  const body = rows.map(row => Object.values(row).map(escape).join(',')).join('\n');
  return header + '\n' + body;
}

export async function GET() {
  const customers = await prisma.customer.findMany({ orderBy: { createdAt: 'desc' } });
  const rows = customers.map(c => ({
    id: c.id,
    name: c.name,
    address: c.address,
    whatsapp: c.whatsapp,
    createdAt: c.createdAt
  }));
  const csv = toCSV(rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="customers.csv"'
    }
  });
}
