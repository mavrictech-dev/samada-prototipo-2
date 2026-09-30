"use client";

import { Check, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { Brand, Category, CmsState, Subcategory } from "@/lib/types";

const slug = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function CollectionCard<T extends { id: string; name: string; active: boolean }>({ title, description, items, usage, onSave, onDelete }: {
  title: string;
  description: string;
  items: T[];
  usage: (id: string) => number;
  onSave: (item: T) => void;
  onDelete: (item: T) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [name, setName] = useState("");
  const commit = () => {
    const clean = name.trim();
    if (!clean) return;
    if (editing) onSave({ ...editing, name: clean });
    else onSave({ id: "", name: clean, active: true } as T);
    setEditing(null); setName(""); setCreating(false);
  };
  return <section className="rounded-2xl border border-[#dce0d8] bg-white">
    <div className="flex items-start justify-between border-b p-5"><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-[10px] text-[#747b70]">{description}</p></div><button onClick={() => { setCreating(true); setEditing(null); setName(""); }} className="grid size-9 place-items-center rounded-lg bg-[#edf3e6] text-[#558B2F]" aria-label={`Crear ${title.toLowerCase()}`}><Plus size={16}/></button></div>
    <div className="p-3">
      {creating && <div className="mb-2 flex gap-2 rounded-xl bg-[#f4f7f1] p-2"><input autoFocus value={name} onChange={event => setName(event.target.value)} onKeyDown={event => event.key === "Enter" && commit()} placeholder={`Nombre de ${title.toLowerCase()}`} className="h-9 min-w-0 flex-1 rounded-lg border bg-white px-3 text-xs outline-none"/><button onClick={commit} className="grid size-9 place-items-center rounded-lg bg-[#7CB342]" aria-label="Guardar"><Check size={15}/></button><button onClick={() => setCreating(false)} className="grid size-9 place-items-center" aria-label="Cancelar"><X size={15}/></button></div>}
      <div className="space-y-1">{items.map(item => editing?.id === item.id ? <div key={item.id} className="flex gap-2 rounded-xl bg-[#f4f7f1] p-2"><input autoFocus value={name} onChange={event => setName(event.target.value)} onKeyDown={event => event.key === "Enter" && commit()} className="h-9 min-w-0 flex-1 rounded-lg border bg-white px-3 text-xs outline-none"/><button onClick={commit} className="grid size-9 place-items-center rounded-lg bg-[#7CB342]" aria-label="Guardar"><Check size={15}/></button><button onClick={() => setEditing(null)} className="grid size-9 place-items-center" aria-label="Cancelar"><X size={15}/></button></div> :
        <div key={item.id} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-[#f6f8f4]"><button onClick={() => onSave({ ...item, active: !item.active })} className={`size-2.5 rounded-full ${item.active ? "bg-[#7CB342]" : "bg-[#c8cdc4]"}`} aria-label={item.active ? `Ocultar ${item.name}` : `Activar ${item.name}`}/><div className="min-w-0 flex-1"><b className="block truncate text-xs">{item.name}</b><small className="text-[9px] text-[#858c81]">{usage(item.id)} productos · {item.active ? "Activa" : "Oculta"}</small></div><button onClick={() => { setEditing(item); setName(item.name); setCreating(false); }} className="grid size-8 place-items-center rounded-lg hover:bg-white" aria-label={`Editar ${item.name}`}><Pencil size={14}/></button><button onClick={() => onDelete(item)} className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-red-50" aria-label={`Eliminar ${item.name}`}><Trash2 size={14}/></button></div>)}</div>
      {!items.length && <p className="p-8 text-center text-xs text-[#858c81]">Todavía no hay elementos.</p>}
    </div>
  </section>;
}

export function TaxonomyManager({ state, setState, toast }: { state: CmsState; setState: React.Dispatch<React.SetStateAction<CmsState>>; toast: (message: string) => void }) {
  const [subcategoryName, setSubcategoryName] = useState("");
  const [subcategoryCategory, setSubcategoryCategory] = useState(state.categories[0]?.id || "");
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);

  const saveCategory = (item: Category) => setState(current => ({ ...current, categories: current.categories.some(entry => entry.id === item.id) ? current.categories.map(entry => entry.id === item.id ? item : entry) : [...current.categories, item] }));
  const saveBrand = (item: Brand) => setState(current => ({ ...current, brands: current.brands.some(entry => entry.id === item.id) ? current.brands.map(entry => entry.id === item.id ? item : entry) : [...current.brands, item] }));
  const addCategory = (item: Category) => saveCategory({ ...item, id: item.id || `${slug(item.name)}-${Date.now()}` });
  const addBrand = (item: Brand) => saveBrand({ ...item, id: item.id || `${slug(item.name)}-${Date.now()}` });
  const guardedDelete = (kind: "category" | "brand", item: Category | Brand) => {
    const used = state.products.some(product => kind === "category" ? product.category === item.id : product.brand === item.id);
    if (used) return toast(`No se puede eliminar “${item.name}” porque tiene productos asignados.`);
    if (!confirm(`¿Eliminar ${item.name}?`)) return;
    setState(current => kind === "category" ? ({ ...current, categories: current.categories.filter(entry => entry.id !== item.id), subcategories: current.subcategories.filter(entry => entry.categoryId !== item.id) }) : ({ ...current, brands: current.brands.filter(entry => entry.id !== item.id) }));
    toast(`${kind === "category" ? "Categoría" : "Marca"} eliminada`);
  };
  const commitSubcategory = () => {
    const name = subcategoryName.trim();
    if (!name || !subcategoryCategory) return;
    const item: Subcategory = editingSubcategory ? { ...editingSubcategory, name, categoryId: subcategoryCategory } : { id: `${slug(name)}-${Date.now()}`, name, categoryId: subcategoryCategory, active: true };
    setState(current => ({ ...current, subcategories: current.subcategories.some(entry => entry.id === item.id) ? current.subcategories.map(entry => entry.id === item.id ? item : entry) : [...current.subcategories, item] }));
    setSubcategoryName(""); setEditingSubcategory(null);
  };
  const deleteSubcategory = (item: Subcategory) => {
    if (state.products.some(product => product.subcategory === item.id)) return toast(`No se puede eliminar “${item.name}” porque tiene productos asignados.`);
    if (!confirm(`¿Eliminar ${item.name}?`)) return;
    setState(current => ({ ...current, subcategories: current.subcategories.filter(entry => entry.id !== item.id) }));
    toast("Subcategoría eliminada");
  };

  return <><div><p className="text-xs text-[#747b70]">Clasificación central del catálogo</p><h2 className="mt-2 text-3xl font-medium tracking-[-.05em]">Categorías y marcas</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-[#747b70]">Los cambios aparecen en los filtros públicos y en el formulario de productos. Los elementos usados se protegen para evitar productos sin clasificación.</p></div>
    <div className="mt-6 grid gap-5 xl:grid-cols-2">
      <CollectionCard title="Categorías" description="Agrupaciones principales del catálogo" items={state.categories} usage={id => state.products.filter(product => product.category === id).length} onSave={item => addCategory(item)} onDelete={item => guardedDelete("category", item)}/>
      <CollectionCard title="Marcas" description="Marcas disponibles para productos y filtros" items={state.brands} usage={id => state.products.filter(product => product.brand === id).length} onSave={item => addBrand(item)} onDelete={item => guardedDelete("brand", item)}/>
    </div>
    <section className="mt-5 rounded-2xl border border-[#dce0d8] bg-white"><div className="flex items-start gap-3 border-b p-5"><span className="grid size-10 place-items-center rounded-xl bg-[#edf3e6] text-[#558B2F]"><Tags size={18}/></span><div><h3 className="font-semibold">Subcategorías</h3><p className="mt-1 text-[10px] text-[#747b70]">Cada subcategoría pertenece a una categoría principal.</p></div></div>
      <div className="grid gap-4 p-5 md:grid-cols-[1fr_1fr_auto]"><input value={subcategoryName} onChange={event => setSubcategoryName(event.target.value)} placeholder="Nombre de la subcategoría" className="h-11 rounded-xl border px-4 text-xs outline-none"/><select value={subcategoryCategory} onChange={event => setSubcategoryCategory(event.target.value)} className="h-11 rounded-xl border bg-white px-4 text-xs">{state.categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><div className="flex gap-2"><button onClick={commitSubcategory} className="flex h-11 items-center gap-2 rounded-xl bg-[#7CB342] px-5 text-xs font-semibold"><Plus size={15}/>{editingSubcategory ? "Guardar" : "Agregar"}</button>{editingSubcategory && <button onClick={() => { setEditingSubcategory(null); setSubcategoryName(""); }} className="grid size-11 place-items-center rounded-xl border" aria-label="Cancelar"><X size={15}/></button>}</div></div>
      <div className="grid gap-3 border-t p-5 sm:grid-cols-2 xl:grid-cols-3">{state.subcategories.map(item => { const category = state.categories.find(entry => entry.id === item.categoryId); const used = state.products.filter(product => product.subcategory === item.id).length; return <article key={item.id} className="flex items-center gap-3 rounded-xl border p-3"><button onClick={() => setState(current => ({ ...current, subcategories: current.subcategories.map(entry => entry.id === item.id ? { ...entry, active: !entry.active } : entry) }))} className={`size-2.5 rounded-full ${item.active ? "bg-[#7CB342]" : "bg-[#c8cdc4]"}`} aria-label="Cambiar estado"/><div className="min-w-0 flex-1"><b className="block truncate text-xs">{item.name}</b><small className="text-[9px] text-[#858c81]">{category?.name || "Sin categoría"} · {used} productos</small></div><button onClick={() => { setEditingSubcategory(item); setSubcategoryName(item.name); setSubcategoryCategory(item.categoryId); }} className="grid size-8 place-items-center"><Pencil size={14}/></button><button onClick={() => deleteSubcategory(item)} className="grid size-8 place-items-center text-red-600"><Trash2 size={14}/></button></article>; })}</div>
    </section>
  </>;
}
