import 'dotenv/config';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db} from '../server/db';
import {createAuth} from '../server/auth';
import {ensureInitialAdmin,sendInitialAccess} from '../server/initial-admin';
const key='initial-admin-access';let id:string|undefined;let previous:unknown;let captured=false;
after(async()=>{
 if(captured){if(previous===undefined)await db.query('DELETE FROM settings WHERE key=$1',[key]);else await db.query('UPDATE settings SET value=$2 WHERE key=$1',[key,JSON.stringify(previous)]);}
 if(id){await db.query('DELETE FROM user_roles WHERE user_id=$1',[id]);await db.query('DELETE FROM "user" WHERE id=$1',[id]);}
 await db.end();
});
test('Alta inicial idempotente y recuperación de envío fallido sin duplicar ni elevar usuarios',async()=>{
 previous=(await db.query('SELECT value FROM settings WHERE key=$1',[key])).rows[0]?.value;captured=true;
 const active=(await db.query('SELECT count(*)::int AS n FROM user_roles r JOIN "user" u ON u.id=r.user_id WHERE r.role_id=$1 AND u.status=$2',['superadmin','active'])).rows[0].n;
 const email=`bootstrap-${randomUUID()}@example.test`;
 if(active){assert.deepEqual(await ensureInitialAdmin(email),{created:false});
  id=(await createAuth({sendVerificationOnSignUp:false}).api.signUpEmail({body:{name:'Prueba de instalación',email,password:randomUUID()+'Aa1!'}})).user.id;
  await db.query('UPDATE "user" SET approved=true,status=$2,"emailVerified"=true WHERE id=$1',[id,'active']);
  await db.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[id,'superadmin']);
  await db.query('INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[key,JSON.stringify({userId:id,status:'pending'})]);
 }else{
  assert.deepEqual(await ensureInitialAdmin(email),{created:true});id=(await db.query('SELECT id FROM "user" WHERE email=$1',[email])).rows[0].id;
 }
 assert.deepEqual(await ensureInitialAdmin(email),{created:false});
 let sends=0;const verify=async()=>({transport:'smtp-local' as const,authenticated:true});
 await assert.rejects(sendInitialAccess({}, {verify,request:async()=>{sends++;throw Error('Entrega simulada fallida');}}),/simulada/);
 assert.equal((await db.query('SELECT value FROM settings WHERE key=$1',[key])).rows[0].value.status,'failed');
 assert.deepEqual(await sendInitialAccess({}, {verify,request:async()=>{sends++;}}),{sent:false});assert.equal(sends,1);
 let release!:()=>void;const blocked=new Promise<void>(r=>{release=r;});let started!:()=>void;const ready=new Promise<void>(r=>{started=r;});
 const attempt=sendInitialAccess({retry:true},{verify,request:async()=>{sends++;started();await blocked;}});await ready;
 assert.deepEqual(await sendInitialAccess({retry:true},{verify,request:async()=>{sends++;}}),{sent:false});
 release();assert.deepEqual(await attempt,{sent:true});assert.equal(sends,2);
 assert.deepEqual(await sendInitialAccess({retry:true},{verify,request:async()=>{sends++;}}),{sent:false});assert.equal(sends,2);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM "user" WHERE email=$1',[email])).rows[0].n,1);
});
