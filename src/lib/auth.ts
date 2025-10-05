import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const COOKIE = 'admin_token';
const SECRET = process.env.ADMIN_SECRET || 'dev-secret-change-me';

export async function issueAdminCookie() {
  const payload = JSON.stringify({ role: 'admin', iat: Date.now() });
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  const token = Buffer.from(payload).toString('base64') + '.' + sig;
  const cookieStore = await cookies();
  cookieStore.set(COOKIE, token, { httpOnly: true, path: '/', sameSite: 'lax', maxAge: 60*60*8 }); // 8h
}

export async function requireAdmin() {
  const cookieStore = await cookies();
  const c = cookieStore.get(COOKIE)?.value;
  if (!c) return false;
  const [b64, sig] = c.split('.');
  if (!b64 || !sig) return false;
  const payload = Buffer.from(b64, 'base64').toString();
  const good = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  if (good !== sig) return false;
  try {
    const data = JSON.parse(payload);
    return data?.role === 'admin';
  } catch { return false; }
}

export async function verifyPin(pin: string, hashed: string) {
  return bcrypt.compare(pin, hashed);
}
