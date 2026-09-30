"use client";

import { ImagePlus, Save, Upload, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Brand, Category, Product, Subcategory } from "@/lib/types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[10px] font-semibold text-[#6f766b]">{label}<span className="mt-2 block [&>input]:h-11 [&>input]:w-full [&>input]:rounded-lg [&>input]:border [&>input]:border-[#d9ddd5] [&>input]:bg-white [&>input]:px-3 [&>input]:text-xs [&>input]:font-normal [&>input]:text-[#20231e] [&>input]:outline-none [&>input]:focus:border-[#7CB342] [&>select]:h-11 [&>select]:w-full [&>select]:rounded-lg [&>select]:border [&>select]:border-[#d9ddd5] [&>select]:bg-white [&>select]:px-3 [&>select]:text-xs [&>select]:font-normal [&>textarea]:min-h-24 [&>textarea]:w-full [&>textarea]:rounded-lg [&>textarea]:border [&>textarea]:border-[#d9ddd5] [&>textarea]:p-3 [&>textarea]:text-xs [&>textarea]:font-normal">{children}</span></label>;
}

async function fileToWebp(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Selecciona un archivo de imagen.");
  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("No se pudo leer la imagen."));
      element.src = source;
    });
    const maxSide = 1400;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("El navegador no pudo procesar la imagen.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", .86);
  } finally {
    URL.revokeObjectURL(source);
  }
}

export function ProductEditor({ initial, categories, subcategories, brands, onClose, onSave }: {
  initial: Product;
  categories: Category[];
  subcategories: Subcategory[];
  brands: Brand[];
  onClose: () => void;
  onSave: (product: Product) => void;
}) {
  const [form, setForm] = useState(initial);
  const [imageStatus, setImageStatus] = useState("");
  const update = <K extends keyof Product>(key: K, value: Product[K]) => setForm(current => ({ ...current, [key]: value }));
  const availableSubcategories = useMemo(() => subcategories.filter(item => item.categoryId === form.category && item.active), [subcategories, form.category]);

  const upload = async (file?: File) => {
    if (!file) return;
    setImageStatus("Convirtiendo a WebP…");
    try {
      const image = await fileToWebp(file);
      update("image", image);
      setImageStatus(`WebP listo · ${Math.round(image.length * .75 / 1024)} KB aprox.`);
    } catch (error) {
      setImageStatus(error instanceof Error ? error.message : "No se pudo procesar la imagen.");
    }
  };

  return <div className="fixed inset-0 z-[100] grid place-items-center bg-[#172014]/60 p-4 backdrop-blur-sm">
    <form onSubmit={event => { event.preventDefault(); onSave(form); }} className="max-h-[94vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-5">
        <div><h2 className="text-xl font-semibold">{initial.name ? "Editar producto" : "Nuevo producto"}</h2><p className="mt-1 text-[10px] text-[#747b70]">Información comercial, clasificación e imagen optimizada</p></div>
        <button type="button" onClick={onClose} aria-label="Cerrar editor"><X size={19}/></button>
      </div>
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_280px]">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Nombre del producto"><input required value={form.name} onChange={event => update("name", event.target.value)}/></Field>
          <Field label="SKU"><input required value={form.sku} onChange={event => update("sku", event.target.value)}/></Field>
          <Field label="Categoría"><select required value={form.category} onChange={event => { const category = event.target.value; const first = subcategories.find(item => item.categoryId === category && item.active); setForm(current => ({ ...current, category, subcategory: first?.id || "" })); }}>{categories.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Subcategoría"><select required value={form.subcategory} onChange={event => update("subcategory", event.target.value)}><option value="">Selecciona una subcategoría</option>{availableSubcategories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Marca"><select required value={form.brand} onChange={event => update("brand", event.target.value)}><option value="">Selecciona una marca</option>{brands.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Presentación"><input value={form.presentation} onChange={event => update("presentation", event.target.value)}/></Field>
          <Field label="Precio distribuidor"><input type="number" min="0" step=".01" value={form.wholesalePrice} onChange={event => update("wholesalePrice", Number(event.target.value))}/></Field>
          <Field label="Precio sugerido"><input type="number" min="0" step=".01" value={form.retailPrice} onChange={event => update("retailPrice", Number(event.target.value))}/></Field>
          <Field label="Pedido mínimo"><input type="number" min="1" value={form.minOrder} onChange={event => update("minOrder", Number(event.target.value))}/></Field>
          <Field label="Unidades por caja"><input type="number" min="1" value={form.unitsPerCase} onChange={event => update("unitsPerCase", Number(event.target.value))}/></Field>
          <Field label="Stock disponible"><input type="number" min="0" value={form.stock} onChange={event => update("stock", Number(event.target.value))}/></Field>
          <Field label="Uso sugerido"><input value={form.use} onChange={event => update("use", event.target.value)}/></Field>
          <div className="md:col-span-2"><Field label="Descripción"><textarea value={form.description} onChange={event => update("description", event.target.value)}/></Field></div>
          <div className="flex items-center gap-5 text-xs md:col-span-2"><label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={event => update("active", event.target.checked)} className="accent-[#558B2F]"/>Publicado</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.featured} onChange={event => update("featured", event.target.checked)} className="accent-[#558B2F]"/>Destacado</label></div>
        </div>
        <aside className="rounded-2xl border border-[#dce0d8] bg-[#f6f8f3] p-4">
          <div className="grid aspect-square place-items-center overflow-hidden rounded-xl border border-dashed border-[#bdc7b5] bg-white"><img src={form.image} alt="Vista previa del producto" className="h-full w-full object-contain p-4"/></div>
          <h3 className="mt-4 flex items-center gap-2 text-sm font-semibold"><ImagePlus size={16}/>Imagen del producto</h3>
          <p className="mt-2 text-[10px] leading-4 text-[#70776d]">Admite PNG, JPG, AVIF o WebP. Se ajusta a un máximo de 1400 px y se guarda automáticamente en WebP.</p>
          <label className="mt-4 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#283021] text-xs font-semibold text-white"><Upload size={15}/>Subir y convertir<input type="file" accept="image/*" className="sr-only" onChange={event => upload(event.target.files?.[0])}/></label>
          {imageStatus && <p className="mt-3 text-center text-[10px] text-[#558B2F]">{imageStatus}</p>}
          <p className="my-4 text-center text-[9px] text-[#8a9186]">o usa una imagen de demostración</p>
          <select value={form.image.startsWith("/assets/") ? form.image : ""} onChange={event => event.target.value && update("image", event.target.value)} className="h-10 w-full rounded-lg border bg-white px-3 text-xs"><option value="">Imagen cargada</option>{["sage","cream","jar","amber","lilac","tube"].map(item => <option key={item} value={`/assets/product-${item}.svg`}>{item}</option>)}</select>
        </aside>
      </div>
      <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-white px-6 py-4"><button type="button" onClick={onClose} className="h-11 rounded-xl border px-5 text-xs font-semibold">Cancelar</button><button type="submit" className="flex h-11 items-center gap-2 rounded-xl bg-[#7CB342] px-5 text-xs font-semibold"><Save size={15}/>Guardar producto</button></div>
    </form>
  </div>;
}
