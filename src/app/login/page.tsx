'use client';
import { useState } from 'react';

export default function Login() {
  const [username, setU] = useState('owner');
  const [pin, setP] = useState('');
  const submit = async () => {
    const res = await fetch('/api/auth/login', { method:'POST', body: JSON.stringify({ username, pin }) });
    if (res.ok) location.href = '/admin';
    else alert('Login gagal');
  };
  return (
    <div className="p-6 max-w-sm mx-auto space-y-3">
      <h1 className="text-xl font-semibold">Admin Login</h1>
      <input className="w-full border p-2 rounded" placeholder="Username" value={username} onChange={e=>setU(e.target.value)} />
      <input className="w-full border p-2 rounded" placeholder="PIN" value={pin} onChange={e=>setP(e.target.value)} />
      <button onClick={submit} className="border rounded px-4 py-2">Login</button>
    </div>
  );
}
