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

  useEffect(() => { fetch("/api/items").then(r=>r.json()).then(setItems); }, []);

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
    <div className="grid gap-6 md:grid-cols-[1fr_420px]">
      {/* Items */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <input className="w-full border rounded p-2" placeholder="Cari item…" value={q} onChange={e=>setQ(e.target.value)} />
          <a href="/items" className="px-3 py-2 border rounded text-sm">Items</a>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {filtered.map(it=>(
            <button key={it.id} onClick={()=>add(it.id)} className="border rounded p-3 text-left hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 grid place-items-center bg-gray-50 rounded text-xl">
                  {it.image?.startsWith("http") ? <img src={it.image} alt="" className="w-8 h-8 object-cover rounded"/> : (it.image ?? "🛒")}
                </div>
                <div className="font-medium truncate">{it.name}</div>
              </div>
              <div className="text-sm opacity-70 mt-1">Rp {it.price.toLocaleString("id-ID")}</div>
              <div className="text-[11px] opacity-60">Stock: {it.stock}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart & Customer */}
      <div className="sticky top-20 h-fit rounded border p-4 space-y-3">
        <h2 className="text-lg font-semibold">Create Order</h2>

        <div className="grid gap-2">
          <input className="border rounded p-2" placeholder="WhatsApp (62…)" value={cust.whatsapp} onChange={e=>onWAChange(e.target.value)} />
          <input className="border rounded p-2" placeholder="Nama" value={cust.name} onChange={e=>setCust({...cust, name:e.target.value})}/>
          <input className="border rounded p-2" placeholder="Alamat" value={cust.address} onChange={e=>setCust({...cust, address:e.target.value})}/>
          <input className="border rounded p-2" placeholder="Catatan pengantaran (opsional)" value={deliveryNote} onChange={e=>setDeliveryNote(e.target.value)} />
        </div>

        {lines.length === 0 ? (
          <div className="text-sm text-gray-500">Keranjang kosong.</div>
        ) : (
          <div className="space-y-2">
            {lines.map(l=>{
              const it = items.find(x=>x.id===l.id);
              return (
                <div key={l.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1 truncate">{it?.name}</div>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>sub(l.id)} className="px-2 border rounded">−</button>
                    <span>{l.qty}</span>
                    <button onClick={()=>add(l.id)} className="px-2 border rounded">＋</button>
                  </div>
                  <div className="w-28 text-right">Rp {(l.qty*l.price).toLocaleString("id-ID")}</div>
                </div>
              );
            })}
            <hr />
            <div className="flex justify-between font-semibold">
              <span>Subtotal</span><span>Rp {subtotal.toLocaleString("id-ID")}</span>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={()=>checkout("CASH")} className="px-3 py-2 rounded border">Cash</button>
          <button onClick={()=>checkout("TRANSFER")} className="px-3 py-2 rounded border">Transfer</button>
          <button onClick={()=>checkout("QRIS")} className="px-3 py-2 rounded bg-[--color-brand] text-white">QRIS</button>
        </div>
      </div>
    </div>
  );
}
