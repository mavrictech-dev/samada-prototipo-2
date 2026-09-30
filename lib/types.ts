export type StockStatus = "available" | "low" | "out";

export interface Category { id: string; name: string; active: boolean; }
export interface Subcategory { id: string; name: string; categoryId: string; active: boolean; }
export interface Brand { id: string; name: string; active: boolean; }

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  presentation: string;
  retailPrice: number;
  wholesalePrice: number;
  minOrder: number;
  unitsPerCase: number;
  stock: number;
  description: string;
  use: string;
  image: string;
  featured: boolean;
  active: boolean;
}

export interface CatalogPage {
  id: string;
  title: string;
  subtitle: string;
  slug: string;
  type: "products" | "editorial";
  theme: "sage" | "sand" | "lilac" | "white";
  productIds: string[];
  published: boolean;
}

export interface Branch { id: string; name: string; phone: string; address: string; }

export interface CmsState {
  products: Product[];
  pages: CatalogPage[];
  branches: Branch[];
  categories: Category[];
  subcategories: Subcategory[];
  brands: Brand[];
  updatedAt: string;
}
