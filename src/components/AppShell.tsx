// src/components/AppShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import QuickCreateFab from "@/components/QuickCreateFab";

type Props = { children: React.ReactNode };

function NavIcon({ name }: { name: "home" | "orders" | "items" | "customers" }) {
  const cls = "w-5 h-5";
  switch (name) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cls} stroke="currentColor" strokeWidth="1.6">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5 10.5V20h14v-9.5" />
        </svg>
      );
    case "orders":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cls} stroke="currentColor" strokeWidth="1.6">
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 7h8M8 12h8M8 17h8" />
        </svg>
      );
    case "items":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cls} stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "customers":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cls} stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="7.5" r="3.5" />
          <path d="M4 20c1.5-3.5 4.5-5.5 8-5.5s6.5 2 8 5.5" />
        </svg>
      );
  }
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const link = (href: string, label: string, icon: React.ReactNode) => {
    const active = pathname === href || (href !== "/" && pathname.startsWith(href));
    return (
      <Link
        href={href}
        onClick={onNavigate}
        className={[
          "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium",
          "hover:bg-[var(--color-primary-50)] transition-colors",
          active
            ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] border border-[var(--color-primary-200)]"
            : "text-gray-700 border border-transparent",
        ].join(" ")}
      >
        {icon}
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <nav className="flex flex-col gap-1">
      {link("/", "Dashboard", <NavIcon name="home" />)}
      {link("/orders", "Order List", <NavIcon name="orders" />)}
      {link("/items", "Items", <NavIcon name="items" />)}
      {link("/customers", "Customers", <NavIcon name="customers" />)}
    </nav>
  );
}

export default function AppShell({ children }: Props) {
  const [open, setOpen] = useState(false);        // drawer (mobile & collapsed desktop)
  const [collapsed, setCollapsed] = useState(false); // sidebar collapsed on md+

  // remember collapsed state
  useEffect(() => {
    const v = localStorage.getItem("sidebarCollapsed");
    if (v) setCollapsed(v === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  /* Top bar height for sticky inner headers and main height calc */
  const topbarVarWhenSidebar = "0px";   // md+ with sidebar visible
  const topbarVarWhenCollapsed = "56px"; // mobile AND md+ when collapsed

  return (
    <>
      {/* Mobile top bar (always visible & sticky) */}
      <div className="md:hidden sticky top-[var(--safe-top)] z-40 bg-white/80 backdrop-blur border-b safe-area-x">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <button
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="p-2 rounded-lg border hover:bg-gray-50"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-primary-600)] text-white text-sm font-bold">
              F
            </div>
            <span className="font-semibold">Fruit POS</span>
          </div>
          <div className="w-9" />
        </div>
      </div>

      {/* Collapsed desktop/iPad top bar (sticky) */}
      {collapsed && (
        <div className="hidden md:block sticky top-[var(--safe-top)] z-40 bg-white/80 backdrop-blur border-b safe-area-x">
          <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
            <button
              aria-label="Open menu"
              onClick={() => setOpen(true)}
              className="p-2 rounded-lg border hover:bg-gray-50"
              title="Open navigation"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-primary-600)] text-white text-sm font-bold">
                F
              </div>
              <span className="font-semibold">Fruit POS</span>
            </div>

            {/* Pin button */}
            <button
              aria-label="Pin sidebar"
              onClick={() => setCollapsed(false)}
              className="p-2 rounded-lg border hover:bg-gray-50"
              title="Pin sidebar"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M14 3l7 7-4 1-3 8-2-2-2 2 2-8-4-1 7-7z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Fixed sidebar on md+ (does NOT scroll away) */}
      {!collapsed && (
        <aside className="hidden md:flex fixed inset-y-0 left-[var(--safe-left)] w-[240px] z-30 border-r bg-white safe-area-t safe-area-b">
          <div className="flex flex-col w-full h-full">
            <div className="px-4 py-5 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-bold">
                  F
                </div>
                <div>
                  <div className="font-semibold leading-none">Fruit POS</div>
                  <div className="text-xs text-gray-500 leading-none mt-1">Home Delivery</div>
                </div>
              </div>
              <button
                className="p-2 rounded-lg border hover:bg-gray-50"
                onClick={() => setCollapsed(true)}
                title="Hide sidebar"
                aria-label="Hide sidebar"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
            </div>

            {/* Sidebar scroll only if menu grows; sidebar itself stays fixed */}
            <div className="p-3 overflow-y-auto">
              <NavLinks />
            </div>

            <div className="mt-auto p-4 text-[11px] text-gray-400">
              v1.0 • {new Date().getFullYear()}
            </div>
          </div>
        </aside>
      )}

      {/* Main content: becomes the ONLY scroller */}
      <div className={!collapsed ? "md:pl-[calc(240px+var(--safe-left))]" : ""}>
        <main
          className={[
            "mx-auto w-full max-w-6xl px-4 md:px-8",
            "pt-[calc(var(--topbar-h,56px)+var(--safe-top))] md:pt-[calc(var(--topbar-h,0px)+var(--safe-top))]",
            "overflow-y-auto",
            // dynamic height: full viewport minus any top bar height
            "h-[calc(100dvh-var(--topbar-h,56px)-var(--safe-bottom))] md:h-[calc(100dvh-var(--topbar-h,0px)-var(--safe-bottom))]",
            collapsed
              ? "md:[--topbar-h:56px]" // collapsed desktop has a top bar
              : "md:[--topbar-h:0px]",   // sidebar visible: no top bar on md+
            "[--topbar-h:56px]",        // mobile always has top bar
          ].join(" ")}
        >
          {children}
        </main>
      </div>

      {/* Drawer (mobile + collapsed desktop) */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute left-[var(--safe-left)] top-[var(--safe-top)] bottom-[var(--safe-bottom)] w-80 max-w-[85vw] bg-white shadow-xl p-4 flex flex-col safe-area-x safe-area-t safe-area-b">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-primary-600)] text-white text-sm font-bold">
                  F
                </div>
                <span className="font-semibold">Fruit POS</span>
              </div>
              <button
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg border hover:bg-gray-50"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6l12 12M18 6l-12 12" />
                </svg>
              </button>
            </div>

            <NavLinks onNavigate={() => setOpen(false)} />

            {/* Pin sidebar from drawer */}
            <div className="mt-auto pt-4">
              <button
                className="w-full border rounded-lg px-3 py-2 text-sm"
                onClick={() => {
                  setCollapsed(false);
                  setOpen(false);
                }}
              >
                Pin sidebar (desktop)
              </button>
            </div>
          </div>
        </div>
      )}
      <QuickCreateFab brand />
    </>
  );
}
