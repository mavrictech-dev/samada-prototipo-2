import { randomUUID, randomBytes } from "node:crypto";
import { z } from "zod";
import { db, transaction } from "./db";
import { auth } from "./auth";
import { allowedBrands, audit, permit } from "./access";
import { parsed } from "./catalog";
import { fail } from "./errors";
import { permissionKeys } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/types";

export async function globalPermission(user:CurrentUser,key:string) {
  await permit(user,key);if(await allowedBrands(user,key)!==null)fail("La seguridad requiere permiso global.",403);
}
export async function securityList(user:CurrentUser,resource:string) {
  if(resource==='roles'&&user.permissions.includes('users.roles'))await globalPermission(user,'users.roles');
  else await globalPermission(user,`${resource}.read`);
  if(resource==='users')return (await db.query(`SELECT u.id,u.name,u.email,u."emailVerified",u.approved,u.status,u."createdAt",COALESCE((SELECT json_agg(json_build_object('roleId',ur.role_id,'brandIds',ur.brand_ids,'name',r.name)) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id),'[]') AS assignments FROM "user" u ORDER BY u."createdAt" DESC`)).rows;
  if(resource==='roles')return (await db.query("SELECT r.*,COALESCE((SELECT json_agg(permission_id) FROM role_permissions rp WHERE rp.role_id=r.id),'[]') AS permission_ids,(SELECT count(*) FROM user_roles ur WHERE ur.role_id=r.id)::int AS users FROM roles r ORDER BY r.name")).rows;
  return (await db.query("SELECT * FROM permissions ORDER BY capability,name")).rows;
}
async function checkDelegation(user:CurrentUser,permissionIds:string[]) {
  const selected=await db.query("SELECT id,capability FROM permissions WHERE id=ANY($1::text[])",[permissionIds]);
  if(selected.rowCount!==new Set(permissionIds).size)fail("Algún permiso ya no existe.");
  for(const p of selected.rows)await globalPermission(user,p.capability);
}
async function assignRoles(user:CurrentUser,target:string,assignments:Array<{roleId:string;brandIds:string[]|null}>) {
  await globalPermission(user,'users.roles');
  if(target===user.id&&!user.roles.includes('superadmin'))fail("No puedes cambiar tus propios roles.",403);
  for(const a of assignments){
    if(a.roleId==='superadmin'&&!user.roles.includes('superadmin'))fail("Solo un superadministrador puede delegar este rol.",403);
    const r=await db.query('SELECT permission_id FROM role_permissions WHERE role_id=$1',[a.roleId]);
    await checkDelegation(user,r.rows.map(p=>p.permission_id));
    if(a.brandIds){const b=await db.query('SELECT id FROM brands WHERE id=ANY($1::text[])',[a.brandIds]);if(b.rowCount!==new Set(a.brandIds).size)fail("Marca no válida.");}
  }
}
const assignmentsSchema=z.array(z.object({roleId:z.string().min(1),brandIds:z.array(z.string()).nullable()})).max(30);
export async function saveSecurity(user:CurrentUser,resource:string,id:string|undefined,input:unknown) {
  await globalPermission(user,`${resource}.${id?'update':'create'}`);
  if(resource==='permissions'){
    const p=parsed(z.object({key:z.string().regex(/^[a-zA-Z0-9._-]+$/).max(120),name:z.string().trim().min(1).max(200),capability:z.enum(permissionKeys as [string,...string[]])}),input);
    const current=id?(await db.query('SELECT * FROM permissions WHERE id=$1',[id])).rows[0]:null;
    if(id&&!current)fail('Permiso no encontrado.',404);
    if(current?.system&&(p.key!==current.key||p.capability!==current.capability))fail('La clave y capacidad de un permiso interno son inmutables.');
    await globalPermission(user,p.capability);
    const key=id||randomUUID();
    await db.query('INSERT INTO permissions(id,key,capability,name) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET key=excluded.key,capability=excluded.capability,name=excluded.name',[key,p.key,p.capability,p.name]);
    await audit(user.id,'permissions.save',key);return key;
  }
  if(resource==='roles'){
    const role=parsed(z.object({name:z.string().trim().min(1).max(150),description:z.string().max(1000).default(''),permissionIds:z.array(z.string())}),input);
    if(id==='superadmin')fail('El rol de recuperación Superadministrador está protegido. Duplica otro rol para personalizarlo.');
    await checkDelegation(user,role.permissionIds);
    const key=id||randomUUID();
    await transaction(async client=>{
      await client.query('INSERT INTO roles(id,name,description) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description',[key,role.name,role.description]);
      await client.query('DELETE FROM role_permissions WHERE role_id=$1',[key]);
      for(const permission of new Set(role.permissionIds))await client.query('INSERT INTO role_permissions(role_id,permission_id) VALUES($1,$2)',[key,permission]);
    });await audit(user.id,'roles.save',key);return key;
  }
  const value=parsed(z.object({name:z.string().trim().min(1).max(150),email:z.email(),status:z.enum(['pending','active','suspended','archived']),assignments:assignmentsSchema.optional()}),input);
  const old=id?(await db.query('SELECT id,email,status FROM "user" WHERE id=$1',[id])).rows[0]:null;
  if(id&&!old)fail('Usuario no encontrado.',404);
  if(old&&old.email!==value.email.toLowerCase())fail('El correo identifica la cuenta. Invita otra cuenta para usar un correo diferente.');
  const selected=value.assignments;
  if(selected)await assignRoles(user,id||'',selected);
  let target=id;
  if(!target){
    const created=await auth.api.signUpEmail({body:{name:value.name,email:value.email,password:randomBytes(28).toString('base64url')+'Aa1!'}});
    target=created.user.id;
  }
  await transaction(async client=>{
    await client.query("SELECT pg_advisory_xact_lock(125902)");
    const superRole=await client.query("SELECT 1 FROM user_roles WHERE user_id=$1 AND role_id='superadmin'",[target]);
    if(superRole.rowCount){
      if(!user.roles.includes('superadmin'))fail('No puedes modificar un superadministrador.',403);
      if(value.status!=='active'||(selected&&!selected.some(a=>a.roleId==='superadmin'&&a.brandIds===null))){
        const count=await client.query(`SELECT count(*)::int AS n FROM user_roles ur JOIN "user" u ON u.id=ur.user_id WHERE ur.role_id='superadmin' AND u.status='active' AND u.approved=true AND ur.user_id<>$1`,[target]);
        if(count.rows[0].n===0)fail('No puedes desactivar ni quitar al último superadministrador.',409);
      }
    }
    await client.query('UPDATE "user" SET name=$1,approved=$2,status=$3,"updatedAt"=now() WHERE id=$4',[value.name,value.status==='active',value.status,target]);
    if(selected){await client.query('DELETE FROM user_roles WHERE user_id=$1',[target]);for(const a of selected)await client.query('INSERT INTO user_roles(user_id,role_id,brand_ids) VALUES($1,$2,$3)',[target,a.roleId,a.brandIds]);}
    if(value.status!=='active')await client.query('DELETE FROM session WHERE "userId"=$1',[target]);
  });
  if(!id)await auth.api.requestPasswordReset({body:{email:value.email,redirectTo:`${process.env.BETTER_AUTH_URL}/reset-password`}});
  await audit(user.id,id?'users.update':'users.invite',target||null,{status:value.status});return target;
}
export async function deleteSecurity(user:CurrentUser,resource:string,id:string) {
  await globalPermission(user,`${resource}.delete`);
  if(resource==='users'){
    if(id===user.id)fail('No puedes eliminar tu propia cuenta.');
    const target=(await db.query('SELECT id,name,email FROM "user" WHERE id=$1',[id])).rows[0];if(!target)fail('Usuario no encontrado.',404);
    await saveSecurity(user,'users',id,{...target,status:'archived',assignments:[]});
  } else if(resource==='roles'){
    if(id==='superadmin')fail('El rol Superadministrador está protegido.');
    if((await db.query('SELECT 1 FROM user_roles WHERE role_id=$1 LIMIT 1',[id])).rowCount)fail('Reasigna los usuarios antes de eliminar el rol.',409);
    const permissions=(await db.query('SELECT permission_id FROM role_permissions WHERE role_id=$1',[id])).rows.map(p=>p.permission_id);await checkDelegation(user,permissions);
    await db.query('DELETE FROM roles WHERE id=$1',[id]);
  } else {
    const p=(await db.query('SELECT * FROM permissions WHERE id=$1',[id])).rows[0];if(p?.system)fail('Los permisos internos están protegidos.');
    if((await db.query('SELECT 1 FROM role_permissions WHERE permission_id=$1 LIMIT 1',[id])).rowCount)fail('Quita el permiso de sus roles antes de eliminarlo.',409);
    await db.query('DELETE FROM permissions WHERE id=$1',[id]);
  }
  await audit(user.id,`${resource}.delete`,id);
}
