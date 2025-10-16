// src/app/customers/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SearchButton from "@/components/SearchButton";
import CustomerModal from "@/components/CustomerModal";
import CustomerActions from "@/components/CustomerActions";
import Pagination from "@/components/ui/Pagination";

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

type PaginatedResponse = {
  data: Customer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

/* =========================
   Page Component with useSearchParams
 ========================= */
function CustomersPageContent() {
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Customer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<PaginatedResponse['pagination'] | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  async function load(page = currentPage, limitValue = limit, searchQuery = query) {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limitValue.toString(),
      ...(searchQuery && { q: searchQuery })
    });
    
    const res = await fetch(`/api/customers?${params}`, { cache: "no-store" });
    const data: PaginatedResponse = await res.json();
    
    if (Array.isArray(data)) {
      // Handle old API response format for backward compatibility
      setCustomers(data);
      setPagination(null);
    } else {
      setCustomers(data.data);
      setPagination(data.pagination);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    load(1, limit, query);
  }, [query, limit]);

  // Auto-open from FAB (?new=1) — using useSearchParams
  useEffect(() => {
    const newParam = searchParams.get("new");
    if (newParam === "1") {
      setEdit(null);
      setOpen(true);
      // Clean up the URL
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete("new");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [searchParams]);

  // Search is now handled by the API, so we don't need client-side filtering

  async function onDelete(id: string) {
    if (!confirm("Delete this customer?")) return;
    const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const t = await res.text();
      alert("Failed to delete: " + t);
      return;
    }
    await load(currentPage, limit, query);
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
    await load(currentPage, limit, query);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Customers</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage your customer database</p>
        </div>

      </div>

      {/* Filters */}
      <div className="p-4 bg-white rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Search */}
          <div className="flex-1">
            <SearchButton
              value={query}
              onChange={setQuery}
              placeholder="Search customers…"
              title="Search customers"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* If ESLint complains about internal <a>, keep this comment above the tag: */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/customers/export?simple=1&excel=1"
              className="btn btn-secondary btn-md"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span className="hidden sm:inline">Export</span>
            </a>

            <button
              onClick={() => fileRef.current?.click()}
              className="btn btn-secondary btn-md"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17,8 12,3 7,8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span className="hidden sm:inline">Import</span>
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
              className="btn btn-primary btn-md"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="hidden sm:inline">New Customer</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading customers…
          </div>
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4 dark:bg-gray-700">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="m23 21-3.5-3.5M21 16v4"/>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1 dark:text-gray-100">No customers found</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Try adjusting your search or create a new customer.</p>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="sm:hidden space-y-3">
            {customers.map((c) => (
              <div key={c.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {c.name || "Unnamed Customer"}
                    </h3>
                    {c.whatsapp && (
                      <div className="flex items-center gap-1 mt-1 text-sm text-primary-600 dark:text-primary-400">
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                        <span>+{c.whatsapp}</span>
                      </div>
                    )}
                    {c.address && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                        {c.address}
                      </p>
                    )}
                  </div>
                  <div className="ml-3">
                    <CustomerActions
                      customer={{ id: c.id, name: c.name, whatsapp: c.whatsapp }}
                      onEdit={(cust) => {
                        const full = customers.find((x) => x.id === cust.id) || c;
                        setEdit(full);
                        setOpen(true);
                      }}
                      onDelete={(id) => onDelete(id)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      WhatsApp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {c.name || "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {c.whatsapp ? (
                          <div className="flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400">
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
                            <span>+{c.whatsapp}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                          {c.address || "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <CustomerActions
                          customer={{ id: c.id, name: c.name, whatsapp: c.whatsapp }}
                          onEdit={(cust) => {
                            const full = customers.find((x) => x.id === cust.id) || c;
                            setEdit(full);
                            setOpen(true);
                          }}
                          onDelete={(id) => onDelete(id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              hasNext={pagination.hasNext}
              hasPrev={pagination.hasPrev}
              onPageChange={(page) => {
                setCurrentPage(page);
                load(page, limit, query);
              }}
              limit={limit}
              onLimitChange={(newLimit) => {
                setLimit(newLimit);
                setCurrentPage(1);
                load(1, newLimit, query);
              }}
              total={pagination.total}
            />
          )}
        </>
      )}

      {/* ADD/EDIT MODAL */}
      {open && (
        <CustomerModal
          customer={edit}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            setEdit(null);
            await load(currentPage, limit, query);
          }}
        />
      )}
    </div>
  );
}

/* =========================
   Main Page Component with Suspense
 ========================= */
export default function CustomersPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading customers…
          </div>
        </div>
      </div>
    }>
      <CustomersPageContent />
    </Suspense>
  );
}
