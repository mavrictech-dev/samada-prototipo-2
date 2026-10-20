import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, transaction } from "./db";
import type { PoolClient, QueryResult } from "pg";
import type { Brand, CmsState, CurrentUser, Product, Size } from "@/lib/types";
import { allowedBrands, audit, permit } from "./access";
import { fail } from "./errors";
import { normalizeSku } from "@/lib/catalog";

const code=z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/,"Usa letras, números, puntos, guiones o guion bajo.");
const entitySchema=z.object({id:z.string().max(150).optional(),code,name:z.string().trim().min(1).max(200),active:z.boolean().default(true),position:z.number().int().nonnegative().default(0),version:z.number().int().optional()});
const productSchema=z.object({
  id:z.string().max(150).optional(),sku:code.transform(normalizeSku),name:z.string().trim().min(1).max(250),brand:z.string().min(1),category:z.string().min(1),subcategory:z.string().default(""),sizeId:z.string().min(1),
  wholesalePrice:z.number().nonnegative().multipleOf(.01).max(999999999999),retailPrice:z.number().nonnegative().multipleOf(.01).max(999999999999).default(0),stock:z.number().int().nonnegative().max(2147483647).default(0),
  minOrder:z.number().int().min(1).default(1),unitsPerCase:z.number().int().min(1).default(1),presentation:z.string().max(250).default(""),description:z.string().max(20000).default(""),use:z.string().max(5000).default(""),
  image:z.string().regex(/^\/(?:assets\/[\w./-]+|api\/media\/[\w./-]+)$/,"Selecciona o sube una imagen válida.").default("/assets/product-sage.svg"),
  imageFile:z.string().max(250).default(""),featured:z.boolean().default(false),active:z.boolean().default(false),position:z.number().int().nonnegative().default(0),groupCode:z.string().max(100).default(""),currency:z.enum(["PEN"]).default("PEN"),version:z.number().int().optional(),
});
export const sorts=["brand-category-size","brand-size-category","size","manual","name"] as const;
export function parsed<T>(schema:z.ZodType<T>,value:unknown):T {
  const r=schema.safeParse(value);
  if(!r.success)fail(r.error.issues.map(issue=>`${issue.path.join(".")}: ${issue.message}`).join("; "));
  return r.data;
}
export function toProduct(row:Record<string,unknown>):Product {
  return {...(row.data as object),id:row.id,sku:row.sku,name:row.name,brand:row.brand_id,category:row.category_id,subcategory:row.subcategory_id||"",sizeId:row.size_id,wholesalePrice:Number(row.wholesale_price),retailPrice:Number(row.retail_price||0),stock:row.stock,active:row.active,position:row.position,version:row.version} as Product;
}
type Queryable=Pick<PoolClient,"query">;
export async function loadState(user?:CurrentUser,client:Queryable=db):Promise<CmsState> {
  const queries=["SELECT * FROM brands ORDER BY position,name","SELECT * FROM categories ORDER BY position,name","SELECT * FROM subcategories ORDER BY position,name","SELECT * FROM sizes ORDER BY position,name","SELECT * FROM products ORDER BY position,sku","SELECT * FROM pages ORDER BY id","SELECT * FROM page_products ORDER BY position","SELECT * FROM settings","SELECT * FROM brand_categories","SELECT * FROM brand_subcategories","SELECT * FROM brand_sizes"];
  const results:QueryResult[]=client===db?await Promise.all(queries.map(q=>client.query(q))):[];
  if(client!==db)for(const q of queries)results.push(await client.query(q));
  const [brands,categories,subs,sizes,products,pages,items,settings,bc,bs,bz]=results;
  const props=(row:Record<string,unknown>)=>({id:String(row.id),code:String(row.code),name:String(row.name),active:Boolean(row.active),position:Number(row.position),version:Number(row.version)});
  const allBrands:Brand[]=brands.rows.map(r=>({...props(r),categoryIds:bc.rows.filter(i=>i.brand_id===r.id).map(i=>i.category_id),subcategoryIds:bs.rows.filter(i=>i.brand_id===r.id).map(i=>i.subcategory_id),sizeIds:bz.rows.filter(i=>i.brand_id===r.id).map(i=>i.size_id)}));
  const settingsMap=new Map(settings.rows.map(r=>[r.key,r.value]));
  const brandScope=user?await allowedBrands(user,"products.read"):null;
  const pageAccess=user?.permissions.includes("pages.read");
  const productList=products.rows.map(toProduct).filter(p=>user ? user.permissions.includes("products.read")&&(brandScope===null||brandScope.includes(p.brand)) : p.active&&allBrands.some(b=>b.id===p.brand&&b.active)&&categories.rows.some(c=>c.id===p.category&&c.active)&&sizes.rows.some(s=>s.id===p.sizeId&&s.active)&&(!p.subcategory||subs.rows.some(s=>s.id===p.subcategory&&s.active)));
  const ids=new Set(productList.map(p=>p.id));
  return {
    brands:allBrands.filter(b=>user||b.active),categories:categories.rows.map(props).filter(c=>user||c.active),subcategories:subs.rows.map(r=>({...props(r),categoryId:r.category_id})).filter(s=>user||s.active),
    sizes:sizes.rows.map(r=>({...props(r),type:r.type,value:r.value===null?undefined:Number(r.value),unit:r.unit||""} as Size)).filter(s=>user||s.active),
    products:productList,
    pages:pages.rows.map(r=>({...r.data,id:r.id,version:r.version,productIds:items.rows.filter(i=>i.page_id===r.id&&ids.has(i.product_id)).map(i=>i.product_id)})).filter(p=>user?pageAccess:p.published),
    branches:settingsMap.get("branches")||[],sort:settingsMap.get("sort")||"brand-category-size",updatedAt:new Date().toISOString(),
  };
}
export async function validateProduct(input:unknown,state:CmsState):Promise<Product> {
  const p=parsed(productSchema,input);
  const brand=state.brands.find(b=>b.id===p.brand&&b.active);
  if(!brand)fail("La marca no existe o está inactiva.");
  if(!state.categories.some(c=>c.id===p.category&&c.active)||!brand.categoryIds?.includes(p.category))fail("La categoría no está habilitada para esta marca.");
  if(p.subcategory&&(!state.subcategories.some(s=>s.id===p.subcategory&&s.categoryId===p.category&&s.active)||!brand.subcategoryIds?.includes(p.subcategory)))fail("La subcategoría no está habilitada para esta marca y categoría.");
  if(!state.sizes.some(s=>s.id===p.sizeId&&s.active)||!brand.sizeIds?.includes(p.sizeId))fail("El tamaño no está habilitado para esta marca.");
  return {...p,id:p.id||randomUUID()};
}
export async function saveProductTx(client:PoolClient,product:Product,expectedVersion?:number) {
  const old=await client.query("SELECT version FROM products WHERE id=$1 FOR UPDATE",[product.id]);
  if(old.rows.length&&expectedVersion!==old.rows[0].version)fail("El producto cambió desde que lo abriste. Recarga y vuelve a revisar.",409);
  if(!old.rows.length&&expectedVersion)fail("El producto fue eliminado.",409);
  const {id,sku,name,brand,category,subcategory,sizeId,wholesalePrice,retailPrice,stock,active,position,version:unusedVersion,...data}=product;
  void unusedVersion;
  await client.query(`INSERT INTO products(id,sku,name,brand_id,category_id,subcategory_id,size_id,wholesale_price,retail_price,stock,active,position,data) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    ON CONFLICT(id) DO UPDATE SET sku=excluded.sku,name=excluded.name,brand_id=excluded.brand_id,category_id=excluded.category_id,subcategory_id=excluded.subcategory_id,size_id=excluded.size_id,wholesale_price=excluded.wholesale_price,retail_price=excluded.retail_price,stock=excluded.stock,active=excluded.active,position=excluded.position,data=excluded.data,version=products.version+1,updated_at=now()`,[id,sku,name,brand,category,subcategory||null,sizeId,wholesalePrice,retailPrice,stock,active,position||0,JSON.stringify(data)]);
}
export async function validateProductRelations(client:PoolClient,p:Product){
  const r=await client.query(`SELECT 1 FROM brands b JOIN brand_categories bc ON bc.brand_id=b.id AND bc.category_id=$2 JOIN categories c ON c.id=bc.category_id JOIN brand_sizes bs ON bs.brand_id=b.id AND bs.size_id=$3 JOIN sizes s ON s.id=bs.size_id WHERE b.id=$1 AND b.active AND c.active AND s.active AND ($4::text='' OR EXISTS(SELECT 1 FROM brand_subcategories bsc JOIN subcategories sc ON sc.id=bsc.subcategory_id WHERE bsc.brand_id=b.id AND sc.id=$4 AND sc.category_id=c.id AND sc.active))`,[p.brand,p.category,p.sizeId,p.subcategory]);
  if(!r.rowCount)fail('La marca, categoría o tamaño cambió. Revisa la clasificación antes de guardar.',409);
}
export async function saveProduct(user:CurrentUser,input:unknown) {
  return transaction(async client=>{
    await client.query("SELECT pg_advisory_xact_lock(125901)");
    const state=await loadState({...user,permissions:[...user.permissions,"products.read"]},client);
    // All taxonomy is available; existing product lookup is independent from a read permission.
    const raw=input as Product;
    const oldResult=raw.id?await client.query("SELECT * FROM products WHERE id=$1",[raw.id]):null;
    const old=oldResult?.rows[0]?toProduct(oldResult.rows[0]):undefined;
    if(old)await permit(user,"products.update",old.brand);
    const p=await validateProduct(input,state);
    await permit(user,old?"products.update":"products.create",p.brand);
    if(p.active!==Boolean(old?.active))await permit(user,"products.publish",p.brand);
    if(p.image.startsWith('/api/media/')&&p.image!==old?.image){
      await permit(user,'media.link',p.brand);
      const asset=(await client.query('SELECT * FROM media_assets WHERE object_key=$1',[p.image.replace('/api/media/','')])).rows[0];
      if(!asset||asset.created_by!==user.id||(asset.product_id&&asset.product_id!==p.id))fail('La imagen no está disponible para este producto.');
    }
    await saveProductTx(client,p,raw.version);
    if(p.image.startsWith('/api/media/'))await client.query('UPDATE media_assets SET product_id=$1 WHERE object_key=$2',[p.id,p.image.replace('/api/media/','')]);
    await client.query("INSERT INTO audit_log(user_id,action,entity_id) VALUES($1,$2,$3)",[user.id,old?"products.update":"products.create",p.id]);
    return p.id;
  });
}
export const taxonomyResources=["brands","categories","subcategories","sizes"] as const;
export type TaxonomyResource=typeof taxonomyResources[number];
export async function saveTaxonomy(user:CurrentUser,resource:TaxonomyResource,input:unknown) {
  if(await allowedBrands(user,`taxonomy.${(input as {id?:string}).id?"update":"create"}`)!==null)fail("La clasificación compartida requiere permiso sin restricción de marca.",403);
  const base=parsed(entitySchema,input), id=base.id||randomUUID();
  return transaction(async client=>{
    await client.query("SELECT pg_advisory_xact_lock(125901)");
    const previous=await client.query(`SELECT * FROM ${resource} WHERE id=$1 FOR UPDATE`,[id]);
    if(previous.rows[0]&&base.version!==previous.rows[0].version)fail("Este registro cambió. Recarga antes de guardar.",409);
    if(resource==="subcategories") {
      const s=parsed(entitySchema.extend({categoryId:z.string().min(1)}),input);
      if(previous.rows[0]&&s.categoryId!==previous.rows[0].category_id) {
        const used=await client.query("SELECT 1 FROM products WHERE subcategory_id=$1 LIMIT 1",[id]);if(used.rowCount)fail("Reasigna los productos antes de cambiar la categoría padre.",409);
      }
      await client.query("INSERT INTO subcategories(id,code,name,category_id,active,position) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,category_id=excluded.category_id,active=excluded.active,position=excluded.position,version=subcategories.version+1",[id,s.code.toUpperCase(),s.name,s.categoryId,s.active,s.position]);
    } else if(resource==="sizes") {
      const s=parsed(entitySchema.extend({type:z.enum(["volume","mass","count","text"]),value:z.number().nonnegative().optional(),unit:z.string().optional()}),input);
      if(s.type!=="text"&&(s.value===undefined||s.value<=0))fail("El tamaño necesita un valor mayor a cero.");
      if(s.type==="volume"&&!["ml","L"].includes(s.unit||""))fail("Elige ml o L para volumen.");
      if(s.type==="mass"&&!["g","kg"].includes(s.unit||""))fail("Elige g o kg para masa.");
      await client.query("INSERT INTO sizes(id,code,name,type,value,unit,active,position) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,type=excluded.type,value=excluded.value,unit=excluded.unit,active=excluded.active,position=excluded.position,version=sizes.version+1",[id,s.code.toUpperCase(),s.name,s.type,s.value??null,s.unit||null,s.active,s.position]);
    } else {
      await client.query(`INSERT INTO ${resource}(id,code,name,active,position) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,active=excluded.active,position=excluded.position,version=${resource}.version+1`,[id,base.code.toUpperCase(),base.name,base.active,base.position]);
    }
    if(resource==="brands") {
      const b=parsed(entitySchema.extend({categoryIds:z.array(z.string()),subcategoryIds:z.array(z.string()),sizeIds:z.array(z.string())}),input);
      const used=await client.query("SELECT category_id,subcategory_id,size_id FROM products WHERE brand_id=$1",[id]);
      if(used.rows.some(p=>!b.categoryIds.includes(p.category_id)||(p.subcategory_id&&!b.subcategoryIds.includes(p.subcategory_id))||!b.sizeIds.includes(p.size_id)))fail("Hay productos que usan relaciones que intentas quitar. Reasígnalos primero.",409);
      const sub=await client.query("SELECT id,category_id FROM subcategories WHERE id=ANY($1::text[])",[b.subcategoryIds]);
      if(sub.rows.some(s=>!b.categoryIds.includes(s.category_id)))fail("Las subcategorías deben pertenecer a categorías habilitadas.");
      for(const [table,field,ids] of [["brand_categories","category_id",b.categoryIds],["brand_subcategories","subcategory_id",b.subcategoryIds],["brand_sizes","size_id",b.sizeIds]] as const) {
        await client.query(`DELETE FROM ${table} WHERE brand_id=$1`,[id]);
        for(const key of new Set(ids))await client.query(`INSERT INTO ${table}(brand_id,${field}) VALUES($1,$2)`,[id,key]);
      }
    }
    await client.query("INSERT INTO audit_log(user_id,action,entity_id) VALUES($1,$2,$3)",[user.id,`${resource}.save`,id]);
    return id;
  });
}
export async function savePage(user:CurrentUser,input:unknown) {
  const page=parsed(z.object({id:z.string().optional(),title:z.string().trim().min(1).max(200),subtitle:z.string().max(1000),slug:code,type:z.enum(["products","editorial"]),theme:z.enum(["sage","sand","lilac","white"]),productIds:z.array(z.string()).max(10000),published:z.boolean(),automatic:z.boolean().default(false),brandId:z.string().default(""),categoryId:z.string().default(""),sort:z.enum(sorts).default("brand-category-size"),version:z.number().int().optional()}),input);
  const id=page.id||randomUUID();
  await permit(user,page.id?"pages.update":"pages.create");
  if(await allowedBrands(user,page.id?"pages.update":"pages.create")!==null)fail("La distribución requiere permiso global.",403);
  await transaction(async client=>{
    const old=await client.query("SELECT * FROM pages WHERE id=$1 FOR UPDATE",[id]);
    if(old.rows[0]&&page.version!==old.rows[0].version)fail("La página cambió. Recarga antes de guardar.",409);
    if(page.published!==Boolean(old.rows[0]?.data.published))await permit(user,"pages.publish");
    const {productIds,version,...data}=page;void version;
    await client.query("INSERT INTO pages(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=pages.version+1",[id,JSON.stringify(data)]);
    await client.query("DELETE FROM page_products WHERE page_id=$1",[id]);
    for(const [i,pid] of [...new Set(productIds)].entries())await client.query("INSERT INTO page_products(page_id,product_id,position) VALUES($1,$2,$3)",[id,pid,i]);
  });
  await audit(user.id,"pages.save",id);
  return id;
}
export async function deleteCatalog(user:CurrentUser,resource:string,id:string) {
  if(resource==="products") {
    const r=await db.query("SELECT brand_id,active FROM products WHERE id=$1",[id]);if(!r.rows[0])fail("Producto no encontrado.",404);
    await permit(user,"products.delete",r.rows[0].brand_id);
    if(r.rows[0].active)await permit(user,"products.publish",r.rows[0].brand_id);
  } else {
    const p=resource==="pages"?"pages.delete":"taxonomy.delete";await permit(user,p);
    if(await allowedBrands(user,p)!==null)fail("Se requiere permiso global.",403);
  }
  if(!["products","pages",...taxonomyResources].includes(resource))fail("Recurso no válido.",404);
  await db.query(`DELETE FROM ${resource} WHERE id=$1`,[id]);await audit(user.id,`${resource}.delete`,id);
}
