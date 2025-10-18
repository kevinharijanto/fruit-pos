// src/app/orders/page.client.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import EditOrderModal from "@/components/EditOrderModal";
import Pagination from "@/components/ui/Pagination";

/* =========================================
   Types
========================================= */
type Unit = "PCS" | "KG";
type PaymentStatus = "unpaid" | "paid" | "refunded";
type DeliveryStatus = "pending" | "delivered" | "failed";

type OrderItem = {
  id: string;
  itemId: string;
  qty: number;
  price: number;
  item: { name: string; unit: Unit };
};

type Order = {
  id: string;
  paymentStatus: PaymentStatus;
  deliveryStatus: DeliveryStatus;
  paidAt?: string | null;
  deliveredAt?: string | null;
  total: number;
  discount: number;
  deliveryFee: number;
  createdAt: string;
  deliveryNote?: string | null;
  paymentType?: "CASH" | "TRANSFER" | "QRIS" | null;
  customer?: { name?: string | null; whatsapp?: string | null; address?: string | null } | null;
  items: OrderItem[];
};

type ItemRef = {
  id: string;
  name: string;
  price: number;
  stock?: number;
  unit?: Unit;
  stockMode?: "TRACK" | "RESELL";
};

type StatusFilter = "All" | "Unfinished" | "Done";
type BadgeStatus = "In Progress" | "Delivered but Not Paid" | "Paid but Not Delivered" | "Done";

/* =========================================
   Constants
========================================= */
const STORE_NAME = "Jjenstore";
const STATUS_OPTIONS: StatusFilter[] = ["All", "Unfinished", "Done"];
const PAYMENT_INSTRUCTION = `Lakukan pembayaran dengan cara
Transfer ke Rekening
BCA 8705484640
An Alfonsa Jeanny

Mohon lampirkan bukti transfer juga
🌸 Thank u 🌸`;

/* =========================================
   Helpers
========================================= */
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const idr = (n: number) => `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;
const asNumber = (v: unknown) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};
const mdSafe = (text: string) => (text || "-").replace(/\*/g, "＊").replace(/_/g, "＿");

function formatDateWithTime(dateStr: string) {
  const d = new Date(dateStr);
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  return `${pad2(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function formatDateDayMonthYear(dateStr: string) {
  const d = new Date(dateStr);
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  return `${pad2(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function statusText(o: Order): BadgeStatus {
  const paid = o.paymentStatus === "paid";
  const del = o.deliveryStatus === "delivered";
  if (paid && del) return "Done";
  if (del && !paid) return "Delivered but Not Paid";
  if (!del && paid) return "Paid but Not Delivered";
  return "In Progress";
}

export function buildWhatsAppMessage(o: {
  createdAt: string;
  items: { qty: number; price: number; item: { name: string; unit?: Unit } }[];
  total: number;
  discount: number;
  deliveryFee: number;
}) {
  const date = formatDateDayMonthYear(o.createdAt);
  const subtotal = o.items.reduce((s, li) => s + Math.round(Number(li.qty) * li.price), 0);

  const SEP = "--------------------";
  const rows: string[] = [];
  for (const li of o.items) {
    const name = li.item?.name ? li.item.name : "-";
    const unit = li.item?.unit || "PCS";
    let qty = Number(li.qty);
    if (unit === "KG") qty = Math.round(qty * 1000) / 1000;
    else qty = Math.floor(qty);

    rows.push(`*${mdSafe(name)}*`);
    rows.push(`${qty}${unit.toLowerCase()} x   _${idr(li.price)}_`);
  }

  const parts: string[] = [
    `Terima Kasih sudah belanja di ${STORE_NAME}!`,
    "",
    `Tanggal: ${date}`,
    SEP,
    ...rows,
    SEP,
    `Subtotal: ${idr(subtotal)}`,
    SEP,
  ];

  if ((o.discount || 0) > 0) parts.push(`Diskon: -${idr(o.discount)}`);
  if ((o.deliveryFee || 0) > 0) parts.push(`Ongkir: +${idr(o.deliveryFee)}`);
  parts.push(`Total: ${idr(o.total)}`, "", PAYMENT_INSTRUCTION);

  return parts.join("\n");
}

/* =========================================
   Icons
========================================= */
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
      <path fill="currentColor" d="M3 17.25V21h3.75L18.81 8.94l-3.75-3.75L3 17.25Zm17.71-10.04c.39-.39.39-1.02 0-1.41l-2.51-2.51a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 2-1.66Z" />
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
function GridIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z" />
    </svg>
  );
}
function MoreVerticalIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  );
}

/* =========================================
   Small UI bits
========================================= */
const btnIcon =
  "inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all duration-200";

function StatusBadge({ s }: { s: BadgeStatus }) {
  const map: Record<BadgeStatus, string> = {
    "In Progress": "badge-warning",
    "Delivered but Not Paid": "badge-orange",
    "Paid but Not Delivered": "badge-blue",
    "Done": "badge-success",
  };
  return <span className={map[s]}>{s}</span>;
}

/* =========================================
   Dropdown
========================================= */
function DropdownMenu({ children, trigger }: { children: React.ReactNode; trigger: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="More options"
      >
        {trigger}
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg z-10">
          <div className="py-1">{children}</div>
        </div>
      )}
    </div>
  );
}
function DropdownMenuItem({
  children,
  onClick,
  className = "",
  danger = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        danger ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/* =========================================
   WhatsApp Preview Modal
   (fix: no clipping of primary button near rounded corner)
========================================= */
function WhatsAppPreviewModal({
  open,
  phone,
  text,
  onChangeText,
  onClose,
  onSend,
}: {
  open: boolean;
  phone: string;
  text: string;
  onChangeText: (v: string) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop below panel */}
      <div className="absolute inset-0 bg-black/50 z-0" onClick={onClose} />
      {/* Dialog */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="
            relative z-10
            w-full max-w-xl
            rounded-2xl
            bg-white dark:bg-gray-900
            border border-gray-200 dark:border-gray-700
            shadow-xl
            overflow-visible
            isolation-isolate
          "
        >
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Send to WhatsApp</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Phone: <span className="font-medium">+{phone || "—"}</span>
            </p>
          </div>

          <div className="px-5 py-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Message preview</label>
            <textarea
              value={text}
              onChange={(e) => onChangeText(e.target.value)}
              className="w-full h-48 input resize-y"
            />
          </div>

{/* Footer */}
<div
  className="
    px-5 pt-3 pb-5 border-t border-gray-100 dark:border-gray-800
    flex items-center justify-end gap-3
    overflow-visible
  "
>
  <button onClick={onClose} className="btn btn-ghost !py-2 !leading-6">
    Cancel
  </button>

  {/* ⬇️ Spacer wrapper keeps the button clear of the rounded corners */}
  <div className="ml-2 mr-2 overflow-visible">
    <button
      onClick={onSend}
      className="
        btn btn-primary
        !h-auto !py-2 !leading-6 !whitespace-nowrap !overflow-visible
        active:translate-y-0
        relative z-10                      /* draw above any subtle overlays */
      "
      style={{ lineHeight: 1.5 }}
    >
      Send via WhatsApp
    </button>
  </div>
</div>
        </div>
      </div>
    </div>
  );
}

/* =========================================
   Page
========================================= */
export default function OrdersPage() {
  // Data & pagination
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });

  // Filters / view
  const [filter, setFilter] = useState<StatusFilter>(() => {
    if (typeof window === "undefined") return "Unfinished";
    return (localStorage.getItem("orders.filter") as StatusFilter) || "Unfinished";
  });
  const [payFilter, setPayFilter] = useState<"all" | PaymentStatus>("all");
  const [shipFilter, setShipFilter] = useState<"all" | DeliveryStatus>("all");
  const [customerQ, setCustomerQ] = useState("");
  const [view, setView] = useState<"cards" | "list">(() => {
    if (typeof window === "undefined") return "cards";
    return (localStorage.getItem("orders.view") as "cards" | "list") || "cards";
  });

  // Items cache
  const [allItems, setAllItems] = useState<ItemRef[]>([]);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("edit");
  const [modalOrder, setModalOrder] = useState<any>(null);

  // UI state
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  // WA confirm state
  const [waModal, setWaModal] = useState<{ open: boolean; phone: string; text: string }>({
    open: false,
    phone: "",
    text: "",
  });

  const params = useSearchParams();
  const waFilter = params.get("wa");
  const openNewParam = params.get("new") === "1";

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("orders.filter", filter);
  }, [filter]);
  useEffect(() => {
    localStorage.setItem("orders.view", view);
  }, [view]);

  async function load(page = 1, search = "") {
    setLoading(true);
    const u = new URLSearchParams({ page: String(page), limit: String(pagination.limit) });
    if (search) u.append("search", search);

    const res = await fetch(`/api/orders?${u}`, { cache: "no-store" });
    const json = await res.json();

    if (json?.data && json?.pagination) {
      setOrders(Array.isArray(json.data) ? json.data : []);
      setPagination(json.pagination);
    } else {
      setOrders(Array.isArray(json) ? json : []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    (async () => {
      const res = await fetch("/api/items", { cache: "no-store" });
      const json = await res.json();
      const arr: any[] = json?.data && Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
      const mapped: ItemRef[] = arr.map((i) => ({
        id: i.id,
        name: i.name,
        price: asNumber(i.price),
        stock: asNumber(i?.stock),
        unit: i.unit,
        stockMode: i?.stockMode as "TRACK" | "RESELL" | undefined,
      }));
      setAllItems(mapped);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (openNewParam) {
      openCreate();
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNewParam]);

  const filtered = useMemo(() => {
    let list = orders;

    if (waFilter) list = list.filter((o) => (o.customer?.whatsapp || "").includes(waFilter));

    if (customerQ.trim()) {
      const q = customerQ.trim().toLowerCase();
      list = list.filter((o) => {
        const n = (o.customer?.name || "").toLowerCase();
        const p = (o.customer?.whatsapp || "").toLowerCase();
        const a = (o.customer?.address || "").toLowerCase();
        return n.includes(q) || p.includes(q) || a.includes(q);
      });
    }

    list = list.filter((o) => {
      const paid = o.paymentStatus === "paid";
      const delivered = o.deliveryStatus === "delivered";
      if (filter === "All") return true;
      if (filter === "Unfinished") return !(paid && delivered);
      if (filter === "Done") return paid && delivered;
      return true;
    });

    if (payFilter !== "all") list = list.filter((o) => o.paymentStatus === payFilter);
    if (shipFilter !== "all") list = list.filter((o) => o.deliveryStatus === shipFilter);

    return list;
  }, [orders, filter, waFilter, payFilter, shipFilter, customerQ]);

  function openCreate() {
    setModalMode("create");
    setModalOrder({
      inProgress: true,
      paidAt: null,
      deliveredAt: null,
      deliveryNote: "",
      paymentType: null,
      discount: 0,
      deliveryFee: 0,
      customer: { name: "", whatsapp: "", address: "" },
      items: [],
    });
    setModalOpen(true);
  }

  function openEdit(o: Order) {
    setModalMode("edit");
    setModalOrder({
      id: o.id,
      paymentStatus: o.paymentStatus,
      deliveryStatus: o.deliveryStatus,
      paidAt: o.paidAt ?? null,
      deliveredAt: o.deliveredAt ?? null,
      deliveryNote: o.deliveryNote ?? "",
      paymentType: (o.paymentType ?? null) as any,
      discount: o.discount ?? 0,
      deliveryFee: o.deliveryFee ?? 0,
      customer: o.customer ?? {},
      items: o.items.map((l) => ({
        itemId: l.itemId,
        qty: l.qty,
        price: l.price,
        item: { name: l.item.name, unit: l.item.unit },
      })),
    });
    setModalOpen(true);
  }

  async function onDelete(id: string) {
    if (deletingOrderId === id) return;
    if (!confirm("Delete this order? Stock will be returned.")) return;

    try {
      setDeletingOrderId(id);
      const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const t = await res.text();
        alert("Failed to delete: " + t);
        return;
      }
      await load(pagination.page, customerQ);
    } catch (err) {
      console.error("Error deleting order:", err);
      alert("Failed to delete order");
    } finally {
      setDeletingOrderId(null);
    }
  }

  function handlePageChange(newPage: number) {
    load(newPage, customerQ);
  }
  function handleSearch() {
    load(1, customerQ);
  }
  function handleLimitChange(newLimit: number) {
    setPagination((prev) => ({ ...prev, limit: newLimit }));
    load(1, customerQ);
  }

  function toggleExpanded(orderId: string) {
    setExpandedItems((prev) => (prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]));
  }

  async function handleQuickStatusUpdate(orderId: string, paymentStatus: PaymentStatus, deliveryStatus: DeliveryStatus) {
    if (updatingStatus === orderId) return;

    try {
      setUpdatingStatus(orderId);
      const res = await fetch(`/api/orders/${orderId}/mark`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus, deliveryStatus }),
      });
      if (!res.ok) {
        const error = await res.text();
        alert("Failed to update status: " + error);
        return;
      }
      await load(pagination.page, customerQ);
    } catch (err) {
      console.error("Error updating order status:", err);
      alert("Failed to update status");
    } finally {
      setUpdatingStatus(null);
    }
  }

  // WhatsApp confirm flow
  function openWhatsAppConfirm(o: Order) {
    const phone = (o.customer?.whatsapp || "").replace(/[^\d]/g, "");
    setWaModal({
      open: true,
      phone,
      text: buildWhatsAppMessage({
        createdAt: o.createdAt,
        items: o.items.map((i) => ({ qty: i.qty, price: i.price, item: { name: i.item.name, unit: i.item.unit } })),
        total: o.total,
        discount: o.discount,
        deliveryFee: o.deliveryFee,
      }),
    });
  }
  function sendWhatsAppNow() {
    if (!waModal.phone) {
      alert("No WhatsApp number for this customer.");
      return;
    }
    const url = `https://wa.me/${waModal.phone}?text=${encodeURIComponent(waModal.text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setWaModal({ open: false, phone: "", text: "" });
  }

  /* =========================================
     Render
  ========================================= */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Orders</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage your customer orders</p>
        </div>

        {waFilter && (
          <Link href="/orders" className="badge-primary inline-flex items-center gap-1" title="Clear WhatsApp filter">
            WA: +{waFilter}
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 6l12 12M18 6l-12 12" />
            </svg>
          </Link>
        )}
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-white rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-4">
          {/* Customer filter */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <input
                className="input pr-10"
                placeholder="Filter customer…"
                value={customerQ}
                onChange={(e) => setCustomerQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                title="Filter by name / phone / address"
              />
              <button
                onClick={handleSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Search"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </button>
            </div>
          </div>

          {/* View toggle */}
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-600 dark:bg-gray-800">
            <button
              className={`px-3 py-2 text-sm rounded-md ${
                view === "cards"
                  ? "bg-primary-600 text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
              }`}
              onClick={() => setView("cards")}
              title="Card view"
              aria-label="Card view"
            >
              <GridIcon className="w-4 h-4" />
            </button>
            <button
              className={`px-3 py-2 text-sm rounded-md ${
                view === "list"
                  ? "bg-primary-600 text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
              }`}
              onClick={() => setView("list")}
              title="List view"
              aria-label="List view"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Overall status */}
          <select className="input w-40" value={filter} onChange={(e) => setFilter(e.target.value as StatusFilter)} title="Overall status">
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Payment filter */}
          <select className="input w-32" value={payFilter} onChange={(e) => setPayFilter(e.target.value as any)} title="Payment status">
            <option value="all">Pay: All</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="refunded">Refunded</option>
          </select>

          {/* Delivery filter */}
          <select className="input w-32" value={shipFilter} onChange={(e) => setShipFilter(e.target.value as any)} title="Delivery status">
            <option value="all">Delivery: All</option>
            <option value="pending">Pending</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
          </select>

          {/* New order */}
          <button onClick={openCreate} className="btn btn-primary btn-md">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Order
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading orders…
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No orders found</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Try adjusting your filters or create a new order.</p>
        </div>
      ) : view === "cards" ? (
        /* Card view */
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((o) => {
            const s = statusText(o);
            const formattedDateTime = formatDateWithTime(o.createdAt);

            const itemsPreview = o.items
              .slice(0, 3)
              .map((li) => {
                const unit = li.item.unit || "PCS";
                let qty = Number(li.qty);
                if (unit === "KG") qty = Math.round(qty * 10) / 10;
                else qty = Math.floor(qty);
                return `${li.item.name}×${qty}`;
              })
              .join(", ");

            return (
              <li key={o.id} className="card card-hover h-full flex flex-col">
                <div className="card-padding flex-1 flex flex-col">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 truncate text-lg">
                        {o.customer?.name ?? "Walk-in"}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{formattedDateTime}</div>
                    </div>
                    <StatusBadge s={s} />
                  </div>

                  {/* Middle */}
                  <div className="flex-1 space-y-3">
                    {o.deliveryNote && (
                      <div className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 p-2 rounded-lg">
                        <span className="font-medium">Note:</span> {o.deliveryNote}
                      </div>
                    )}

                    {o.customer?.address && (
                      <div className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                        <div className="flex items-start gap-2">
                          <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span className="break-words font-medium">{o.customer.address}</span>
                        </div>
                      </div>
                    )}

                    {/* Items section with toggle */}
                    {!!o.items.length && (
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {!expandedItems.includes(o.id) ? (
                          <button
                            onClick={() => toggleExpanded(o.id)}
                            className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 text-sm font-medium flex items-center gap-1"
                          >
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M9 5l7 7-7 7" />
                            </svg>
                            Show Items ({o.items.length})
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-700 dark:text-gray-300">Items Ordered</span>
                              <button
                                onClick={() => toggleExpanded(o.id)}
                                className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 text-sm font-medium flex items-center gap-1"
                              >
                                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                                  <path d="M19 9l-7 7-7-7" />
                                </svg>
                                Hide
                              </button>
                            </div>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {o.items.map((li) => {
                                const unit = li.item.unit || "PCS";
                                let qty = Number(li.qty);
                                if (unit === "KG") qty = Math.round(qty * 10) / 10;
                                else qty = Math.floor(qty);
                                return (
                                  <div key={li.id} className="text-sm text-gray-600 dark:text-gray-300 truncate">
                                    {li.item.name}×{qty}
                                  </div>
                                );
                              })}
                            </div>
                            {!!itemsPreview && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">Preview: {itemsPreview}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bottom row */}
                  <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex flex-col gap-3">
                      {/* Quick status */}
                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                        {o.paymentStatus !== "paid" && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusUpdate(o.id, "paid", o.deliveryStatus)}
                            disabled={updatingStatus === o.id}
                            className="px-4 py-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-sm font-medium hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {updatingStatus === o.id ? (
                              <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Updating…
                              </span>
                            ) : (
                              "Mark as Paid"
                            )}
                          </button>
                        )}
                        {o.deliveryStatus !== "delivered" && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusUpdate(o.id, o.paymentStatus, "delivered")}
                            disabled={updatingStatus === o.id}
                            className="px-4 py-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {updatingStatus === o.id ? (
                              <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Updating…
                              </span>
                            ) : (
                              "Mark as Delivered"
                            )}
                          </button>
                        )}
                        {o.paymentStatus === "paid" && o.deliveryStatus === "delivered" && (
                          <span className="px-4 py-2 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded-lg text-sm font-medium">
                            Order Complete
                          </span>
                        )}
                      </div>

                      {/* Price & menu */}
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">Rp {o.total.toLocaleString("id-ID")}</div>

                        <DropdownMenu trigger={<MoreVerticalIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />}>
                          {o.customer?.whatsapp && (
                            <DropdownMenuItem onClick={() => openWhatsAppConfirm(o)}>
                              <WhatsAppIcon className="w-4 h-4" />
                              WhatsApp
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openEdit(o)}>
                            <PencilIcon className="w-4 h-4" />
                            Edit Order
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDelete(o.id)}
                            danger
                            disabled={deletingOrderId === o.id}
                          >
                            {deletingOrderId === o.id ? (
                              <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Deleting…
                              </span>
                            ) : (
                              <>
                                <TrashIcon className="w-4 h-4" />
                                Delete Order
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        /* List / table view */
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-cell">Date & Time</th>
                  <th className="table-cell">Customer</th>
                  <th className="table-cell">Items</th>
                  <th className="table-cell">Total</th>
                  <th className="table-cell">Status</th>
                  <th className="table-cell text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((o) => {
                  const s = statusText(o);
                  const formattedDateTime = formatDateWithTime(o.createdAt);

                  const itemCountDisplay = o.items.reduce((sum, item) => {
                    const unit = item.item.unit || "PCS";
                    if (unit === "KG") return sum + Number(item.qty);
                    return sum + Math.floor(Number(item.qty));
                  }, 0);

                  return (
                    <tr key={o.id} className="table-row">
                      <td className="table-cell">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{formattedDateTime}</div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="max-w-xs">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {o.customer?.name ?? "Walk-in"}
                          </div>
                          {o.customer?.address && (
                            <div className="text-sm text-gray-600 dark:text-gray-400 truncate" title={o.customer.address}>
                              📍 {o.customer.address}
                            </div>
                          )}
                          {o.deliveryNote && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1" title={o.deliveryNote}>
                              Note: {o.deliveryNote}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="text-gray-900 dark:text-gray-100">{itemCountDisplay}</div>
                      </td>
                      <td className="table-cell">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          Rp {o.total.toLocaleString("id-ID")}
                        </div>
                      </td>
                      <td className="table-cell">
                        <StatusBadge s={s} />
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2 justify-end">
                          {o.customer?.whatsapp && (
                            <button
                              type="button"
                              className={`${btnIcon} text-white bg-green-600 hover:bg-green-700 focus:ring-green-500 border-transparent`}
                              onClick={() => openWhatsAppConfirm(o)}
                              title="WhatsApp"
                              aria-label="WhatsApp"
                            >
                              <WhatsAppIcon className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            className={`${btnIcon} text-primary-600 bg-white border-primary-200 hover:bg-primary-50 focus:ring-primary-500`}
                            onClick={() => openEdit(o)}
                            title="Edit"
                            aria-label="Edit"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            className={`${btnIcon} text-red-600 border-red-200 hover:bg-red-50 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed`}
                            onClick={() => onDelete(o.id)}
                            disabled={deletingOrderId === o.id}
                            title="Delete order"
                            aria-label="Delete"
                          >
                            {deletingOrderId === o.id ? (
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            ) : (
                              <TrashIcon className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            hasNext={pagination.hasNext}
            hasPrev={pagination.hasPrev}
            onPageChange={handlePageChange}
            limit={pagination.limit}
            onLimitChange={handleLimitChange}
            total={pagination.total}
          />
        </div>
      )}

      {/* Create/Edit modal */}
      {modalOpen && modalOrder && (
        <EditOrderModal
          mode={modalMode}
          order={modalOrder}
          allItems={allItems}
          onClose={() => setModalOpen(false)}
          onSaved={async () => {
            setModalOpen(false);
            setModalOrder(null);
            await load();
          }}
        />
      )}

      {/* WhatsApp preview modal */}
      <WhatsAppPreviewModal
        open={waModal.open}
        phone={waModal.phone}
        text={waModal.text}
        onChangeText={(v) => setWaModal((m) => ({ ...m, text: v }))}
        onClose={() => setWaModal({ open: false, phone: "", text: "" })}
        onSend={sendWhatsAppNow}
      />
    </div>
  );
}
