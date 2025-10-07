// src/components/DashboardHeader.tsx
"use client";

import Link from "next/link";
import React from "react";
import SearchButton from "@/components/SearchButton";

export type Range = "Today" | "This Week" | "This Month" | "All";

export default function DashboardHeader({
  range,
  setRange,
  q,
  setQ,
}: {
  range: Range;
  setRange: (r: Range) => void;
  q: string;
  setQ: (v: string) => void;
}) {
  const ranges: Range[] = ["Today", "This Week", "This Month", "All"];
  const dateStr = new Date().toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className={[
        // sticky & solid
        "sticky top-[calc(var(--topbar-h,0px)+var(--tabs-h,0px))] z-[60] isolate",
        "bg-white border-b shadow-sm",
        // make header full-bleed inside <main> (which has px-4 md:px-8)
        "-mx-4 md:-mx-8 px-4 md:px-8 safe-area-x",
      ].join(" ")}
    >
      <div className="py-4">
        {/* Row 1: title + date • search + new order */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-[28px] font-semibold leading-tight tracking-tight">
              Dashboard
            </h1>
            <p className="text-xs text-gray-500">{dateStr}</p>
          </div>

          <div className="ml-auto flex w-full md:w-auto items-center gap-2">
            <SearchButton value={q} onChange={setQ} placeholder="Search recent orders…" />

            <Link
              href="/pos"
              className="hidden sm:inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] active:bg-[var(--color-primary-800)] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--color-primary-300)]"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Order
            </Link>
          </div>
        </div>

        {/* Row 2: range pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          {ranges.map((r) => {
            const active = range === r;
            return (
              <button
                key={r}
                type="button"
                aria-pressed={active}
                onClick={() => setRange(r)}
                className={[
                  "px-3 py-1.5 rounded-full text-sm font-medium border shadow-sm transition-colors",
                  active
                    ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] border-[var(--color-primary-200)]"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
                ].join(" ")}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
