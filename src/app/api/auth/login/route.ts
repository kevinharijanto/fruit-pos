import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { issueAdminCookie, verifyPin } from '@/lib/auth';

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { username, pin } = await req.json();
  const admin = await prisma.admin.findUnique({ where: { username } });

  if (!admin) 
    return NextResponse.json({ error: 'Invalid user' }, { status: 401 });

  const ok = await verifyPin(pin, admin.hashedPin);

  if (!ok) 
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
  
  await issueAdminCookie();
  return NextResponse.json({ ok: true });
}
