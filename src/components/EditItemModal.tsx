// src/components/EditItemModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Category = { id: string; name: string };

export type Item = {
  id?: string;
  name: string;
  price: number;
  costPrice?: number;
  stock: number; // UI number; API/db handles Decimal
  unit?: "PCS" | "KG";
  stockMode?: "TRACK" | "RESELL";
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
};

export default function EditItemModal({
  item,
  mode, // "edit" | "create"
  onClose,
  onSaved,
}: {
  item?: Item;
  mode: "edit" | "create";
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  /* ===== Body lock + hide FAB ===== */
  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.classList.add("modal-open");
    document.body.classList.add("modal-open");
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.classList.remove("modal-open");
      document.body.classList.remove("modal-open");
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  /* ===== Form state ===== */
  const [name, setName] = useState(item?.name ?? "");
  const [price, setPrice] = useState<number>(item?.price ?? 0);
  const [costPrice, setCostPrice] = useState<number>(item?.costPrice ?? 0);
  const [stock, setStock] = useState<number>(item?.stock ?? 0);

  const [unit, setUnit] = useState<"PCS" | "KG">(item?.unit || "PCS");
  const [stockMode, setStockMode] = useState<"TRACK" | "RESELL">(item?.stockMode || "TRACK");

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>(item?.category?.id || item?.categoryId || "");
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState("");

  const [busy, setBusy] = useState(false);

  const unitLabel = unit === "KG" ? "kg" : "pcs";
  const isValid = name.trim().length > 0 && price >= 0 && costPrice >= 0 && (stockMode === "RESELL" || stock >= 0);

  /* ===== Mutual constraints (LOCKS) ===== */
  // If user picks KG → force RESELL (no stock tracking)
  useEffect(() => {
    if (unit === "KG" && stockMode !== "RESELL") {
      setStockMode("RESELL");
    }
  }, [unit]); // eslint-disable-line react-hooks/exhaustive-deps

  // If user picks TRACK → force PCS (we only track integer stock)
  useEffect(() => {
    if (stockMode === "TRACK" && unit === "KG") {
      setUnit("PCS");
    }
  }, [stockMode]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ===== Load categories ===== */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/categories", { cache: "no-store" });
        if (!r.ok) return;
        const cats = await r.json();
        if (Array.isArray(cats)) setCategories(cats);
      } catch {}
    })();
  }, []);

  async function createCategory() {
    const n = newCat.trim();
    if (!n) return;
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n }),
    });
    if (!res.ok) {
      alert("Failed to create category");
      return;
    }
    const cat = await res.json();
    setCategories((prev) => [...prev.filter((c) => c.id !== cat.id), cat].sort((a, b) => a.name.localeCompare(b.name)));
    setCategoryId(cat.id);
    setNewCat("");
    setAddingCat(false);
  }

  const pricePreview = useMemo(() => Math.max(0, Math.floor(price)).toLocaleString("id-ID"), [price]);
  const costPreview = useMemo(() => Math.max(0, Math.floor(costPrice)).toLocaleString("id-ID"), [costPrice]);

  async function save() {
    if (busy || !isValid) return;
    setBusy(true);

    // Enforce the lock server-side too
    let finalUnit = unit;
    let finalStockMode = stockMode;
    let finalStock = stock;

    if (finalUnit === "KG") {
      finalStockMode = "RESELL";
      finalStock = 0; // stock not tracked
    }
    if (finalStockMode === "TRACK") {
      finalUnit = "PCS";
      finalStock = Math.max(0, Math.floor(finalStock)); // integers only
    }

    const payload: any = {
      name: name.trim(),
      price: Math.floor(Math.max(0, price)),
      costPrice: Math.floor(Math.max(0, costPrice)),
      unit: finalUnit,
      stockMode: finalStockMode,
      stock: finalStockMode === "TRACK" ? finalStock : undefined,
      categoryId: categoryId || undefined,
    };
    if (!categoryId && newCat.trim()) payload.categoryName = newCat.trim();

    try {
      const url = mode === "create" ? "/api/items" : `/api/items/${item!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        let msg = res.statusText;
        if (ct.includes("application/json")) {
          const j = await res.json();
          msg = j.error || msg;
        }
        throw new Error(msg);
      }
      await onSaved();
    } catch (e: any) {
      alert(e?.message || "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50">
      <div
        className="
          fixed inset-0
          sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
          bg-white h-[100dvh] w-[100vw] sm:h-auto sm:max-h-[90svh] sm:w-[600px]
          overflow-hidden rounded-none sm:rounded-xl shadow flex flex-col min-h-0
        "
      >
        {/* Header */}
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div className="text-base font-semibold">{mode === "create" ? "New Item" : "Edit Item"}</div>
          <button onClick={onClose} className="text-sm underline">Close</button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-4
                        [-webkit-overflow-scrolling:touch] [touch-action:pan-y]">
          {/* Name */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Name (emoji ok, e.g. 🍌)</div>
            <input
              className="border rounded p-3 w-full"
              placeholder="e.g. 🍎 Apple Fuji"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Category</div>
            <div className="flex gap-2">
              <select
                className="border rounded p-3 w-full"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button className="px-3 py-2 border rounded" onClick={() => setAddingCat(v => !v)}>
                {addingCat ? "Cancel" : "New"}
              </button>
            </div>

            {addingCat && (
              <div className="flex gap-2 mt-2">
                <input
                  className="border rounded p-3 w-full"
                  placeholder='e.g. "Fruit", "Meat"'
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                />
                <button
                  className="px-3 py-2 rounded text-white bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)]"
                  onClick={createCategory}
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Unit */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Price unit</div>
            <div className="flex gap-3">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  checked={unit === "PCS"}
                  onChange={() => setUnit("PCS")}
                  // allowed in both modes
                />
                per PCS
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  checked={unit === "KG"}
                  onChange={() => setUnit("KG")}
                  disabled={stockMode === "TRACK"} // cannot choose KG while tracking
                />
                per KG
              </label>
            </div>
            {stockMode === "TRACK" && <div className="text-xs text-gray-500">Per KG is disabled while tracking stock.</div>}
          </div>

          {/* Stock mode */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Stock mode</div>
            <div className="flex gap-3">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  checked={stockMode === "TRACK"}
                  onChange={() => setStockMode("TRACK")}
                  disabled={unit === "KG"} // cannot track KG
                />
                Have Stock (tracked)
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  checked={stockMode === "RESELL"}
                  onChange={() => setStockMode("RESELL")}
                />
                Resell (no stock)
              </label>
            </div>
            {unit === "KG" && <div className="text-xs text-gray-500">Per KG items are always “Resell (no stock)”.</div>}
          </div>

          {/* Price / Cost / Stock */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Price (Rp / {unitLabel})</div>
              <input
                type="number" min={0} step={100}
                className="border rounded p-3 w-full"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value || 0))}
              />
              <div className="text-xs text-gray-500">Shown as Rp {pricePreview} / {unitLabel}</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Cost Price (Rp / {unitLabel})</div>
              <input
                type="number" min={0} step={100}
                className="border rounded p-3 w-full"
                value={costPrice}
                onChange={(e) => setCostPrice(Number(e.target.value || 0))}
              />
              <div className="text-xs text-gray-500">Rp {costPreview} / {unitLabel}</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Stock {stockMode === "RESELL" && "(not tracked)"}</div>
              <input
                type="number" min={0}
                className="border rounded p-3 w-full disabled:bg-gray-100"
                value={stock}
                onChange={(e) => setStock(Number(e.target.value || 0))}
                disabled={stockMode === "RESELL"}
              />
              {stockMode === "TRACK" && <div className="text-xs text-gray-500">Tracked as integers (pcs).</div>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3 pb-[env(safe-area-inset-bottom)] flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {isValid ? `Unit: ${unitLabel} • ${stockMode === "TRACK" ? "Stock tracked" : "Resell"}` : "Fill required fields"}
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-3 border rounded" onClick={onClose} disabled={busy}>Cancel</button>
            <button
              className="px-4 py-3 rounded text-white bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)]
                         disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={save}
              disabled={!isValid || busy}
            >
              {busy ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
