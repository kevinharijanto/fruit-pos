"use client";

import { useEffect, useMemo, useState } from "react";
import Modal, { ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

// Type declarations for Web Contacts API
declare global {
  interface Navigator {
    contacts?: {
      select: (properties: string[], options?: { multiple?: boolean }) => Promise<Contact[]>;
    };
  }
}

// Contact interface for the Web Contacts API
interface Contact {
  name?: string[];
  tel?: string[];
  address?: {
    streetAddress?: string;
  }[];
}

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
  const [importingContacts, setImportingContacts] = useState(false);
  const [showContactsList, setShowContactsList] = useState(false);
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([]);

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
    } catch (error) {
      alert(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  // Import contacts from phone
  async function importContacts() {
    if (importingContacts) return; // Prevent multiple calls
    if (!navigator.contacts) {
      alert('Contact API is not available in this browser. This feature works best in mobile browsers and PWAs.');
      return;
    }

    try {
      setImportingContacts(true);
      const contacts = await navigator.contacts.select(['name', 'tel', 'address'], { multiple: true });
      if (contacts && contacts.length > 0) {
        setAvailableContacts(contacts);
        setShowContactsList(true);
      } else {
        alert('No contacts selected or no contacts available.');
      }
    } catch (error) {
      console.error('Error importing contacts:', error);
      alert('Failed to import contacts. Please make sure you grant permission to access your contacts.');
    } finally {
      setImportingContacts(false);
    }
  }

  // Select a contact and populate the form
  function selectContact(contact: Contact) {
    // Set name (use first name if available)
    if (contact.name && contact.name.length > 0) {
      setName(contact.name[0]);
    }

    // Set phone number (use first phone if available)
    if (contact.tel && contact.tel.length > 0) {
      const phone = contact.tel[0].replace(/\D/g, '');
      if (phone.startsWith('62')) {
        setPhoneDigits(phone.slice(2)); // Remove 62 prefix
      } else if (phone.startsWith('0')) {
        setPhoneDigits(phone.slice(1)); // Remove 0 prefix
      } else {
        setPhoneDigits(phone);
      }
    }

    // Set address (use first address if available)
    if (contact.address && contact.address.length > 0 && contact.address[0].streetAddress) {
      setAddress(contact.address[0].streetAddress || '');
    }

    setShowContactsList(false);
  }

  // Check if Contacts API is available
  const isContactsAPIAvailable = typeof navigator !== 'undefined' && !!navigator.contacts;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      size="responsive"
      className="overflow-hidden"
    >
      <ModalHeader>
        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {isEdit ? "Edit Customer" : "New Customer"}
        </div>
      </ModalHeader>

      <ModalBody className="space-y-6">
        {/* Phone Contacts Import */}
        {!isEdit && isContactsAPIAvailable && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Quick Import
              </label>
              <button
                type="button"
                className="btn btn-outline btn-sm dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={importContacts}
                disabled={importingContacts}
              >
                {importingContacts ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Importing…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Import from Contacts
                  </span>
                )}
              </button>
            </div>
          </section>
        )}

        {/* Contacts List Modal */}
        {showContactsList && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-96 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Select a Contact</h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {availableContacts.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                    No contacts found
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {availableContacts.map((contact, index) => (
                      <button
                        key={index}
                        type="button"
                        className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => selectContact(contact)}
                      >
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {contact.name?.[0] || 'Unknown Name'}
                        </div>
                        {contact.tel && contact.tel.length > 0 && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {contact.tel[0]}
                          </div>
                        )}
                        {contact.address && contact.address.length > 0 && contact.address[0].streetAddress && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {contact.address[0].streetAddress}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm w-full dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  onClick={() => setShowContactsList(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Name */}
        <section className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Name
          </label>
          <input
            className="input dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:placeholder-gray-500"
            placeholder="Customer name"
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
            {isEdit ? "Update existing customer" : "Create new customer"}
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
