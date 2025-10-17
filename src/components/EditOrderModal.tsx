"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Modal, { ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

export type OrderForEdit = {
  id?: string;
  // NEW dual-tag statuses (optional so callers don't break)
  paymentStatus?: "unpaid" | "paid" | "refunded";
  deliveryStatus?: "pending" | "delivered" | "failed";
  // legacy fields still accepted for inference
  inProgress?: boolean;
  paidAt?: string | null;
  deliveredAt?: string | null;
  deliveryNote?: string | null;
  paymentType?: "CASH" | "TRANSFER" | "QRIS" | null;
  discount?: number;
  deliveryFee?: number;
  customer?: { name?: string | null; whatsapp?: string | null; address?: string | null } | null;
  items: { itemId: string; qty: number; price: number; item: { name: string; unit?: "PCS" | "KG" } }[];
};

export type ItemRef = { id: string; name: string; price: number; stock?: number; unit?: "PCS" | "KG"; stockMode?: "TRACK" | "RESELL" };
type CustPick = { id: string; name?: string | null; whatsapp?: string | null; address?: string | null };

export default function EditOrderModal({
  mode,
  order,
  allItems,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  order: OrderForEdit;
  allItems: ItemRef[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  /* =========================
     Customer state
  ========================= */
  const [name, setName] = useState(order.customer?.name ?? "");
  const [address, setAddress] = useState(order.customer?.address ?? "");
  const initialDigits = (order.customer?.whatsapp ?? "").replace(/^\+?62/, "").replace(/\D/g, "");
  const [phoneDigits, setPhoneDigits] = useState(initialDigits);
  const fullWA = phoneDigits ? `62${phoneDigits}` : "";

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (fullWA.length >= 8) {
        const res = await fetch("/api/customers?wa=" + encodeURIComponent(fullWA), { cache: "no-store" });
        const arr = (await res.json()) as CustPick[];
        const c = Array.isArray(arr) ? arr.find((x) => x.whatsapp === fullWA) : undefined;
        if (!ignore && c) {
          setName((v) => v || c.name || "");
          setAddress((v) => v || c.address || "");
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [fullWA]);

  const phoneDisplay = useMemo(() => phoneDigits.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim(), [phoneDigits]);
  function onPhoneInput(v: string) {
    setPhoneDigits(v.replace(/\D/g, ""));
  }

  /* =========================
     Items & search
  ========================= */
  const [lines, setLines] = useState(
    (order.items || []).map((l) => ({ itemId: l.itemId, name: l.item.name, qty: l.qty, price: l.price }))
  );

  const itemsById = useMemo(() => Object.fromEntries(allItems.map((i) => [i.id, i])), [allItems]);

  // Remember original quantities (so PCS stock checks allow keeping previous qty)
  const origQty = useMemo(() => {
    const m = new Map<string, number>();
    (order.items || []).forEach((l) => m.set(l.itemId, l.qty));
    return m;
  }, [order.items]);

  // Search
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ItemRef[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    let ignore = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const res = await fetch(`/api/items?q=${encodeURIComponent(query.trim())}&limit=50`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await res.json();
        const items = data.data || (Array.isArray(data) ? data : []);
        if (!ignore) setSearchResults(items);
      } catch (e: any) {
        if (!ignore && e?.name !== "AbortError") console.error("Failed to search items:", e);
      } finally {
        if (!ignore) setSearchLoading(false);
      }
    }, 300);
    return () => {
      ignore = true;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return searchResults;
  }, [allItems, query, searchResults]);

  /* =========================
     Item resolvers (source of truth)
  ========================= */
  const resolveItem = useCallback(
    (id: string) => itemsById[id] ?? searchResults.find((x) => x.id === id),
    [itemsById, searchResults]
  );

  const resolveUnit = useCallback(
    (id: string) => {
      // Prefer live item refs (search or allItems)
      const liveUnit = resolveItem(id)?.unit as "PCS" | "KG" | undefined;
      if (liveUnit) return liveUnit;
      // Fallback to the unit provided by the incoming order payload (if any)
      const fromOrder = order.items?.find((l) => l.itemId === id)?.item?.unit as "PCS" | "KG" | undefined;
      return fromOrder ?? "PCS";
    },
    [resolveItem, order.items]
  );

  /* =========================
     Qty helpers (unit-aware)
  ========================= */
  function roundByUnit(itemId: string, q: number) {
    if (!Number.isFinite(q) || q < 0) q = 0;
    const u = resolveUnit(itemId);
    if (u === "KG") {
      return Math.round(q * 1000) / 1000;
    }
    return Math.floor(q);
  }

function setQty(itemId: string, q: number) {
  setLines((prev) =>
    prev.map((l) => {
      if (l.itemId !== itemId) return l;

      const base = resolveItem(itemId);
      const u = resolveUnit(itemId);

      const parsed = Number.isFinite(q) ? q : l.qty;   // don't jump to 0 on transient input
      const roundedQty = roundByUnit(itemId, parsed);

      const reserved = origQty.get(itemId) || 0;
      const stock = typeof base?.stock === "number" ? base!.stock : undefined;
      const tracked = (base?.stockMode === "TRACK") || (base?.stockMode == null && typeof stock === "number");

      // PCS: for tracked items, block only if remaining after change would be negative
      if (u !== "KG" && tracked && typeof stock === "number" && (stock + reserved - roundedQty) < 0) {
        return l;
      }
      return { ...l, qty: roundedQty };
    })
  );
}

function inc(itemId: string) {
  setLines((prev) =>
    prev.map((l) => {
      if (l.itemId !== itemId) return l;
      const base = resolveItem(itemId);
      const u = resolveUnit(itemId);
      const step = u === "KG" ? 0.001 : 1;

      const reserved = origQty.get(itemId) || 0;
      const stock = typeof base?.stock === "number" ? base!.stock : undefined;
      const tracked = (base?.stockMode === "TRACK") || (base?.stockMode == null && typeof stock === "number");

      const next = roundByUnit(itemId, l.qty + step);

      // PCS: only block for tracked items if stock would go negative AFTER the change
      if (u !== "KG" && tracked && typeof stock === "number" && (stock + reserved - next) < 0) {
        return l;
      }
      return { ...l, qty: next };
    })
  );
}


function dec(itemId: string) {
  setLines((prev) =>
    prev.map((l) => {
      if (l.itemId !== itemId) return l;
      const u = resolveUnit(itemId);
      const step = u === "KG" ? 0.001 : 1;
      const next = roundByUnit(itemId, l.qty - step);
      return { ...l, qty: next };
    })
  );
}


  function remove(itemId: string) {
    setLines((prev) => prev.filter((l) => l.itemId !== itemId));
  }

 function addItem(itemId: string) {
  const exists = lines.find((l) => l.itemId === itemId);
  const it = resolveItem(itemId);
  if (!it) return;

  if (exists) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.itemId !== itemId) return l;
        const u = resolveUnit(itemId);
        const step = u === "KG" ? 0.001 : 1;

        const base = resolveItem(itemId);
        const reserved = origQty.get(itemId) || 0;
        const stock = typeof base?.stock === "number" ? base!.stock : undefined;
        const tracked = (base?.stockMode === "TRACK") || (base?.stockMode == null && typeof stock === "number");

        const next = roundByUnit(itemId, l.qty + step);

        if (u !== "KG" && tracked && typeof stock === "number" && (stock + reserved - next) < 0) {
          return l;
        }
        return { ...l, qty: next };
      })
    );
  } else {
    const u = it.unit ?? "PCS";
    setLines((prev) => [
      ...prev,
      {
        itemId,
        name: it.name,
        qty: u === "KG" ? 0.001 : 1,
        price: it.price,
      },
    ]);
  }
}


  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.qty * l.price, 0), [lines]);

  /* =========================
     Meta / statuses
  ========================= */
  const [paymentType, setPaymentType] = useState<OrderForEdit["paymentType"]>(order.paymentType ?? null);
  const [deliveryNote, setDeliveryNote] = useState(order.deliveryNote ?? "");
  const [discount, setDiscount] = useState<number>(order.discount ?? 0);
  const [deliveryFee, setDeliveryFee] = useState<number>(order.deliveryFee ?? 0);

  const [paymentStatus, setPaymentStatus] = useState<"unpaid" | "paid" | "refunded">(
    order.paymentStatus ?? (order.paidAt ? "paid" : "unpaid")
  );
  const [deliveryStatus, setDeliveryStatus] = useState<"pending" | "delivered" | "failed">(
    order.deliveryStatus ?? (order.deliveredAt ? "delivered" : "pending")
  );

  const total = Math.max(subtotal - (discount || 0) + (deliveryFee || 0), 0);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    const payload = {
      customer: fullWA || name || address ? { name, address, whatsapp: fullWA } : undefined,
      items: lines.filter((l) => l.qty > 0).map((l) => ({ itemId: l.itemId, qty: l.qty })),
      paymentType: paymentType || undefined,
      deliveryNote: deliveryNote || undefined,
      discount: Number.isFinite(discount) ? Math.max(0, Math.floor(discount)) : undefined,
      deliveryFee: Number.isFinite(deliveryFee) ? Math.max(0, Math.floor(deliveryFee)) : undefined,
      paymentStatus,
      deliveryStatus,
    };

    try {
      setSaving(true);
      let res: Response;
      if (mode === "create") {
        res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/orders/${order.id}` , {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const j = await res.json();
          alert(`Failed to save: ${j.error ?? res.statusText}`);
        } else {
          alert(`Failed to save (${res.status}).`);
        }
        return;
      }
      await onSaved();
    } catch (error: any) {
      alert(`Failed to save: ${error?.message ?? "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  /* =========================
     Customer picker (unchanged UI)
  ========================= */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [custQ, setCustQ] = useState("");
  const [custResults, setCustResults] = useState<CustPick[]>([]);
  const [custLoading, setCustLoading] = useState(false);

  useEffect(() => {
    if (!pickerOpen) return;
    let ignore = false;
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const url = "/api/customers" + (custQ.trim() ? `?q=${encodeURIComponent(custQ.trim())}` : "");
        const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
        const data = await res.json();
        const arr = data.data || (Array.isArray(data) ? data : []);
        if (!ignore) setCustResults(arr);
      } finally {
        if (!ignore) setCustLoading(false);
      }
    }, 200);
    setCustLoading(true);
    return () => {
      ignore = true;
      ctrl.abort();
      clearTimeout(id);
    };
  }, [pickerOpen, custQ]);

  function chooseCustomer(c: CustPick) {
    setName(c.name || "");
    setAddress(c.address || "");
    const d = String(c.whatsapp || "").replace(/\D/g, "");
    setPhoneDigits(d.startsWith("62") ? d.slice(2) : d.startsWith("0") ? d.slice(1) : d);
    setPickerOpen(false);
  }

  /* =========================
     Render
  ========================= */
  return (
    <>
      <Modal isOpen={true} onClose={onClose} size="responsive" className="overflow-hidden">
        <ModalHeader>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {mode === "create" ? "New Order" : "Edit Order"}
          </div>
        </ModalHeader>

        <ModalBody className="space-y-6">
          {/* CUSTOMER SECTION */}
          <section className="bg-gray-50 dark:bg-gray-900/30 rounded-xl p-3 sm:p-6 space-y-3 sm:space-y-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">Customer Information</div>
              </div>
              <button
                type="button"
                className={cn(
                  "px-3 py-2 border rounded-lg text-sm font-medium transition-colors",
                  "border-gray-300 bg-white hover:bg-gray-50 text-gray-700",
                  "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                onClick={() => {
                  setPickerOpen(true);
                  setCustQ("");
                }}
                disabled={saving}
              >
                Choose existing
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                <input
                  className={cn(
                    "input text-base",
                    "bg-white border-gray-300 text-gray-900 placeholder-gray-500",
                    "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:placeholder-gray-500"
                  )}
                  placeholder="Customer name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone number</label>
                <div className="flex">
                  <div
                    className={cn(
                      "px-4 py-3 border rounded-l-lg bg-gray-50 select-none text-sm font-medium",
                      "bg-gray-100 border-gray-300 text-gray-700",
                      "dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                    )}
                  >
                    +62
                  </div>
                  <input
                    inputMode="numeric"
                    className={cn(
                      "input border-l-0 rounded-r-lg text-base",
                      "bg-white border-gray-300 text-gray-900 placeholder-gray-500",
                      "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:placeholder-gray-500"
                    )}
                    placeholder="8123 456 789"
                    value={phoneDisplay}
                    onChange={(e) => onPhoneInput(e.target.value)}
                  />
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Stored as {fullWA || "—"}</div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
              <input
                className={cn(
                  "input text-base",
                  "bg-white border-gray-300 text-gray-900 placeholder-gray-500",
                  "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:placeholder-gray-500"
                )}
                placeholder="Street, house no., etc."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </section>

          {/* ITEMS SECTION */}
          <section className="bg-gray-50 dark:bg-gray-900/30 rounded-xl p-3 sm:p-6 space-y-3 sm:space-y-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">Items</div>
              </div>
              <div className="text-right text-sm text-gray-700 dark:text-gray-300 leading-5">
                <div>
                  Subtotal: <span className="font-semibold">Rp {subtotal.toLocaleString("id-ID")}</span>
                </div>
                {discount ? <div>Discount: −Rp {discount.toLocaleString("id-ID")}</div> : null}
                {deliveryFee ? <div>Ongkir: +Rp {deliveryFee.toLocaleString("id-ID")}</div> : null}
              </div>
            </div>

            {/* Search to add */}
            <div className="rounded-lg border overflow-hidden bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
              <div className="p-2 sm:p-3 border-b border-gray-200 dark:border-gray-600">
                <input
                  className={cn(
                    "input text-base",
                    "bg-white border-gray-300 text-gray-900 placeholder-gray-500",
                    "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:placeholder-gray-500"
                  )}
                  placeholder="Search items to add…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="max-h-40 sm:max-h-48 min-h-0 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-600">
                {filtered.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => addItem(it.id)}
                    className={cn(
                      "w-full text-left p-3 flex items-center justify-between text-base transition-colors",
                      "hover:bg-gray-50",
                      "dark:hover:bg-gray-700"
                    )}
                  >
                    <span className="truncate font-medium text-gray-900 dark:text-gray-100">{it.name}</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Rp {it.price.toLocaleString("id-ID")} • stock {it.stock}
                      {it.unit ? ` • ${it.unit}` : ""}
                    </span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="p-3 text-sm text-gray-500 dark:text-gray-400">
                    {searchLoading ? "Searching…" : "No items."}
                  </div>
                )}
              </div>
            </div>

            {/* Current items */}
            <ul className="divide-y divide-gray-200 dark:divide-gray-600 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
              {lines.length === 0 && <li className="p-4 text-base text-gray-500 dark:text-gray-400">No items.</li>}
              {lines.map((l) => {
                const u = resolveUnit(l.itemId);
                const step = u === "KG" ? 0.001 : 1;
                const displayValue = u === "KG" ? Number(Number.isFinite(l.qty) ? Number(l.qty.toFixed(3)) : 0) : l.qty;
                return (
                  <li
                    key={l.itemId}
                    className="p-3 sm:p-4 grid grid-cols-1 gap-2 sm:gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-base font-medium text-gray-900 dark:text-gray-100">{l.name}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Rp {l.price.toLocaleString("id-ID")} / {u}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className={cn(
                          "px-3 py-2 border rounded-lg text-base font-medium transition-colors",
                          "border-gray-300 bg-white hover:bg-gray-50 text-gray-700",
                          "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        )}
                        onClick={() => dec(l.itemId)}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        step={step}
                        className={cn("w-24 border rounded-lg p-2 text-center text-base font-medium",
                                      "bg-white border-gray-300 text-gray-900",
                                      "dark:bg-gray-8 00 dark:border-gray-600 dark:text-gray-300")}
                        value={displayValue}
                        min={0}
                        onChange={(e) => {
                          const raw = e.target.value.replace(",", ".");
                          if (raw === "") {
                            // allow clearing to 0 while typing
                            setQty(l.itemId, 0);
                            return;
                          }
                          const n = Number(raw);
                          if (Number.isNaN(n)) return;       // ignore bad keystrokes
                          setQty(l.itemId, n);
                        }}
                        onBlur={(e) => {
                          // snap to precision on blur
                          const raw = e.target.value.replace(",", ".");
                          const n = Number(raw);
                          if (!Number.isNaN(n)) setQty(l.itemId, n);
                        }}
                      />
                      <button
                        className={cn(
                          "px-3 py-2 border rounded-lg text-base font-medium transition-colors",
                          "border-gray-300 bg-white hover:bg-gray-50 text-gray-700",
                          "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        )}
                        onClick={() => inc(l.itemId)}
                      >
                        ＋
                      </button>
                    </div>

                    <div className="text-right sm:w-32 text-base font-semibold text-gray-900 dark:text-gray-100">
                      Rp {(l.qty * l.price).toLocaleString("id-ID")}
                    </div>

                    <div className="text-right">
                      <button
                        className={cn(
                          "px-3 py-2 border rounded-lg text-sm font-medium transition-colors",
                          "border-red-300 bg-white hover:bg-red-50 text-red-700",
                          "dark:border-red-600 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20"
                        )}
                        onClick={() => remove(l.itemId)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* ORDER DETAILS SECTION */}
          <section className="bg-gray-50 dark:bg-gray-900/30 rounded-xl p-3 sm:p-6 space-y-3 sm:space-y-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">Order Details</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Payment method</label>
                <select
                  className={cn(
                    "input text-base",
                    "bg-white border-gray-300 text-gray-900",
                    "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
                  )}
                  value={paymentType ?? ""}
                  onChange={(e) => setPaymentType((e.target.value || null) as any)}
                >
                  <option value="">Select…</option>
                  <option value="CASH">Cash</option>
                  <option value="TRANSFER">Transfer</option>
                  <option value="QRIS">QRIS</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
                <input
                  className={cn(
                    "input text-base",
                    "bg-white border-gray-300 text-gray-900 placeholder-gray-500",
                    "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:placeholder-gray-500"
                  )}
                  placeholder="Delivery notes (optional)"
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                />
              </div>
            </div>

            {/* Dual-tag status controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Payment status</label>
                <select
                  className={cn(
                    "input text-base",
                    "bg-white border-gray-300 text-gray-900",
                    "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
                  )}
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as any)}
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Delivery status</label>
                <select
                  className={cn(
                    "input text-base",
                    "bg-white border-gray-300 text-gray-900",
                    "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
                  )}
                  value={deliveryStatus}
                  onChange={(e) => setDeliveryStatus(e.target.value as any)}
                >
                  <option value="pending">Pending</option>
                  <option value="delivered">Delivered</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>

            {/* Discount and Delivery Fee */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Discount</label>
                <input
                  className={cn(
                    "input w-full text-base",
                    "bg-white border-gray-300 text-gray-900",
                    "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
                  )}
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value || 0))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Delivery Fee (Ongkir)</label>
                <input
                  className={cn(
                    "input w-full text-base",
                    "bg-white border-gray-300 text-gray-900",
                    "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
                  )}
                  type="number"
                  min={0}
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(Number(e.target.value || 0))}
                />
              </div>
            </div>
          </section>
        </ModalBody>

        <ModalFooter>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-3 sm:gap-0">
            <div className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
              Total: Rp {total.toLocaleString("id-ID")}
            </div>
            <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
              <button
                type="button"
                className={cn(
                  "btn btn-secondary btn-md flex-1 sm:flex-none",
                  "dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                )}
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={cn("btn btn-primary btn-md flex-1 sm:flex-none", "disabled:opacity-50 disabled:cursor-not-allowed")}
                onClick={save}
                disabled={saving}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving…
                  </span>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        </ModalFooter>
      </Modal>

      {/* Picker sheet (unchanged UI) */}
      {pickerOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40">
          <div className="fixed inset-x-0 bottom-0 sm:inset-0 sm:m-auto bg-white h-[75dvh] sm:h-auto sm:max-h-[85svh] sm:w-[700px] rounded-t-2xl sm:rounded-xl shadow flex flex-col min-h-0 dark:bg-gray-800">
            <div className="border-b px-5 py-4 flex items-center justify-between dark:border-gray-700">
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">Choose Customer</div>
              <button
                type="button"
                className="text-base underline text-gray-600 dark:text-gray-400"
                onClick={() => setPickerOpen(false)}
                disabled={saving}
              >
                Close
              </button>
            </div>
            <div className="px-5 py-3 border-b dark:border-gray-700">
              <input
                className={cn(
                  "input text-base",
                  "bg-white border-gray-300 text-gray-900 placeholder-gray-500",
                  "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:placeholder-gray-500"
                )}
                placeholder="Search name, address, or phone…"
                value={custQ}
                onChange={(e) => setCustQ(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-1">
              {custLoading ? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading…</div>
              ) : custResults.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No customers found.</div>
              ) : (
                <ul className="divide-y dark:divide-gray-700">
                  {custResults.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => chooseCustomer(c)}
                        className={cn("w-full text-left p-4 hover:bg-gray-50", "dark:hover:bg-gray-700")}
                      >
                        <div className="text-base font-medium truncate text-gray-900 dark:text-gray-100">{c.name || "—"}</div>
                        <div className="mt-1 text-sm text-gray-700 break-words dark:text-gray-300">{c.address || "No address"}</div>
                        <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{c.whatsapp ? `+${c.whatsapp}` : "No phone"}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
