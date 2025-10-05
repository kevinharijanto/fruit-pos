"use client";

import { useEffect, useMemo, useState } from "react";

export type Customer = {
  id?: string;
  name: string;
  address?: string | null;
  whatsapp?: string | null; // stored as digits like 62812...
};

export default function EditCustomerModal({
  mode,         // "create" | "edit"
  customer,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  customer?: Customer;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(customer?.name ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const initialDigits = (customer?.whatsapp ?? "").replace(/^\+?62/, "").replace(/\D/g, "");
  const [digits, setDigits] = useState(initialDigits);
  const fullWA = digits ? `62${digits}` : "";

  const phoneDisplay = useMemo(
    () => digits.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim(),
    [digits]
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const valid = (name.trim().length > 0) || !!digits;

  async function save() {
    if (!valid) return;
    const payload = {
      name: name.trim(),
      address: (address || "").trim(),
      whatsapp: fullWA,
    };

    let res: Response;
    if (mode === "create") {
      res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch(`/api/customers/${customer?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    if (!res.ok) {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const j = await res.json();
        alert(j.error ?? "Failed to save");
      } else {
        alert("Failed to save");
      }
      return;
    }
    await onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50">
      <div className="fixed inset-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
                      bg-white h-[100dvh] w-[100vw] sm:h-auto sm:max-h-[90svh] sm:w-[700px]
                      overflow-hidden rounded-none sm:rounded-xl shadow flex flex-col min-h-0">
        {/* Header */}
        <div className="border-b px-5 py-4 flex items-center justify-between">
          <div className="text-xl font-semibold">{mode === "create" ? "New Customer" : "Edit Customer"}</div>
          <button onClick={onClose} className="text-base underline">Close</button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-5 space-y-6
                        [-webkit-overflow-scrolling:touch] [touch-action:pan-y]">
          <section className="space-y-3">
            <div className="text-base font-medium">Name</div>
            <input
              className="border rounded p-4 w-full text-base"
              placeholder="e.g. Ibu Sari"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <div className="text-base font-medium">Phone number</div>
            <div className="flex">
              <div className="px-4 py-4 border rounded-l bg-gray-50 select-none text-base">+62</div>
              <input
                inputMode="numeric"
                className="border border-l-0 rounded-r p-4 w-full text-base"
                placeholder="8123 456 789"
                value={phoneDisplay}
                onChange={(e) => setDigits(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="text-[12px] text-gray-500">Stored as {fullWA || "—"}</div>

            <div className="text-base font-medium">Address</div>
            <input
              className="border rounded p-4 w-full text-base"
              placeholder="Street, house no., etc."
              value={address ?? ""}
              onChange={(e) => setAddress(e.target.value)}
            />
          </section>
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-4 pb-[env(safe-area-inset-bottom)] flex items-center justify-end gap-3">
          <button className="px-5 py-3 border rounded text-base" onClick={onClose}>Cancel</button>
          <button
            className="px-5 py-3 rounded text-white bg-green-600 hover:bg-green-700 active:bg-green-800
                       text-base focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600 disabled:opacity-50"
            onClick={save}
            disabled={!valid}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
