"use client";

import { Minus, PackageCheck, Plus, ShoppingBag, X } from "lucide-react";
import type { Product } from "@/lib/types";

export function ProductModal({ product, quantity, onQuantity, onClose, onAdd }: {
  product: Product | null;
  quantity: number;
  onQuantity: (quantity: number) => void;
  onClose: () => void;
  onAdd: () => void;
}) {
  if (!product) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#172014]/65 p-4 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="relative grid max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[24px] bg-white shadow-2xl md:grid-cols-[.9fr_1.1fr]" role="dialog" aria-modal="true" aria-labelledby="product-title">
        <button onClick={onClose} className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full border border-[#dfe3da] bg-white" aria-label="Cerrar"><X size={18}/></button>
        <div className="grid min-h-72 place-items-center bg-[#eef2e7] p-10">
          <img src={product.image} alt={product.name} className="h-80 w-full object-contain drop-shadow-xl" />
        </div>
        <div className="p-7 md:p-12">
          <p className="mb-3 text-xs font-semibold text-[#558B2F]">{product.category} / {product.subcategory}</p>
          <h2 id="product-title" className="text-3xl font-medium tracking-[-.04em] text-[#212121] md:text-4xl">{product.name}</h2>
          <p className="mt-3 text-xs text-[#798073]">{product.brand} · {product.sku} · {product.presentation}</p>
          <p className="mt-6 text-sm leading-6 text-[#4f554d]">{product.description}</p>
          <div className="mt-7 flex items-end justify-between border-y border-[#e2e5de] py-5">
            <div><span className="text-xs text-[#747b70]">Precio distribuidor</span><p className="text-3xl font-semibold">S/ {product.wholesalePrice.toFixed(2)}</p></div>
            <span className="rounded-full bg-[#edf4e4] px-3 py-1.5 text-xs font-medium text-[#4c7629]">{product.stock > 0 ? `${product.stock} disponibles` : "Sin stock"}</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 py-6 text-sm">
            <div><dt className="text-[#838980]">Pedido mínimo</dt><dd className="mt-1 font-semibold">{product.minOrder} unidades</dd></div>
            <div><dt className="text-[#838980]">Caja cerrada</dt><dd className="mt-1 font-semibold">{product.unitsPerCase} unidades</dd></div>
            <div><dt className="text-[#838980]">Uso sugerido</dt><dd className="mt-1 font-semibold">{product.use}</dd></div>
            <div><dt className="text-[#838980]">Precio sugerido</dt><dd className="mt-1 font-semibold">S/ {product.retailPrice.toFixed(2)}</dd></div>
          </dl>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex h-12 items-center justify-between rounded-xl border border-[#dfe3da] px-2 sm:w-36">
              <button onClick={() => onQuantity(Math.max(product.minOrder, quantity - product.minOrder))} className="grid size-9 place-items-center" aria-label="Restar"><Minus size={16}/></button>
              <strong>{quantity}</strong>
              <button onClick={() => onQuantity(quantity + product.minOrder)} className="grid size-9 place-items-center" aria-label="Sumar"><Plus size={16}/></button>
            </div>
            <button disabled={!product.stock} onClick={onAdd} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#7CB342] px-5 text-sm font-semibold text-[#17230d] disabled:opacity-40"><ShoppingBag size={17}/>Agregar al pedido</button>
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-[#747b70]"><PackageCheck size={15}/>Precio y stock de demostración. Confirma disponibilidad con tu sede.</p>
        </div>
      </section>
    </div>
  );
}
