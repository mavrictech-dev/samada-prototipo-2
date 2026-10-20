import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { getMigrations } from "better-auth/db/migration";
import { db, transaction } from "../server/db";
import { auth } from "../server/auth";
import { seedState } from "../lib/seed";
import type { CmsState, Size } from "../lib/types";
import { permissionKeys } from "../lib/permissions";
import { normalizeSku } from "../lib/catalog";
import { saveProductTx } from "../server/catalog";

async function main() {
  await fs.mkdir('data/backups',{recursive:true});
  await db.query(await fs.readFile(path.join(process.cwd(),'server/schema.sql'),'utf8'));
  const migrations=await getMigrations(auth.options);
  await migrations.runMigrations();
  await transaction(async client=>{
    await client.query("SELECT pg_advisory_xact_lock(125901)");
    for(const key of permissionKeys)await client.query('INSERT INTO permissions(id,key,capability,name,system) VALUES($1,$1,$1,$1,true) ON CONFLICT(id) DO NOTHING',[key]);
    const roleDefs=[
      ['superadmin','Superadministrador','Administración completa',permissionKeys],
      ['admin','Administrador','Catálogo y gestión de usuarios',permissionKeys.filter(p=>!p.startsWith('roles.')&&!p.startsWith('permissions.'))],
      ['catalog-manager','Gestor de catálogo','Gestiona y publica el catálogo',permissionKeys.filter(p=>/^(products|taxonomy|pages|imports|media)\./.test(p))],
      ['operator','Operador de carga','Prepara productos e imágenes',permissionKeys.filter(p=>['products.read','products.create','products.update','taxonomy.read','imports.read','imports.template','imports.upload','imports.execute','imports.cancel','media.read','media.upload','media.link','media.replace'].includes(p))],
      ['reader','Consulta','Consulta y exporta', ['products.read','products.export','taxonomy.read','pages.read','imports.template']],
    ] as const;
    for(const [id,name,description,keys] of roleDefs) {
      const exists=await client.query('INSERT INTO roles(id,name,description,system) VALUES($1,$2,$3,true) ON CONFLICT(id) DO NOTHING RETURNING id',[id,name,description]);
      if(exists.rowCount)for(const key of keys)await client.query('INSERT INTO role_permissions(role_id,permission_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,key]);
    }
    const existing=await client.query("SELECT value FROM settings WHERE key='migration-v1'");
    if(existing.rowCount)return;
    let source:CmsState=structuredClone(seedState);
    try {
      const raw=await fs.readFile('data/cms-state.json','utf8');
      source=JSON.parse(raw);
      await fs.writeFile(`data/backups/cms-state-${Date.now()}.json`,raw,{flag:'wx'});
    } catch(error) { if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error; }
    await fs.writeFile(`data/backups/source-${Date.now()}.json`,JSON.stringify(source,null,2),{flag:'wx'});
    for(const resource of ['brands','categories'] as const)for(const [i,item] of source[resource].entries())await client.query(`INSERT INTO ${resource}(id,code,name,active,position) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING`,[item.id,item.code||item.id.toUpperCase(),item.name,item.active,i*10]);
    for(const [i,item] of source.subcategories.entries())await client.query('INSERT INTO subcategories(id,code,name,category_id,active,position) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING',[item.id,item.code||item.id.toUpperCase(),item.name,item.categoryId,item.active,i*10]);
    const sizes:Size[]=[{id:'sin-tamano',code:'SIN-TAMANO',name:'Sin tamaño',active:true,type:'text',position:999},...(source.sizes||[]).filter(s=>s.id!=='sin-tamano')];
    const prepared=source.products.map((p,i)=>{
      let sizeId=p.sizeId;
      if(!sizeId) {
        const m=p.presentation.match(/^(\d+(?:[.,]\d+)?)\s*(ml|kg|g|l)\b/i);
        if(m) {
          const value=Number(m[1].replace(',','.'));const unit=m[2].toLowerCase()==='l'?'L':m[2].toLowerCase();
          sizeId=`size-${value}-${unit.toLowerCase()}`;
          if(!sizes.some(s=>s.id===sizeId))sizes.push({id:sizeId,code:`${value}${unit}`.toUpperCase(),name:`${value} ${unit}`,active:true,type:['ml','L'].includes(unit)?'volume':'mass',value,unit,position:sizes.length*10});
        } else sizeId='sin-tamano';
      }
      const brand=source.brands.find(b=>b.id===p.brand||b.name===p.brand)?.id;
      const sub=source.subcategories.find(s=>s.id===p.subcategory||(s.name===p.subcategory&&s.categoryId===p.category))?.id;
      if(!brand)throw new Error(`Marca no reconocida para SKU ${p.sku}`);
      return {...p,sku:normalizeSku(p.sku),brand,subcategory:sub||'',sizeId,position:p.position??i*10,currency:p.currency||'PEN'};
    });
    const skuSet=new Set(prepared.map(p=>p.sku));if(skuSet.size!==prepared.length)throw new Error('Hay SKU duplicados. La migración se detuvo sin alterar el origen.');
    for(const size of sizes)await client.query('INSERT INTO sizes(id,code,name,type,value,unit,active,position) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING',[size.id,size.code||size.id.toUpperCase(),size.name,size.type,size.value??null,size.unit||null,size.active,size.position||0]);
    for(const brand of source.brands) {
      const items=prepared.filter(p=>p.brand===brand.id);
      const cats=brand.categoryIds||[...new Set(items.map(p=>p.category))];
      const subs=brand.subcategoryIds||source.subcategories.filter(s=>cats.includes(s.categoryId)).map(s=>s.id);
      for(const [table,column,ids] of [['brand_categories','category_id',cats],['brand_subcategories','subcategory_id',subs],['brand_sizes','size_id',brand.sizeIds||sizes.map(s=>s.id)]] as const)for(const id of ids)await client.query(`INSERT INTO ${table}(brand_id,${column}) VALUES($1,$2) ON CONFLICT DO NOTHING`,[brand.id,id]);
    }
    for(const p of prepared) {
      let migratedImage:Awaited<ReturnType<typeof import('../server/storage').storeImage>>|undefined;
      if(p.image.startsWith('data:image/')) {
        const {storeImage}=await import('../server/storage');
        const image=await storeImage(Buffer.from(p.image.split(',')[1],'base64'),p.sku);
        p.image=image.url;
        migratedImage=image;
      }
      await saveProductTx(client,p);
      if(migratedImage){const a=migratedImage;await client.query('INSERT INTO media_assets(id,sku,original_name,object_key,thumbnail_key,checksum,bytes,width,height,product_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[a.id,p.sku,`${p.sku}.webp`,a.key,a.thumbnailKey,a.checksum,a.bytes,a.width,a.height,p.id,'migration']);}
    }
    for(const page of source.pages) {
      const {productIds,...data}=page;
      await client.query('INSERT INTO pages(id,data) VALUES($1,$2) ON CONFLICT DO NOTHING',[page.id,JSON.stringify(data)]);
      for(const [i,id] of [...new Set(productIds)].entries())if(prepared.some(p=>p.id===id))await client.query('INSERT INTO page_products(page_id,product_id,position) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[page.id,id,i]);
    }
    await client.query("INSERT INTO settings(key,value) VALUES('branches',$1),('sort',$2),('migration-v1',$3) ON CONFLICT DO NOTHING",[JSON.stringify(source.branches),JSON.stringify(source.sort||'brand-category-size'),JSON.stringify({date:new Date().toISOString(),products:prepared.length})]);
  });
  console.log('Base de datos preparada. Origen respaldado en data/backups.');
}
main().then(()=>db.end()).catch(async error=>{console.error(error);await db.end();process.exitCode=1;});
