"use client";

import { useEffect, useMemo, useState, useRef } from "react";

/* -----------------------------
   Brand / style tokens
----------------------------- */
const BRAND = {
  btnActive: "bg-primary-600 text-white",
  btnHover: "hover:bg-primary-50",
  textPrimary: "text-primary-700",
  chipBg: "bg-primary-50",
  chipBorder: "border-primary-200",
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
  if (range === "All") return { from: new Date(0), to: endOfDay(anchor) }; // Use anchor date for "to"
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
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
      {RANGES.map((r) => {
        const active = value === r;
        return (
          <button
            key={r}
            onClick={() => onChange(r)}
            className={[
              "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
              active
                ? "bg-primary-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
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
    <div className="card card-hover">
      <div className="card-padding">
        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</div>
        <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">{value}</div>
        {sub ? <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{sub}</div> : null}
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className={["text-xs px-2 py-1 rounded-full border", BRAND.chipBg, BRAND.chipBorder, BRAND.textPrimary].join(" ")}>
      {children}
    </span>
  );
}

function Bucket({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <div className="card card-hover">
      <div className="card-padding">
        <div className="font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</div>
        <div className="space-y-3 max-h-96 overflow-auto pr-2">{children}</div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">{text}</div>;
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 dark:bg-gray-700"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2 dark:bg-gray-700"></div>
    </div>
  );
}

function MetricSkeleton() {
  return (
    <div className="card card-hover">
      <div className="card-padding">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2 dark:bg-gray-700"></div>
        <div className="h-8 bg-gray-200 rounded w-3/4 dark:bg-gray-700"></div>
        <div className="h-3 bg-gray-200 rounded w-1/3 mt-2 dark:bg-gray-700"></div>
      </div>
    </div>
  );
}

function OrderRow({ o, children, right }: React.PropsWithChildren<{ o: Order; right?: React.ReactNode }>) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-800">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
          {o.customer?.name ?? "No name"}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(o.createdAt).toLocaleDateString()}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">#{o.id.slice(-6)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {children}
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{right}</div>
      </div>
    </div>
  );
}

/* -----------------------------
   Compact popover calendar
----------------------------- */
function CompactCalendar({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [monthStart, setMonthStart] = useState(new Date(value.getFullYear(), value.getMonth(), 1));
  
  // Update monthStart when value changes (when user selects a date)
  useEffect(() => {
    const newMonthStart = new Date(value.getFullYear(), value.getMonth(), 1);
    setMonthStart(newMonthStart);
  }, [value]);
  
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
        <button className="rounded-lg border px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
          onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))}>←</button>
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {monthStart.toLocaleString(undefined, { month: "long", year: "numeric" })}
        </div>
        <button className="rounded-lg border px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
          onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))}>→</button>
      </div>
      <div className="grid grid-cols-7 gap-1 px-1 text-center text-[10px] text-gray-500 dark:text-gray-400">
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
                !d ? "opacity-0 cursor-default" : "hover:bg-gray-50 dark:hover:bg-gray-700",
                isSelected ? "bg-green-600 text-white border-green-600"
                  : isToday ? "border-green-400 dark:border-green-500 text-gray-900 dark:text-gray-100" : "border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100",
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
  const [position, setPosition] = useState({ top: 0, left: 0, right: 'auto' });
  const buttonRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  
  // Calculate position when opening
  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const calendarWidth = 320; // w-80 = 20rem = 320px
      const windowWidth = window.innerWidth;
      
      setPosition({
        top: rect.bottom + window.scrollY + 8, // 8px = mt-2
        left: rect.right + window.scrollX - calendarWidth, // Align to right
        right: 'auto'
      });
      
      // If calendar would go off screen on the left, align to right edge of button
      if (rect.right - calendarWidth < 0) {
        setPosition({
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX,
          right: 'auto'
        });
      }
    }
  };
  
  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is outside both button and calendar
      if (buttonRef.current && calendarRef.current &&
          !buttonRef.current.contains(target) &&
          !calendarRef.current.contains(target)) {
        setOpen(false);
      }
    };
    
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      updatePosition();
      // Update position on scroll/resize
      window.addEventListener('scroll', updatePosition);
      window.addEventListener('resize', updatePosition);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  return (
    <>
      <div ref={buttonRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="btn btn-secondary btn-md justify-between"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span>{value.toLocaleDateString()}</span>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </button>
      </div>
      
      {open && typeof window !== 'undefined' && (
        <div
          ref={calendarRef}
          className="fixed z-50 w-80 max-w-[90vw] rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800"
          role="dialog"
          style={{
            top: `${position.top}px`,
            left: position.left,
            right: position.right,
          }}
        >
          <CompactCalendar
            value={value}
            onChange={(d) => {
              onChange(d);
              setOpen(false);
            }}
          />
        </div>
      )}
    </>
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
  
  // Dashboard metrics from optimized API
  const [dashboardMetrics, setDashboardMetrics] = useState<any>(null);
  const [topItems, setTopItems] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [recentUnpaid, setRecentUnpaid] = useState<any[]>([]);
  const [recentUndelivered, setRecentUndelivered] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate bounds before useEffect to avoid dependency issues
  const bounds = useMemo(() => rangeBounds(range, anchor), [range, anchor]);

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Build query params for date range and search
        const params = new URLSearchParams();
        // Always send date range to API, even for "All" range
        params.append("from", bounds.from.toISOString());
        params.append("to", bounds.to.toISOString());
        if (q) {
          params.append("search", q);
        }
        
        // Fetch dashboard data from optimized API
        const res = await fetch(`/api/dashboard?${params}`);
        const data = await res.json();
        
        if (!isMounted) return;

        console.log('Dashboard data:', data); // Debug log

        // Set items for mapping
        setItems(data.items.map((x: any) => ({
          id: x.id,
          name: x.name ?? x.title ?? x.label ?? undefined,
          costPrice: x.costPrice ?? 0,
          unit: x.unit as Unit,
        })));

        // Store the recent orders separately to avoid duplicates
        // We only need the counts and basic data for display
        const unpaidOrders: Order[] = (data.recentUnpaid || []).map((o: any) => ({
          id: o.id,
          createdAt: o.createdAt,
          paidAt: null,
          total: o.total,
          items: [],
          customer: o.customer,
        } as Order));
        
        const undeliveredOrders: Order[] = (data.recentUndelivered || []).map((o: any) => ({
          id: o.id,
          createdAt: o.createdAt,
          paidAt: o.paidAt,
          total: o.total,
          items: [],
          customer: o.customer,
        } as Order));

        // Store orders for filtering - use a Set to ensure uniqueness
        const allRecentOrders = new Map<string, Order>();
        [...unpaidOrders, ...undeliveredOrders].forEach(order => {
          if (!allRecentOrders.has(order.id)) {
            allRecentOrders.set(order.id, order);
          }
        });
        
        setOrders(Array.from(allRecentOrders.values()));
        
        // Store separate arrays for display
        setRecentUnpaid(unpaidOrders);
        setRecentUndelivered(undeliveredOrders);
        
        // Store metrics directly for display
        if (data.metrics) {
          setDashboardMetrics(data.metrics);
        }
        if (data.topItems) {
          setTopItems(data.topItems);
        }
        if (data.topCustomers) {
          setTopCustomers(data.topCustomers);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [range, anchor, q, bounds]); // Add dependencies for refetching when range, anchor, search, or bounds changes

  const itemsMap = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);

  // All orders in window & search (createdAt)
  const filteredAll = useMemo(() => {
    const filtered = orders.filter((o) => {
      const d = new Date(o.createdAt);
      const inWindow = d >= bounds.from && d <= bounds.to;
      const matchSearch = q ? (o.customer?.name ?? "").toLowerCase().includes(q.toLowerCase()) : true;
      return inWindow && matchSearch;
    });
    console.log('Filtered orders:', filtered.length, 'for range:', range, 'bounds:', bounds); // Debug log
    return filtered;
  }, [orders, bounds, q, range]);

  const filteredPaid = useMemo(() => filteredAll.filter((o) => !!o.paidAt), [filteredAll]);
  const filteredUnpaid = useMemo(() => filteredAll.filter((o) => !o.paidAt), [filteredAll]);
  const filteredUndelivered = useMemo(() => filteredAll.filter((o) => isUndelivered(o)), [filteredAll]);

  // KPIs
  // Use metrics from optimized API
  const totalOrders = dashboardMetrics?.totalOrders || 0;
  const omzet = dashboardMetrics?.omzet || 0;
  const netProfit = dashboardMetrics?.netProfit || 0;
  const sellerDeliveryFeeTotal = dashboardMetrics?.sellerDeliveryFeeTotal || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Overview of your business performance</p>
        </div>
      </div>

      {/* Filter bar (wraps on mobile) */}
      <div className="p-4 bg-white rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-4">
          {/* Period selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Period:</span>
            <RangeToggle value={range} onChange={setRange} />
          </div>
          
          {/* Date range display */}
          <div className="text-sm text-gray-500 dark:text-gray-400" suppressHydrationWarning>
            {range === "All"
              ? `Up to ${endOfDay(anchor).toLocaleDateString('en-US')}`
              : `${bounds.from.toLocaleDateString('en-US')} – ${bounds.to.toLocaleDateString('en-US')}`}
          </div>
          
          {/* Calendar button */}
          <MiniCalendarButton value={anchor} onChange={(d) => setAnchor(startOfDay(d))} />
          
          {/* Search input */}
          <div className="flex-1 min-w-[200px]">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search customer…"
              className="input w-full"
            />
          </div>
        </div>
      </div>

      {/* KPI grid (stacks 1/2/4 cols responsively) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-4">
        {isLoading ? (
          <>
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </>
        ) : (
          <>
            <Metric title="Total Orders" value={String(totalOrders)} />
            <Metric title="Unpaid Orders" value={String(filteredUnpaid.length)} />
            <Metric title="Revenue (Omzet)" value={moneyIDR(omzet)} />
            <Metric title="Seller Delivery Fees" value={moneyIDR(sellerDeliveryFeeTotal)} />
            <Metric title="Net Profit" value={moneyIDR(netProfit - sellerDeliveryFeeTotal)} />
          </>
        )}
      </div>

      {/* Buckets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Bucket title="Unpaid Orders">
          {isLoading ? (
            <div className="space-y-3">
              <LoadingSkeleton />
              <LoadingSkeleton />
              <LoadingSkeleton />
            </div>
          ) : filteredUnpaid.length ? (
            filteredUnpaid.map((o) => (
              <OrderRow key={`unpaid-${o.id}`} o={o} right={<span className="font-semibold">{moneyIDR(o.total)}</span>}>
                <Pill>unpaid</Pill>
              </OrderRow>
            ))
          ) : (
            <Empty text="Nothing pending" />
          )}
        </Bucket>

        <Bucket title="Undelivered Orders">
          {isLoading ? (
            <div className="space-y-3">
              <LoadingSkeleton />
              <LoadingSkeleton />
              <LoadingSkeleton />
            </div>
          ) : filteredUndelivered.length ? (
            filteredUndelivered.map((o) => (
              <OrderRow key={`undelivered-${o.id}`} o={o} right={<span className="font-semibold">{moneyIDR(o.total)}</span>}>
                <Pill>undelivered</Pill>
              </OrderRow>
            ))
          ) : (
            <Empty text="All delivered!" />
          )}
        </Bucket>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Bucket title="Top Items (by qty)">
          {isLoading ? (
            <div className="space-y-3">
              <LoadingSkeleton />
              <LoadingSkeleton />
              <LoadingSkeleton />
              <LoadingSkeleton />
            </div>
          ) : topItems.length ? (
            topItems.map((it) => (
              <div key={it.name} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-800">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{it.name}</div>
                  <div className="text-xs text-gray-500 mt-1 dark:text-gray-400">Revenue {moneyIDR(it.revenue)}</div>
                </div>
                <div className="text-sm font-semibold text-gray-900 shrink-0 dark:text-gray-100">{fmtQty(it.qty, it.unit)}</div>
              </div>
            ))
          ) : (
            <Empty text="No items in this range" />
          )}
        </Bucket>

        <Bucket title="Top Customers (by spend)">
          {isLoading ? (
            <div className="space-y-3">
              <LoadingSkeleton />
              <LoadingSkeleton />
              <LoadingSkeleton />
              <LoadingSkeleton />
            </div>
          ) : topCustomers.length ? (
            topCustomers.map((c) => (
              <div key={c.name} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-800">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{c.name}</div>
                  <div className="text-xs text-gray-500 mt-1 dark:text-gray-400">{c.orders} orders</div>
                </div>
                <div className="text-sm font-semibold text-gray-900 shrink-0 dark:text-gray-100">{moneyIDR(c.spend)}</div>
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
