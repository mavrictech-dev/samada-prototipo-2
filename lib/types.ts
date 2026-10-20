export type StockStatus = "available" | "low" | "out";

export interface CatalogEntity { id: string; code?: string; name: string; active: boolean; position?: number; version?: number; }
export type Category = CatalogEntity;
export interface Subcategory extends CatalogEntity { categoryId: string; }
export interface Brand extends CatalogEntity { categoryIds?: string[]; subcategoryIds?: string[]; sizeIds?: string[]; }
export interface Size extends CatalogEntity { type: "volume" | "mass" | "count" | "text"; value?: number; unit?: string; normalizedValue?: number; }
export type CatalogSort = "brand-category-size" | "brand-size-category" | "size" | "manual" | "name";

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
  sizeId?: string;
  groupCode?: string;
  currency?: string;
  position?: number;
  imageFile?: string;
  version?: number;
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
  automatic?: boolean;
  brandId?: string;
  categoryId?: string;
  sort?: CatalogSort;
  version?: number;
}

export interface Branch { id: string; name: string; phone: string; address: string; }

export interface CmsState {
  products: Product[];
  pages: CatalogPage[];
  branches: Branch[];
  categories: Category[];
  subcategories: Subcategory[];
  brands: Brand[];
  sizes: Size[];
  sort: CatalogSort;
  updatedAt: string;
}

export interface CurrentUser { id: string; name: string; email: string; permissions: string[]; roles: string[]; brandIds: string[] | null; }
