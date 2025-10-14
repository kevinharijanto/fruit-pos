"use client";

import { useEffect, useMemo, useState } from "react";

/* -----------------------------
   Brand / style tokens
----------------------------- */
const BRAND = {
  btnActive: "bg-green-600 text-white",
  btnHover: "hover:bg-green-50",
  textGreen: "text-green-700",
  chipBg: "bg-green-50",
  chipBorder: "border-green-200",
};

/* -----------------------------
   Types aligned to your app
----------------------------- */
type Unit = "pcs" | "kg";
type Order = {
  id: string;
  createdAt: string;
  paidAt?: string | null;
  total: number;
  items: { itemId: string; qty: number; price: number }[];
  customer?: { name?: string | null } | null;

  // delivery hints (any one may exist in your schema)
  deliveryStatus?: "pending" | "delivered" | "canceled";
  delivered?: boolean;
  deliveredAt?: string | null;
};
type Item = { id: string; name?: string; costPrice: number; unit?: Unit };
type Range = "Today" | "This Week" | "This Month" | "All";

/* -----------------------------
   Date helpers
----------------------------- */
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date)   { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function rangeBounds(range: Range, anchor: Date) {
  if (range === "All") return { from: new Date(0), to: endOfDay(anchor) };
  if (range === "Today") return { from: startOfDay(anchor), to: endOfDay(anchor) };
  if (range === "This Week") {
    const day = (anchor.getDay() + 6) % 7; // Monday=0
    const from = startOfDay(addDays(anchor, -day));
    const to = endOfDay(addDays(from, 6));
    return { from, to };
  }
  const from = startOfDay(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  const to = endOfDay(new Date(anchor.getFullYear(), anchor.getMonth()+1, 0));
  return { from, to };
}

/* -----------------------------
   Misc helpers
----------------------------- */
function moneyIDR(n: number) { return `Rp ${Math.round(n).toLocaleString("id-ID")}`; }
function isUndelivered(o: Order) {
  if (typeof o.delivered === "boolean") return !o.delivered;
  if (o.deliveryStatus) return o.deliveryStatus !== "delivered";
  if ("deliveredAt" in o) return !o.deliveredAt;
  return true;
}
function fmtQty(qty: number, unit: Unit = "pcs") {
  return unit === "kg" ? `${Number(qty.toFixed(2))} kg` : `${Math.round(qty)} pcs`;
}

/* -----------------------------
   UI atoms
----------------------------- */
const RANGES: Range[] = ["Today", "This Week", "This Month", "All"];

function RangeToggle({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {RANGES.map((r) => {
        const active = value === r;
        return (
          <button
            key={r}
            onClick={() => onChange(r)}
            className={[
              "px-3 py-1.5 text-sm rounded-full border transition",
              active ? BRAND.btnActive : `text-gray-700 ${BRAND.btnHover}`,
            ].join(" ")}
            type="button"
          >
            {r}
          </button>
        );
      })}
    </div>
  );
}

function Metric({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {sub ? <div className="mt-1 text-xs text-gray-500">{sub}</div> : null}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className={["text-xs px-2 py-1 rounded-full border", BRAND.chipBg, BRAND.chipBorder, BRAND.textGreen].join(" ")}>
      {children}
    </span>
  );
}

function Bucket({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="font-medium mb-2">{title}</div>
      <div className="space-y-2 max-h-96 overflow-auto pr-1">{children}</div>
    </div>
  );
}
function Empty({ text }: { text: string }) { return <div className="text-sm text-gray-500">{text}</div>; }

function OrderRow({ o, children, right }: React.PropsWithChildren<{ o: Order; right?: React.ReactNode }>) {
  return (
    <div className="flex items-center justify-between gap-2 border rounded-xl p-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">
          {o.customer?.name ?? "No name"} <span className="text-gray-400">#{o.id.slice(-6)}</span>
        </div>
        <div className="text-xs text-gray-500">{new Date(o.createdAt).toLocaleString()}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {children}
        <div className="text-sm">{right}</div>
      </div>
    </div>
  );
}

/* -----------------------------
   Compact popover calendar
----------------------------- */
function CompactCalendar({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [monthStart, setMonthStart] = useState(new Date(value.getFullYear(), value.getMonth(), 1));
  const firstDay = new Date(monthStart).getDay();
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const todayKey = new Date().toDateString();
  const selectedKey = value.toDateString();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="flex items-center justify-between px-1 pb-2">
        <button className="rounded-lg border px-2 py-1 text-sm hover:bg-gray-50"
          onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))}>←</button>
        <div className="text-sm font-medium">
          {monthStart.toLocaleString(undefined, { month: "long", year: "numeric" })}
        </div>
        <button className="rounded-lg border px-2 py-1 text-sm hover:bg-gray-50"
          onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))}>→</button>
      </div>
      <div className="grid grid-cols-7 gap-1 px-1 text-center text-[10px] text-gray-500">
        {"SMTWTFS".split("").map((c, i) => (<div key={i} className="py-1">{c}</div>))}
      </div>
      <div className="grid grid-cols-7 gap-1 p-1">
        {cells.map((d, i) => {
          const isToday = d && d.toDateString() === todayKey;
          const isSelected = d && d.toDateString() === selectedKey;
          return (
            <button
              key={i}
              disabled={!d}
              onClick={() => d && onChange(startOfDay(d))}
              className={[
                "h-8 w-8 rounded-lg text-xs border flex items-center justify-center",
                !d ? "opacity-0 cursor-default" : "hover:bg-gray-50",
                isSelected ? "bg-green-600 text-white border-green-600"
                  : isToday ? "border-green-400" : "border-gray-200",
              ].join(" ")}
            >
              {d ? d.getDate() : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MiniCalendarButton({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {value.toLocaleDateString()}
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-80 max-w-[90vw] right-0 rounded-2xl border bg-white p-2 shadow-lg" role="dialog">
          <CompactCalendar
            value={value}
            onChange={(d) => {
              onChange(d);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

/* -----------------------------
   Page (mobile-first)
----------------------------- */
export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [range, setRange] = useState<Range>("Today");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const oRes = await fetch("/api/orders", { cache: "no-store" });
      const iRes = await fetch("/api/items", { cache: "no-store" });

      const oJson = await oRes.json();
      const iJson = await iRes.json();

      const o: Order[] = Array.isArray(oJson) ? oJson : oJson.orders ?? [];
      const iArr: any[] = Array.isArray(iJson) ? iJson : iJson.items ?? iJson;

      setOrders(o);
      setItems(
        iArr.map((x) => ({
          id: x.id,
          name: x.name ?? x.title ?? x.label ?? undefined,
          costPrice: x.costPrice ?? 0,
          unit:
            (x.unit as Unit) ??
            (x.unitType as Unit) ??
            (x.soldByWeight ? "kg" : undefined) ??
            "pcs",
        }))
      );
    })();
  }, []);

  const bounds = useMemo(() => rangeBounds(range, anchor), [range, anchor]);
  const itemsMap = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);

  // All orders in window & search (createdAt)
  const filteredAll = useMemo(() => {
    return orders.filter((o) => {
      const d = new Date(o.createdAt);
      const inWindow = d >= bounds.from && d <= bounds.to;
      const matchSearch = q ? (o.customer?.name ?? "").toLowerCase().includes(q.toLowerCase()) : true;
      return inWindow && matchSearch;
    });
  }, [orders, bounds, q]);

  const filteredPaid = useMemo(() => filteredAll.filter((o) => !!o.paidAt), [filteredAll]);
  const filteredUnpaid = useMemo(() => filteredAll.filter((o) => !o.paidAt), [filteredAll]);
  const filteredUndelivered = useMemo(() => filteredAll.filter((o) => isUndelivered(o)), [filteredAll]);

  // KPIs
  const totalOrders = filteredAll.length;
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

  // Rankings (respect units)
  const topItems = useMemo(() => {
    const acc = new Map<string, { name: string; qty: number; revenue: number; unit: Unit }>();
    for (const o of filteredAll) {
      for (const li of o.items) {
        const meta = itemsMap[li.itemId];
        const unit: Unit = meta?.unit ?? "pcs";
        const key = li.itemId;
        const prev = acc.get(key) ?? { name: meta?.name ?? key, qty: 0, revenue: 0, unit };
        prev.qty += li.qty;
        prev.revenue += li.qty * li.price;
        prev.unit = unit;
        acc.set(key, prev);
      }
    }
    return Array.from(acc.values()).sort((a, b) => b.qty - a.qty).slice(0, 8);
  }, [filteredAll, itemsMap]);

  const topCustomers = useMemo(() => {
    const acc = new Map<string, { name: string; orders: number; spend: number }>();
    for (const o of filteredAll) {
      const name = o.customer?.name ?? "—";
      const prev = acc.get(name) ?? { name, orders: 0, spend: 0 };
      prev.orders += 1;
      prev.spend += o.total;
      acc.set(name, prev);
    }
    return Array.from(acc.values()).sort((a, b) => b.spend - a.spend).slice(0, 8);
  }, [filteredAll]);

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* Header + shortcuts */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <h1 className="text-xl sm:text-2xl font-semibold">Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          <a href="/orders" className="px-3 py-2 rounded-xl border hover:bg-gray-50">Orders</a>
          <a href="/items" className="px-3 py-2 rounded-xl border hover:bg-gray-50">Items</a>
          <a href="/customers" className="px-3 py-2 rounded-xl border hover:bg-gray-50">Customers</a>
        </div>
      </div>

      {/* Filter bar (wraps on mobile) */}
      <div className="flex flex-wrap items-center gap-2">
        <RangeToggle value={range} onChange={setRange} />
        <div className="text-xs text-gray-500">
          {range === "All"
            ? `Up to ${endOfDay(anchor).toLocaleDateString()}`
            : `${bounds.from.toLocaleDateString()} – ${bounds.to.toLocaleDateString()}`}
        </div>
        <MiniCalendarButton value={anchor} onChange={(d) => setAnchor(startOfDay(d))} />
        <div className="w-full sm:w-72 ml-auto">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customer…"
            className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
          />
        </div>
      </div>

      {/* KPI grid (stacks 1/2/4 cols responsively) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric title="Total Orders" value={String(totalOrders)} />
        <Metric title="Revenue (Omzet)" value={moneyIDR(omzet)} />
        <Metric title="Net Profit" value={moneyIDR(netProfit)} />
        <Metric title="Unpaid Orders" value={String(filteredUnpaid.length)} />
      </div>

      {/* Buckets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Bucket title="Unpaid Orders">
          {filteredUnpaid.length ? (
            filteredUnpaid.map((o) => (
              <OrderRow key={o.id} o={o} right={<strong>{moneyIDR(o.total)}</strong>}>
                <Pill>unpaid</Pill>
              </OrderRow>
            ))
          ) : (
            <Empty text="Nothing pending" />
          )}
        </Bucket>

        <Bucket title="Undelivered Orders">
          {filteredUndelivered.length ? (
            filteredUndelivered.map((o) => (
              <OrderRow key={o.id} o={o} right={<strong>{moneyIDR(o.total)}</strong>}>
                <Pill>undelivered</Pill>
              </OrderRow>
            ))
          ) : (
            <Empty text="All delivered!" />
          )}
        </Bucket>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Bucket title="Top Items (by qty)">
          {topItems.length ? (
            topItems.map((it) => (
              <div key={it.name} className="flex items-center justify-between gap-2 border rounded-xl p-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{it.name}</div>
                  <div className="text-xs text-gray-500">Revenue {moneyIDR(it.revenue)}</div>
                </div>
                <div className="text-sm font-semibold shrink-0">{fmtQty(it.qty, it.unit)}</div>
              </div>
            ))
          ) : (
            <Empty text="No items in this range" />
          )}
        </Bucket>

        <Bucket title="Top Customers (by spend)">
          {topCustomers.length ? (
            topCustomers.map((c) => (
              <div key={c.name} className="flex items-center justify-between gap-2 border rounded-xl p-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-gray-500">{c.orders} orders</div>
                </div>
                <div className="text-sm font-semibold shrink-0">{moneyIDR(c.spend)}</div>
              </div>
            ))
          ) : (
            <Empty text="No customers in this range" />
          )}
        </Bucket>
      </div>
    </div>
  );
}
