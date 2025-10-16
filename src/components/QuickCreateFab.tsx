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
        fixed right-4 bottom-[calc(max(env(safe-area-inset-bottom),20px)+20px)]
        md:right-6 md:bottom-[calc(max(env(safe-area-inset-bottom),20px)+24px)]
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
          className="absolute right-0 bottom-[calc(max(env(safe-area-inset-bottom),20px)+80px)] flex flex-col items-end gap-3 pointer-events-auto"
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
          "pointer-events-auto grid place-items-center w-14 h-14 rounded-full shadow-lg border focus:outline-none transition-all duration-200",
          !brand && "bg-white border-gray-200 text-gray-700 hover:shadow-xl hover:scale-105 active:shadow active:scale-95 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300",
          brand &&
            "text-white focus:ring-4 focus:ring-primary-200 focus:ring-offset-2 " +
              "bg-primary-600 hover:bg-primary-700 hover:shadow-xl hover:scale-105 " +
              "active:bg-primary-800 active:shadow active:scale-95",
        ].join(" ")}
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5">
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
        flex items-center gap-3
        rounded-xl border shadow-lg
        bg-white hover:bg-gray-50 hover:shadow-xl
        px-4 py-3 text-sm min-w-[180px] justify-between
        transition-all duration-200
        dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700
      "
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex w-6 h-6 items-center justify-center rounded-lg bg-primary-600 text-white text-xs font-medium">
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
      </div>
      <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}
