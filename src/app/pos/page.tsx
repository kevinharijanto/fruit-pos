"use client";
import { useEffect, useMemo, useState } from "react";

type Item = { id:string; name:string; price:number; stock:number; image?:string|null };
type CartLine = { id:string; qty:number; price:number };

export default function POSPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cust, setCust] = useState({ name:"", address:"", whatsapp:"" });
  const [deliveryNote, setDeliveryNote] = useState("");

  useEffect(() => {
    fetch("/api/items")
      .then(r=>r.json())
      .then(json => {
        // Handle new paginated format or fallback to old format
        let items: any[] = [];
        if (json.data && Array.isArray(json.data)) {
          items = json.data;
        } else if (Array.isArray(json)) {
          items = json;
        }
        setItems(items);
      });
  }, []);

  // Autofill customer by whatsapp
  async function onWAChange(v: string) {
    setCust(c => ({ ...c, whatsapp: v }));
    if (v && v.length >= 6) {
      const found = await (await fetch(`/api/customers/search?wa=${encodeURIComponent(v)}`)).json();
      if (found) setCust({ name: found.name || "", address: found.address || "", whatsapp: found.whatsapp || v });
    }
  }

  const filtered = useMemo(() => items.filter(i => i.name.toLowerCase().includes(q.toLowerCase())), [items, q]);
  const priceOf = (id:string)=> items.find(i=>i.id===id)?.price ?? 0;
  const stockOf = (id:string)=> items.find(i=>i.id===id)?.stock ?? 0;

  const lines: CartLine[] = Object.entries(cart).filter(([_,qty])=>qty>0).map(([id,qty]) => ({ id, qty, price: priceOf(id) }));
  const subtotal = lines.reduce((s,l)=> s + l.qty*l.price, 0);

  const add = (id:string) => setCart(c => {
    const next = (c[id]||0) + 1;
    if (next > stockOf(id)) { alert("Stock tidak cukup"); return c; }
    return ({ ...c, [id]: next });
  });
  const sub = (id:string) => setCart(c => ({ ...c, [id]: Math.max((c[id]||0)-1,0) }));
  const clear = () => setCart({});

  async function checkout(paymentType:"CASH"|"TRANSFER"|"QRIS") {
    if (lines.length === 0) return alert("Keranjang kosong.");
    const body = {
      customer: cust.whatsapp || cust.name ? cust : null,
      items: lines.map(l => ({ itemId: l.id, qty: l.qty })),
      paymentType,
      deliveryNote
    };
    const res = await fetch("/api/orders", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) });
    if (!res.ok) return alert("Gagal membuat order");
    clear();
    alert("Order dibuat.");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      {/* Items */}
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              className="input"
              placeholder="Search items…"
              value={q}
              onChange={e=>setQ(e.target.value)}
            />
          </div>
          <a href="/items" className="btn btn-secondary btn-md">Manage Items</a>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(it=>(
            <button
              key={it.id}
              onClick={()=>add(it.id)}
              className="card card-hover p-4 text-left group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 grid place-items-center bg-gray-50 rounded-lg text-2xl group-hover:bg-primary-50 transition-colors">
                  {it.image?.startsWith("http") ?
                    <img src={it.image} alt="" className="w-12 h-12 object-cover rounded-lg"/> :
                    (it.image ?? "🛒")
                  }
                </div>
                <div className="font-semibold text-gray-900 truncate group-hover:text-primary-600 transition-colors">
                  {it.name}
                </div>
              </div>
              <div className="text-lg font-bold text-gray-900">Rp {it.price.toLocaleString("id-ID")}</div>
              <div className="text-sm text-gray-500 mt-1">Stock: {it.stock}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart & Customer */}
      <div className="sticky top-6 h-fit">
        <div className="card">
          <div className="card-padding space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Create Order</h2>
              <p className="text-sm text-gray-500 mt-1">Add customer details and items</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                <input
                  className="input"
                  placeholder="+62…"
                  value={cust.whatsapp}
                  onChange={e=>onWAChange(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  className="input"
                  placeholder="Customer name"
                  value={cust.name}
                  onChange={e=>setCust({...cust, name:e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  className="input"
                  placeholder="Delivery address"
                  value={cust.address}
                  onChange={e=>setCust({...cust, address:e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Note (optional)</label>
                <input
                  className="input"
                  placeholder="Special instructions..."
                  value={deliveryNote}
                  onChange={e=>setDeliveryNote(e.target.value)}
                />
              </div>
            </div>

            {lines.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg viewBox="0 0 24 24" className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                  <path d="M4 7a2 2 0 012-2 1 1 0 000 2H6a2 2 0 00-2 2v6a2 2 0 002 2h8a2 2 0 002-2V9a2 2 0 00-2-2h-1a1 1 0 100-2h1a4 4 0 014 4v6a4 4 0 01-4 4H6a4 4 0 01-4-4V9a4 4 0 014-4z"/>
                </svg>
                <p>Cart is empty</p>
                <p className="text-sm mt-1">Add items to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="max-h-64 overflow-y-auto space-y-3">
                  {lines.map(l=>{
                    const it = items.find(x=>x.id===l.id);
                    return (
                      <div key={l.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 truncate">{it?.name}</div>
                          <div className="text-sm text-gray-500">Rp {it?.price.toLocaleString("id-ID")} each</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={()=>sub(l.id)}
                            className="w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 flex items-center justify-center transition-colors"
                          >
                            −
                          </button>
                          <span className="w-8 text-center font-semibold">{l.qty}</span>
                          <button
                            onClick={()=>add(l.id)}
                            className="w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 flex items-center justify-center transition-colors"
                          >
                            ＋
                          </button>
                        </div>
                        <div className="w-24 text-right font-semibold text-gray-900">
                          Rp {(l.qty*l.price).toLocaleString("id-ID")}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">Subtotal</span>
                    <span className="text-xl font-bold text-gray-900">Rp {subtotal.toLocaleString("id-ID")}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 pt-4">
              <button
                onClick={()=>checkout("CASH")}
                className="btn btn-secondary btn-md"
                disabled={lines.length === 0}
              >
                Cash
              </button>
              <button
                onClick={()=>checkout("TRANSFER")}
                className="btn btn-secondary btn-md"
                disabled={lines.length === 0}
              >
                Transfer
              </button>
              <button
                onClick={()=>checkout("QRIS")}
                className="btn btn-primary btn-md"
                disabled={lines.length === 0}
              >
                QRIS
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
