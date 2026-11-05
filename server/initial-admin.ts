import {randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db,transaction} from './db';
import {createAuth} from './auth';
import {verifyMail,MailDeliveryError} from './mail';

const key='initial-admin-access';
type AccessState={userId:string;status:'pending'|'sending'|'sent'|'failed';updatedAt?:string;attemptId?:string};
export async function ensureInitialAdmin(email:string|undefined){
 const bootstrapAuth=createAuth({sendVerificationOnSignUp:false});
 return transaction(async client=>{
  await client.query('SELECT pg_advisory_xact_lock(125903)');
  const active=await client.query('SELECT 1 FROM user_roles ur JOIN "user" u ON u.id=ur.user_id WHERE ur.role_id=$1 AND u.approved=true AND u.status=$2 LIMIT 1',['superadmin','active']);
  if(active.rowCount)return {created:false};
  const parsed=z.email().safeParse(email?.trim().toLowerCase());if(!parsed.success)throw Error('Configura ADMIN_EMAIL.');
  if((await client.query('SELECT 1 FROM "user" WHERE email=$1',[parsed.data])).rowCount)throw Error('Existe una cuenta sin rol; requiere revisión manual.');
  const signup=await bootstrapAuth.api.signUpEmail({body:{name:'Administrador Samada',email:parsed.data,password:randomBytes(32).toString('base64url')+'Aa1!'}});
  await client.query('UPDATE "user" SET approved=true,status=$2,"emailVerified"=true WHERE id=$1',[signup.user.id,'active']);
  await client.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[signup.user.id,'superadmin']);
  await client.query('INSERT INTO audit_log(user_id,action,entity_id) VALUES($1,$2,$1)',[signup.user.id,'setup.first-admin']);
  await client.query('INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[key,JSON.stringify({userId:signup.user.id,status:'pending'} satisfies AccessState)]);
  return {created:true};
 });
}
async function requestAccess(email:string){
 let confirmed=false;const invitationAuth=createAuth({onResetMailSent:()=>{confirmed=true;}});
 await invitationAuth.api.requestPasswordReset({body:{email,redirectTo:process.env.BETTER_AUTH_URL+'/reset-password'}});
 if(!confirmed)throw new MailDeliveryError('uncertain','No se confirmó el correo. Revisa el proveedor antes de reintentar.');
}
export async function sendInitialAccess({retry=false}: {retry?:boolean}={},delivery={verify:verifyMail,request:requestAccess}){
 // Validate connectivity before claiming the invitation, so a missing configuration does not consume it.
 await delivery.verify();
 const claimed=await transaction(async client=>{
  const row=(await client.query('SELECT value FROM settings WHERE key=$1 FOR UPDATE',[key])).rows[0];
  if(!row)return null;const state=row.value as AccessState;
  if(state.status==='sent'||(state.status!=='pending'&&!retry))return null;
  if(state.status==='sending'&&(!state.updatedAt||Date.now()-Date.parse(state.updatedAt)<600000))return null;
  const target=(await client.query('SELECT u.email FROM "user" u JOIN user_roles r ON r.user_id=u.id WHERE u.id=$1 AND r.role_id=$2 AND r.brand_ids IS NULL AND u.approved AND u.status=$3',[state.userId,'superadmin','active'])).rows[0];
  if(!target)throw Error('No hay acceso inicial válido. No se cambiaron permisos.');
  const attemptId=randomUUID();
  await client.query('UPDATE settings SET value=$2 WHERE key=$1',[key,JSON.stringify({...state,attemptId,status:'sending',updatedAt:new Date().toISOString()})]);
  return {email:target.email as string,userId:state.userId,attemptId};
 });
 if(!claimed)return {sent:false};
 try{
  await delivery.request(claimed.email);
  await transaction(async client=>{
   await client.query("UPDATE settings SET value=$2 WHERE key=$1 AND value->>'attemptId'=$3",[key,JSON.stringify({userId:claimed.userId,status:'sent',updatedAt:new Date().toISOString()}),claimed.attemptId]);
   await client.query('INSERT INTO audit_log(user_id,action,entity_id) VALUES($1,$2,$1)',[claimed.userId,'setup.access-mail-sent']);
  });
  return {sent:true};
 }catch(error){await db.query("UPDATE settings SET value=$2 WHERE key=$1 AND value->>'attemptId'=$3",[key,JSON.stringify({userId:claimed.userId,status:'failed',updatedAt:new Date().toISOString()}),claimed.attemptId]);throw error;}
}
