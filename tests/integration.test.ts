import "dotenv/config";
import { test,after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import ExcelJS from "exceljs";
import { db } from "../server/db";
import type { CmsState,CurrentUser } from "../lib/types";
import { sortProducts } from "../lib/catalog";
import { parseFile } from "../server/imports";
const BASE=process.env.BETTER_AUTH_URL||'http://localhost:3000';
class Client {
  cookies='';
  async request(path:string,body?:unknown,method=body===undefined?'GET':'POST'){
    const response=await fetch(BASE+path,{method,headers:{Origin:BASE,...(this.cookies?{Cookie:this.cookies}:{}),...(body!==undefined&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});
    const cookies=response.headers.getSetCookie();if(cookies.length){const jar=new Map(this.cookies.split('; ').filter(Boolean).map(c=>c.split(/=(.*)/).slice(0,2) as [string,string]));cookies.forEach(c=>{const [key,value]=c.split(';')[0].split(/=(.*)/);jar.set(key,value);});this.cookies=[...jar].map(([k,v])=>`${k}=${v}`).join('; ');}
    return response;
  }
  async json<T=Record<string,unknown>>(path:string,body?:unknown,method?:string):Promise<T>{const response=await this.request(path,body,method);const data=await response.json();assert.ok(response.ok,`${path} ${response.status}: ${JSON.stringify(data)}`);return data as T;}
}
const admin=new Client(),guest=new Client();
const tag=`IT${Date.now()}`;
const created:{brand?:string;sizes:string[];user?:string;role?:string;permission?:string;jobs:string[]}={sizes:[],jobs:[]};
let state:CmsState,brandId:string,size250:string,size500:string,size1000:string,sku0:string;
after(async()=>{
  // These fixtures are private drafts. Cleanup touches only the exact IDs created by this run.
  for(const id of created.jobs)await db.query('DELETE FROM media_assets WHERE job_id=$1',[id]);
  for(const id of created.jobs)await db.query('DELETE FROM import_jobs WHERE id=$1',[id]);
  if(created.brand){await db.query('DELETE FROM media_assets WHERE product_id IN (SELECT id FROM products WHERE brand_id=$1)',[created.brand]);await db.query('DELETE FROM products WHERE brand_id=$1',[created.brand]);await db.query('DELETE FROM brand_categories WHERE brand_id=$1',[created.brand]);await db.query('DELETE FROM brand_subcategories WHERE brand_id=$1',[created.brand]);await db.query('DELETE FROM brand_sizes WHERE brand_id=$1',[created.brand]);await db.query('DELETE FROM brands WHERE id=$1',[created.brand]);}
  for(const id of created.sizes)await db.query('DELETE FROM sizes WHERE id=$1',[id]);
  if(created.user){await db.query('DELETE FROM user_roles WHERE user_id=$1',[created.user]);await db.query('DELETE FROM "user" WHERE id=$1',[created.user]);}
  if(created.role)await db.query('DELETE FROM roles WHERE id=$1',[created.role]);
  if(created.permission)await db.query('DELETE FROM permissions WHERE id=$1',[created.permission]);
  await db.end();
});
async function waitJob(id:string,timeout=240000){const until=Date.now()+timeout;while(Date.now()<until){const job=await admin.json<{status:string;done:number;errors:number;rows:Array<{errors:string[]}>}>(`/api/admin/jobs/${id}`);if(['completed','partial','failed','cancelled'].includes(job.status))return job;await new Promise(r=>setTimeout(r,1000));}throw new Error('Timeout de procesamiento: '+id);}
async function mailUrl(email:string,part:string){
  for(let i=0;i<20;i++){
    const data=await (await fetch('http://localhost:8026/api/v1/messages')).json();
    const found=(data.messages||[]).find((m:{To?:Array<{Address:string}>;Subject:string})=>m.To?.some(t=>t.Address===email)&&m.Subject.includes(part));
    if(found){const message=await (await fetch(`http://localhost:8026/api/v1/message/${found.ID}`)).json();const urls=String(message.Text||'').match(/https?:\/\/[^\s]+/g);if(urls?.length)return urls[0];}
    await new Promise(r=>setTimeout(r,300));
  }throw new Error('Correo local no recibido: '+part);
}
test('01 · Anónimo: API de gestión cerrada y JSON global retirado',async()=>{
  assert.equal((await guest.request('/api/admin/state')).status,401);
  assert.equal((await guest.request('/api/admin/products',{name:'intruso'})).status,401);
  assert.equal((await guest.request('/api/cms',{})).status,405);
  const response=await fetch(BASE+'/admin',{redirect:'manual'});assert.ok([307,308,303].includes(response.status));assert.match(response.headers.get('location')||'',/login/);
});
test('02 · Login con acceso local y plantilla dinámica Excel/CSV',async()=>{
  const access=await fs.readFile('data/ACCESO-LOCAL.txt','utf8');const email=access.match(/Correo: (.+)/)![1].trim(),password=access.match(/aleatoria: (.+)/)![1].trim();
  await admin.json('/api/auth/sign-in/email',{email,password});const me=await admin.json<CurrentUser>('/api/me');assert.ok(me.roles.includes('superadmin'));
  state=await admin.json<CmsState>('/api/admin/state');assert.ok(state.products.length>0);
  const response=await admin.request('/api/admin/template');assert.equal(response.status,200);const wb=new ExcelJS.Workbook();await wb.xlsx.load(Buffer.from(await response.arrayBuffer()) as unknown as ExcelJS.Buffer);assert.equal(wb.getWorksheet('Productos')!.getCell('A1').text,'sku');assert.equal(wb.getWorksheet('Productos')!.getCell('A2').text,'');assert.ok(wb.getWorksheet('MarcaTamano'));assert.equal(wb.getWorksheet('_Schema')!.getCell('B1').text,'samada-catalogo-v1');
  const csv=await (await admin.request('/api/admin/template?format=csv')).text();assert.match(csv,/tamano_codigo/);
});
test('03 · Tamaños numéricos, marca y relaciones dinámicas',async()=>{
  const createSize=async(code:string,name:string,value:number,unit:string)=>{const result=await admin.json<{id:string}>('/api/admin/sizes',{code:`${tag}-${code}`,name,type:'volume',value,unit,active:true,position:0});created.sizes.push(result.id);return result.id;};
  size250=await createSize('250ML','250 ml',250,'ml');size500=await createSize('500ML','500 ml',500,'ml');size1000=await createSize('1L','1 L',1,'L');
  const brand=await admin.json<{id:string}>('/api/admin/brands',{code:tag,name:`Prueba ${tag}`,active:true,position:999,categoryIds:[state.categories[0].id],subcategoryIds:[],sizeIds:[size1000,size250,size500]});brandId=brand.id;created.brand=brandId;
  const fresh=await admin.json<CmsState>('/api/admin/state');const sample=[size1000,size250,size500].map((id,i)=>({...state.products[0],id:String(i),sku:String(i),brand:brandId,category:state.categories[0].id,sizeId:id}));assert.deepEqual(sortProducts(sample,fresh,'size').map(p=>p.sizeId),[size250,size500,size1000]);
  const invalid=await admin.request('/api/admin/products',{...state.products[0],id:'',sku:`${tag}-BAD`,brand:brandId,sizeId:state.sizes[0].id,version:undefined});assert.equal(invalid.status,400);
});
test('04 · CSV de 1.500 SKU: vista previa, cola e idempotencia',async()=>{
  const categoryCode=state.categories[0].code;const header='sku,nombre,marca_codigo,categoria_codigo,tamano_codigo,precio_mayorista,stock,publicado';
  sku0=`000123-${tag}`;
  const lines=Array.from({length:1500},(_,i)=>`${i===0?sku0:`${tag}-${String(i).padStart(5,'0')}`},Producto ${i},${tag},${categoryCode},${tag}-250ML,19.90,100,NO`);
  const data=new FormData();data.set('mode','create');data.set('file',new File([header+'\n'+lines.join('\n')],'1500.csv',{type:'text/csv'}));
  const preview=await admin.json<{id:string}>('/api/admin/imports',data);created.jobs.push(preview.id);const snapshot=await admin.json<{total:number;errors:number;rows:Array<{sku:string}>}>(`/api/admin/jobs/${preview.id}`);assert.equal(snapshot.total,1500);assert.equal(snapshot.errors,0);assert.equal(snapshot.rows[0].sku,sku0);
  await admin.json(`/api/admin/jobs/${preview.id}`,{action:'execute'});const result=await waitJob(preview.id);assert.equal(result.status,'completed',JSON.stringify(result));assert.equal(result.done,1500);
  assert.equal((await admin.request(`/api/admin/jobs/${preview.id}`,{action:'execute'})).status,409);
  const count=await db.query('SELECT count(*)::int AS n FROM products WHERE brand_id=$1',[brandId]);assert.equal(count.rows[0].n,1500);
  const pub=await guest.json<CmsState>('/api/cms');assert.ok(!pub.products.some(p=>p.brand===brandId));
});
test('05 · Actualización parcial conserva campos y comprueba conflictos',async()=>{
  const form=new FormData();form.set('mode','update');form.set('file',new File([`sku,stock\n${sku0},0`],'stock.csv'));
  const r=await admin.json<{id:string}>('/api/admin/imports',form);created.jobs.push(r.id);await admin.json(`/api/admin/jobs/${r.id}`,{action:'execute'});assert.equal((await waitJob(r.id)).done,1);
  const p=(await db.query('SELECT * FROM products WHERE sku=$1',[sku0])).rows[0];assert.equal(p.stock,0);assert.equal(Number(p.wholesale_price),19.9);
  const product=(await admin.json<CmsState>('/api/admin/state')).products.find(p=>p.sku===sku0)!;
  await admin.json('/api/admin/products',{...product,description:'Descripción nueva'});
  assert.equal((await admin.request('/api/admin/products',{...product,name:'Edición obsoleta'})).status,409);
  const duplicate=new FormData();duplicate.set('file',new File([`sku,stock\n${sku0},2\n${sku0},4`],'duplicates.csv'));duplicate.set('mode','update');const d=await admin.json<{id:string}>('/api/admin/imports',duplicate);created.jobs.push(d.id);const details=await admin.json<{errors:number}>(`/api/admin/jobs/${d.id}`);assert.equal(details.errors,2);assert.equal((await admin.request(`/api/admin/jobs/${d.id}`,{action:'execute'})).status,400);
});
test('06 · Carpeta por SKU: WebP, galería y pendientes',async()=>{
  const r=await admin.json<{id:string}>('/api/admin/media',{filename:'Prueba imágenes'});created.jobs.push(r.id);
  const png=await sharp({create:{width:32,height:48,channels:4,background:{r:124,g:179,b:66,alpha:0.5}}}).png().toBuffer();
  const form=new FormData();form.set('jobId',r.id);form.append('files',new File([png],`${sku0}.png`,{type:'image/png'}));form.append('files',new File([png],`${sku0}__01.png`,{type:'image/png'}));form.append('files',new File([png],'NO-MATCH.png',{type:'image/png'}));
  await admin.json('/api/admin/media',form);await admin.json(`/api/admin/jobs/${r.id}`,{action:'plan'});
  const preview=await admin.json<{errors:number}>(`/api/admin/jobs/${r.id}`);assert.equal(preview.errors,1);
  await admin.json(`/api/admin/jobs/${r.id}`,{action:'execute',skipInvalid:true,replace:false});const done=await waitJob(r.id);assert.equal(done.done,2,JSON.stringify(done));assert.equal(done.status,'partial');
  const p=(await admin.json<CmsState>('/api/admin/state')).products.find(p=>p.sku===sku0)!;assert.match(p.image,/\.webp$/);
  assert.equal((await guest.request(p.image)).status,401);const response=await admin.request(p.image);assert.equal(response.status,200);assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).format,'webp');
  const target=(await admin.json<CmsState>('/api/admin/state')).products.find(p=>p.sku===`${tag}-00001`)!;
  await admin.json(`/api/admin/jobs/${r.id}`,{action:'map',rowNumber:3,productId:target.id,position:0});
  await admin.json(`/api/admin/jobs/${r.id}`,{action:'execute'});const retried=await waitJob(r.id);assert.equal(retried.done,3,JSON.stringify(retried));assert.equal(retried.status,'completed');
  const assets=await db.query('SELECT count(*)::int AS n FROM media_assets WHERE job_id=$1',[r.id]);assert.equal(assets.rows[0].n,3,'El reintento no debe duplicar imágenes completadas.');
});
test('07 · Registro, verificación, aprobación, CRUD y alcance por marca',async()=>{
  const member=new Client(),email=`${tag.toLowerCase()}@samada.local`,password=randomUUID()+'Aa1!';
  const signup=await member.json<{user:{id:string}}>('/api/auth/sign-up/email',{email,name:`Usuario ${tag}`,password,callbackURL:BASE+'/login'});created.user=signup.user.id;
  const verify=await mailUrl(email,'Verifica');await fetch(verify);assert.equal((await member.request('/api/auth/sign-in/email',{email,password})).status,403);
  const permission=await admin.json<{id:string}>('/api/security/permissions',{key:`test.${tag}`,name:'Lectura de productos de prueba',capability:'products.read'});created.permission=permission.id;
  const role=await admin.json<{id:string}>('/api/security/roles',{name:`Rol ${tag}`,description:'Prueba de alcance',permissionIds:[permission.id]});created.role=role.id;
  await admin.json(`/api/security/users/${signup.user.id}`,{name:`Usuario ${tag}`,email,status:'active',assignments:[{roleId:role.id,brandIds:[brandId]}]},'PUT');
  await member.json('/api/auth/sign-in/email',{email,password});const privateState=await member.json<CmsState>('/api/admin/state');assert.equal(privateState.products.length,1500);assert.ok(privateState.products.every(p=>p.brand===brandId));
  assert.equal((await member.request('/api/admin/products',{...privateState.products[0],name:'No permitido'})).status,403);
  assert.equal((await member.request('/api/security/roles',{name:'Escalada',permissionIds:['users.roles']})).status,403);
  assert.equal((await member.request('/api/admin/template')).status,403);
  await member.json('/api/auth/request-password-reset',{email,redirectTo:BASE+'/reset-password'});const recovery=await mailUrl(email,'Recupera');const resetRedirect=await fetch(recovery,{redirect:'manual'});const token=new URL(resetRedirect.headers.get('location')||recovery,BASE).searchParams.get('token');assert.ok(token);
  await member.json('/api/auth/reset-password',{token,newPassword:password+'NEW'});assert.equal((await member.request('/api/me')).status,401);
  assert.ok((await member.request('/api/auth/reset-password',{token,newPassword:password+'OTHER'})).status>=400);
  await member.json('/api/auth/sign-in/email',{email,password:password+'NEW'});
  await admin.json(`/api/security/users/${signup.user.id}`,{name:`Usuario ${tag}`,email,status:'suspended',assignments:[{roleId:role.id,brandIds:[brandId]}]},'PUT');assert.equal((await member.request('/api/me')).status,401);
  const me=await admin.json<CurrentUser>('/api/me');assert.equal((await admin.request(`/api/security/users/${me.id}`,{name:me.name,email:me.email,status:'suspended',assignments:[]},'PUT')).status,409);
});
test('08 · Origen no permitido rechazado incluso con sesión',async()=>{
  const response=await fetch(BASE+'/api/admin/products',{method:'POST',headers:{Origin:'https://no-permitido.example',Cookie:admin.cookies,'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,403);
});
test('09 · Excel conserva SKU texto y rechaza números/fórmulas; CSV admite punto y coma',async()=>{
  const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Productos');sheet.addRow(['sku','nombre']);
  sheet.addRow(['000123','Texto con ceros']);sheet.addRow([123,'SKU numérico']);sheet.addRow(['FORMULA',{formula:'1+1',result:2}]);
  const rows=await parseFile(Buffer.from(await workbook.xlsx.writeBuffer()),'catalogo.xlsx');
  assert.equal(rows[0].sku,'000123');assert.ok((rows[1].__parseErrors as string[]).some(e=>e.includes('debe ser texto')));assert.ok((rows[2].__parseErrors as string[]).some(e=>e.includes('no fórmulas')));
  const csv=await parseFile(Buffer.from('sku;stock\n000123;0'),'productos.csv',';');assert.equal(csv[0].sku,'000123');assert.equal(csv[0].stock,'0');
  await assert.rejects(()=>parseFile(Buffer.from('sku,sku\n1,2'),'duplicado.csv'),/encabezados duplicados/);
});
test('10 · Editar y eliminar roles/permisos; archivo de usuario y referencias protegidas',async()=>{
  const role=await admin.json<Array<{id:string;permission_ids:string[]}>>('/api/security/roles');assert.ok(role.some(r=>r.id===created.role));
  await admin.json(`/api/security/roles/${created.role}`,{name:`Rol ${tag} editado`,description:'Modificado desde API',permissionIds:[created.permission]},'PUT');
  await admin.json(`/api/security/permissions/${created.permission}`,{key:`test.${tag}`,name:'Lectura editada',capability:'products.read'},'PUT');
  assert.equal((await admin.request(`/api/security/roles/${created.role}`,{},'DELETE')).status,409);
  assert.equal((await admin.request(`/api/security/permissions/${created.permission}`,{},'DELETE')).status,409);
  await admin.json(`/api/security/users/${created.user}`,{},'DELETE');
  const users=await admin.json<Array<{id:string;status:string}>>('/api/security/users');assert.equal(users.find(u=>u.id===created.user)?.status,'archived');
  await admin.json(`/api/security/roles/${created.role}`,{},'DELETE');
  await admin.json(`/api/security/permissions/${created.permission}`,{},'DELETE');
});
