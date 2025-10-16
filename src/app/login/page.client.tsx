"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { useDarkMode } from "@/contexts/DarkModeContext";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { darkMode, toggleDarkMode } = useDarkMode();
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
    <div className="min-h-svh grid place-items-center bg-gray-50 dark:bg-gray-900">
      {/* Dark Mode Toggle */}
      <button
        onClick={toggleDarkMode}
        className="fixed top-4 right-4 p-2 rounded-lg bg-white dark:bg-gray-800 shadow-md hover:shadow-lg transition-all duration-200"
        aria-label="Toggle dark mode"
      >
        {darkMode ? (
          <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        )}
      </button>

      <form
        onSubmit={onSubmit}
        className="w-[min(90vw,420px)] rounded-2xl border bg-white dark:bg-gray-800 dark:border-gray-700 shadow-lg p-6 space-y-4"
      >
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Sign in</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Enter admin password to access the POS.
        </p>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Admin password</label>
          <input
            type="password"
            className="w-full border rounded-lg p-3 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !password}
          className="w-full px-4 py-3 rounded-lg text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-60 transition-colors duration-200"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Tip: Set <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">ADMIN_PASSWORD</code> in your environment variables.
        </div>
      </form>
    </div>
  );
}