"use client";

import { useEffect, useMemo, useState } from "react";
import Modal, { ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

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
    if (addingCat) return; // Prevent multiple calls
    const n = newCat.trim();
    if (!n) return;
    
    setAddingCat(true);
    try {
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
    } catch (error) {
      alert("Failed to create category");
      setAddingCat(false);
    }
  }

  const pricePreview = useMemo(() => {
    const value = Math.max(0, unit === "KG" ? price : Math.floor(price));
    return value.toLocaleString("id-ID", { maximumFractionDigits: unit === "KG" ? 2 : 0 });
  }, [price, unit]);
  const costPreview = useMemo(() => {
    const value = Math.max(0, unit === "KG" ? costPrice : Math.floor(costPrice));
    return value.toLocaleString("id-ID", { maximumFractionDigits: unit === "KG" ? 2 : 0 });
  }, [costPrice, unit]);

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
      price: finalUnit === "KG" ? Math.max(0, price) : Math.floor(Math.max(0, price)),
      costPrice: finalUnit === "KG" ? Math.max(0, costPrice) : Math.floor(Math.max(0, costPrice)),
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
    <Modal
      isOpen={true}
      onClose={onClose}
      size="responsive"
      className="overflow-hidden"
    >
      <ModalHeader>
        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {mode === "create" ? "New Item" : "Edit Item"}
        </div>
      </ModalHeader>

      <ModalBody className="space-y-6">
        {/* Name */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Name (emoji ok, e.g. 🍌)</div>
          <input
            className={cn(
              "input",
              "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:placeholder-gray-500"
            )}
            placeholder="e.g. 🍎 Apple Fuji"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Category</div>
          <div className="flex gap-2">
            <select
              className={cn(
                "input",
                "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
              )}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              type="button"
              className={cn(
                "px-3 py-2 border rounded text-sm",
                "border-gray-300 bg-white hover:bg-gray-50",
                "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              )}
              onClick={() => setAddingCat(v => !v)}
              disabled={busy}
            >
              {addingCat ? "Cancel" : "New"}
            </button>
          </div>

          {addingCat && (
            <div className="flex gap-2 mt-2">
              <input
                className={cn(
                  "input",
                  "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:placeholder-gray-500"
                )}
                placeholder='e.g. "Fruit", "Meat"'
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
              />
              <button
                type="button"
                className={cn(
                  "px-3 py-2 rounded text-white text-sm",
                  "bg-primary-600 hover:bg-primary-700",
                  "focus:outline-none focus:ring-2 focus:ring-primary-500",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                onClick={createCategory}
                disabled={addingCat || !newCat.trim()}
              >
                {addingCat ? "Adding…" : "Add"}
              </button>
            </div>
          )}
        </div>

        {/* Unit */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Price unit</div>
          <div className="flex gap-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                checked={unit === "PCS"}
                onChange={() => setUnit("PCS")}
                // allowed in both modes
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">per PCS</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                checked={unit === "KG"}
                onChange={() => setUnit("KG")}
                disabled={stockMode === "TRACK"} // cannot choose KG while tracking
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">per KG</span>
            </label>
          </div>
          {stockMode === "TRACK" && <div className="text-xs text-gray-500 dark:text-gray-400">Per KG is disabled while tracking stock.</div>}
        </div>

        {/* Stock mode */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Stock mode</div>
          <div className="flex gap-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                checked={stockMode === "TRACK"}
                onChange={() => setStockMode("TRACK")}
                disabled={unit === "KG"} // cannot track KG
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Have Stock (tracked)</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                checked={stockMode === "RESELL"}
                onChange={() => setStockMode("RESELL")}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Resell (no stock)</span>
            </label>
          </div>
          {unit === "KG" && <div className="text-xs text-gray-500 dark:text-gray-400">Per KG items are always "Resell (no stock)".</div>}
        </div>

        {/* Price / Cost / Stock */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Price (Rp / {unitLabel})</div>
            <input
              type="number" min={0} step={unit === "KG" ? 0.01 : 100}
              className={cn(
                "input",
                "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
              )}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value || 0))}
            />
            <div className="text-xs text-gray-500 dark:text-gray-400">Shown as Rp {pricePreview} / {unitLabel}</div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Cost Price (Rp / {unitLabel})</div>
            <input
              type="number" min={0} step={unit === "KG" ? 0.01 : 100}
              className={cn(
                "input",
                "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
              )}
              value={costPrice}
              onChange={(e) => setCostPrice(Number(e.target.value || 0))}
            />
            <div className="text-xs text-gray-500 dark:text-gray-400">Rp {costPreview} / {unitLabel}</div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Stock {stockMode === "RESELL" && "(not tracked)"}</div>
            <input
              type="number" min={0}
              className={cn(
                "input disabled:bg-gray-100",
                "dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:disabled:bg-gray-900"
              )}
              value={stock}
              onChange={(e) => setStock(Number(e.target.value || 0))}
              disabled={stockMode === "RESELL"}
            />
            {stockMode === "TRACK" && <div className="text-xs text-gray-500 dark:text-gray-400">Tracked as integers (pcs).</div>}
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <div className="flex items-center justify-between w-full">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {isValid ? `Unit: ${unitLabel} • ${stockMode === "TRACK" ? "Stock tracked" : "Resell"}` : "Fill required fields"}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(
                "btn btn-secondary btn-md",
                "dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              )}
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className={cn(
                "btn btn-primary btn-md",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              onClick={save}
              disabled={!isValid || busy}
            >
              {busy ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  );
}
