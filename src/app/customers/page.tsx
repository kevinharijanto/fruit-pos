// src/app/customers/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import SearchButton from "@/components/SearchButton";
import CustomerModal from "@/components/CustomerModal";
import CustomerActions from "@/components/CustomerActions";

/* =========================
   Types
========================= */
type Customer = {
  id: string;
  name: string | null;
  whatsapp: string | null;
  address: string | null;
  createdAt?: string;
};

/* =========================
   Page
========================= */
export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Customer | null>(null);

  const params = useSearchParams();
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);
    const data: Customer[] = await (await fetch("/api/customers")).json();
    setCustomers(Array.isArray(data) ? data : []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  // Auto-open from FAB (?new=1)
  useEffect(() => {
    if (params.get("new") === "1") {
      setEdit(null);
      setOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      window.history.replaceState({}, "", url.toString());
    }
  }, [params]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.address || "").toLowerCase().includes(q) ||
        (c.whatsapp || "").includes(q)
    );
  }, [customers, query]);

  async function onDelete(id: string) {
    if (!confirm("Delete this customer?")) return;
    const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const t = await res.text();
      alert("Failed to delete: " + t);
      return;
    }
    await load();
  }

  async function handleImport(file: File) {
    const doReplace = confirm(
      "Replace all existing customers to match this CSV?\n\nOK = Replace (sync to CSV)\nCancel = Merge (upsert only)"
    );
    const fd = new FormData();
    fd.append("file", file);
    const url = `/api/customers/import${doReplace ? "?replace=1" : ""}`;
    const res = await fetch(url, { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) {
      alert("Import failed: " + (data?.error || res.statusText));
      return;
    }
    alert(
      `Import ${doReplace ? "(replace)" : "(merge)"} done.\n` +
        `Created: ${data.created}\n` +
        `Updated: ${data.updated}\n` +
        `Skipped: ${data.skipped}\n` +
        (doReplace ? `Deleted: ${data.deleted}\n` : "") +
        (data.errors?.length ? `Errors: ${data.errors.length}` : "")
    );
    await load();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Customers</h1>

        <div className="ml-auto flex items-center gap-2">
          <SearchButton value={query} onChange={setQuery} placeholder="Search customers…" title="Search customers" />

          {/* Export / Import */}
          {/* <a
            href="/api/customers/export"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border shadow-sm text-sm bg-white hover:bg-gray-50"
          >
            Export CSV
          </a> */}
          <a
            href="/api/customers/export?simple=1&excel=1"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border shadow-sm text-sm bg-white hover:bg-gray-50"
          >
            Export to Excel
          </a>
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border shadow-sm text-sm bg-white hover:bg-gray-50"
          >
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              if (f) handleImport(f);
              e.currentTarget.value = "";
            }}
          />

          {/* New Customer */}
          <button
            onClick={() => {
              setEdit(null);
              setOpen(true);
            }}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white
                       bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] active:bg-[var(--color-primary-800)]
                       focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--color-primary-300)]"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Customer
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="p-3 text-sm text-gray-500">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="p-3 text-sm text-gray-500">No customers.</div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <li key={c.id} className="rounded-2xl border bg-white shadow-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-base font-semibold truncate">{c.name || "—"}</div>
                  <div className="text-xs text-gray-500 truncate">+{c.whatsapp || "—"}</div>
                </div>

                {/* Actions: desktop = big buttons, mobile = kebab menu */}
                <CustomerActions
                  customer={{ id: c.id, name: c.name, whatsapp: c.whatsapp }}
                  onEdit={(cust) => {
                    // ensure we pass address to the modal:
                    const full = customers.find((x) => x.id === cust.id) || c;
                    setEdit(full);
                    setOpen(true);
                  }}
                  onDelete={(id) => onDelete(id)}
                />
              </div>

              {c.address && <div className="text-sm text-gray-700 mt-2">{c.address}</div>}
            </li>
          ))}
        </ul>
      )}

      {/* ADD/EDIT MODAL */}
      {open && (
        <CustomerModal
          customer={edit}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            setEdit(null);
            await load();
          }}
        />
      )}
    </div>
  );
}
