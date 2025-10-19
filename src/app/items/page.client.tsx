
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SearchButton from "@/components/SearchButton";
import EditItemModal from "@/components/EditItemModal";
import QuickCreateFab from "@/components/QuickCreateFab";
import Pagination from "@/components/ui/Pagination";

/* =========================
   Types aligned to Prisma
========================= */
type Category = { id: string; name: string };

type Item = {
  id: string;
  name: string;
  price: number;
  costPrice: number;
  stock: string | number; // Prisma Decimal -> serialized string; number in some setups
  unit: "PCS" | "KG";
  stockMode: "TRACK" | "RESELL";
  category?: Category | null;
  createdAt?: string;
};

type PaginatedResponse = {
  data: Item[];
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
   Icons (inline)
========================= */
function PencilIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L18.81 8.94l-3.75-3.75L3 17.25Zm17.71-10.04c.39-.39.39-1.02 0-1.41l-2.51-2.51a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 2-1.66Z"
      />
    </svg>
  );
}
function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M9 3h6l1 2h5v2H3V5h5l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v9H7V9Z"
      />
    </svg>
  );
}

const btnIcon =
  "inline-flex items-center justify-center w-11 h-11 rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all duration-200";

/* =========================
   Helpers
========================= */
const fmtIDR = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("id-ID");

function asNumber(x: string | number | null | undefined): number {
  if (x == null) return 0;
  if (typeof x === "number") return x;
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function fmtQty(stock: string | number, unit: "PCS" | "KG") {
  const n = asNumber(stock);
  // show decimals for KG, whole numbers for PCS
  return unit === "KG" ? n.toLocaleString("id-ID", { maximumFractionDigits: 3 }) : n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

/* =========================
   Page
========================= */
export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<PaginatedResponse['pagination'] | null>(null);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"edit" | "create">("create");
  const [current, setCurrent] = useState<any>(undefined);

  const params = useSearchParams();

  async function load(page = currentPage, limitValue = limit, searchQuery = query, categoryFilter = catFilter, forceRefresh = false) {
    setLoading(true);
    const searchParams = new URLSearchParams({
      page: page.toString(),
      limit: limitValue.toString(),
      ...(searchQuery && { q: searchQuery }),
      ...(categoryFilter && categoryFilter !== "ALL" && { cat: categoryFilter })
    });
    
    // Force cache busting if needed
    const cacheOptions = forceRefresh ? { cache: "no-store" as RequestCache } : { cache: "no-store" as RequestCache };
    
    const res = await fetch(`/api/items?${searchParams}`, cacheOptions);
    const data = await res.json();
    
    if (Array.isArray(data)) {
      // Handle search response (array of items) or old API response format
      setItems(data);
      setPagination(null);
    } else if (data && data.data && Array.isArray(data.data)) {
      // Handle paginated response
      setItems(data.data);
      setPagination(data.pagination);
    } else {
      // Fallback for unexpected response format
      setItems([]);
      setPagination(null);
    }
    
    // load categories for filter
    try {
      const rc = await fetch("/api/categories", { cache: "no-store" });
      if (rc.ok) {
        const cats = await rc.json();
        setCategories(Array.isArray(cats) ? cats : []);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    load(1, limit, query, catFilter);
  }, [query, catFilter, limit]);

  // Auto open “New Item” via ?new=1
  useEffect(() => {
    if (params.get("new") === "1") {
      setCurrent(undefined);
      setMode("create");
      setOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      window.history.replaceState({}, "", url.toString());
    }
  }, [params]);

  // Search and filtering is now handled by the API, so we don't need client-side filtering

  async function onDelete(id: string) {
    if (!confirm("Delete this item?")) return;
    const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const t = await res.text();
      alert("Failed to delete: " + t);
      return;
    }
    // Force refresh the data to ensure the table updates
    await load(currentPage, limit, query, catFilter, true);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Items</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage your product inventory</p>
        </div>

      </div>

      {/* Filters */}
      <div className="p-4 bg-white rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Search and filter row for mobile */}
          <div className="flex flex-1 gap-2">
            {/* Category filter */}
            <select
              className="input flex-1 sm:w-48"
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              title="Filter category"
            >
              <option value="ALL">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Search */}
            <div className="flex-1 min-w-[150px]">
              <SearchButton
                value={query}
                onChange={setQuery}
                placeholder="Search items…"
                title="Search items"
              />
            </div>
          </div>

          {/* New Item button */}
          <button
            onClick={() => {
              setCurrent(undefined);
              setMode("create");
              setOpen(true);
            }}
            className="btn btn-primary btn-md w-full sm:w-auto"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="hidden sm:inline">New Item</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading items…
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4 dark:bg-gray-700">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1 dark:text-gray-100">No items found</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Try adjusting your filters or create a new item.</p>
        </div>
      ) : (
        <>
          {/* Table View */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Unit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {items.map((it) => {
                    const unitLabel = it.unit === "KG" ? "kg" : "pcs";
                    const tracked = it.stockMode === "TRACK";
                    return (
                      <tr key={it.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {it.name}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {tracked ? (
                              <span className="badge-success">Tracked</span>
                            ) : (
                              <span className="badge-warning">Resell</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {it.category?.name || "—"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {it.unit === "KG" ? "per KG" : "per PCS"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            Rp {fmtIDR(it.price)}
                            <span className="text-xs text-gray-500 dark:text-gray-400">/{unitLabel}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {tracked ? (
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {fmtQty(it.stock, it.unit)} {unitLabel}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500 italic dark:text-gray-400">
                              Not tracked
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              className={`${btnIcon} text-primary-600 bg-white border-primary-200 hover:bg-primary-50 focus:ring-primary-500 dark:bg-gray-800 dark:border-primary-800 dark:hover:bg-primary-900/20`}
                              onClick={() => {
                                // Pass fields expected by your EditItemModal.
                                // Note: modal uses `unitType` internally, so we map from schema `unit`.
                                setCurrent({
                                  id: it.id,
                                  name: it.name,
                                  price: it.price,
                                  costPrice: typeof it.costPrice === "number" ? it.costPrice : 0,
                                  stock: asNumber(it.stock),
                                  unit: it.unit,                // use correct field name
                                  stockMode: it.stockMode,
                                  categoryId: it.category?.id,
                                  category: it.category || null,
                                });
                                setMode("edit");
                                setOpen(true);
                              }}
                              title="Edit"
                              aria-label="Edit"
                            >
                              <PencilIcon className="w-5 h-5" />
                            </button>

                            <button
                              className={`${btnIcon} text-red-600 border-red-200 hover:bg-red-50 focus:ring-red-500`}
                              onClick={() => onDelete(it.id)}
                              title="Delete"
                              aria-label="Delete"
                            >
                              <TrashIcon className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {items.map((it) => {
                const unitLabel = it.unit === "KG" ? "kg" : "pcs";
                const tracked = it.stockMode === "TRACK";
                return (
                  <div key={it.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {it.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          {tracked ? (
                            <span className="badge-success">Tracked</span>
                          ) : (
                            <span className="badge-warning">Resell</span>
                          )}
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {it.unit === "KG" ? "per KG" : "per PCS"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          className={`${btnIcon} text-primary-600 bg-white border-primary-200 hover:bg-primary-50 focus:ring-primary-500 dark:bg-gray-800 dark:border-primary-800 dark:hover:bg-primary-900/20`}
                          onClick={() => {
                            setCurrent({
                              id: it.id,
                              name: it.name,
                              price: it.price,
                              costPrice: typeof it.costPrice === "number" ? it.costPrice : 0,
                              stock: asNumber(it.stock),
                              unit: it.unit,
                              stockMode: it.stockMode,
                              categoryId: it.category?.id,
                              category: it.category || null,
                            });
                            setMode("edit");
                            setOpen(true);
                          }}
                          title="Edit"
                          aria-label="Edit"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          className={`${btnIcon} text-red-600 border-red-200 hover:bg-red-50 focus:ring-red-500`}
                          onClick={() => onDelete(it.id)}
                          title="Delete"
                          aria-label="Delete"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Category:</span>
                        <span className="ml-2 text-gray-900 dark:text-gray-100">
                          {it.category?.name || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Price:</span>
                        <span className="ml-2 text-gray-900 dark:text-gray-100">
                          Rp {fmtIDR(it.price)}/{unitLabel}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Stock:</span>
                        <span className="ml-2 text-gray-900 dark:text-gray-100">
                          {tracked ? `${fmtQty(it.stock, it.unit)} ${unitLabel}` : "Not tracked"}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Cost:</span>
                        <span className="ml-2 text-gray-900 dark:text-gray-100">
                          Rp {fmtIDR(it.costPrice)}/{unitLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                load(page, limit, query, catFilter);
              }}
              limit={limit}
              onLimitChange={(newLimit) => {
                setLimit(newLimit);
                setCurrentPage(1);
                load(1, newLimit, query, catFilter);
              }}
              total={pagination.total}
            />
          )}
        </>
      )}

      {/* Modal (create/edit) */}
      {open && (
        <EditItemModal
          item={current}
          mode={mode}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            setCurrent(undefined);
            // Force refresh to ensure latest data is shown
            await load(currentPage, limit, query, catFilter, true);
          }}
        />
      )}

      {/* Floating quick-create menu (includes New Customer) */}
      <QuickCreateFab brand />
    </div>
  );
}
