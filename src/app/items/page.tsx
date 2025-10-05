"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SearchButton from "@/components/SearchButton";
import EditItemModal from "@/components/EditItemModal";
import QuickCreateFab from "@/components/QuickCreateFab";

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
  "inline-flex items-center justify-center w-11 h-11 rounded-xl border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1";

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

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"edit" | "create">("create");
  const [current, setCurrent] = useState<any>(undefined);

  const params = useSearchParams();

  async function load() {
    setLoading(true);
    const res = await fetch("/api/items");
    const data: Item[] = await res.json();
    setItems(Array.isArray(data) ? data : []);
    // load categories for filter
    try {
      const rc = await fetch("/api/categories");
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const matchesQ =
        !q ||
        it.name.toLowerCase().includes(q) ||
        (it.category?.name || "").toLowerCase().includes(q);
      const matchesCat =
        catFilter === "ALL" || it.category?.id === catFilter;
      return matchesQ && matchesCat;
    });
  }, [items, query, catFilter]);

  async function onDelete(id: string) {
    if (!confirm("Delete this item?")) return;
    const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const t = await res.text();
      alert("Failed to delete: " + t);
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Items</h1>

        {/* Filters */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Category filter */}
          <select
            className="border rounded-xl px-3 py-2 text-sm bg-white"
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
          <SearchButton
            value={query}
            onChange={setQuery}
            placeholder="Search items…"
            title="Search items"
          />

          {/* New Item (desktop) */}
          <button
            onClick={() => {
              setCurrent(undefined);
              setMode("create");
              setOpen(true);
            }}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white
                       bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] active:bg-[var(--color-primary-800)]
                       focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--color-primary-300)]"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Item
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="p-3 text-sm text-gray-500">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="p-3 text-sm text-gray-500">No items.</div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((it) => {
            const unitLabel = it.unit === "KG" ? "kg" : "pcs";
            const tracked = it.stockMode === "TRACK";
            return (
              <li key={it.id} className="rounded-2xl border bg-white shadow-sm p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-base font-semibold break-words">{it.name}</div>

                    {/* Badges */}
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      {it.category?.name && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 border">
                          {it.category.name}
                        </span>
                      )}
                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-50 border">
                        {it.unit === "KG" ? "per KG" : "per PCS"}
                      </span>
                      {tracked ? (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800">
                          Tracked
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-amber-50 border border-amber-200 text-amber-800">
                          Resell
                        </span>
                      )}
                    </div>

                    {/* Numbers */}
                    <div className="mt-2 text-[13px] text-gray-700">
                      <div>
                        <span className="text-gray-500">Price</span>{" "}
                        <span className="font-semibold">Rp {fmtIDR(it.price)}</span>
                        <span className="text-gray-500"> / {unitLabel}</span>
                      </div>
                      {typeof it.costPrice === "number" && it.costPrice > 0 && (
                        <div className="mt-0.5 text-gray-500">
                          Cost: <span className="text-gray-700">Rp {fmtIDR(it.costPrice)}</span> / {unitLabel}
                        </div>
                      )}

                      {tracked ? (
                        <div className="mt-1">
                          <span className="text-gray-500">Stock</span>{" "}
                          <span className="font-semibold">{fmtQty(it.stock, it.unit)}</span>{" "}
                          <span className="text-gray-500">{unitLabel}</span>
                        </div>
                      ) : (
                        <div className="mt-1 text-gray-500 italic">Stock not tracked (resell)</div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      className={`${btnIcon} text-[var(--color-primary-800)] bg-white border-gray-300 hover:bg-gray-50`}
                      onClick={() => {
                        // Pass fields expected by your EditItemModal.
                        // Note: modal uses `unitType` internally, so we map from schema `unit`.
                        setCurrent({
                          id: it.id,
                          name: it.name,
                          price: it.price,
                          costPrice: typeof it.costPrice === "number" ? it.costPrice : 0,
                          stock: asNumber(it.stock),
                          unitType: it.unit,            // map for modal defaults
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
                      className={`${btnIcon} text-red-600 border-red-300 hover:bg-red-50`}
                      onClick={() => onDelete(it.id)}
                      title="Delete"
                      aria-label="Delete"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
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
            await load();
          }}
        />
      )}

      {/* Floating quick-create menu (includes New Customer) */}
      <QuickCreateFab brand />
    </div>
  );
}
