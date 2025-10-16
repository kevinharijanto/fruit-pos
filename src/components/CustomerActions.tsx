// src/components/CustomerActions.tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type CustomerLite = {
  id: string;
  name: string | null;
  whatsapp: string | null;
};

export default function CustomerActions({
  customer,
  onEdit,
  onDelete,
}: {
  customer: CustomerLite;
  onEdit: (c: CustomerLite) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <KebabMenu
      items={[
        {
          kind: "link",
          label: "View transactions",
          href: customer.whatsapp ? `/orders?wa=${encodeURIComponent(customer.whatsapp)}` : "/orders",
          icon: <ListIcon className="w-5 h-5" />,
        },
        ...(customer.whatsapp
          ? [
              {
                kind: "link" as const,
                label: "WhatsApp",
                href: `https://wa.me/${customer.whatsapp}`,
                icon: <WhatsAppIcon className="w-5 h-5" />,
                colorClass: "text-[#25D366]",
                newTab: true,
              },
            ]
          : []),
        {
          kind: "button",
          label: "Edit",
          onClick: () => onEdit(customer),
          icon: <PencilIcon className="w-5 h-5" />,
        },
        {
          kind: "button",
          label: "Delete",
          onClick: () => onDelete(customer.id),
          icon: <TrashIcon className="w-5 h-5" />,
          colorClass: "text-red-600",
        },
      ]}
    />
  );
}

/* ===== Uniform desktop buttons (44×44) ===== */
const btnIcon =
  "inline-flex items-center justify-center w-11 h-11 rounded-xl border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1";

function TransactionsButton({ wa }: { wa: string | null }) {
  return (
    <Link
      href={wa ? `/orders?wa=${encodeURIComponent(wa)}` : "/orders"}
      className={`${btnIcon} text-[var(--color-primary-700)] bg-white border-gray-200 hover:bg-gray-50`}
      title="View transactions"
      aria-label="View transactions"
    >
      <ListIcon className="w-5 h-5" />
    </Link>
  );
}
function WhatsAppButton({ wa }: { wa: string }) {
  return (
    <a
      href={`https://wa.me/${wa}`}
      target="_blank"
      className={`${btnIcon} text-white bg-[#25D366] hover:bg-[#1ebe57] active:bg-[#17a652] focus:ring-[#25D366] border-transparent`}
      title="Open WhatsApp"
      aria-label="Open WhatsApp"
    >
      <WhatsAppIcon className="w-5 h-5" />
    </a>
  );
}
function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`${btnIcon} text-[var(--color-primary-800)] bg-white border-gray-300 hover:bg-gray-50`}
      title="Edit"
      aria-label="Edit"
    >
      <PencilIcon className="w-5 h-5" />
    </button>
  );
}
function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`${btnIcon} text-red-600 border-red-300 hover:bg-red-50`}
      title="Delete"
      aria-label="Delete"
    >
      <TrashIcon className="w-5 h-5" />
    </button>
  );
}

/* ===== Mobile kebab menu ===== */
type MenuItem =
  | {
      kind: "link";
      label: string;
      href: string;
      icon?: React.ReactNode;
      colorClass?: string;
      newTab?: boolean;
    }
  | {
      kind: "button";
      label: string;
      onClick: () => void;
      icon?: React.ReactNode;
      colorClass?: string;
    };

function KebabMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDoc);
      window.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center w-11 h-11 rounded-xl border bg-white shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
        title="More actions"
        aria-label="More actions"
      >
        <KebabIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border bg-white shadow-lg overflow-hidden z-50 dark:bg-gray-800 dark:border-gray-700">
          <ul className="py-1">
            {items.map((it, i) =>
              it.kind === "link" ? (
                <li key={i}>
                  <a
                    href={it.href}
                    target={it.newTab ? "_blank" : undefined}
                    className={`flex items-center gap-3 px-3 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${it.colorClass || "text-gray-800 dark:text-gray-200"}`}
                    onClick={() => setOpen(false)}
                  >
                    {it.icon}
                    <span>{it.label}</span>
                  </a>
                </li>
              ) : (
                <li key={i}>
                  <button
                    className={`w-full text-left flex items-center gap-3 px-3 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${it.colorClass || "text-gray-800 dark:text-gray-200"}`}
                    onClick={() => {
                      setOpen(false);
                      it.onClick();
                    }}
                  >
                    {it.icon}
                    <span>{it.label}</span>
                  </button>
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ===== Icons (inline, no deps) ===== */
function WhatsAppIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M20.5 3.5A10.5 10.5 0 0 0 3.9 20.1L3 21l.9-2.9A10.5 10.5 0 1 0 20.5 3.5ZM12 20.8a8.8 8.8 0 0 1-4.48-1.23l-.3-.18-2.69.7.71-2.61-.19-.31a8.82 8.82 0 1 1 6.95 3.63Zm4.68-6.53c-.29-.15-1.73-.86-2-.96-.27-.1-.46-.15-.65.12-.19.26-.75.9-.92 1.08-.17.19-.32.21-.6.08-.29-.14-1.2-.43-2.27-1.37-.83-.72-1.39-1.6-1.56-1.86-.17-.26-.02-.41.12-.56.13-.13.3-.34.45-.51.15-.18.21-.31.31-.51.1-.21.05-.4-.02-.57-.07-.16-.63-1.51-.86-2.06-.23-.54-.46-.46-.64-.47-.17-.01-.37-.02-.57-.02-.2 0-.53.08-.8.36-.27.28-.99 1.02-.99 2.48 0 1.47 1.02 2.9 1.16 3.1.14.2 2.01 3.23 4.88 4.53.68.31 1.2.49 1.61.62.67.21 1.29.18 1.78.11.54-.09 1.62-.66 1.85-1.3.23-.64.23-1.18.16-1.3-.07-.12-.26-.2-.56-.35Z"
      />
    </svg>
  );
}
function PencilIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L18.81 8.94l-3.75-3.75L3 17.25Zm17.71-10.04c.39-.39.39-1.02 0-1.41l-2.51-2.51a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 2-1.66Z"
      />
    </svg>
  );
}
function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M9 3h6l1 2h5v2H3V5h5l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v9H7V9Z" />
    </svg>
  );
}
function ListIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z" />
    </svg>
  );
}
function KebabIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <circle cx="12" cy="5" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="19" r="2" fill="currentColor" />
    </svg>
  );
}
