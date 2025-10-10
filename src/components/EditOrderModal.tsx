// src/components/EditOrderModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

export type OrderForEdit = {
  id?: string;
  // NEW dual-tag statuses (optional so callers don’t break)
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
  items: { itemId: string; qty: number; price: number; item: { name: string } }[];
};

export type ItemRef = { id: string; name: string; price: number; stock: number; unit?: "PCS" | "KG" };
type CustPick = { id: string; name?: string | null; whatsapp?: string | null; address?: string | null };

export default function EditOrderModal({
  mode, order, allItems, onClose, onSaved,
}: {
  mode: "create" | "edit";
  order: OrderForEdit;
  allItems: ItemRef[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  // Body lock (skip iOS background issues)
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Customer
  const [name, setName] = useState(order.customer?.name ?? "");
  const [address, setAddress] = useState(order.customer?.address ?? "");
  const initialDigits = (order.customer?.whatsapp ?? "").replace(/^\+?62/, "").replace(/\D/g, "");
  const [phoneDigits, setPhoneDigits] = useState(initialDigits);
  const fullWA = phoneDigits ? `62${phoneDigits}` : "";

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (fullWA.length >= 8) {
        const res = await fetch("/api/customers?q=" + encodeURIComponent(fullWA), { cache: "no-store" });
        const arr = (await res.json()) as CustPick[];
        const c = Array.isArray(arr) ? arr.find((x) => x.whatsapp === fullWA) : undefined;
        if (!ignore && c) {
          setName((v) => v || c.name || "");
          setAddress((v) => v || c.address || "");
        }
      }
    })();
    return () => { ignore = true; };
  }, [fullWA]);

  const phoneDisplay = useMemo(
    () => phoneDigits.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim(),
    [phoneDigits]
  );
  function onPhoneInput(v: string) { setPhoneDigits(v.replace(/\D/g, "")); }

  // Items
  const [lines, setLines] = useState(
    (order.items || []).map((l) => ({ itemId: l.itemId, name: l.item.name, qty: l.qty, price: l.price }))
  );
  const itemsById = useMemo(() => Object.fromEntries(allItems.map((i) => [i.id, i])), [allItems]);

  const origQty = useMemo(() => {
    const m = new Map<string, number>();
    (order.items || []).forEach((l) => m.set(l.itemId, l.qty));
    return m;
  }, [order.items]);

  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((i) => i.name.toLowerCase().includes(q));
  }, [allItems, query]);

  // Helpers for unit-aware qty edits
  function roundByUnit(itemId: string, q: number) {
    const u = itemsById[itemId]?.unit || "PCS";
    if (u === "KG") {
      // one decimal place, e.g. 0.1 kg steps
      return Math.max(0, Math.round(q * 1000) / 1000);
    }
    // PCS → integers
    return Math.max(0, Math.floor(q));
  }

  function setQty(itemId: string, q: number) {
    setLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, qty: roundByUnit(itemId, q || 0) } : l)));
  }

  function inc(itemId: string) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.itemId !== itemId) return l;
        const base = itemsById[itemId];
        const step = (base?.unit === "KG") ? 0.001 : 1;
        const reserved = origQty.get(itemId) || 0;
        const available = (base?.stock ?? 0) + reserved - l.qty;
        if (base?.unit !== "KG" && available <= 0) return l; // only guard stock for tracked PCS; KG items are RESELL anyway
        const next = roundByUnit(itemId, l.qty + step);
        if (base?.unit !== "KG" && next > l.qty + available) return l;
        return { ...l, qty: next };
      })
    );
  }

  function dec(itemId: string) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.itemId !== itemId) return l;
        const base = itemsById[itemId];
        const step = (base?.unit === "KG") ? 0.001 : 1;
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
    const it = itemsById[itemId];
    if (!it) return;
    if (exists) inc(itemId);
    else setLines((prev) => [...prev, { itemId, name: it.name, qty: it.unit === "KG" ? 0.01 : 1, price: it.price }]);
  }
//
  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.qty * l.price, 0), [lines]);

  // Meta
  const [paymentType, setPaymentType] = useState<OrderForEdit["paymentType"]>(order.paymentType ?? null);
  const [deliveryNote, setDeliveryNote] = useState(order.deliveryNote ?? "");
  const [discount, setDiscount] = useState<number>(order.discount ?? 0);
  const [deliveryFee, setDeliveryFee] = useState<number>(order.deliveryFee ?? 0);
  // NEW: local dual-tag state (infer from provided fields or legacy timestamps)
  const [paymentStatus, setPaymentStatus] = useState<"unpaid"|"paid"|"refunded">(
    order.paymentStatus ?? (order.paidAt ? "paid" : "unpaid")
  );
  const [deliveryStatus, setDeliveryStatus] = useState<"pending"|"delivered"|"failed">(
    order.deliveryStatus ?? (order.deliveredAt ? "delivered" : "pending")
  );

  const total = Math.max(subtotal - (discount || 0) + (deliveryFee || 0), 0);

  async function save() {
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

    let res: Response;
    if (mode === "create") {
      res = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      res = await fetch(`/api/orders/${order.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
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
  }

  // Customer picker (unchanged visual)
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
        const arr = (await res.json()) as CustPick[];
        if (!ignore) setCustResults(Array.isArray(arr) ? arr : []);
      } finally {
        if (!ignore) setCustLoading(false);
      }
    }, 200);
    setCustLoading(true);
    return () => { ignore = true; ctrl.abort(); clearTimeout(id); };
  }, [pickerOpen, custQ]);

  function chooseCustomer(c: CustPick) {
    setName(c.name || "");
    setAddress(c.address || "");
    // normalize to local digits
    const d = String(c.whatsapp || "").replace(/\D/g, "");
    setPhoneDigits(d.startsWith("62") ? d.slice(2) : d.startsWith("0") ? d.slice(1) : d);
    setPickerOpen(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50">
      <div
        className="
          fixed inset-0
          sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
          bg-white
          h-[100dvh] w-[100vw] sm:h-auto sm:max-h-[90svh] sm:w-[760px]
          overflow-hidden
          rounded-none sm:rounded-xl shadow
          flex flex-col min-h-0
        "
      >
        {/* Header */}
        <div className="border-b px-5 py-4 flex items-center justify-between">
          <div className="text-xl font-semibold">{mode === "create" ? "New Order" : "Edit Order"}</div>
          <button onClick={onClose} className="text-base underline">Close</button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-5 space-y-7 [-webkit-overflow-scrolling:touch] [touch-action:pan-y]">
          {/* CUSTOMER */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-base font-medium">Customer</div>
              <button type="button" className="px-3 py-2 border rounded text-base" onClick={() => { setPickerOpen(true); setCustQ(""); }}>
                Choose existing
              </button>
            </div>

            <div className="text-base font-medium">Name</div>
            <input className="border rounded p-4 w-full text-base" placeholder="Customer name" value={name} onChange={(e) => setName(e.target.value)} />

            <div className="text-base font-medium">Phone number</div>
            <div className="flex">
              <div className="px-4 py-4 border rounded-l bg-gray-50 select-none text-base">+62</div>
              <input inputMode="numeric" className="border border-l-0 rounded-r p-4 w-full text-base" placeholder="8123 456 789" value={phoneDisplay} onChange={(e) => onPhoneInput(e.target.value)} />
            </div>
            <div className="text-[12px] text-gray-500">Stored as {fullWA || "—"}</div>

            <div className="text-base font-medium">Address</div>
            <input className="border rounded p-4 w-full text-base" placeholder="Street, house no., etc." value={address} onChange={(e) => setAddress(e.target.value)} />
          </section>

          {/* ITEMS */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-base font-medium">Items</div>
              <div className="text-sm text-gray-600">
                Subtotal: <span className="font-semibold">Rp {subtotal.toLocaleString("id-ID")}</span>
              </div>
              <div className="text-right text-sm text-gray-700 leading-5">
                <div>Subtotal: <span className="font-semibold">Rp {subtotal.toLocaleString("id-ID")}</span></div>
                {discount ? <div>Discount: −Rp {discount.toLocaleString("id-ID")}</div> : null}
                {deliveryFee ? <div>Ongkir: +Rp {deliveryFee.toLocaleString("id-ID")}</div> : null}
              </div>
            </div>

            {/* Search to add */}
            <div className="rounded border overflow-hidden">
              <div className="p-3 border-b">
                <input className="w-full border rounded p-3 text-base" placeholder="Search items to add…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div className="max-h-48 min-h-0 overflow-y-auto divide-y [-webkit-overflow-scrolling:touch]">
                {filtered.map((it) => (
                  <button key={it.id} type="button" onClick={() => addItem(it.id)} className="w-full text-left p-3 hover:bg-gray-50 flex items-center justify-between text-base">
                    <span className="truncate">{it.name}</span>
                    <span className="text-xs text-gray-600">Rp {it.price.toLocaleString("id-ID")} • stock {it.stock}{it.unit ? ` • ${it.unit.toLowerCase()}` : ""}</span>
                  </button>
                ))}
                {filtered.length === 0 && <div className="p-3 text-sm text-gray-500">No items.</div>}
              </div>
            </div>

            {/* Current items */}
            <ul className="divide-y rounded border">
              {lines.length === 0 && <li className="p-4 text-base text-gray-500">No items.</li>}
              {lines.map((l) => {
                const u = itemsById[l.itemId]?.unit || "PCS";
                const step = u === "KG" ? 0.001 : 1;
                return (
                  <li key={l.itemId} className="p-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="truncate text-base font-medium">{l.name}</div>
                      <div className="text-xs text-gray-600">Rp {l.price.toLocaleString("id-ID")} / {u === "KG" ? "kg" : "pcs"}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button className="px-4 py-3 border rounded text-base" onClick={() => dec(l.itemId)}>−</button>
                      <input
                        type="number"
                        step={step}
                        className="w-24 border rounded p-3 text-center text-base"
                        value={l.qty}
                        min={0}
                        onChange={(e) => setQty(l.itemId, Number(e.target.value))}
                      />
                      <button className="px-4 py-3 border rounded text-base" onClick={() => inc(l.itemId)}>＋</button>
                    </div>

                    <div className="text-right sm:w-32 text-base font-semibold">
                      Rp {(l.qty * l.price).toLocaleString("id-ID")}
                    </div>

                    <div className="text-right">
                      <button className="px-3 py-2 border rounded text-sm" onClick={() => remove(l.itemId)}>Remove</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* META */}
          <section className="space-y-3">
            <div className="text-base font-medium">Payment method</div>
            <select className="border rounded p-4 w-full text-base" value={paymentType ?? ""} onChange={(e) => setPaymentType((e.target.value || null) as any)}>
              <option value="">Select…</option>
              <option value="CASH">Cash</option>
              <option value="TRANSFER">Transfer</option>
              <option value="QRIS">QRIS</option>
            </select>

            <div className="text-base font-medium">Notes</div>
            <input className="border rounded p-4 w-full text-base" placeholder="Delivery notes (optional)" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} />

          {/* NEW: Dual-tag status controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-base font-medium">Payment status</div>
              <select
                className="border rounded p-4 w-full text-base"
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as any)}
              >
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div className="space-y-2">
              <div className="text-base font-medium">Delivery status</div>
              <select
                className="border rounded p-4 w-full text-base"
                value={deliveryStatus}
                onChange={(e) => setDeliveryStatus(e.target.value as any)}
              >
                <option value="pending">Pending</option>
                <option value="delivered">Delivered</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {/* Discount */}
          <div className="flex items-center gap-3">
            <span className="text-base">Discount</span>
            <input
              className="border rounded p-3 w-32 text-base"
              type="number"
              min={0}
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value || 0))}
            />
          </div>

          {/* Delivery Fee (Ongkir) */}
          <div className="flex items-center gap-3">
            <span className="text-base">Delivery Fee (Ongkir)</span>
            <input
              className="border rounded p-3 w-32 text-base"
              type="number"
              min={0}
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(Number(e.target.value || 0))}
            />
          </div>

          </section>
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-4 pb-[env(safe-area-inset-bottom)] flex items-center justify-between">
          <div className="text-lg font-semibold">Total: Rp {total.toLocaleString("id-ID")}</div>
          <div className="flex gap-3">
            <button className="px-5 py-3 border rounded text-base" onClick={onClose}>Cancel</button>
            <button className="px-5 py-3 rounded text-white bg-green-600 hover:bg-green-700 active:bg-green-800 text-base focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600" onClick={save}>
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Picker sheet (unchanged UI) */}
      {pickerOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40">
          <div className="fixed inset-x-0 bottom-0 sm:inset-0 sm:m-auto bg-white h-[75dvh] sm:h-auto sm:max-h-[85svh] sm:w-[700px] rounded-t-2xl sm:rounded-xl shadow flex flex-col min-h-0">
            <div className="border-b px-5 py-4 flex items-center justify-between">
              <div className="text-lg font-semibold">Choose Customer</div>
              <button className="text-base underline" onClick={() => setPickerOpen(false)}>Close</button>
            </div>
            <div className="px-5 py-3 border-b">
              <input className="w-full border rounded p-3 text-base" placeholder="Search name, address, or phone…" value={custQ} onChange={(e) => setCustQ(e.target.value)} autoFocus />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-1 [-webkit-overflow-scrolling:touch] [touch-action:pan-y]">
              {custLoading ? (
                <div className="p-4 text-sm text-gray-500">Loading…</div>
              ) : custResults.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">No customers found.</div>
              ) : (
                <ul className="divide-y">
                  {custResults.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => chooseCustomer(c)} className="w-full text-left p-4 hover:bg-gray-50">
                        <div className="text-base font-medium truncate">{c.name || "—"}</div>
                        <div className="mt-1 text-sm text-gray-700 break-words">{c.address || "No address"}</div>
                        <div className="mt-1 text-sm text-gray-500">{c.whatsapp ? `+${c.whatsapp}` : "No phone"}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
