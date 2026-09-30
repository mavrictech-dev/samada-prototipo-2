"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronDown, Grid2X2, List, MapPin, MessageCircle, Minus, Package, Plus, Search, Settings, ShoppingBag, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useCms } from "./cms-provider";
import { ProductModal } from "./product-modal";
import { TurnBook } from "./turn-book";
import { SamadaLogo, ThemeToggle } from "./theme-toggle";
import type { Product } from "@/lib/types";

type Cart = Record<string, number>;

export function CatalogApp() {
  const { state, ready } = useCms();
  const [query,setQuery] = useState("");
  const [category,setCategory] = useState("all");
  const [brand,setBrand] = useState("all");
  const [stockOnly,setStockOnly] = useState(false);
  const [view,setView] = useState<"book"|"list">("book");
  const [searchOpen,setSearchOpen] = useState(false);
  const [cartOpen,setCartOpen] = useState(false);
  const [selected,setSelected] = useState<Product|null>(null);
  const [quantity,setQuantity] = useState(6);
  const [cart,setCart] = useState<Cart>({});
  const [branch,setBranch] = useState(state.branches[0]?.id || "central");
  const [notice,setNotice] = useState("");

  useEffect(()=>{ const handler=(event:KeyboardEvent)=>{ if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setSearchOpen(true)} if(event.key==="/"&&!/INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement).tagName)){event.preventDefault();setSearchOpen(true)} }; addEventListener("keydown",handler); return()=>removeEventListener("keydown",handler);},[]);
  useEffect(()=>{ if(state.branches.length&&!state.branches.some(item=>item.id===branch))setBranch(state.branches[0].id);},[state.branches,branch]);

  const categories=useMemo(()=>[{id:"all",name:"Todo"},...state.categories.filter(item=>item.active).map(item=>({id:item.id,name:item.name}))],[state.categories]);
  const brands=useMemo(()=>state.brands.filter(item=>item.active),[state.brands]);
  const getBrand=useCallback((id:string)=>state.brands.find(item=>item.id===id)?.name||id,[state.brands]);
  const getSubcategory=useCallback((id:string)=>state.subcategories.find(item=>item.id===id)?.name||id,[state.subcategories]);
  const filtered=useMemo(()=>state.products.filter(product=>{
    const haystack=`${product.name} ${product.sku} ${getBrand(product.brand)} ${getSubcategory(product.subcategory)}`.toLowerCase();
    return product.active && (category==="all"||product.category===category) && (brand==="all"||product.brand===brand) && (!stockOnly||product.stock>0) && haystack.includes(query.toLowerCase().trim());
  }),[state.products,category,brand,stockOnly,query,getBrand,getSubcategory]);
  const visiblePages=useMemo(()=>state.pages.map(page=>({...page,productIds:page.productIds.filter(id=>filtered.some(product=>product.id===id))})),[state.pages,filtered]);
  const cartItems=useMemo(()=>Object.entries(cart).map(([id,amount])=>({product:state.products.find(product=>product.id===id),amount})).filter(item=>item.product) as Array<{product:Product;amount:number}>,[cart,state.products]);
  const cartCount=cartItems.reduce((sum,item)=>sum+item.amount,0);
  const cartTotal=cartItems.reduce((sum,item)=>sum+item.product.wholesalePrice*item.amount,0);
  const activeBranch=state.branches.find(item=>item.id===branch)||state.branches[0];
  const selectProduct=useCallback((product:Product)=>{setSelected({...product,brand:getBrand(product.brand),subcategory:getSubcategory(product.subcategory)});setQuantity(product.minOrder)},[getBrand,getSubcategory]);
  const addToCart=(product:Product,amount:number)=>{setCart(current=>({...current,[product.id]:(current[product.id]||0)+amount}));setSelected(null);setNotice(`${product.name} agregado al pedido`);setTimeout(()=>setNotice(""),2500)};
  const updateCart=(product:Product,amount:number)=>setCart(current=>{const next={...current}; if(amount<=0)delete next[product.id];else next[product.id]=amount;return next});
  const requestAdvice=useCallback(()=>{setCartOpen(true)},[]);
  const sendOrder=()=>{
    const lines=cartItems.map(item=>`• ${item.product.sku} ${item.product.name}: ${item.amount} u.`).join("\n");
    const message=cartItems.length?`Hola Samada, quiero cotizar este pedido para distribuidores:\n${lines}\nTotal referencial: S/ ${cartTotal.toFixed(2)}\nSede: ${activeBranch?.name}`:`Hola Samada, quiero recibir asesoría para distribuidores en ${activeBranch?.name}.`;
    if(activeBranch?.phone){window.open(`https://wa.me/${activeBranch.phone}?text=${encodeURIComponent(message)}`,"_blank","noopener,noreferrer");}
    else {navigator.clipboard?.writeText(message);setNotice("Consulta copiada. Agrega el teléfono real en el CMS para abrir WhatsApp.");setCartOpen(false);setTimeout(()=>setNotice(""),4000)}
  };

  if(!ready)return <main className="grid min-h-screen place-items-center bg-[#f3f5f0]"><div className="text-center"><span className="mx-auto block size-8 animate-spin rounded-full border-2 border-[#7CB342] border-t-transparent"/><p className="mt-4 text-sm text-[#687064]">Preparando catálogo…</p></div></main>;
  const bookKey=JSON.stringify([visiblePages,filtered]);
  return <div className="theme-page relative min-h-screen text-[#212121]">
    {/* Fondo completo responsive con imagen de almacén, blur y oscurecido adaptativo */}
    <div className="catalog-bg-wrapper" aria-hidden="true">
      <img
        src="/assets/catalog-bg.webp"
        alt=""
        className="catalog-bg-image"
      />
      <div className="catalog-bg-tint" />
    </div>

    <header className="sticky top-0 z-50 border-b border-[#dfe3da]/80 bg-white/90 backdrop-blur-xl transition-colors">
      <div className="mx-auto flex h-[76px] max-w-[1440px] items-center gap-6 px-5 lg:px-10">
        <Link href="/" aria-label="Samada inicio"><SamadaLogo className="w-36 md:w-40"/></Link>
        <span className="hidden border-l border-[#e0e3dc] pl-6 text-[11px] text-[#747b70] md:block">Canal distribuidores</span>
        <button onClick={()=>setSearchOpen(true)} className="mx-auto hidden h-11 w-full max-w-md items-center gap-3 rounded-xl border border-[#dfe3da] bg-[#f8f9f6] px-4 text-left text-xs text-[#777e73] md:flex"><Search size={16}/>Buscar producto, SKU o marca <kbd className="ml-auto rounded border bg-white px-2 py-1 text-[10px]">Ctrl K</kbd></button>
        <div className="ml-auto flex items-center gap-2">
          <label className="hidden items-center gap-2 text-xs lg:flex"><MapPin size={16} className="text-[#558B2F]"/><select value={branch} onChange={e=>setBranch(e.target.value)} className="bg-transparent outline-none">{state.branches.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <button onClick={()=>setSearchOpen(true)} className="grid size-10 place-items-center rounded-full md:hidden" aria-label="Buscar"><Search size={19}/></button>
          <button onClick={()=>setCartOpen(true)} className="relative flex h-11 items-center gap-2 rounded-xl bg-[#7CB342] px-3.5 text-xs font-semibold" aria-label="Abrir mi pedido"><ShoppingBag size={17}/><span className="hidden sm:inline">Mi pedido</span>{cartCount>0&&<span className="grid size-5 place-items-center rounded-full bg-[#233018] text-[9px] text-white">{cartCount}</span>}</button>
          <ThemeToggle compact/>
          <Link href={typeof window !== "undefined" && window.location.hostname.includes("samadaperu.com") ? "https://gestion.samadaperu.com" : "/admin"} className="grid size-10 place-items-center rounded-full border border-[#dfe3da]" aria-label="Administrar catálogo"><Settings size={17}/></Link>
        </div>
      </div>
    </header>

    <main className="relative z-10">
      <section className="mx-auto max-w-[1440px] px-5 pt-8 lg:px-10">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div><p className="text-xs text-[#687064]">Samada / Catálogo para distribuidores</p><h1 className="mt-3 max-w-3xl text-3xl font-medium leading-tight tracking-[-.055em] md:text-5xl">Encuentra, cotiza y arma tu pedido sin perder tiempo.</h1></div>
          <div className="flex items-center gap-2 text-xs text-[#687064]"><span className="size-2 rounded-full bg-[#7CB342]"/>{filtered.length} productos disponibles</div>
        </div>
        <div className="mt-8 flex flex-col gap-3 border-b border-[#dce1d7]/80 pb-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">{categories.map(item=><button key={item.id} onClick={()=>setCategory(item.id)} className={`shrink-0 rounded-full px-4 py-2.5 text-xs transition ${category===item.id?"bg-[#22251f] text-white":"border border-[#d9ddd5]/80 bg-white/90 backdrop-blur-sm hover:bg-[#eef2e8]"}`}>{item.name} <span className="ml-2 opacity-60">{state.products.filter(product=>item.id==="all"||product.category===item.id).length}</span></button>)}</div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-10 items-center gap-2 rounded-full border border-[#d9ddd5]/80 bg-white/90 backdrop-blur-sm px-4 text-xs"><SlidersHorizontal size={14}/><select value={brand} onChange={e=>setBrand(e.target.value)} className="bg-transparent outline-none"><option value="all">Todas las marcas</option>{brands.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={13}/></label>
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-[#d9ddd5]/80 bg-white/90 backdrop-blur-sm px-4 text-xs"><input type="checkbox" checked={stockOnly} onChange={e=>setStockOnly(e.target.checked)} className="accent-[#558B2F]"/>Con stock</label>
            <div className="flex rounded-full border border-[#d9ddd5]/80 bg-white/90 backdrop-blur-sm p-1"><button onClick={()=>setView("book")} className={`grid size-8 place-items-center rounded-full ${view==="book"?"bg-[#edf3e6] text-[#558B2F]":"text-[#7a8176]"}`} aria-label="Vista revista"><Grid2X2 size={15}/></button><button onClick={()=>setView("list")} className={`grid size-8 place-items-center rounded-full ${view==="list"?"bg-[#edf3e6] text-[#558B2F]":"text-[#7a8176]"}`} aria-label="Vista pedido rápido"><List size={16}/></button></div>
          </div>
        </div>
      </section>

      {view==="book" ? <section className="py-6"><div className="mx-auto mb-4 flex max-w-[1360px] items-center justify-between px-5 text-[11px] text-[#6d7469] lg:px-10"><span>Catálogo editorial interactivo</span><span className="hidden sm:block">Arrastra una esquina o usa las flechas</span></div><TurnBook key={bookKey} pages={visiblePages} products={filtered} onProduct={selectProduct} onContact={requestAdvice}/>{filtered.length===0&&<Empty onReset={()=>{setCategory("all");setBrand("all");setStockOnly(false);setQuery("")}}/>}</section> :
      <DistributorList products={filtered} cart={cart} onProduct={selectProduct} onAdd={addToCart} getBrand={getBrand}/>} 

      <section className="border-y border-[#dce1d7]/80 bg-white/80 backdrop-blur-md"><div className="mx-auto grid max-w-[1360px] gap-4 px-5 py-6 text-xs text-[#61685e] sm:grid-cols-3 lg:px-10"><span className="flex items-center gap-2"><Package size={17} className="text-[#558B2F]"/>Precios mayoristas claros</span><span className="flex items-center gap-2"><Sparkles size={17} className="text-[#558B2F]"/>Surtido editable por catálogo</span><span className="flex items-center gap-2"><MessageCircle size={17} className="text-[#558B2F]"/>Asesoría por sede</span></div></section>
    </main>
    <footer className="relative z-10 mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-7 text-[10px] text-[#747b70] sm:flex-row sm:justify-between lg:px-10"><span>© 2026 Samada · Catálogo de demostración</span><span>Precios, stock y sedes requieren validación comercial</span></footer>

    {searchOpen&&<SearchPalette products={state.products.filter(p=>p.active)} getBrand={getBrand} getSubcategory={getSubcategory} onClose={()=>setSearchOpen(false)} onSelect={product=>{setSearchOpen(false);selectProduct(product)}}/>}
    <ProductModal product={selected} quantity={quantity} onQuantity={setQuantity} onClose={()=>setSelected(null)} onAdd={()=>selected&&addToCart(selected,quantity)}/>
    {cartOpen&&<CartDrawer items={cartItems} total={cartTotal} branchName={activeBranch?.name||"Sede"} onClose={()=>setCartOpen(false)} onChange={updateCart} onSend={sendOrder}/>} 
    {notice&&<div className="fixed bottom-5 left-1/2 z-[150] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-[#242921] px-5 py-3 text-xs text-white shadow-xl"><Check size={16} className="text-[#9ccc65]"/>{notice}</div>}
  </div>;
}

function DistributorList({products,cart,onProduct,onAdd,getBrand}:{products:Product[];cart:Cart;onProduct:(p:Product)=>void;onAdd:(p:Product,q:number)=>void;getBrand:(id:string)=>string}){
  return <section className="mx-auto max-w-[1360px] px-5 py-7 lg:px-10"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-2xl font-medium tracking-[-.04em]">Pedido rápido</h2><p className="mt-1 text-xs text-[#747b70]">Compara presentación, caja y stock sin abrir cada ficha.</p></div></div>{products.length?<div className="overflow-hidden rounded-2xl border border-[#dce1d7] bg-white"><div className="hidden grid-cols-[1.8fr_.7fr_.7fr_.7fr_.7fr_120px] gap-4 border-b bg-[#f7f8f5] px-5 py-3 text-[10px] font-semibold text-[#747b70] lg:grid"><span>Producto</span><span>SKU</span><span>Mayorista</span><span>Mínimo</span><span>Stock</span><span>Acción</span></div>{products.map(product=><div key={product.id} className="grid items-center gap-3 border-b border-[#e7e9e4] p-4 last:border-0 sm:grid-cols-[1fr_auto] lg:grid-cols-[1.8fr_.7fr_.7fr_.7fr_.7fr_120px] lg:gap-4 lg:px-5"><button onClick={()=>onProduct(product)} className="flex min-w-0 items-center gap-3 text-left"><span className="grid size-14 shrink-0 place-items-center rounded-xl bg-[#eff3e9]"><img src={product.image} alt="" className="h-12 w-12 object-contain"/></span><span className="min-w-0"><b className="block truncate text-sm">{product.name}</b><small className="text-[#7b8277]">{getBrand(product.brand)} · {product.presentation}</small></span></button><span className="hidden text-xs text-[#646b61] lg:block">{product.sku}</span><strong className="hidden text-sm lg:block">S/ {product.wholesalePrice.toFixed(2)}</strong><span className="hidden text-xs lg:block">{product.minOrder} u.</span><span className={`hidden text-xs lg:block ${product.stock===0?"text-red-600":product.stock<12?"text-amber-600":"text-[#558B2F]"}`}>{product.stock===0?"Agotado":`${product.stock} u.`}</span><button disabled={!product.stock} onClick={()=>onAdd(product,product.minOrder)} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#7CB342] px-3 text-xs font-semibold disabled:opacity-35"><Plus size={14}/>{cart[product.id]?"Agregar más":"Agregar"}</button></div>)}</div>:<Empty/>}</section>;
}

function Empty({onReset}:{onReset?:()=>void}){return <div className="mx-auto my-10 max-w-lg rounded-2xl border border-[#dce1d7] bg-white p-10 text-center"><Search className="mx-auto text-[#558B2F]"/><h3 className="mt-4 text-xl font-medium">No hay productos con estos filtros.</h3><p className="mt-2 text-sm text-[#6d7469]">Prueba otra categoría, marca o disponibilidad.</p>{onReset&&<button onClick={onReset} className="mt-5 rounded-lg bg-[#7CB342] px-5 py-3 text-xs font-semibold">Ver todo el catálogo</button>}</div>}

function SearchPalette({products,getBrand,getSubcategory,onClose,onSelect}:{products:Product[];getBrand:(id:string)=>string;getSubcategory:(id:string)=>string;onClose:()=>void;onSelect:(p:Product)=>void}){
  const [value,setValue]=useState(""); const matches=products.filter(p=>`${p.name} ${p.sku} ${getBrand(p.brand)} ${getSubcategory(p.subcategory)}`.toLowerCase().includes(value.toLowerCase())).slice(0,8);
  useEffect(()=>{const h=(e:KeyboardEvent)=>e.key==="Escape"&&onClose();addEventListener("keydown",h);return()=>removeEventListener("keydown",h)},[onClose]);
  return <div className="fixed inset-0 z-[120] flex justify-center bg-[#172014]/60 p-4 pt-[10vh] backdrop-blur-sm" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="h-fit w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center gap-3 border-b px-5"><Search size={20} className="text-[#558B2F]"/><input autoFocus value={value} onChange={e=>setValue(e.target.value)} placeholder="Busca por nombre, SKU, marca o subcategoría…" className="h-16 flex-1 bg-transparent text-sm outline-none"/><button onClick={onClose} aria-label="Cerrar"><X size={18}/></button></div><div className="max-h-[60vh] overflow-auto p-2">{matches.map(product=><button key={product.id} onClick={()=>onSelect(product)} className="flex w-full items-center gap-4 rounded-xl p-3 text-left hover:bg-[#f0f4eb]"><span className="grid size-14 place-items-center rounded-lg bg-[#eef2e8]"><img src={product.image} alt="" className="size-12 object-contain"/></span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{product.name}</b><small className="text-[#747b70]">{product.sku} · {getBrand(product.brand)} · {product.presentation}</small></span><span className="text-right"><b className="block text-sm">S/ {product.wholesalePrice.toFixed(2)}</b><small className={product.stock?"text-[#558B2F]":"text-red-600"}>{product.stock?`${product.stock} en stock`:"Agotado"}</small></span><ArrowRight size={16}/></button>)}{!matches.length&&<p className="p-10 text-center text-sm text-[#747b70]">No encontramos coincidencias.</p>}</div><div className="border-t bg-[#f8f9f6] px-5 py-3 text-[10px] text-[#747b70]">Consejo: escribe el SKU para llegar directo al producto.</div></div></div>
}

function CartDrawer({items,total,branchName,onClose,onChange,onSend}:{items:Array<{product:Product;amount:number}>;total:number;branchName:string;onClose:()=>void;onChange:(p:Product,n:number)=>void;onSend:()=>void}){
 return <div className="fixed inset-0 z-[130] bg-[#172014]/45" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><aside className="ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl"><div className="flex h-20 items-center justify-between border-b px-6"><div><h2 className="text-xl font-medium tracking-[-.04em]">Mi pedido</h2><p className="text-[10px] text-[#747b70]">Cotización para {branchName}</p></div><button onClick={onClose} className="grid size-10 place-items-center" aria-label="Cerrar pedido"><X size={19}/></button></div><div className="flex-1 overflow-auto p-5">{items.length?items.map(({product,amount})=><div key={product.id} className="flex gap-3 border-b py-4 first:pt-0"><span className="grid size-16 shrink-0 place-items-center rounded-xl bg-[#eff3e9]"><img src={product.image} alt="" className="size-14 object-contain"/></span><div className="min-w-0 flex-1"><b className="block truncate text-sm">{product.name}</b><small className="text-[#747b70]">{product.sku} · S/ {product.wholesalePrice.toFixed(2)}</small><div className="mt-2 flex items-center gap-3"><button onClick={()=>onChange(product,amount-product.minOrder)} className="grid size-7 place-items-center rounded-full border" aria-label={`Restar ${product.minOrder} unidades de ${product.name}`}><Minus size={12}/></button><strong className="text-xs">{amount} u.</strong><button onClick={()=>onChange(product,amount+product.minOrder)} className="grid size-7 place-items-center rounded-full border" aria-label={`Sumar ${product.minOrder} unidades de ${product.name}`}><Plus size={12}/></button><span className="ml-auto text-sm font-semibold">S/ {(amount*product.wholesalePrice).toFixed(2)}</span></div></div></div>):<div className="grid h-full place-items-center text-center"><div><ShoppingBag className="mx-auto text-[#7CB342]"/><h3 className="mt-4 font-medium">Tu pedido está vacío.</h3><p className="mt-2 text-xs text-[#747b70]">Agrega productos desde la revista o la lista.</p></div></div>}</div><div className="border-t p-6"><div className="mb-4 flex justify-between"><span className="text-sm text-[#747b70]">Total referencial</span><strong className="text-xl">S/ {total.toFixed(2)}</strong></div><button onClick={onSend} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#7CB342] text-sm font-semibold"><MessageCircle size={18}/>{items.length?"Cotizar por WhatsApp":"Pedir asesoría"}</button><p className="mt-3 text-center text-[10px] text-[#747b70]">La sede confirmará stock, condiciones y total final.</p></div></aside></div>
}
