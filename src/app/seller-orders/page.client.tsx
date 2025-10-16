// src/app/seller-orders/page.client.tsx
"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import EditSellerOrderModal from "@/components/EditSellerOrderModal";
import Pagination from "@/components/ui/Pagination";

/* =========================
   Types
========================= */
type SellerOrder = {
  id: string;
  paymentStatus: "unpaid" | "paid" | "refunded";
  deliveryStatus: "pending" | "delivered" | "failed";
  paidAt?: string | null;
  deliveredAt?: string | null;
  total: number;
  discount: number;
  deliveryFee: number;
  createdAt: string;
  deliveryNote?: string | null;
  paymentType?: "CASH" | "TRANSFER" | "QRIS" | null;
  seller?: { name?: string | null; whatsapp?: string | null; address?: string | null } | null;
  // Items may be omitted in lightweight list responses
  items?: { id: string; itemId: string; qty: number; price: number; item: { name: string; unit?: "PCS" | "KG" } }[];
  // Lightweight count when items are omitted
  itemsCount?: number;
};

type ItemRef = { id: string; name: string; price: number; stock: number; unit?: "PCS" | "KG"; categoryName?: string };

type StatusFilter = "All" | "Unfinished" | "Done";

// badges we show on each order card/row
type BadgeStatus = "In Progress" | "Delivered but Not Paid" | "Paid but Not Delivered" | "Done";

const STORE_NAME = "Jjenstore";

function idr(n: number) {
  return `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;
}
function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

// "15 October 2025 18:21"
function formatDateWithTime(dateStr: string) {
  const d = new Date(dateStr);
  const day = pad2(d.getDate());
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  const hours = pad2(d.getHours());
  const minutes = pad2(d.getMinutes());
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()} ${hours}:${minutes}`;
}

// "11 October 2025"
function formatDateDayMonthYear(dateStr: string) {
  const d = new Date(dateStr);
  const day = pad2(d.getDate());
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// prevent Markdown conflicts inside names by swapping *, _
function mdSafe(text: string) {
  return (text || "-").replace(/\*/g, "＊").replace(/_/g, "＿");
}


const STATUS_OPTIONS: StatusFilter[] = ["All", "Unfinished", "Done"];

// Card/list badge text
const statusText = (o: SellerOrder): BadgeStatus => {
  const paid = o.paymentStatus === "paid";
  const del = o.deliveryStatus === "delivered";
  if (paid && del) return "Done";
  if (del && !paid) return "Delivered but Not Paid";
  if (!del && paid) return "Paid but Not Delivered";
  return "In Progress";
};

/* =========================
   Icons + shared classes
========================= */
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

// Dropdown menu component
function DropdownMenu({ children, trigger }: { children: React.ReactNode; trigger: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="More options"
      >
        {trigger}
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg z-10">
          <div className="py-1">
            {children}
          </div>
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
  disabled = false
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

const btnIcon =
  "inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all duration-200";

/* =========================
   Small UI helpers
========================= */
function StatusBadge({ s }: { s: BadgeStatus }) {
  const map: Record<BadgeStatus, string> = {
    "In Progress": "badge-warning",
    "Delivered but Not Paid": "badge-orange",
    "Paid but Not Delivered": "badge-blue",
    "Done": "badge-success",
  };
  return <span className={`${map[s]}`}>{s}</span>;
}

function asNumber(v: any): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/* =========================
   Page
========================= */
export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });

  const [filter, setFilter] = useState<StatusFilter>(() => {
    if (typeof window === "undefined") return "Unfinished";
    return (localStorage.getItem("seller-orders.filter") as StatusFilter) || "Unfinished";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("seller-orders.filter", filter);
  }, [filter]);

  const [payFilter, setPayFilter] = useState<"all" | "unpaid" | "paid" | "refunded">("all");
  const [shipFilter, setShipFilter] = useState<"all" | "pending" | "delivered" | "failed">("all");
  const [allItems, setAllItems] = useState<ItemRef[]>([]);
  const [sellers, setSellers] = useState<{ id: string; name: string; whatsapp?: string; address?: string; phone?: string }[]>([]);
  const [sellerQ, setSellerQ] = useState("");
  const [view, setView] = useState<"cards" | "list">(() => {
    if (typeof window === "undefined") return "cards";
    return (localStorage.getItem("seller-orders.view") as "cards" | "list") || "cards";
  });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("edit");
  const [modalOrder, setModalOrder] = useState<any>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const params = useSearchParams();
  const waFilter = params.get("wa");
  const openNewParam = params.get("new") === "1";

  useEffect(() => {
    localStorage.setItem("seller-orders.view", view);
  }, [view]);

  async function load(page = 1, search = "", force = false) {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      limit: pagination.limit.toString(),
    });
    if (search) params.append("search", search);
    // Optimize payload: omit items in list (load on demand)
    params.append("includeItems", "0");
    // Bust cache after mutations
    if (force) params.append("noCache", String(Date.now()));
    
    const res = await fetch(`/api/seller-orders?${params}`, force ? { cache: "no-store" } : {});
    const response = await res.json();
    
    if (response.data && response.pagination) {
      setOrders(Array.isArray(response.data) ? response.data : []);
      setPagination(response.pagination);
    } else {
      // Fallback for backward compatibility
      setOrders(Array.isArray(response) ? response : []);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
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
    if (waFilter) list = list.filter((o) => (o.seller?.whatsapp || "").includes(waFilter));
    if (sellerQ.trim()) {
      const q = sellerQ.trim().toLowerCase();
      list = list.filter((o) => {
        const n = (o.seller?.name || "").toLowerCase();
        const p = (o.seller?.whatsapp || "").toLowerCase();
        const a = (o.seller?.address || "").toLowerCase();
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
  }, [orders, filter, waFilter, payFilter, shipFilter, sellerQ]);

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
      seller: { name: "", whatsapp: "", address: "" },
      items: [],
    });
    setModalOpen(true);
  }

  async function openEdit(o: SellerOrder) {
    setModalMode("edit");
    // Ensure we have full items for editing
    let orderForEdit: any = o;
    if (!Array.isArray(o.items) || (o.items?.length ?? 0) === 0) {
      try {
        const res = await fetch(`/api/seller-orders/${o.id}`);
        if (res.ok) {
          const full = await res.json();
          orderForEdit = full;
        }
      } catch {}
    }
    setModalOrder({
      id: orderForEdit.id,
      paymentStatus: orderForEdit.paymentStatus,
      deliveryStatus: orderForEdit.deliveryStatus,
      paidAt: orderForEdit.paidAt ?? null,
      deliveredAt: orderForEdit.deliveredAt ?? null,
      deliveryNote: orderForEdit.deliveryNote ?? "",
      paymentType: (orderForEdit.paymentType ?? null) as any,
      discount: orderForEdit.discount ?? 0,
      deliveryFee: orderForEdit.deliveryFee ?? 0,
      seller: orderForEdit.seller ?? {},
      items: (orderForEdit.items || []).map((l: any) => ({
        itemId: l.itemId,
        qty: Number(l.qty),
        price: Number(l.price),
        item: { name: (l.item?.name ?? "") },
      })),
    });
    setModalOpen(true);
  }

  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  async function onDelete(id: string) {
    if (deletingOrderId === id) return; // Prevent multiple calls
    if (!confirm("Delete this seller order?")) return;
    
    try {
      setDeletingOrderId(id);
      const res = await fetch(`/api/seller-orders/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const t = await res.text();
        alert("Failed to delete: " + t);
        return;
      }
      // Optimistic update: remove locally, then re-fetch fresh list
      setOrders(prev => prev.filter(o => o.id !== id));
      await load(pagination.page, sellerQ, true);
    } catch (error) {
      console.error("Error deleting seller order:", error);
      alert("Failed to delete seller order");
    } finally {
      setDeletingOrderId(null);
    }
  }

  function handlePageChange(newPage: number) {
    load(newPage, sellerQ);
  }

  function handleSearch() {
    load(1, sellerQ);
  }

  async function ensureOrderItemsLoaded(orderId: string) {
    // If the order already has items, skip
    const target = orders.find(o => o.id === orderId);
    if (target && Array.isArray(target.items) && target.items.length > 0) return;
    try {
      const res = await fetch(`/api/seller-orders/${orderId}`);
      if (!res.ok) return;
      const full = await res.json();
      setOrders(prev => prev.map(o => {
        if (o.id !== orderId) return o;
        // Merge in items from detail response
        return {
          ...o,
          items: Array.isArray(full.items) ? full.items.map((li: any) => ({
            id: li.id,
            itemId: li.itemId,
            qty: Number(li.qty),
            price: li.price,
            item: { name: (li.item?.name ?? ""), unit: (li.item?.unit ?? "PCS") as any }
          })) : [],
          itemsCount: undefined
        };
      }));
    } catch {}
  }

  function toggleExpanded(orderId: string) {
    const willExpand = !expandedItems.includes(orderId);
    setExpandedItems(prev =>
      willExpand
        ? [...prev, orderId]
        : prev.filter(id => id !== orderId)
    );
    if (willExpand) {
      // Lazy-load items only when expanding
      ensureOrderItemsLoaded(orderId);
    }
  }

  function handleLimitChange(newLimit: number) {
    setPagination(prev => ({ ...prev, limit: newLimit }));
    load(1, sellerQ);
  }

  async function handleQuickStatusUpdate(orderId: string, paymentStatus: string, deliveryStatus: string) {
    if (updatingStatus === orderId) return; // Prevent multiple calls
    
    try {
      setUpdatingStatus(orderId);
      const res = await fetch(`/api/seller-orders/${orderId}/mark`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus, deliveryStatus }),
      });
      
      if (!res.ok) {
        const error = await res.text();
        alert("Failed to update status: " + error);
        return;
      }
      
      // Optimistic update: apply status locally, then re-fetch fresh list
      setOrders(prev => prev.map(o =>
        o.id === orderId
          ? {
              ...o,
              paymentStatus: paymentStatus as any,
              deliveryStatus: deliveryStatus as any,
              paidAt: paymentStatus === "paid" ? (o.paidAt ?? new Date().toISOString()) : o.paidAt,
              deliveredAt: deliveryStatus === "delivered" ? (o.deliveredAt ?? new Date().toISOString()) : o.deliveredAt
            }
          : o
      ));
      await load(pagination.page, sellerQ, true);
    } catch (error) {
      console.error("Error updating seller order status:", error);
      alert("Failed to update status");
    } finally {
      setUpdatingStatus(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header / Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Seller Orders</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Track orders from your sellers</p>
        </div>

        {waFilter && (
          <Link
            href="/seller-orders"
            className="badge-primary inline-flex items-center gap-1"
            title="Clear WhatsApp filter"
          >
            WA: +{waFilter}
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6l-12 12" />
            </svg>
          </Link>
        )}
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-white rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {/* Seller filter */}
          <div className="flex-1 min-w-[160px] sm:min-w-[200px]">
            <div className="relative">
              <input
                className="input pr-10"
                placeholder="Filter seller…"
                value={sellerQ}
                onChange={(e) => setSellerQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                title="Filter by name / phone / address"
              />
              <button
                onClick={handleSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Search"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
              </button>
            </div>
          </div>

          {/* View toggle */}
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-600 dark:bg-gray-800">
            <button
              className={`px-3 py-2 text-sm rounded-md ${view === "cards" ? "bg-primary-600 text-white" : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"}`}
              onClick={() => setView("cards")}
              title="Card view"
              aria-label="Card view"
            >
              <GridIcon className="w-4 h-4" />
            </button>
            <button
              className={`px-3 py-2 text-sm rounded-md ${view === "list" ? "bg-primary-600 text-white" : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"}`}
              onClick={() => setView("list")}
              title="List view"
              aria-label="List view"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Status filter */}
          <select
            className="input w-24 sm:w-40 text-xs sm:text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value as StatusFilter)}
            title="Overall status"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Payment filter */}
          <select
            className="input w-20 sm:w-32 text-xs sm:text-sm"
            value={payFilter}
            onChange={(e) => setPayFilter(e.target.value as any)}
            title="Payment status"
          >
            <option value="all">Pay: All</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="refunded">Refunded</option>
          </select>

          {/* Delivery filter */}
          <select
            className="input w-20 sm:w-32 text-xs sm:text-sm"
            value={shipFilter}
            onChange={(e) => setShipFilter(e.target.value as any)}
            title="Delivery status"
          >
            <option value="all">Deliv: All</option>
            <option value="pending">Pending</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
          </select>

          {/* New order button */}
          <button
            onClick={openCreate}
            className="btn btn-primary btn-md whitespace-nowrap"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="hidden sm:inline">New Seller Order</span>
            <span className="sm:hidden">New Order</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading seller orders…
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No seller orders found</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Try adjusting your filters or create a new seller order.</p>
        </div>
      ) : view === "cards" ? (
        /* =============== CARD VIEW =============== */
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((o) => {
            const s = statusText(o);
            const formattedDateTime = formatDateWithTime(o.createdAt);
            const hasItems = Array.isArray(o.items) && (o.items?.length ?? 0) > 0;
            // Count label for button and table
            const countLabel = hasItems ? (o.items?.length ?? 0) : Number(o.itemsCount || 0);
            // Display count (sum quantities) if we have items; otherwise fallback to itemsCount
            const itemCountDisplay = hasItems
              ? (o.items ?? []).reduce((sum, item) => {
                  const unit = (item.item as any)?.unit || "PCS";
                  if (unit === "KG") {
                    return sum + Number(item.qty);
                  } else {
                    return sum + Math.floor(Number(item.qty));
                  }
                }, 0)
              : Number(o.itemsCount || 0);

            const itemsPreview = hasItems
              ? o.items!.slice(0, 3)
                  .map((li) => {
                    const unit = (li.item as any)?.unit || "PCS";
                    let qty = Number(li.qty);
                    if (unit === "KG") {
                      qty = Math.round(qty * 10) / 10; // 1 decimal place
                    } else {
                      qty = Math.floor(qty); // integer
                    }
                    return `${li.item.name}×${qty}`;
                  })
                  .join(", ")
              : "";
            return (
              <li key={o.id} className="card card-hover h-full flex flex-col">
                <div className="card-padding flex-1 flex flex-col">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 truncate text-lg">
                        {o.seller?.name ?? "No Seller"}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {formattedDateTime}
                      </div>
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
                    
                    {o.seller?.address && (
                      <div className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                        <div className="flex items-start gap-2">
                          <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                          </svg>
                          <span className="break-words font-medium">{o.seller.address}</span>
                        </div>
                      </div>
                    )}

                    {/* Items section - hidden by default, toggle to show */}
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {(hasItems || Number(o.itemsCount || 0) > 0) && (
                        <div className="space-y-2">
                          {!expandedItems.includes(o.id) && (
                            <button
                              onClick={() => toggleExpanded(o.id)}
                              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 text-sm font-medium flex items-center gap-1"
                            >
                              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 5l7 7-7 7"/>
                              </svg>
                              Show Items ({countLabel})
                            </button>
                          )}
                          {expandedItems.includes(o.id) && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-700 dark:text-gray-300">Items Ordered</span>
                                <button
                                  onClick={() => toggleExpanded(o.id)}
                                  className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 text-sm font-medium flex items-center gap-1"
                                >
                                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M19 9l-7 7-7-7"/>
                                  </svg>
                                  Hide
                                </button>
                              </div>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {hasItems ? (
                                  o.items!.map((li) => {
                                    const unit = (li.item as any)?.unit || "PCS";
                                    let qty = Number(li.qty);
                                    if (unit === "KG") {
                                      qty = Math.round(qty * 10) / 10; // 1 decimal place
                                    } else {
                                      qty = Math.floor(qty); // integer
                                    }
                                    return (
                                      <div key={li.id} className="text-sm text-gray-600 dark:text-gray-300 truncate">
                                        {li.item.name}×{qty}
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="text-sm text-gray-500 dark:text-gray-400">Loading items…</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom row - pinned to bottom */}
                  <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex flex-col gap-3">
                      {/* Status Actions - more prominent now */}
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
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                       
                      {/* Price and Actions */}
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          Rp {o.total.toLocaleString("id-ID")}
                        </div>
                         
                        {/* Three-dot menu */}
                        <DropdownMenu
                          trigger={
                            <MoreVerticalIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                          }
                        >
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
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
        /* =============== LIST/TABLE VIEW =============== */
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-cell">Date & Time</th>
                  <th className="table-cell">Seller</th>
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
                  const hasItems = Array.isArray(o.items) && (o.items?.length ?? 0) > 0;
                  const itemCountDisplay = hasItems
                    ? (o.items ?? []).reduce((sum, item) => {
                        const unit = (item.item as any)?.unit || "PCS";
                        if (unit === "KG") {
                          return sum + Number(item.qty);
                        } else {
                          return sum + Math.floor(Number(item.qty));
                        }
                      }, 0)
                    : Number(o.itemsCount || 0);
                  return (
                    <tr key={o.id} className="table-row">
                      <td className="table-cell">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{formattedDateTime}</div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="max-w-xs">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{o.seller?.name ?? "No Seller"}</div>
                          {o.seller?.address && (
                            <div className="text-sm text-gray-600 dark:text-gray-400 truncate" title={o.seller.address}>
                              📍 {o.seller.address}
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
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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

      {/* CREATE/EDIT MODAL */}
      {modalOpen && (
        <EditSellerOrderModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={async () => {
            // Reload current page with existing filters after save (no-store)
            await load(pagination.page, sellerQ, true);
          }}
          order={modalOrder}
          sellers={[]}
          items={[]}
        />
      )}
    </div>
  );
}