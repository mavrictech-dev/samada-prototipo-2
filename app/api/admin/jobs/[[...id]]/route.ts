import { readJson } from "@/server/request";
import { z } from "zod";
import { db } from "@/server/db";
import { principal,authorize,checkOrigin,allowedBrands,audit } from "@/server/access";
import { jobAccess,executeJob,planMedia,recheckJob } from "@/server/jobs";
import { loadState,parsed } from "@/server/catalog";
import { csvBuffer } from "@/server/imports";
import { errorResponse,fail } from "@/server/errors";
type Context={params:Promise<{id?:string[]}>};
export async function GET(request:Request,ctx:Context){try{
  const user=await principal(request.headers);const id=(await ctx.params).id?.[0];const url=new URL(request.url);
  if(!id){const kind=url.searchParams.get('kind')==='media'?'media':'products',permission=kind==='media'?'media.read':'imports.read';await authorize(request.headers,permission);const all=await allowedBrands(user,permission)===null;return Response.json((await db.query('SELECT * FROM import_jobs WHERE kind=$1 AND ($2::boolean OR user_id=$3) ORDER BY created_at DESC LIMIT 100',[kind,all,user.id])).rows);}
  const job=await jobAccess(user,id);
  if(url.searchParams.get('report')==='1'){
    const rows=(await db.query('SELECT row_number,sku,status,errors,data FROM import_rows WHERE job_id=$1 ORDER BY row_number',[id])).rows;
    return new Response(new Uint8Array(csvBuffer([['fila','sku','estado','errores','archivo'],...rows.map(r=>[r.row_number,r.sku,r.status,r.errors.join('; '),r.data.filename||''])])),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="Samada-Reporte.csv"'}});
  }
  const page=Math.max(0,Number(url.searchParams.get('page'))||0);const rows=(await db.query('SELECT * FROM import_rows WHERE job_id=$1 ORDER BY row_number LIMIT 100 OFFSET $2',[id,page*100])).rows;
  return Response.json({...job,rows});
}catch(error){return errorResponse(error);}}
export async function POST(request:Request,ctx:Context){try{
  checkOrigin(request);const user=await principal(request.headers);const id=(await ctx.params).id?.[0];if(!id)fail('Falta el trabajo.');const job=await jobAccess(user,id);
  const body=parsed(z.object({action:z.enum(['execute','cancel','plan','map','recheck']),skipInvalid:z.boolean().default(false),replace:z.boolean().default(false),rowNumber:z.number().int().optional(),productId:z.string().optional(),position:z.number().int().min(0).max(99).default(0)}),await readJson(request));
  if(body.action==='recheck')await recheckJob(user,id);
  if(body.action==='execute')await executeJob(user,id,body.skipInvalid,body.replace);
  if(body.action==='cancel'){
    await authorize(request.headers,job.kind==='media'?'media.upload':'imports.cancel');await db.query("UPDATE import_jobs SET status='cancelled',updated_at=now() WHERE id=$1 AND status IN ('preview','uploading','queued','running','failed')",[id]);await audit(user.id,'jobs.cancel',id);
  }
  if(body.action==='plan'){if(job.kind!=='media')fail('Acción no válida.');await planMedia(user,id);}
  if(body.action==='map'){
    if(job.kind!=='media'||!['preview','partial'].includes(job.status))fail('Solo se pueden ajustar imágenes pendientes.');
    const row=await db.query('SELECT status FROM import_rows WHERE job_id=$1 AND row_number=$2',[id,body.rowNumber]);if(!row.rows[0]||row.rows[0].status==='completed')fail('Esta fila ya fue aplicada.');
    const state=await loadState(user);if(!state.products.some(p=>p.id===body.productId))fail('Producto no accesible.');
    await authorize(request.headers,'media.link',state.products.find(p=>p.id===body.productId)?.brand);
    await db.query("UPDATE import_rows SET data=data||$3::jsonb WHERE job_id=$1 AND row_number=$2",[id,body.rowNumber,JSON.stringify({manualProductId:body.productId,manualPosition:body.position})]);await planMedia(user,id);
  }
  return Response.json({ok:true});
}catch(error){return errorResponse(error);}}
