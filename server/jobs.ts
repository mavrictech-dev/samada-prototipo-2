import { PgBoss } from "pg-boss";
import { randomUUID } from "node:crypto";
import { db,transaction } from "./db";
import { allowedBrands,audit,permit,userAccess } from "./access";
import { loadState,saveProductTx,toProduct,validateProduct,validateProductRelations } from "./catalog";
import { getObject,putObject,storeImage,validateImage } from "./storage";
import { fail } from "./errors";
import type { CurrentUser,Product } from "@/lib/types";
import { normalizeSku } from "@/lib/catalog";

const globalQueue=globalThis as unknown as {samadaBoss?:Promise<PgBoss>};
export function queue(){return globalQueue.samadaBoss ||= (async()=>{const boss=new PgBoss({connectionString:process.env.DATABASE_URL,max:3});boss.on('error',error=>console.error('Queue:',error.message));await boss.start();await boss.createQueue('samada-process',{retryLimit:3,retryDelay:10,expireInSeconds:3600});return boss;})();}
export async function jobAccess(user:CurrentUser,id:string){
  const r=await db.query('SELECT * FROM import_jobs WHERE id=$1',[id]);const job=r.rows[0];if(!job)fail('Trabajo no encontrado.',404);
  const permission=job.kind==='media'?'media.read':'imports.read';await permit(user,permission);
  if(job.user_id!==user.id&&await allowedBrands(user,permission)!==null)fail('No tienes acceso a este trabajo.',403);
  return job;
}
export async function createMediaJob(user:CurrentUser,filename:string){
  await permit(user,'media.upload');const id=randomUUID();await db.query("INSERT INTO import_jobs(id,user_id,kind,filename,status) VALUES($1,$2,'media',$3,'uploading')",[id,user.id,filename.slice(0,250)]);return id;
}
export async function addMedia(user:CurrentUser,id:string,files:File[]){
  const job=await jobAccess(user,id);await permit(user,'media.upload');
  if(job.status!=='uploading')fail('Esta carga ya terminó su recepción.',409);if(files.length>10)fail('Carga hasta 10 archivos por solicitud.');
  const entries:Array<{assetId:string;key:string;filename:string;errors:string[]}>=[];
  for(const file of files){
    const assetId=randomUUID();const key=`staging/${id}/${assetId}`;
    const filename=file.name.split(/[\\/]/).pop()||'';
    let errors:string[]=[];
    try {if(file.size>20*1024*1024)fail('La imagen supera 20 MB.');const buffer=Buffer.from(await file.arrayBuffer());await validateImage(buffer);await putObject(key,buffer,'application/octet-stream');}catch(error){errors=[error instanceof Error?error.message:'Imagen inválida.'];}
    entries.push({assetId,key,filename,errors});
  }
  await transaction(async client=>{
    const locked=await client.query('SELECT status,total FROM import_jobs WHERE id=$1 FOR UPDATE',[id]);if(locked.rows[0].status!=='uploading')fail('La recepción terminó.',409);
    let number=locked.rows[0].total;if(number+entries.length>10000)fail('Máximo 10.000 imágenes por lote.');
    for(const entry of entries)await client.query('INSERT INTO import_rows(job_id,row_number,status,data,errors) VALUES($1,$2,$3,$4,$5)',[id,++number,entry.errors.length?'invalid':'uploaded',JSON.stringify(entry),JSON.stringify(entry.errors)]);
    await client.query('UPDATE import_jobs SET total=$2,updated_at=now() WHERE id=$1',[id,number]);
  });
}
export async function planMedia(user:CurrentUser,id:string){
  const job=await jobAccess(user,id);if(!['uploading','preview','partial','failed'].includes(job.status))fail('El trabajo ya se está procesando.',409);
  const state=await loadState(user);const rows=(await db.query('SELECT * FROM import_rows WHERE job_id=$1 ORDER BY row_number',[id])).rows;
  const plans=rows.map(row=>{
    if(row.status==='completed')return row;
    if(row.data.errors?.length)return {...row,status:'invalid',errors:row.data.errors};
    const data=row.data;const base=normalizeSku(data.filename.replace(/\.[^.]+$/,''));const gallery=base.match(/^(.*)__(\d{2})$/);
    let position=gallery?Number(gallery[2]):0;
    const sku=gallery?gallery[1]:base;
    const candidates=data.manualProductId?state.products.filter(p=>p.id===data.manualProductId):state.products.filter(p=>p.imageFile?p.imageFile===data.filename:p.sku===sku);
    if(data.manualPosition!==undefined)position=data.manualPosition;
    const product=candidates.length===1?candidates[0]:null;
    const errors=product?[]:[candidates.length>1?'El archivo coincide con varios productos.':'No hay producto para este SKU o nombre de archivo. Asigna el producto manualmente.'];
    return {...row,data:{...data,productId:product?.id,version:product?.version,brandId:product?.brand,position,replace:position===0&&!!product?.image?.startsWith('/api/media/')},sku:product?.sku||sku,status:errors.length?'invalid':'valid',errors};
  });
  const counts=new Map<string,number>();for(const row of plans)if(row.data.productId){const key=`${row.data.productId}:${row.data.position}`;counts.set(key,(counts.get(key)||0)+1);}
  await transaction(async client=>{
    const locked=await client.query('SELECT status FROM import_jobs WHERE id=$1 FOR UPDATE',[id]);if(!['uploading','preview','partial','failed'].includes(locked.rows[0].status))fail('El trabajo cambió.',409);
    for(const row of plans){if(row.status==='completed')continue;if(row.data.productId&&(counts.get(`${row.data.productId}:${row.data.position}`)||0)>1){row.status='invalid';row.errors.push('Hay más de una imagen para este producto y posición.');}await client.query('UPDATE import_rows SET sku=$3,data=$4,status=$5,errors=$6 WHERE job_id=$1 AND row_number=$2',[id,row.row_number,row.sku,JSON.stringify(row.data),row.status,JSON.stringify(row.errors)]);}
    await client.query("UPDATE import_jobs SET status='preview',errors=$2,updated_at=now() WHERE id=$1",[id,plans.filter(r=>r.status==='invalid').length]);
  });
}
export async function recheckJob(user:CurrentUser,id:string){
  const job=await jobAccess(user,id);if(!['preview','partial','failed'].includes(job.status))fail('Espera a que termine el procesamiento.',409);
  if(job.kind==='media')return planMedia(user,id);
  await permit(user,'imports.execute');const state=await loadState(user);
  const rows=(await db.query("SELECT * FROM import_rows WHERE job_id=$1 AND status<>'completed' ORDER BY row_number",[id])).rows;
  const duplicates=new Set((await db.query('SELECT sku FROM import_rows WHERE job_id=$1 GROUP BY sku HAVING count(*)>1',[id])).rows.map(r=>r.sku));
  await transaction(async client=>{
    const lock=await client.query('SELECT status FROM import_jobs WHERE id=$1 FOR UPDATE',[id]);if(!['preview','partial','failed'].includes(lock.rows[0].status))fail('El trabajo cambió.',409);
    for(const row of rows){
      const errors:string[]=[];const p:Product=row.data.product;const current=state.products.find(item=>item.sku===row.sku);
      if(duplicates.has(row.sku))errors.push('SKU duplicado en el archivo. Corrige el archivo y vuelve a cargarlo.');
      if(row.status==='invalid')errors.push(...row.errors);
      if(job.mode==='create'&&current)errors.push('El SKU ya existe. Usa una nueva importación para actualizarlo.');
      if(job.mode==='update'&&!current)errors.push('El SKU no existe o no es accesible.');
      if(current)await permit(user,'products.update',current.brand);
      try{await validateProduct(p,state);await permit(user,current?'products.update':'products.create',p.brand);if(p.active!==Boolean(current?.active))await permit(user,'products.publish',p.brand);}catch(error){errors.push((error as Error).message);}
      const data={...row.data,product:{...p,id:current?.id||p.id},version:current?.version,action:current?'update':'create'};
      await client.query('UPDATE import_rows SET status=$3,errors=$4,data=$5 WHERE job_id=$1 AND row_number=$2',[id,row.row_number,errors.length?'invalid':'valid',JSON.stringify([...new Set(errors)]),JSON.stringify(data)]);
    }
    await client.query("UPDATE import_jobs SET status='preview',errors=(SELECT count(*) FROM import_rows WHERE job_id=$1 AND status IN ('invalid','error')),updated_at=now() WHERE id=$1",[id]);
  });
}
export async function executeJob(user:CurrentUser,id:string,skipInvalid:boolean,replace:boolean){
  const job=await jobAccess(user,id);await permit(user,job.kind==='media'?'media.link':'imports.execute');
  if(!['preview','failed'].includes(job.status))fail('Este trabajo no está disponible para ejecutar.',409);
  if(job.errors&&!skipInvalid)fail('Corrige los errores o elige explícitamente procesar solo las filas válidas.');
  if(job.kind==='media'){
    const replacements=await db.query("SELECT 1 FROM import_rows WHERE job_id=$1 AND status='valid' AND data->>'replace'='true' LIMIT 1",[id]);
    if(replacements.rowCount&&!replace)fail('Confirma que deseas reemplazar las imágenes existentes.');
    if(replacements.rowCount)await permit(user,'media.replace');
  }
  const changed=await db.query("UPDATE import_jobs SET status='queued',data=(data-'error')||$2::jsonb,updated_at=now() WHERE id=$1 AND status=ANY($3::text[]) RETURNING id",[id,JSON.stringify({skipInvalid,replace,executor:user.id}),['preview','failed']]);
  if(!changed.rowCount)fail('Este trabajo ya fue enviado.',409);
  try{await (await queue()).send('samada-process',{id},{singletonKey:id});}catch(error){await db.query("UPDATE import_jobs SET status='failed' WHERE id=$1",[id]);throw error;}
  await audit(user.id,'jobs.execute',id);
}
export async function processJob(id:string){
  const info=(await db.query('SELECT * FROM import_jobs WHERE id=$1',[id])).rows[0];if(!info||!['queued','running','failed'].includes(info.status))return;
  const actor=await userAccess(info.data.executor||info.user_id);
  await permit(actor,info.kind==='media'?'media.link':'imports.execute');
  await db.query("UPDATE import_jobs SET status='running',updated_at=now() WHERE id=$1 AND status<>'cancelled'",[id]);
  const state=await loadState(actor);
  const rows=(await db.query("SELECT * FROM import_rows WHERE job_id=$1 AND status='valid' ORDER BY row_number",[id])).rows;
  for(const row of rows){
    row.data=(await db.query('SELECT data FROM import_rows WHERE job_id=$1 AND row_number=$2',[id,row.row_number])).rows[0].data;
    const current=(await db.query('SELECT status FROM import_jobs WHERE id=$1',[id])).rows[0];if(current?.status==='cancelled')return;
    try {
      const user=await userAccess(actor.id);
      await permit(user,info.kind==='media'?'media.link':'imports.execute');
      if(info.kind==='products'){
        const p:Product=await validateProduct(row.data.product,state);
        await permit(user,row.data.action==='create'?'products.create':'products.update',p.brand);
        const before=(await db.query('SELECT active,brand_id FROM products WHERE id=$1',[p.id])).rows[0];
        if(before)await permit(user,'products.update',before.brand_id);
        if(p.active!==Boolean(before?.active))await permit(user,'products.publish',p.brand);
        await transaction(async client=>{
          const job=await client.query('SELECT status FROM import_jobs WHERE id=$1 FOR UPDATE',[id]);if(job.rows[0].status==='cancelled')return;
          await client.query("SELECT pg_advisory_xact_lock(125901)");
          await validateProductRelations(client,p);
          await saveProductTx(client,p,row.data.version);
          await client.query("UPDATE import_rows SET status='completed' WHERE job_id=$1 AND row_number=$2",[id,row.row_number]);
          await client.query("INSERT INTO audit_log(user_id,action,entity_id,detail) VALUES($1,'imports.product',$2,$3)",[user.id,p.id,JSON.stringify({jobId:id,sku:p.sku})]);
        });
      }else {
        const target=(await db.query('SELECT * FROM products WHERE id=$1',[row.data.productId])).rows[0];if(!target)fail('El producto ya no existe.',409);
        const p=toProduct(target);await permit(user,'media.link',p.brand);
        if(row.data.replace){if(!info.data.replace)fail('Reemplazo no autorizado.');await permit(user,'media.replace',p.brand);}
        if(p.version!==row.data.version)fail('El producto cambió desde la vista previa. Genera otra revisión.',409);
        const asset=await storeImage(await getObject(row.data.key),p.sku,row.data.assetId);
        await transaction(async client=>{
          const job=await client.query('SELECT status FROM import_jobs WHERE id=$1 FOR UPDATE',[id]);if(job.rows[0].status==='cancelled')return;
          const check=await client.query('SELECT version FROM products WHERE id=$1 FOR UPDATE',[p.id]);if(check.rows[0]?.version!==row.data.version)fail('El producto cambió durante el procesamiento.',409);
          await client.query('INSERT INTO media_assets(id,job_id,sku,original_name,object_key,thumbnail_key,checksum,bytes,width,height,product_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO NOTHING',[asset.id,id,p.sku,row.data.filename,asset.key,asset.thumbnailKey,asset.checksum,asset.bytes,asset.width,asset.height,p.id,user.id]);
          await client.query('UPDATE media_assets SET position=$2 WHERE id=$1',[asset.id,row.data.position]);
          if(row.data.position===0)await client.query("UPDATE products SET data=jsonb_set(data,'{image}',to_jsonb($2::text)),version=version+1,updated_at=now() WHERE id=$1",[p.id,asset.url]);
          await client.query("UPDATE import_rows SET status='completed' WHERE job_id=$1 AND row_number=$2",[id,row.row_number]);
          // Gallery rows of the same SKU were approved in the same preview; advance their snapshot.
          if(row.data.position===0)await client.query("UPDATE import_rows SET data=jsonb_set(data,'{version}',to_jsonb($3::int)) WHERE job_id=$1 AND status='valid' AND data->>'productId'=$2",[id,p.id,(p.version||0)+1]);
          await client.query("INSERT INTO audit_log(user_id,action,entity_id,detail) VALUES($1,'media.link',$2,$3)",[user.id,p.id,JSON.stringify({jobId:id,assetId:asset.id,position:row.data.position})]);
        });
      }
    }catch(error){await db.query("UPDATE import_rows SET status='error',errors=$3 WHERE job_id=$1 AND row_number=$2",[id,row.row_number,JSON.stringify([error instanceof Error?error.message:'No se pudo procesar.'])]);}
    await db.query("UPDATE import_jobs SET done=(SELECT count(*) FROM import_rows WHERE job_id=$1 AND status='completed'),errors=(SELECT count(*) FROM import_rows WHERE job_id=$1 AND status IN ('invalid','error')),updated_at=now() WHERE id=$1",[id]);
  }
  await db.query("UPDATE import_jobs SET status=CASE WHEN errors>0 THEN 'partial' ELSE 'completed' END,updated_at=now() WHERE id=$1 AND status<>'cancelled'",[id]);
}
