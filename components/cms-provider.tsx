"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { seedState } from "@/lib/seed";
import type { Brand, CatalogPage, Category, CmsState, Product, Subcategory } from "@/lib/types";

const STORAGE_KEY = "samada-commerce-cms-v3";

type CmsContextValue = {
  state: CmsState;
  ready: boolean;
  saveProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  savePage: (page: CatalogPage) => void;
  deletePage: (id: string) => void;
  setState: React.Dispatch<React.SetStateAction<CmsState>>;
  resetDemo: () => void;
};

const CmsContext = createContext<CmsContextValue | null>(null);

const slug = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function migrateState(value: Partial<CmsState>): CmsState {
  const oldProducts = Array.isArray(value.products) ? value.products : seedState.products;
  const categories: Category[] = Array.isArray(value.categories) ? value.categories : [...seedState.categories];
  const brands: Brand[] = Array.isArray(value.brands) ? value.brands : [...seedState.brands];
  const subcategories: Subcategory[] = Array.isArray(value.subcategories) ? value.subcategories : [...seedState.subcategories];

  oldProducts.forEach(product => {
    if (!categories.some(item => item.id === product.category || item.name.toLowerCase() === product.category.toLowerCase())) {
      categories.push({ id: slug(product.category) || `categoria-${categories.length + 1}`, name: product.category, active: true });
    }
    if (!brands.some(item => item.id === product.brand || item.name.toLowerCase() === product.brand.toLowerCase())) {
      brands.push({ id: slug(product.brand) || `marca-${brands.length + 1}`, name: product.brand, active: true });
    }
  });

  const products = oldProducts.map(product => {
    const category = categories.find(item => item.id === product.category || item.name.toLowerCase() === product.category.toLowerCase())?.id || categories[0]?.id || "general";
    let subcategory = subcategories.find(item => item.id === product.subcategory || (item.categoryId === category && item.name.toLowerCase() === product.subcategory.toLowerCase()))?.id;
    if (!subcategory) {
      subcategory = slug(`${category}-${product.subcategory}`) || `subcategoria-${subcategories.length + 1}`;
      subcategories.push({ id: subcategory, name: product.subcategory, categoryId: category, active: true });
    }
    const brand = brands.find(item => item.id === product.brand || item.name.toLowerCase() === product.brand.toLowerCase())?.id || brands[0]?.id || "samada";
    return { ...product, category, subcategory, brand };
  });

  return {
    products,
    pages: Array.isArray(value.pages) ? value.pages : seedState.pages,
    branches: Array.isArray(value.branches) ? value.branches : seedState.branches,
    categories,
    subcategories,
    brands,
    updatedAt: value.updatedAt || new Date().toISOString(),
  };
}

export function CmsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CmsState>(seedState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setState(migrateState(JSON.parse(stored) as Partial<CmsState>));
    } catch { /* Fall back to seed data. */ }
    setReady(true);

    fetch("/api/cms")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && Array.isArray(data.products)) {
          setState(migrateState(data));
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          } catch {}
        }
      })
      .catch(err => console.warn("Using offline state:", err));
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
    } catch {}

    const timer = setTimeout(() => {
      fetch("/api/cms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      }).catch(err => console.warn("Failed to sync to server:", err));
    }, 500);

    return () => clearTimeout(timer);
  }, [state, ready]);

  const saveProduct = useCallback((product: Product) => setState(current => ({
    ...current,
    products: current.products.some(item => item.id === product.id)
      ? current.products.map(item => item.id === product.id ? product : item)
      : [product, ...current.products],
  })), []);

  const deleteProduct = useCallback((id: string) => setState(current => ({
    ...current,
    products: current.products.filter(product => product.id !== id),
    pages: current.pages.map(page => ({ ...page, productIds: page.productIds.filter(productId => productId !== id) })),
  })), []);

  const savePage = useCallback((page: CatalogPage) => setState(current => ({
    ...current,
    pages: current.pages.some(item => item.id === page.id)
      ? current.pages.map(item => item.id === page.id ? page : item)
      : [...current.pages, page],
  })), []);

  const deletePage = useCallback((id: string) => setState(current => ({ ...current, pages: current.pages.filter(page => page.id !== id) })), []);
  const resetDemo = useCallback(() => setState({ ...seedState, updatedAt: new Date().toISOString() }), []);

  const value = useMemo(() => ({ state, ready, saveProduct, deleteProduct, savePage, deletePage, setState, resetDemo }), [state, ready, saveProduct, deleteProduct, savePage, deletePage, resetDemo]);
  return <CmsContext.Provider value={value}>{children}</CmsContext.Provider>;
}

export function useCms() {
  const value = useContext(CmsContext);
  if (!value) throw new Error("useCms must be used within CmsProvider");
  return value;
}
