"use client";

import { useEffect, useMemo, useState } from "react";
import Modal, { ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

export type Seller = {
  id?: string;
  name: string | null;
  whatsapp: string | null;
  address: string | null;
};

export default function SellerModal({
  seller,
  onClose,
  onSaved,
}: {
  seller: Seller | null; // null => new seller
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const isEdit = !!seller?.id;

  /* ===== Form state ===== */
  const [name, setName] = useState(seller?.name ?? "");
  const [address, setAddress] = useState(seller?.address ?? "");

  // store WA digits without +62; display grouped for readability
  const initialDigits = (seller?.whatsapp ?? "").replace(/^\+?62/, "").replace(/\D/g, "");
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
      const res = await fetch(isEdit ? `/api/sellers/${seller!.id}` : "/api/sellers", {
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
    } catch (error) {
      alert(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      size="responsive"
      className="overflow-hidden"
    >
      <ModalHeader>
        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {isEdit ? "Edit Seller" : "New Seller"}
        </div>
      </ModalHeader>

      <ModalBody className="space-y-6">
        {/* Name */}
        <section className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Name
          </label>
          <input
            className="input dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:placeholder-gray-500"
            placeholder="Seller name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </section>

        {/* Phone */}
        <section className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Phone number
          </label>
          <div className="flex">
            <div className="px-4 py-3 border border-r-0 rounded-l-lg bg-gray-50 select-none font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              +62
            </div>
            <input
              inputMode="numeric"
              className={cn(
                "input rounded-l-none border-l-0",
                "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
              )}
              placeholder="8123 456 789"
              value={phoneDisplay}
              onChange={(e) => onPhoneInput(e.target.value)}
            />
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Stored as: {buildWA() || "—"}
          </div>
        </section>

        {/* Address */}
        <section className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Address
          </label>
          <textarea
            className={cn(
              "input min-h-[100px] resize-none",
              "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:placeholder-gray-500"
            )}
            placeholder="Street, house number, etc."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </section>
      </ModalBody>

      <ModalFooter>
        <div className="flex items-center justify-between w-full">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {isEdit ? "Update existing seller" : "Create new seller"}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="btn btn-secondary btn-md dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-md"
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
                "Save"
              )}
            </button>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  );
}