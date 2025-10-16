"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Dashboard" },
  { href: "/orders", label: "Orders" },
  { href: "/seller-orders", label: "Seller Orders" },
  { href: "/items", label: "Items" },
  { href: "/customers", label: "Customers" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-[var(--topbar-h,56px)] z-10 bg-white/80 backdrop-blur border-b safe-area-x">
      <div className="mx-auto max-w-6xl px-4 h-12 flex items-center gap-4">
        {tabs.map((t) => {
          const active =
            pathname === t.href ||
            (t.href !== "/" && pathname.startsWith(t.href));
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`px-1 ${
                active
                  ? "font-semibold text-gray-900"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
