"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error || "Login failed");
        return;
      }
      const next = sp.get("next") || "/";
      router.replace(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-svh grid place-items-center bg-gray-50">
      <form
        onSubmit={onSubmit}
        className="w-[min(90vw,420px)] rounded-2xl border bg-white shadow p-6 space-y-4"
      >
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-gray-500">
          Enter admin password to access the POS.
        </p>

        <div className="space-y-2">
          <label className="text-sm font-medium">Admin password</label>
          <input
            type="password"
            className="w-full border rounded p-3"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !password}
          className="w-full px-4 py-3 rounded text-white bg-[var(--color-primary-600,#16a34a)]
                     hover:bg-[var(--color-primary-700,#15803d)] disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <div className="text-xs text-gray-500 text-center">
          Tip: Set <code>ADMIN_PASSWORD</code> in your environment variables.
        </div>
      </form>
    </div>
  );
}