import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,createPublicKey,publicEncrypt,randomBytes,constants} from 'node:crypto';
import {mailbox} from './mail-config.mjs';
import {createAuth} from './auth';
import {transaction} from './db';

export async function provisionLocalAccess(email:string,publicKeyBase64:string){
 const address=mailbox(email),key=createPublicKey(Buffer.from(publicKeyBase64,'base64'));
 if(key.asymmetricKeyType!=='rsa'||(key.asymmetricKeyDetails?.modulusLength||0)<3072)throw Error('Se requiere una clave pública RSA de al menos 3072 bits.');
 const directory=path.resolve('data/access'),file=path.join(directory,createHash('sha256').update(address).digest('hex')+'.json');
 await fs.mkdir(directory,{recursive:true,mode:0o700});
 const result=await transaction(async client=>{
  await client.query('SELECT pg_advisory_xact_lock(125904)');
  const existing=(await client.query('SELECT u.id FROM "user" u JOIN user_roles ur ON ur.user_id=u.id WHERE u.email=$1 AND ur.role_id=$2 AND ur.brand_ids IS NULL AND u.approved AND u.status=$3',[address,'superadmin','active'])).rows[0];
  if(existing){
   const stored=JSON.parse(await fs.readFile(file,'utf8'));
   if(stored.id!==existing.id||stored.email!==address)throw Error('Las credenciales privadas no coinciden. No se modificó la cuenta.');
   return stored as {id:string;email:string;password:string;url:string};
  }
  if((await client.query('SELECT 1 FROM "user" WHERE email=$1',[address])).rowCount)throw Error('La cuenta ya existe. No se elevó ni se cambió su contraseña.');
  const password=randomBytes(24).toString('base64url')+'Aa1!';
  const signup=await createAuth({sendVerificationOnSignUp:false}).api.signUpEmail({body:{name:'Administrador Samada',email:address,password}});
  const stored={id:signup.user.id,email:address,password,url:process.env.BETTER_AUTH_URL+'/login'};
  // Persistir el acceso antes de activar la cuenta; nunca se imprime la contraseña.
  await fs.writeFile(file,JSON.stringify(stored),{mode:0o600,flag:'wx'});
  await client.query('UPDATE "user" SET approved=true,status=$2,"emailVerified"=true WHERE id=$1',[signup.user.id,'active']);
  await client.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[signup.user.id,'superadmin']);
  await client.query('INSERT INTO audit_log(user_id,action,entity_id) VALUES($1,$2,$1)',[signup.user.id,'setup.local-access']);
  return stored;
 });
 const payload=Buffer.from(JSON.stringify(result));
 return publicEncrypt({key,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},payload).toString('base64');
}
