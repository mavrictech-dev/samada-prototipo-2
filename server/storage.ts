import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import sharp from "sharp";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { fail } from "./errors";

const root=path.join(process.cwd(),"data","media");
const s3=process.env.S3_BUCKET?new S3Client({region:process.env.S3_REGION||"us-east-1",endpoint:process.env.S3_ENDPOINT,forcePathStyle:true}):null;
function safeKey(key:string) {if(!/^[a-zA-Z0-9._/-]+$/.test(key)||key.split('/').some(p=>p==='..'||!p))fail("Ruta de archivo no válida.");return key;}
export async function putObject(key:string,buffer:Buffer,contentType:string) {
  safeKey(key);
  if(s3)await s3.send(new PutObjectCommand({Bucket:process.env.S3_BUCKET,Key:key,Body:buffer,ContentType:contentType}));
  else {const target=path.join(root,key);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,buffer);}
}
export async function getObject(key:string) {
  safeKey(key);
  if(s3){const r=await s3.send(new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:key}));if(!r.Body)fail("Archivo no encontrado.",404);return Buffer.from(await r.Body.transformToByteArray());}
  return fs.readFile(path.join(root,key));
}
export async function validateImage(buffer:Buffer) {
  if(buffer.length>20*1024*1024)fail("La imagen supera 20 MB.");
  const metadata=await sharp(buffer,{limitInputPixels:40_000_000,failOn:"warning"}).metadata();
  if(!['jpeg','png','webp','avif','heif'].includes(metadata.format||'')||!metadata.width||!metadata.height)fail("Formato no admitido. Usa JPG, PNG, WebP o AVIF.");
  if((metadata.pages||1)>1)fail("Selecciona una imagen estática.");
  return metadata;
}
export async function storeImage(buffer:Buffer,sku:string,id=randomUUID()) {
  await validateImage(buffer);
  const safeName=sku.replace(/[^a-zA-Z0-9._-]/g,'_');
  const key=`images/${id}/${safeName}.webp`, thumbnailKey=`images/${id}/${safeName}-thumb.webp`;
  const image=await sharp(buffer,{limitInputPixels:40_000_000}).rotate().resize({width:1400,height:1400,fit:'inside',withoutEnlargement:true}).webp({quality:86}).toBuffer({resolveWithObject:true});
  const thumbnail=await sharp(image.data).resize({width:280,height:280,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer();
  await putObject(`originals/${id}/source`,buffer,'application/octet-stream');
  await putObject(key,image.data,'image/webp');await putObject(thumbnailKey,thumbnail,'image/webp');
  return {id,key,thumbnailKey,url:`/api/media/${key}`,checksum:createHash('sha256').update(buffer).digest('hex'),bytes:image.data.length,width:image.info.width,height:image.info.height};
}
