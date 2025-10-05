"use client";

import { useEffect, useMemo, useState } from "react";

export type Customer = {
  id?: string;
  name: string | null;
  whatsapp: string | null;
  address: string | null;
};

export default function CustomerModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer | null; // null => new customer
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const isEdit = !!customer?.id;

  /* ===== Body / FAB / scroll handling ===== */
  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua);

    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;

    // Flag both <html> and <body> so CSS can hide any FAB reliably
    document.documentElement.classList.add("modal-open");
    document.body.classList.add("modal-open");

    // Lock background scroll (avoid on iOS to prevent scroll bugs)
    if (!isIOS) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.documentElement.classList.remove("modal-open");
      document.body.classList.remove("modal-open");
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  /* ===== Form state ===== */
  const [name, setName] = useState(customer?.name ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");

  // store WA digits without +62; display grouped for readability
  const initialDigits = (customer?.whatsapp ?? "").replace(/^\+?62/, "").replace(/\D/g, "");
  const [phoneDigits, setPhoneDigits] = useState(initialDigits);

  const phoneDisplay = useMemo(
    () => phoneDigits.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim(),
    [phoneDigits]
  );
  function onPhoneInput(v: string) {
    setPhoneDigits(v.replace(/\D/g, ""));
  }
  function buildWA() {
    const d = phoneDigits.replace(/\D/g, "");
    if (!d) return null;
    if (d.startsWith("62")) return d;
    if (d.startsWith("0")) return "62" + d.slice(1);
    return "62" + d; // assume local without 0
  }

  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    const payload = {
      name: name.trim() || null,
      address: address.trim() || null,
      whatsapp: buildWA(),
    };
    try {
      setSaving(true);
      const res = await fetch(isEdit ? `/api/customers/${customer!.id}` : "/api/customers", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        let msg = res.statusText;
        if (ct.includes("application/json")) {
          const j = await res.json();
          msg = j.error || msg;
        }
        alert(`Failed to save: ${msg}`);
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50">
      {/* Fullscreen on mobile; centered card on >=sm */}
      <div
        className="
          fixed inset-0
          sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
          bg-white
          h-[100dvh] w-[100vw] sm:h-auto sm:w-[640px] sm:max-h-[90svh]
          overflow-hidden
          rounded-none sm:rounded-2xl shadow
          flex flex-col min-h-0
        "
      >
        {/* Header */}
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div className="text-base font-semibold">{isEdit ? "Edit Customer" : "New Customer"}</div>
          <button onClick={onClose} className="text-sm underline">
            Close
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto touch-scroll px-4 py-4 space-y-4">
          {/* Name */}
          <section className="space-y-2">
            <div className="text-sm font-medium">Name</div>
            <input
              className="border rounded p-3 w-full"
              placeholder="Customer name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </section>

          {/* Phone */}
          <section className="space-y-2">
            <div className="text-sm font-medium">Phone number</div>
            <div className="flex">
              <div className="px-3 py-3 border rounded-l bg-gray-50 select-none">+62</div>
              <input
                inputMode="numeric"
                className="border border-l-0 rounded-r p-3 w-full"
                placeholder="8123 456 789"
                value={phoneDisplay}
                onChange={(e) => onPhoneInput(e.target.value)}
              />
            </div>
            <div className="text-[11px] text-gray-500">Stored as {buildWA() || "—"}</div>
          </section>

          {/* Address */}
          <section className="space-y-2">
            <div className="text-sm font-medium">Address</div>
            <textarea
              className="border rounded p-3 w-full min-h-[88px]"
              placeholder="Street, house no., etc."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </section>
        </div>

        {/* Sticky footer (above any FAB) */}
        <div className="border-t px-4 py-3 safe-bottom flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {isEdit ? "Update existing customer" : "Create new customer"}
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-3 border rounded" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              className="
                px-4 py-3 rounded text-white
                bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] active:bg-[var(--color-primary-800)]
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-300)]
              "
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
