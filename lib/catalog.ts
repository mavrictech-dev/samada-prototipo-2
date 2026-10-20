import type { CmsState, Product, CatalogSort, Size } from "./types";
export const normalizeSku = (sku: string) => sku.trim().toUpperCase();
export const normalizeText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function sizeValue(size: Size) {
  if(size.type === "volume") return (size.value || 0) * (size.unit === "L" ? 1000 : 1);
  if(size.type === "mass") return (size.value || 0) * (size.unit === "kg" ? 1000 : 1);
  return size.type === "count" ? size.value || 0 : size.position || 0;
}
export function sortProducts(products: Product[], state: CmsState, sort: CatalogSort = state.sort) {
  const brand = new Map(state.brands.map(item=>[item.id,item]));
  const category = new Map(state.categories.map(item=>[item.id,item]));
  const sizes = new Map(state.sizes.map(item=>[item.id,item]));
  const compareSize = (a:Product,b:Product) => {
    const x=sizes.get(a.sizeId||""), y=sizes.get(b.sizeId||"");
    if(!x||!y)return Number(!x)-Number(!y);
    const groups=["volume","mass","count","text"];
    return groups.indexOf(x.type)-groups.indexOf(y.type)||sizeValue(x)-sizeValue(y)||x.name.localeCompare(y.name,"es");
  };
  return [...products].sort((a,b)=>{
    if(sort==="manual")return (a.position||0)-(b.position||0)||a.sku.localeCompare(b.sku);
    if(sort==="name")return a.name.localeCompare(b.name,"es")||a.sku.localeCompare(b.sku);
    if(sort==="size")return compareSize(a,b)||a.sku.localeCompare(b.sku);
    const brandOrder=(brand.get(a.brand)?.position||0)-(brand.get(b.brand)?.position||0)||a.brand.localeCompare(b.brand);
    const categoryOrder=(category.get(a.category)?.position||0)-(category.get(b.category)?.position||0)||a.category.localeCompare(b.category);
    return brandOrder||(sort==="brand-size-category"?compareSize(a,b)||categoryOrder:categoryOrder||compareSize(a,b))||(a.position||0)-(b.position||0)||a.sku.localeCompare(b.sku);
  });
}
