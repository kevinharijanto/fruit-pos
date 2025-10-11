// src/app/orders/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import EditOrderModal from "@/components/EditOrderModal";

/* =========================
   Types
========================= */
type Order = {
  id: string;
  paymentStatus: 'unpaid'|'paid'|'refunded';
  deliveryStatus: 'pending'|'delivered'|'failed';
  paidAt?: string | null;
  deliveredAt?: string | null;
  total: number;
  discount: number;
  deliveryFee: number;
  createdAt: string;
  deliveryNote?: string | null;
  paymentType?: "CASH" | "TRANSFER" | "QRIS" | null;
  customer?: { name?: string | null; whatsapp?: string | null; address?: string | null } | null;
  items: { id: string; itemId: string; qty: number; price: number; item: { name: string } }[];
};

type ItemRef = { id: string; name: string; price: number; stock: number; unit?: "PCS" | "KG" };

type StatusFilter = "All" | "Unfinished" | "Done";

const STORE_NAME = "Jjenstore";

const PAYMENT_INSTRUCTION = `Lakukan pembayaran dengan cara
Transfer ke Rekening
BCA 8705484640
An Alfonsa Jeanny

Mohon lampirkan bukti transfer juga
🌸 Thank u 🌸`;

function idr(n: number) {
  return `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;
}
function pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }

// "11 October 2025" (no time, per your preferred screenshot)
function formatDateDayMonthYear(dateStr: string) {
  const d = new Date(dateStr);
  const day = pad2(d.getDate());
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// prevent Markdown conflicts inside names by swapping *, _ with lookalikes
function mdSafe(text: string) {
  return (text || "-").replace(/\*/g, "＊").replace(/_/g, "＿");
}

// word-wrap without breaking words
function wrapName(name: string, width: number): string[] {
  const words = (name || "-").split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) { cur = w; continue; }
    if ((cur + " " + w).length <= width) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function buildWhatsAppMessage(o: {
  createdAt: string;
  items: { qty: number; price: number; item: { name: string } }[];
  total: number;
  discount: number;
  deliveryFee: number;
}) {
  const date = formatDateDayMonthYear(o.createdAt);

  // Subtotal like API (sum of rounded line totals)
  const subtotal = o.items.reduce((s, li) => s + Math.round(Number(li.qty) * li.price), 0);

  // Layout constants (tuned for WhatsApp on small screens)
  const NAME_W = 22;
  const SEP = "--------------------";

  const rows: string[] = [];
for (const li of o.items) {
  const name = li.item?.name ? li.item.name : "-";
  // one full line for the (bold) name — no wrapping/splitting
  rows.push(`*${mdSafe(name)}*`);
  // next line: qty + italic unit price
  rows.push(`${li.qty}x   _${idr(li.price)}_`);
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



const STATUS_OPTIONS: StatusFilter[] = [
  "All",
  "Unfinished",
  "Done",
];

// Map current flags to the 4 requested statuses
const statusText = (o: Order): Exclude<StatusFilter, "ALL"> => {
  const paid = o.paymentStatus === 'paid';
  const del  = o.deliveryStatus === 'delivered';
  if (paid && del) return "Done";
  if (del && !paid) return "Delivered but Not Paid";
  if (!del && paid) return "Paid but Not Delivered";
  return "In Progress";
};

/* =========================
   Icons + shared classes
========================= */
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
function GridIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z" />
    </svg>
  );
}

const btnIcon =
  "inline-flex items-center justify-center w-11 h-11 rounded-xl border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1";

/* =========================
   Small UI helpers
========================= */
function StatusBadge({ s }: { s: Exclude<StatusFilter, "ALL"> }) {
  const map: Record<Exclude<StatusFilter, "ALL">, string> = {
    // not paid + not delivered
    "In Progress": "bg-yellow-100 text-yellow-800 border border-yellow-200",
    // delivered + not paid
    "Delivered but Not Paid": "bg-orange-100 text-orange-800 border border-orange-200",
    // paid + not delivered
    "Paid but Not Delivered": "bg-blue-100 text-blue-800 border border-blue-200",
    Done: "bg-green-100 text-green-800 border border-green-200",
  };
  return <span className={`px-2 py-1 rounded text-xs whitespace-nowrap ${map[s]}`}>{s}</span>;
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
export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
 const [filter, setFilter] = useState<StatusFilter>(() => {
   if (typeof window === "undefined") return "Unfinished";
   return (localStorage.getItem("orders.filter") as StatusFilter) || "Unfinished";
 });
 useEffect(() => {
   if (typeof window !== "undefined") localStorage.setItem("orders.filter", filter);
 }, [filter])
  const [payFilter, setPayFilter] = useState<'all'|'unpaid'|'paid'|'refunded'>('all');
  const [shipFilter, setShipFilter] = useState<'all'|'pending'|'delivered'|'failed'>('all');
  const [allItems, setAllItems] = useState<ItemRef[]>([]);
  const [view, setView] = useState<"cards" | "list">(() => {
    if (typeof window === "undefined") return "cards";
    return (localStorage.getItem("orders.view") as "cards" | "list") || "cards";
  });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("edit");
  const [modalOrder, setModalOrder] = useState<any>(null);

  const params = useSearchParams();
  const waFilter = params.get("wa");
  const openNewParam = params.get("new") === "1";

  useEffect(() => {
    localStorage.setItem("orders.view", view);
  }, [view]);

  async function load() {
    setLoading(true);
    const data: Order[] = await (await fetch("/api/orders")).json();
    setOrders(Array.isArray(data) ? data : []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    (async () => {
      const arr: any[] = await (await fetch("/api/items")).json();
      const mapped: ItemRef[] = (Array.isArray(arr) ? arr : []).map((i) => ({
        id: i.id,
        name: i.name,
        price: asNumber(i.price),
        stock: asNumber(i.stock),
        unit: i.unit,
      }));
      setAllItems(mapped);
    })();
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
   list = list.filter((o) => {
     if (filter === "ALL") return true;
     const paid = o.paymentStatus === "paid";
     const delivered = o.deliveryStatus === "delivered";
     if (filter === "Unfinished") return !(paid && delivered); // anything not fully done
     if (filter === "Done") return paid && delivered;
     return true;
   });
    if (payFilter !== 'all')  list = list.filter(o => o.paymentStatus  === payFilter);
    if (shipFilter !== 'all') list = list.filter(o => o.deliveryStatus === shipFilter);
    return list;
  }, [orders, filter, waFilter, payFilter, shipFilter]);

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
      // send dual tags so the modal uses them directly
      paymentStatus: o.paymentStatus,        // 'unpaid' | 'paid' | 'refunded'
      deliveryStatus: o.deliveryStatus,      // 'pending' | 'delivered' | 'failed'
      // keep timestamps for display/inference safety
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
        item: { name: l.item.name },
      })),
    });
    setModalOpen(true);
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this order? Stock will be returned.")) return;
    const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const t = await res.text();
      alert("Failed to delete: " + t);
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Orders</h1>

        {waFilter && (
          <Link
            href="/orders"
            className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
            title="Clear WhatsApp filter"
          >
            WA: +{waFilter} • clear
          </Link>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* View toggle */}
          <div className="inline-flex rounded-xl border bg-white shadow-sm overflow-hidden">
            <button
              className={`px-3 py-2 text-sm ${view === "cards" ? "bg-[var(--color-primary-50,#f0fdf4)] text-[var(--color-primary-800,#14532d)]" : "text-gray-600"}`}
              onClick={() => setView("cards")}
              title="Card view"
              aria-label="Card view"
            >
              <GridIcon className="w-4 h-4" />
            </button>
            <button
              className={`px-3 py-2 text-sm border-l ${view === "list" ? "bg-[var(--color-primary-50,#f0fdf4)] text-[var(--color-primary-800,#14532d)]" : "text-gray-600"}`}
              onClick={() => setView("list")}
              title="List view"
              aria-label="List view"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Status filter */}
          <label htmlFor="status" className="text-sm text-gray-600 hidden sm:inline-block">
            Filter
          </label>
          <select
            id="status"
            className="border rounded p-2 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value as StatusFilter)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* NEW: Payment & Delivery filters */}
          <select
            className="border rounded p-2 text-sm"
            value={payFilter}
            onChange={(e) => setPayFilter(e.target.value as any)}
            title="Payment status"
          >
            <option value="all">Pay: All</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="refunded">Refunded</option>
          </select>
          <select
            className="border rounded p-2 text-sm"
            value={shipFilter}
            onChange={(e) => setShipFilter(e.target.value as any)}
            title="Delivery status"
          >
            <option value="all">Delivery: All</option>
            <option value="pending">Pending</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
          </select>
          {/* New order button */}

          <button
            onClick={openCreate}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white
                       bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] active:bg-[var(--color-primary-800)]
                       focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--color-primary-300)]"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Order
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-3 text-sm text-gray-500">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="p-3 text-sm text-gray-500">No orders.</div>
      ) : view === "cards" ? (
        /* =============== CARD VIEW =============== */
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((o) => {
            const s = statusText(o);
            const date = new Date(o.createdAt).toLocaleString("id-ID");
            const itemCount = o.items.reduce((n, it) => n + it.qty, 0);
            const itemsPreview = o.items.slice(0, 3).map((li) => `${li.item.name}×${li.qty}`).join(", ");
            return (
              <li key={o.id} className="rounded-2xl border bg-white shadow-sm p-4">
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {o.customer?.name ?? "Walk-in"}
                      {o.customer?.whatsapp ? <span className="text-gray-500"> • +{o.customer.whatsapp}</span> : null}
                    </div>
                    <div className="text-xs text-gray-500">{date}</div>
                  </div>
                  <StatusBadge s={s} />
                </div>

                {/* Middle */}
                <div className="mt-3 text-sm text-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="truncate">
                      {itemsPreview}
                      {o.items.length > 3 ? "…" : ""}
                    </div>
                    <div className="text-xs text-gray-500 ml-2 whitespace-nowrap">{itemCount} items</div>
                  </div>
                  {o.deliveryNote && (
                    <div className="text-xs text-gray-500 mt-1 break-words">Note: {o.deliveryNote}</div>
                  )}
                  {o.customer?.address && (
                    <div className="text-xs text-gray-600 mt-1 break-words">{o.customer.address}</div>
                  )}
                </div>

                {/* Bottom row */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-lg font-semibold">Rp {o.total.toLocaleString("id-ID")}</div>
                  <div className="flex items-center gap-2">
                    {o.customer?.whatsapp && (
                      <a
                        className={`${btnIcon} text-white bg-[#25D366] hover:bg-[#1ebe57] active:bg-[#17a652] focus:ring-[#25D366] border-transparent`}
                        target="_blank"
                        rel="noopener noreferrer"
                        href={`https://wa.me/${o.customer.whatsapp}?text=${encodeURIComponent(buildWhatsAppMessage(o))}`}
                        title="WhatsApp"
                        aria-label="WhatsApp"
                      >
                        <WhatsAppIcon className="w-5 h-5" />
                      </a>
                    )}
                    <button
                      className={`${btnIcon} text-[var(--color-primary-800)] bg-white border-gray-300 hover:bg-gray-50`}
                      onClick={() => openEdit(o)}
                      title="Edit"
                      aria-label="Edit"
                    >
                      <PencilIcon className="w-5 h-5" />
                    </button>
                    <button
                      className={`${btnIcon} text-red-600 border-red-300 hover:bg-red-50`}
                      onClick={() => onDelete(o.id)}
                      title="Delete order"
                      aria-label="Delete"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        /* =============== LIST/TABLE VIEW =============== */
        <div className="overflow-x-auto border rounded">
          <table className="min-w-[720px] w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr className="text-left">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Items</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const s = statusText(o);
                const date = new Date(o.createdAt).toLocaleString("id-ID");
                const itemCount = o.items.reduce((n, it) => n + it.qty, 0);
                return (
                  <tr key={o.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap">{date}</td>
                    <td className="px-3 py-2">
                      <div className="truncate max-w-[260px]">
                        <span className="font-medium">{o.customer?.name ?? "Walk-in"}</span>
                        {o.customer?.whatsapp ? <span className="text-gray-500"> • +{o.customer.whatsapp}</span> : null}
                      </div>
                      {o.deliveryNote && (
                        <div className="text-[11px] text-gray-500 truncate max-w-[260px]">Note: {o.deliveryNote}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{itemCount}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-semibold">
                      Rp {o.total.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge s={s} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 justify-end">
                        {o.customer?.whatsapp && (
                          <a
                            className={`${btnIcon} text-white bg-[#25D366] hover:bg-[#1ebe57] active:bg-[#17a652] focus:ring-[#25D366] border-transparent`}
                            target="_blank"
                            rel="noopener noreferrer"
                            href={`https://wa.me/${o.customer.whatsapp}?text=${encodeURIComponent(buildWhatsAppMessage(o))}`}
                            title="WhatsApp"
                            aria-label="WhatsApp"
                          >
                            <WhatsAppIcon className="w-5 h-5" />
                          </a>
                        )}
                        <button
                          className={`${btnIcon} text-[var(--color-primary-800)] bg-white border-gray-300 hover:bg-gray-50`}
                          onClick={() => openEdit(o)}
                          title="Edit"
                          aria-label="Edit"
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        <button
                          className={`${btnIcon} text-red-600 border-red-300 hover:bg-red-50`}
                          onClick={() => onDelete(o.id)}
                          title="Delete order"
                          aria-label="Delete"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE/EDIT MODAL */}
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
    </div>
  );
}
