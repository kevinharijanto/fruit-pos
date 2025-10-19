"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Modal from "./ui/Modal";
import { ModalHeader, ModalBody, ModalFooter } from "./ui/Modal";
import { useDarkMode } from "@/contexts/DarkModeContext";

// Define types locally (align with API payloads)
type Item = {
  id: string;
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  unit?: "PCS" | "KG";
  // category might be a string or an object with a name field depending on source
  category?: { id?: string; name?: string } | string;
  // some sources may flatten to categoryName
  categoryName?: string;
};

type Seller = {
  id: string;
  name: string;
  whatsapp?: string;
  address?: string;
  phone?: string;
};

type SellerOrder = {
  id: string;
  sellerId?: string;
  status: string;
  totalAmount: number;
  deliveryFee: number;
  notes?: string;
};

type SellerOrderItem = {
  id: string;
  itemId: string;
  quantity: number;
  price: number;
  item: Item;
};

export default function EditSellerOrderModal({
  isOpen,
  onClose,
  onSaved,
  order,
  sellers,
  items,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
  // extend order to include seller info (name/wa/address) for prefill
  order?: (SellerOrder & {
    items: (SellerOrderItem & { item: Item })[];
    seller?: { name?: string | null; whatsapp?: string | null; address?: string | null }
  }) | null;
  sellers: Seller[];
  items: Item[];
}) {
  const { darkMode } = useDarkMode();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    sellerId: order?.sellerId || "",
    sellerName: ((order as any)?.seller?.name as string) || "",
    status: order?.status || "PENDING",
    totalAmount: order?.totalAmount || 0,
    deliveryFee: (order as any)?.deliveryFee || 0,
    // Prefill from deliveryNote (server field) when editing
    notes: ((order as any)?.deliveryNote as string) || "",
  });

  const [showSellerSelector, setShowSellerSelector] = useState(false);
  const [sellerSearch, setSellerSearch] = useState("");

  const [orderItems, setOrderItems] = useState<
    { itemId: string; quantity: number; price: number; itemName: string; unit?: "PCS" | "KG" }[]
  >(
    order?.items.map((i) => ({
      itemId: i.itemId,
      // support both "quantity" and "qty" coming from API
      quantity: (i as any).quantity ?? (i as any).qty ?? 1,
      price: i.price,
      itemName: i.item.name,
      unit: (i.item as any)?.unit || (items.find(it => it.id === i.itemId) as any)?.unit || "PCS",
    })) || []
  );
 
  const isUpdate = !!(order && (order as any).id);
 
  const [itemSearch, setItemSearch] = useState("");
  const [showItemSelector, setShowItemSelector] = useState(false);
  // Helpers to read category name robustly
  const getCategoryName = (item: Item) => {
    const cat: any = (item as any).category;
    if (typeof cat === "string") return cat || "";
    if (cat && typeof cat === "object") return String(cat.name || "");
    return String((item as any).categoryName || "");
  };

  // Lazy-load heavy sources only when selectors open
  const [lazyItems, setLazyItems] = useState<Item[]>(items || []);
  const [lazySellers, setLazySellers] = useState<Seller[]>(sellers || []);
  
  useEffect(() => {
    if (showItemSelector && lazyItems.length === 0) {
      (async () => {
        try {
          const res = await fetch("/api/items?limit=500");
          const json = await res.json();
          const arr = json.data && Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
          setLazyItems(arr);
        } catch {}
      })();
    }
  }, [showItemSelector, lazyItems.length]);
  
  // Prefetch sellers either when selector opens or when modal opens
  useEffect(() => {
    if ((showSellerSelector || isOpen) && lazySellers.length === 0) {
      (async () => {
        try {
          const res = await fetch("/api/sellers");
          const json = await res.json();
          const arr = json.data && Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
          setLazySellers(arr);
        } catch {}
      })();
    }
  }, [showSellerSelector, isOpen, lazySellers.length]);
  
  // Filter items by name or category using the best available source
  const sourceItems = (lazyItems && lazyItems.length > 0) ? lazyItems : items;
  const filteredItems = sourceItems.filter((item) => {
    const q = itemSearch.toLowerCase();
    const cat = getCategoryName(item).toLowerCase();
    return item.name.toLowerCase().includes(q) || cat.includes(q);
  });
  
  // Show all filtered items without pagination
  const paginatedItems = filteredItems;
  
  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalAmount = Math.max(0, subtotal + (formData.deliveryFee || 0));
  
  // Filter sellers using the best available source
  const sourceSellers = (lazySellers && lazySellers.length > 0) ? lazySellers : sellers;
  const filteredSellers = sourceSellers.filter((seller) =>
    (seller.name || "").toLowerCase().includes(sellerSearch.toLowerCase())
  );
  
  const addOrderItem = (item: Item) => {
    setOrderItems([
      ...orderItems,
      {
        itemId: item.id,
        quantity: item.unit === "KG" ? 0.1 : 1,
        price: item.costPrice, // Use cost price for seller orders
        itemName: item.name,
        unit: (item as any).unit || "PCS",
      },
    ]);
  };

  const updateOrderItem = (index: number, field: string, value: any) => {
    const newItems = [...orderItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setOrderItems(newItems);
  };

  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Validate items: require at least one with qty > 0
      const validItems = orderItems.filter((it) => Number(it.quantity) > 0);
      if (validItems.length === 0) {
        setError("Add at least one item with quantity > 0");
        setIsLoading(false);
        return;
      }

      // Prefer lazy-loaded sellers if present; fallback to prop
      const sourceSellers = (lazySellers && lazySellers.length > 0) ? lazySellers : sellers;
      const selectedSeller = sourceSellers.find(s => s.id === formData.sellerId);
      const existingSeller = (order as any)?.seller;
      const sellerNameTrim = (formData.sellerName || "").trim();

      // Require a seller for create; allow existing seller for edit
      if (!isUpdate && !selectedSeller && !sellerNameTrim) {
        setError("Please select a seller before saving");
        setIsLoading(false);
        return;
      }

      const sellerPayload = selectedSeller
        ? {
            name: selectedSeller.name,
            address: selectedSeller.address || undefined,
            whatsapp: selectedSeller.whatsapp || undefined,
          }
        : existingSeller
        ? {
            name: (existingSeller.name as string) || undefined,
            address: (existingSeller.address as string) || undefined,
            whatsapp: (existingSeller.whatsapp as string) || undefined,
          }
        // Fallback: if user has a seller name prefilled (from edit), use it
        : (sellerNameTrim
          ? { name: sellerNameTrim }
          : undefined);

      const payload = {
        seller: sellerPayload,
        // API computes totals, send only expected fields
        deliveryFee: formData.deliveryFee,
        deliveryNote: formData.notes || undefined,
        items: validItems.map((it) => ({
          itemId: it.itemId,
          qty: it.quantity,
        })),
      };

      const url = isUpdate ? `/api/seller-orders/${(order as any).id}` : "/api/seller-orders";
      const method = isUpdate ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let msg = response.statusText;
        try {
          const j = await response.json();
          msg = j.error || j.message || msg;
        } catch {}
        throw new Error(msg || "Failed to save seller order");
      }

      // notify parent to refresh list; then close
      try { await (onSaved?.()); } catch {}
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save seller order");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSeller = (seller: Seller) => {
    setFormData(prev => ({
      ...prev,
      sellerId: seller.id,
      sellerName: seller.name
    }));
    setShowSellerSelector(false);
    setSellerSearch("");
  };

  // Prefill seller selection/name when editing an existing order
  useEffect(() => {
    if (!order) return;
    const oSeller = (order as any)?.seller;
    const sourceSellersLocal = (lazySellers && lazySellers.length > 0) ? lazySellers : sellers;
    let match: Seller | undefined;

    // Prefer matching by whatsapp, then name, then id
    if (oSeller?.whatsapp) {
      match = sourceSellersLocal.find(s => (s.whatsapp || "") === oSeller.whatsapp);
    }
    if (!match && oSeller?.name) {
      const n = String(oSeller.name).toLowerCase();
      match = sourceSellersLocal.find(s => (s.name || "").toLowerCase() === n);
    }
    if (!match && order.sellerId) {
      match = sourceSellersLocal.find(s => s.id === order.sellerId);
    }

    if (match) {
      setFormData(prev => ({
        ...prev,
        sellerId: match!.id,
        sellerName: match!.name || "",
      }));
    } else if (oSeller?.name) {
      setFormData(prev => ({
        ...prev,
        sellerName: String(oSeller.name || ""),
      }));
    }
  }, [order, sellers, lazySellers]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="responsive" className="overflow-hidden">
      <ModalHeader>
        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {isUpdate ? "Edit Seller Order" : "New Seller Order"}
        </div>
        {/* removed to keep modal headers consistent */}
      </ModalHeader>
      <ModalBody className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Seller
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={formData.sellerName}
              readOnly
              placeholder="Select a seller"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900"
            />
            <button
              type="button"
              onClick={() => setShowSellerSelector(true)}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Select
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
          >
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Order Items
          </label>
          <div className="space-y-2 mb-2">
            {orderItems.map((item, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={item.itemName}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900"
                />
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => {
                    const raw = parseFloat(e.target.value);
                    const v = Number.isFinite(raw) ? raw : 0;
                    const qty =
                      item.unit === "KG"
                        ? Math.max(0, Math.round(v * 1000) / 1000) // keep 0.001 kg precision
                        : Math.max(0, Math.floor(v)); // PCS: integer only
                    updateOrderItem(index, "quantity", qty);
                  }}
                  className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900"
                  min="0"
                  step={item.unit === "KG" ? "0.001" : "1"}
                  required
                />
                <input
                  type="number"
                  value={item.price}
                  onChange={(e) => updateOrderItem(index, "price", parseFloat(e.target.value) || 0)}
                  className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900"
                  min="0"
                  step="0.01"
                  required
                />
                <button
                  type="button"
                  onClick={() => removeOrderItem(index)}
                  className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowItemSelector(true)}
            className="w-full px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            Add Item
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Delivery Fee
          </label>
          <input
            type="number"
            value={formData.deliveryFee}
            onChange={(e) => setFormData({ ...formData, deliveryFee: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900"
            min="0"
            step="0.01"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-3 sm:gap-0 pt-4">
          <div className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
            Total: Rp {totalAmount.toLocaleString("id-ID")}
          </div>
          <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              type="button"
              className="btn btn-secondary btn-md flex-1 sm:flex-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-md flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving…
                </span>
              ) : (
                isUpdate ? "Save Changes" : "Create Order"
              )}
            </button>
          </div>
        </div>
      </form>
      </ModalBody>

      {showItemSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Add Item</h3>
            <input
              type="text"
              placeholder="Search items..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900 mb-4"
            />
            <div className="max-h-60 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-600">
              {paginatedItems.length > 0 ? (
                paginatedItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addOrderItem(item)}
                    className="w-full text-left p-3 hover:bg-gray-50 flex items-center justify-between transition-colors dark:hover:bg-gray-700"
                  >
                    <span className="truncate font-medium text-gray-900 dark:text-white">{item.name}</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Cost: Rp {Number(item.costPrice || 0).toLocaleString("id-ID")} • stock {Number(item.stock || 0)}
                      {item.unit ? ` • ${String(item.unit).toLowerCase()}` : ""}
                      {getCategoryName(item) ? ` • ${getCategoryName(item)}` : ""}
                    </span>
                  </button>
                ))
              ) : (
                <div className="p-3 text-sm text-gray-500 dark:text-gray-400">
                  No items found matching "{itemSearch}"
                </div>
              )}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  setShowItemSelector(false);
                  setItemSearch("");
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showSellerSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Select Seller</h3>
            <input
              type="text"
              placeholder="Search sellers..."
              value={sellerSearch}
              onChange={(e) => setSellerSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-white text-gray-900 mb-4"
            />
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {filteredSellers.length > 0 ? (
                filteredSellers.map((seller) => (
                  <div
                    key={seller.id}
                    onClick={() => handleSelectSeller(seller)}
                    className="p-3 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">{seller.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Phone: {seller.phone || "-"}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Address: {seller.address || "-"}</div>
                  </div>
                ))
              ) : (
                <div className="p-3 text-sm text-gray-500 dark:text-gray-400">
                  No sellers found{sellerSearch ? ` matching "${sellerSearch}"` : ""}. Try clearing the search or add a seller first.
                </div>
              )}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  setShowSellerSelector(false);
                  setSellerSearch("");
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}