import { readForm } from "@/server/request";
import { authorize,checkOrigin,audit } from "@/server/access";
import { storeImage } from "@/server/storage";
import { db } from "@/server/db";
import { fail,errorResponse } from "@/server/errors";
export async function POST(request:Request){try{
  checkOrigin(request);const user=await authorize(request.headers,'media.upload');const form=await readForm(request);const file=form.get('file');if(!(file instanceof File))fail('Selecciona una imagen.');if(file.size>20*1024*1024)fail('Máximo 20 MB.');
  const sku=String(form.get('sku')||'producto');const asset=await storeImage(Buffer.from(await file.arrayBuffer()),sku);
  await db.query('INSERT INTO media_assets(id,sku,original_name,object_key,thumbnail_key,checksum,bytes,width,height,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[asset.id,sku,file.name,asset.key,asset.thumbnailKey,asset.checksum,asset.bytes,asset.width,asset.height,user.id]);
  await audit(user.id,'media.upload',asset.id);return Response.json({url:asset.url,bytes:asset.bytes});
}catch(error){return errorResponse(error);}}
