"use client";

import { useEffect, useMemo, useState } from "react";
import Modal, { ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

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
    <Modal
      isOpen={true}
      onClose={onClose}
      size="responsive"
      className="overflow-hidden"
    >
      <ModalHeader>
        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {mode === "create" ? "New Customer" : "Edit Customer"}
        </div>
      </ModalHeader>

      <ModalBody className="space-y-6">
        <section className="space-y-3">
          <div className="text-base font-medium text-gray-900 dark:text-gray-100">Name</div>
          <input
            className={cn(
              "input text-base",
              "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:placeholder-gray-500"
            )}
            placeholder="e.g. Ibu Sari"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="text-base font-medium text-gray-900 dark:text-gray-100">Phone number</div>
          <div className="flex">
            <div className={cn(
              "px-4 py-4 border rounded-l bg-gray-50 select-none text-base",
              "dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            )}>
              +62
            </div>
            <input
              inputMode="numeric"
              className={cn(
                "input border-l-0 rounded-r text-base",
                "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:placeholder-gray-500"
              )}
              placeholder="8123 456 789"
              value={phoneDisplay}
              onChange={(e) => setDigits(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Stored as {fullWA || "—"}</div>

          <div className="text-base font-medium text-gray-900 dark:text-gray-100">Address</div>
          <input
            className={cn(
              "input text-base",
              "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:placeholder-gray-500"
            )}
            placeholder="Street, house no., etc."
            value={address ?? ""}
            onChange={(e) => setAddress(e.target.value)}
          />
        </section>
      </ModalBody>

      <ModalFooter>
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            className="btn btn-secondary btn-md text-base dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={cn(
              "btn btn-primary btn-md text-base",
              "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600"
            )}
            onClick={save}
            disabled={!valid}
          >
            Save Changes
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
