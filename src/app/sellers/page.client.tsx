// src/app/sellers/page.client.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import SearchButton from "@/components/SearchButton";
import SellerModal from "@/components/SellerModal";
import Pagination from "@/components/ui/Pagination";

/* =========================
   Types
========================= */
type Seller = {
  id: string;
  name: string | null;
  whatsapp: string | null;
  address: string | null;
  createdAt?: string;
};

type PaginatedResponse = {
  data: Seller[];
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
   Page
========================= */
export default function SellersPage() {
  const searchParams = useSearchParams();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Seller | null>(null);
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
    
    const res = await fetch(`/api/sellers?${params}`, { cache: "no-store" });
    const data: PaginatedResponse = await res.json();
    
    if (Array.isArray(data)) {
      // Handle old API response format for backward compatibility
      setSellers(data);
      setPagination(null);
    } else {
      setSellers(data.data);
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
    if (!confirm("Delete this seller?")) return;
    const res = await fetch(`/api/sellers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const t = await res.text();
      alert("Failed to delete: " + t);
      return;
    }
    await load(currentPage, limit, query);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sellers</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage your seller database</p>
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
              placeholder="Search sellers…"
              title="Search sellers"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* New Seller */}
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
              <span className="hidden sm:inline">New Seller</span>
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
            Loading sellers…
          </div>
        </div>
      ) : sellers.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4 dark:bg-gray-700">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="m23 21-3.5-3.5M21 16v4"/>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1 dark:text-gray-100">No sellers found</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Try adjusting your search or create a new seller.</p>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="sm:hidden space-y-3">
            {sellers.map((s) => (
              <div key={s.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 relative">
                {/* Three-dot menu positioned outside the card content */}
                <div className="absolute top-3 right-3 z-10">
                  <SellerActions
                    seller={{ id: s.id, name: s.name, whatsapp: s.whatsapp }}
                    onEdit={(sel) => {
                      const full = sellers.find((x) => x.id === sel.id) || s;
                      setEdit(full);
                      setOpen(true);
                    }}
                    onDelete={(id) => onDelete(id)}
                  />
                </div>
                <div className="p-4 pr-12">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {s.name || "Unnamed Seller"}
                    </h3>
                    {s.whatsapp && (
                      <div className="flex items-center gap-1 mt-1 text-sm text-gray-600 dark:text-gray-400">
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                        <span>+{s.whatsapp}</span>
                      </div>
                    )}
                    {s.address && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                        {s.address}
                      </p>
                    )}
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
                      Seller
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
                  {sellers.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {s.name || "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {s.whatsapp ? (
                          <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
                            <span>+{s.whatsapp}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                          {s.address || "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <SellerActions
                          seller={{ id: s.id, name: s.name, whatsapp: s.whatsapp }}
                          onEdit={(sel) => {
                            const full = sellers.find((x) => x.id === sel.id) || s;
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
        <SellerModal
          seller={edit}
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

// Simple Seller Actions component (similar to CustomerActions but without WhatsApp)
function SellerActions({ seller, onEdit, onDelete }: {
  seller: { id: string; name: string | null; whatsapp: string | null };
  onEdit: (seller: { id: string; name: string | null; whatsapp: string | null }) => void;
  onDelete: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="More options"
      >
        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg z-50">
          <div className="py-1">
            <button
              onClick={() => {
                onEdit(seller);
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
            <button
              onClick={() => {
                onDelete(seller.id);
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}