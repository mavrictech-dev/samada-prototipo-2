import "dotenv/config";
import {randomBytes} from "node:crypto";
import {z} from "zod";
import {db,transaction} from "../server/db";
import {auth} from "../server/auth";

async function main(){
 let created=false;
 await transaction(async client=>{
  await client.query("SELECT pg_advisory_xact_lock(125903)");
  const active=await client.query('SELECT 1 FROM user_roles ur JOIN "user" u ON u.id=ur.user_id WHERE ur.role_id=$1 AND u.approved=true AND u.status=$2 LIMIT 1',['superadmin','active']);
  if(active.rowCount){console.log('Ya existe un superadministrador activo; no se cambiaron cuentas ni se enviaron invitaciones.');return;}
  const parsed=z.email().safeParse(process.env.ADMIN_EMAIL?.trim().toLowerCase());
  if(!parsed.success)throw Error('Configura ADMIN_EMAIL con el correo del administrador inicial.');
  const email=parsed.data;
  const existing=await client.query('SELECT id FROM "user" WHERE email=$1',[email]);
  if(existing.rowCount)throw Error('La cuenta inicial ya existe sin rol de administración. Requiere revisión; no se elevaron permisos automáticamente.');
  const signup=await auth.api.signUpEmail({body:{name:'Administrador Samada',email,password:randomBytes(32).toString('base64url')+'Aa1!'}});
  await client.query('UPDATE "user" SET approved=true,status=$2,"emailVerified"=true WHERE id=$1',[signup.user.id,'active']);
  await client.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[signup.user.id,'superadmin']);
  await client.query('INSERT INTO audit_log(user_id,action,entity_id) VALUES($1,$2,$1)',[signup.user.id,'setup.first-admin']);
  created=true;
 });
 if(created){
  await auth.api.requestPasswordReset({body:{email:process.env.ADMIN_EMAIL!.trim().toLowerCase(),redirectTo:process.env.BETTER_AUTH_URL+'/reset-password'}});
  console.log('Administrador inicial preparado. Se solicitó el correo para establecer su contraseña.');
 }
}
main().catch(()=>{console.error('No se pudo preparar el acceso inicial. Revisa ADMIN_EMAIL, la cuenta y la configuración SMTP; no se muestran datos privados.');process.exitCode=1;}).finally(()=>db.end());
