// src/components/SearchButton.tsx
"use client";

import { useEffect, useState } from "react";

export default function SearchButton({
  value,
  onChange,
  placeholder = "Search…",
  title = "Search",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState(value || "");

  useEffect(() => setInner(value || ""), [value]);

  // shortcuts: Ctrl/Cmd+K or '/'
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if ((mod && e.key.toLowerCase() === "k") || (!mod && e.key === "/")) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        className="inline-flex items-center justify-center p-2 rounded-xl border bg-white hover:bg-gray-50"
        onClick={() => setOpen(true)}
        title={`${title} (/, Ctrl+K)`}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-1/2 top-[12vh] -translate-x-1/2 w-[92vw] max-w-[560px]">
            <div className="rounded-2xl border bg-white shadow-xl p-3">
              <input
                autoFocus
                className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary-400)]"
                placeholder={placeholder}
                value={inner}
                onChange={(e) => {
                  setInner(e.target.value);
                  onChange(e.target.value);
                }}
                onKeyDown={(e) => e.key === "Enter" && setOpen(false)}
              />
              <div className="mt-2 text-[11px] text-gray-500">Press Enter to close • / or Ctrl+K to open</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
