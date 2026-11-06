import 'dotenv/config';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,privateDecrypt,constants,randomUUID,createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {provisionLocalAccess} from '../server/local-access';
import {db} from '../server/db';
import {createAuth} from '../server/auth';
import {POST} from '../app/api/auth/[...all]/route';
const address=`access-${randomUUID()}@example.test`;let id:string|undefined;
after(async()=>{
 if(id){await db.query('DELETE FROM user_roles WHERE user_id=$1',[id]);await db.query('DELETE FROM "user" WHERE id=$1',[id]);}
 await fs.unlink(path.resolve('data/access',createHash('sha256').update(address).digest('hex')+'.json')).catch(()=>{});
 await db.end();
});
test('Acceso cifrado, idempotente, login local y bloqueo de rutas sin correo',async()=>{
 const previous=process.env.MAIL_TRANSPORT;process.env.MAIL_TRANSPORT='disabled';
 try{
  const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:4096});
  const encoded=Buffer.from(publicKey.export({type:'spki',format:'pem'})).toString('base64');
  const decrypt=(cipher:string)=>JSON.parse(privateDecrypt({key:privateKey,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(cipher,'base64')).toString());
  const access=decrypt(await provisionLocalAccess(address,encoded));id=access.id;
  assert.equal(access.email,address);assert.ok(access.password.length>=32);
  assert.deepEqual(decrypt(await provisionLocalAccess(address,encoded)),access);
  const logged=await createAuth().api.signInEmail({body:{email:address,password:access.password}});
  assert.equal(logged.user.id,id);
  for(const endpoint of ['sign-up/email','request-password-reset','send-verification-email']){
   const response=await POST(new Request('http://localhost:3000/api/auth/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:address,password:access.password,name:'No crear'})}));
   assert.equal(response.status,503);
  }
  const nonAdmin=`non-admin-${randomUUID()}@example.test`;
  const account=await createAuth({sendVerificationOnSignUp:false}).api.signUpEmail({body:{name:'Sin privilegios',email:nonAdmin,password:randomUUID()+'Aa1!'}});
  try{await assert.rejects(provisionLocalAccess(nonAdmin,encoded),/ya existe/);assert.equal((await db.query('SELECT 1 FROM user_roles WHERE user_id=$1',[account.user.id])).rowCount,0);}finally{await db.query('DELETE FROM "user" WHERE id=$1',[account.user.id]);}
 }finally{if(previous===undefined)delete process.env.MAIL_TRANSPORT;else process.env.MAIL_TRANSPORT=previous;}
});
