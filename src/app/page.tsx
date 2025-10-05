"use client";

import { useEffect, useMemo, useState } from "react";

type Order = {
  id: string;
  paidAt?: string | null;
  createdAt: string;
  total: number;
  items: { itemId: string; qty: number; price: number }[];
};
type Item = { id: string; costPrice: number };

type Range = "Today" | "This Week" | "This Month" | "All";

function inRange(d: Date, range: Range) {
  const now = new Date();
  const start = new Date(now);
  if (range === "Today") {
    start.setHours(0, 0, 0, 0);
  } else if (range === "This Week") {
    const day = (now.getDay() + 6) % 7; // Monday=0
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
  } else if (range === "This Month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    return true;
  }
  return d >= start;
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [range, setRange] = useState<Range>("Today");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const o: Order[] = await (await fetch("/api/orders")).json();
      const i: any[] = await (await fetch("/api/items")).json();
      setOrders(o);
      setItems(i.map((x) => ({ id: x.id, costPrice: x.costPrice ?? 0 })));
    })();
  }, []);

  const itemsMap = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);

  const filteredPaid = useMemo(
    () =>
      orders.filter(
        (o) =>
          !!o.paidAt &&
          inRange(new Date(o.paidAt!), range) &&
          (q ? (o as any).customer?.name?.toLowerCase().includes(q.toLowerCase()) : true)
      ),
    [orders, range, q]
  );

  const omzet = useMemo(() => filteredPaid.reduce((s, o) => s + o.total, 0), [filteredPaid]);

  const netProfit = useMemo(
    () =>
      filteredPaid.reduce((sum, o) => {
        const profit = o.items.reduce((p, li) => {
          const cost = itemsMap[li.itemId]?.costPrice ?? 0;
          return p + li.qty * (li.price - cost);
        }, 0);
        return sum + profit;
      }, 0),
    [filteredPaid, itemsMap]
  );

  return (
    <div className="space-y-4">
      {/* Your existing sticky header component can still be used here */}
      {/* Below: simple metric cards; place in your existing cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric title="Orders (paid)" value={filteredPaid.length.toString()} />
        <Metric title="Revenue (Omzet)" value={`Rp ${omzet.toLocaleString("id-ID")}`} />
        <Metric title="Net Profit" value={`Rp ${netProfit.toLocaleString("id-ID")}`} />
        {/* ...your other metric cards... */}
      </div>

      {/* ...rest of your dashboard... */}
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}
