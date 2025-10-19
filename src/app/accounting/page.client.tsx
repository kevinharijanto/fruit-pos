"use client";

import { useEffect, useState, useMemo } from "react";
import { useDarkMode } from "@/contexts/DarkModeContext";
import Modal, { ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";

// Types
type AccountingOrder = {
  id: string;
  type: "seller" | "customer";
  paymentStatus: string;
  deliveryStatus: string;
  paidAt: string | null;
  deliveredAt: string | null;
  deliveryNote: string | null;
  paymentType: "CASH" | "TRANSFER" | "QRIS" | null;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  party: {
    name: string | null;
    whatsapp: string | null;
    address: string | null;
  } | null;
  items: Array<{
    id: string;
    itemId: string;
    qty: number;
    price: number;
    item: {
      name: string;
      unit: "PCS" | "KG";
    };
  }>;
};

type AccountingData = {
  data: AccountingOrder[];
  summary: {
    sellerOrdersCount: number;
    customerOrdersCount: number;
    sellerOrdersTotal: number;
    customerOrdersTotal: number;
    totalRevenue: number;
    totalCosts: number;
    grossProfit: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

// Helper functions
function moneyIDR(n: number) {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("id-ID");
}

function statusColor(status: string) {
  switch (status.toLowerCase()) {
    case "paid":
    case "delivered":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "unpaid":
    case "pending":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "refunded":
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  }
}

// Order Details Modal Component
function OrderDetailsModal({ order, isOpen, onClose }: {
  order: AccountingOrder | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!order) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Order Details - {order.type === "seller" ? "Seller Order" : "Customer Order"}
        </h2>
      </ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          {/* Order Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Order ID</p>
              <p className="font-medium">{order.id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
              <p className="font-medium">{formatDate(order.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Payment Status</p>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColor(order.paymentStatus)}`}>
                {order.paymentStatus}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Delivery Status</p>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColor(order.deliveryStatus)}`}>
                {order.deliveryStatus}
              </span>
            </div>
            {order.paidAt && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Paid At</p>
                <p className="font-medium">{formatDate(order.paidAt)}</p>
              </div>
            )}
            {order.deliveredAt && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Delivered At</p>
                <p className="font-medium">{formatDate(order.deliveredAt)}</p>
              </div>
            )}
            {order.paymentType && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Payment Type</p>
                <p className="font-medium">{order.paymentType}</p>
              </div>
            )}
            {order.deliveryNote && (
              <div className="md:col-span-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">Delivery Note</p>
                <p className="font-medium">{order.deliveryNote}</p>
              </div>
            )}
          </div>

          {/* Party Info */}
          {order.party && (
            <div>
              <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-2">
                {order.type === "seller" ? "Seller" : "Customer"} Information
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <p className="font-medium">{order.party.name || "Unknown"}</p>
                {order.party.whatsapp && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">WhatsApp: {order.party.whatsapp}</p>
                )}
                {order.party.address && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">Address: {order.party.address}</p>
                )}
              </div>
            </div>
          )}

          {/* Items */}
          <div>
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-2">Order Items</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Item
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Quantity
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Price
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                        {item.item.name}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                        {item.qty} {item.item.unit}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                        {moneyIDR(item.price)}
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {moneyIDR(item.qty * item.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-2">Order Summary</h3>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{moneyIDR(order.subtotal)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Discount:</span>
                  <span className="text-red-600">-{moneyIDR(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>Delivery Fee:</span>
                <span>{moneyIDR(order.deliveryFee)}</span>
              </div>
              <div className="flex justify-between font-medium pt-2 border-t border-gray-200 dark:border-gray-600">
                <span>Total:</span>
                <span>{moneyIDR(order.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <button
          onClick={onClose}
          className="btn btn-primary"
        >
          Close
        </button>
      </ModalFooter>
    </Modal>
  );
}

export default function AccountingPageClient() {
  const { darkMode } = useDarkMode();
  const [data, setData] = useState<AccountingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "seller" | "customer">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<AccountingOrder | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  // Build query params
  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", page.toString());
    p.set("limit", "25");
    if (search) p.set("search", search);
    if (typeFilter !== "all") p.set("type", typeFilter);
    if (dateFrom) p.set("from", dateFrom);
    if (dateTo) p.set("to", dateTo);
    return p;
  }, [page, search, typeFilter, dateFrom, dateTo]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/accounting?${params}`);
        if (!res.ok) throw new Error("Failed to fetch data");
        const result = await res.json();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, dateFrom, dateTo]);

  // Set default date range to current month
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDateFrom(firstDay.toISOString().split('T')[0]);
    setDateTo(lastDay.toISOString().split('T')[0]);
  }, []);

  // Export function
  const handleExport = async (excelFormat = false) => {
    try {
      const exportParams = new URLSearchParams();
      if (dateFrom) exportParams.set("from", dateFrom);
      if (dateTo) exportParams.set("to", dateTo);
      if (typeFilter !== "all") exportParams.set("type", typeFilter);
      if (excelFormat) exportParams.set("excel", "1");
      
      const res = await fetch(`/api/accounting/export?${exportParams}`);
      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] || "accounting.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed");
    }
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded dark:bg-red-900 dark:border-red-700 dark:text-red-200">
        <p className="font-medium">Error loading accounting data</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Accounting</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Track seller orders and paid customer orders
        </p>
      </div>

      {/* Summary Cards */}
      {data?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Revenue</p>
            <p className="mt-2 text-2xl font-bold text-green-600 dark:text-green-400">
              {moneyIDR(data.summary.totalRevenue)}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {data.summary.customerOrdersCount} paid orders
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Costs</p>
            <p className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
              {moneyIDR(data.summary.totalCosts)}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {data.summary.sellerOrdersCount} seller orders
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Gross Profit</p>
            <p className={`mt-2 text-2xl font-bold ${data.summary.grossProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {moneyIDR(data.summary.grossProfit)}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Revenue - Costs
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Profit Margin</p>
            <p className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
              {data.summary.totalRevenue > 0 
                ? `${Math.round((data.summary.grossProfit / data.summary.totalRevenue) * 100)}%`
                : "0%"
              }
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Gross profit / Revenue
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="input w-full"
          >
            <option value="all">All Orders</option>
            <option value="seller">Seller Orders</option>
            <option value="customer">Customer Orders</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="input w-full"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="input w-full"
          />
          <button
            onClick={() => {
              setSearch("");
              setTypeFilter("all");
              const now = new Date();
              const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
              const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
              setDateFrom(firstDay.toISOString().split('T')[0]);
              setDateTo(lastDay.toISOString().split('T')[0]);
            }}
            className="btn btn-secondary w-full"
          >
            Reset Filters
          </button>
        </div>
        
        {/* Export buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleExport(false)}
            className="btn btn-secondary btn-sm"
          >
            Export as CSV
          </button>
          <button
            onClick={() => handleExport(true)}
            className="btn btn-secondary btn-sm"
          >
            Export for Excel
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Party
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-6 py-4">
                      <div className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 dark:bg-gray-700"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2 dark:bg-gray-700"></div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : data?.data?.length ? (
                data.data.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        order.type === "seller" 
                          ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      }`}>
                        {order.type === "seller" ? "Seller" : "Customer"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      <div className="font-medium">{order.party?.name || "Unknown"}</div>
                      {order.party?.whatsapp && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{order.party.whatsapp}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColor(order.paymentStatus)}`}>
                          {order.paymentStatus}
                        </span>
                        {order.deliveryStatus !== order.paymentStatus && (
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColor(order.deliveryStatus)}`}>
                            {order.deliveryStatus}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {moneyIDR(order.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowOrderModal(true);
                        }}
                        className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    No orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data?.pagination && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 dark:bg-gray-800 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Showing <span className="font-medium">{(data.pagination.page - 1) * data.pagination.limit + 1}</span> to{" "}
                <span className="font-medium">
                  {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)}
                </span>{" "}
                of <span className="font-medium">{data.pagination.total}</span> results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={!data.pagination.hasPrev}
                  className="btn btn-secondary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={!data.pagination.hasNext}
                  className="btn btn-secondary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={showOrderModal}
        onClose={() => {
          setShowOrderModal(false);
          setSelectedOrder(null);
        }}
      />
    </div>
  );
}