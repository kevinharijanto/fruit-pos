// src/components/QuickCreateFab.tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export default function QuickCreateFab({ brand = false }: { brand?: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // close on outside click / ESC
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // close menu on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div
      ref={rootRef}
      className="
        app-fab
        fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+16px)]
        md:right-6 md:bottom-6
        z-30
        pointer-events-none
      "
      data-fab
      aria-expanded={open}
    >
      {/* Speed-dial menu — UNMOUNTED when closed to avoid invisible hit area */}
      {open && (
        <div
          role="menu"
          aria-label="Quick create"
          className="absolute right-0 bottom-[72px] flex flex-col items-end gap-2 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <SpeedItem href="/orders?new=1" label="New Order" onClick={() => setOpen(false)} />
          <SpeedItem href="/items?new=1" label="New Item" onClick={() => setOpen(false)} />
          <SpeedItem href="/customers?new=1" label="New Customer" onClick={() => setOpen(false)} />
        </div>
      )}

      {/* FAB button */}
      <button
        aria-label="Create"
        onClick={() => setOpen((v) => !v)}
        className={[
          "pointer-events-auto grid place-items-center w-14 h-14 rounded-full shadow-lg border focus:outline-none",
          !brand && "bg-white border-gray-200 text-gray-800 hover:shadow-xl active:shadow",
          brand &&
            "text-white focus:ring-2 focus:ring-offset-2 " +
              "bg-[color:var(--color-brand-600,#16a34a)] " +
              "hover:bg-[color:var(--color-brand-700,#15803d)] " +
              "active:bg-[color:var(--color-brand-800,#166534)]",
        ].join(" ")}
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}

function SpeedItem({
  href,
  label,
  onClick,
}: {
  href: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="
        pointer-events-auto
        flex items-center gap-2
        rounded-xl border shadow-lg
        bg-white hover:bg-gray-50
        px-3 py-2 text-sm min-w-[168px] justify-between
      "
    >
      <span className="inline-flex w-5 h-5 items-center justify-center rounded bg-gray-900 text-white text-[13px]">+</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}
