import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {parse} from 'dotenv';
const base={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP};
const google={MAIL_TRANSPORT:'gmail-api',GOOGLE_MAIL_USER:'sender@example.test',GOOGLE_OAUTH_CLIENT_ID:'client-id',GOOGLE_OAUTH_CLIENT_SECRET:'secret-private',GOOGLE_OAUTH_REFRESH_TOKEN:'refresh-private',MAIL_FROM:'Samada <sender@example.test>'};
const valid={POSTGRES_PASSWORD:randomBytes(32).toString('hex'),BETTER_AUTH_SECRET:randomBytes(32).toString('hex'),BETTER_AUTH_URL:'https://gestion.samadaperu.com',TRUSTED_ORIGINS:'https://gestion.samadaperu.com,https://samadaperu.com',...google};
const check=env=>spawnSync(process.execPath,['scripts/validate-production.mjs'],{env:{...base,...env},encoding:'utf8'});
test('Bootstrap OAuth conserva claves, elimina SMTP obsoleto y no imprime secretos',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'samada-bootstrap-test-')),script=path.resolve('scripts/bootstrap-production.mjs'),file=path.join(directory,'.env');
 const run=extra=>spawnSync(process.execPath,[script],{cwd:directory,env:{...base,...extra},encoding:'utf8'});
 try{
  const first=run({});assert.equal(first.status,0);const initial=await fs.readFile(file,'utf8');assert.match(initial,/POSTGRES_PASSWORD=[a-f0-9]{64}/);
  await fs.appendFile(file,'SMTP_HOST=smtp.resend.com\nSMTP_PASSWORD=legacy-secret\n');
  const apply=run(Object.fromEntries(Object.entries({...google,ADMIN_EMAIL:'owner@example.test'}).map(([k,v])=>['DEPLOY_'+k,v])));
  assert.equal(apply.status,0);for(const secret of ['secret-private','refresh-private','owner@example.test'])assert.ok(!apply.stdout.includes(secret)&&!apply.stderr.includes(secret));
  const after=await fs.readFile(file,'utf8'),config=parse(after);
  assert.equal(config.MAIL_TRANSPORT,'gmail-api');assert.equal(config.GOOGLE_OAUTH_REFRESH_TOKEN,'refresh-private');assert.ok(!after.includes('SMTP_PASSWORD'));assert.ok(!after.includes('resend'));
  for(const name of ['POSTGRES_PASSWORD','BETTER_AUTH_SECRET'])assert.equal(parse(initial)[name],config[name]);
  const invalid=run({DEPLOY_MAIL_TRANSPORT:'gmail-api'});assert.equal(invalid.status,1);assert.equal(await fs.readFile(file,'utf8'),after);
  await fs.writeFile(file,'# Configuración previa\nPOSTGRES_PASSWORD=conservar\n');
  assert.equal(run({DEPLOY_MAIL_TRANSPORT:'gmail-api'}).status,0);assert.equal(await fs.readFile(file,'utf8'),'# Configuración previa\nPOSTGRES_PASSWORD=conservar\n');
 }finally{await fs.unlink(file).catch(()=>{});await fs.rmdir(directory);}
});
test('Producción usa OAuth sin SMTP_PASSWORD y rechaza configuraciones incompletas',()=>{
 assert.equal(check(valid).status,0);const good=check(valid);assert.ok(!good.stdout.includes(valid.GOOGLE_OAUTH_REFRESH_TOKEN));
 for(const override of [{BETTER_AUTH_URL:'http://localhost:3000'},{MAIL_TRANSPORT:''},{MAIL_TRANSPORT:'smtp-local',SMTP_HOST:'mail'},{GOOGLE_OAUTH_REFRESH_TOKEN:''},{GOOGLE_OAUTH_CLIENT_SECRET:''},{MAIL_FROM:'Samada <other@example.test>'},{GOOGLE_MAIL_USER:'sender@samada.local',MAIL_FROM:'Samada <sender@samada.local>'},{TRUSTED_ORIGINS:'https://otro.example'},{BETTER_AUTH_SECRET:'CAMBIAR_POR_VALOR'}])assert.equal(check({...valid,...override}).status,1);
 const smtp={...valid,MAIL_TRANSPORT:'smtp',SMTP_HOST:'smtp.example.test',SMTP_PORT:'587',SMTP_SECURE:'false',SMTP_USER:'user',SMTP_PASSWORD:'secret'};
 assert.equal(check(smtp).status,0);assert.equal(check({...smtp,SMTP_PASSWORD:''}).status,1);
 assert.equal(check({...smtp,SMTP_PORT:'25'}).status,1);
});
test('Worker: heartbeat ausente o antiguo falla; heartbeat reciente pasa',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'samada-heartbeat-test-')),file=path.join(directory,'samada-worker-heartbeat');
 const heartbeat=()=>spawnSync(process.execPath,['scripts/worker-health.mjs'],{env:{...base,TEMP:directory,TMP:directory,TMPDIR:directory}});
 try{assert.equal(heartbeat().status,1);await fs.writeFile(file,'ready');assert.equal(heartbeat().status,0);const old=new Date(Date.now()-60000);await fs.utimes(file,old,old);assert.equal(heartbeat().status,1);}finally{await fs.unlink(file).catch(()=>{});await fs.rmdir(directory);}
});
