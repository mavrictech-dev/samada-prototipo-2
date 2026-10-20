import { auth } from "./auth";
import { db, transaction } from "./db";
import { fail } from "./errors";
import type { CurrentUser } from "@/lib/types";

export async function userAccess(id: string): Promise<CurrentUser> {
  const result=await db.query('SELECT id,name,email,approved,status FROM "user" WHERE id=$1',[id]);
  const u=result.rows[0];
  if(!u?.approved||u.status!=="active")fail("Tu cuenta está pendiente de aprobación o suspendida.",403);
  const roles=await db.query('SELECT r.id,r.name,ur.brand_ids FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1',[id]);
  const permissions=await db.query('SELECT DISTINCT p.capability AS key FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=$1',[id]);
  const brandIds=roles.rows.some(r=>r.brand_ids===null)?null:[...new Set<string>(roles.rows.flatMap(r=>r.brand_ids||[]))];
  return {id:u.id,name:u.name,email:u.email,roles:roles.rows.map(r=>r.id),permissions:permissions.rows.map(p=>p.key),brandIds};
}
export async function principal(headers: Headers) {
  const session=await auth.api.getSession({headers});
  if(!session)fail("Inicia sesión para continuar.",401);
  return userAccess(session.user.id);
}
export async function authorize(headers:Headers,permission:string,brandId?:string) {
  const user=await principal(headers);
  await permit(user,permission,brandId);
  return user;
}
export async function permit(user:CurrentUser,permission:string,brandId?:string) {
  const access=await db.query('SELECT ur.brand_ids FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=$1 AND p.capability=$2',[user.id,permission]);
  if(!access.rows.some(row=>row.brand_ids===null||(!brandId&&row.brand_ids.length>0)||(brandId&&row.brand_ids.includes(brandId))))fail("No tienes permiso para esta operación o marca.",403);
}
export async function allowedBrands(user:CurrentUser,permission:string):Promise<string[]|null> {
  const result=await db.query('SELECT ur.brand_ids FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=$1 AND p.capability=$2',[user.id,permission]);
  return result.rows.some(row=>row.brand_ids===null)?null:[...new Set<string>(result.rows.flatMap(r=>r.brand_ids||[]))];
}
export function checkOrigin(request: Request) {
  const origin=request.headers.get("origin");
  const allowed=new Set((process.env.TRUSTED_ORIGINS||process.env.BETTER_AUTH_URL||"http://localhost:3000").split(","));
  if(!origin||!allowed.has(origin))fail("Origen de la solicitud no permitido.",403);
}
export async function audit(userId:string|null,action:string,entityId:string|null,detail:unknown={}) {
  await db.query('INSERT INTO audit_log(user_id,action,entity_id,detail) VALUES($1,$2,$3,$4)',[userId,action,entityId,JSON.stringify(detail)]);
}
export async function throttle(key:string,limit=15) {
  await transaction(async client=>{
    const r=await client.query("INSERT INTO rate_limits(key,count,expires_at) VALUES($1,1,now()+interval '1 minute') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<now() THEN 1 ELSE rate_limits.count+1 END, expires_at=CASE WHEN rate_limits.expires_at<now() THEN now()+interval '1 minute' ELSE rate_limits.expires_at END RETURNING count",[key]);
    if(r.rows[0].count>limit)fail("Demasiadas solicitudes. Espera un minuto.",429);
  });
}
