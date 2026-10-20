import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const base={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP};
const valid={POSTGRES_PASSWORD:randomBytes(32).toString('hex'),BETTER_AUTH_SECRET:randomBytes(32).toString('hex'),BETTER_AUTH_URL:'https://gestion.samadaperu.com',TRUSTED_ORIGINS:'https://gestion.samadaperu.com,https://samadaperu.com',SMTP_HOST:'smtp.samadaperu.com',MAIL_FROM:'Samada <acceso@samadaperu.com>'};
const check=env=>spawnSync(process.execPath,['scripts/validate-production.mjs'],{env:{...base,...env},encoding:'utf8'});
test('Producción: requiere configuración real y no imprime secretos',()=>{
 const absent=check({});assert.equal(absent.status,1);assert.match(absent.stderr,/Falta BETTER_AUTH_URL/);
 const good=check(valid);assert.equal(good.status,0);assert.ok(!good.stdout.includes(valid.BETTER_AUTH_SECRET));assert.ok(!good.stdout.includes(valid.POSTGRES_PASSWORD));
 for(const override of [{BETTER_AUTH_URL:'http://localhost:3000'},{SMTP_HOST:'127.0.0.1'},{POSTGRES_PASSWORD:'corto'},{TRUSTED_ORIGINS:'https://otro.example'},{BETTER_AUTH_SECRET:'CAMBIAR_POR_OPENSSL_RAND_HEX_32'},{MAIL_FROM:'Samada <acceso@samada.local>'},{SMTP_USER:'usuario'}])assert.equal(check({...valid,...override}).status,1);
});
test('Worker: heartbeat ausente o antiguo falla; heartbeat reciente pasa',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'samada-heartbeat-test-')),file=path.join(directory,'samada-worker-heartbeat');
 const heartbeat=()=>spawnSync(process.execPath,['scripts/worker-health.mjs'],{env:{...base,TEMP:directory,TMP:directory,TMPDIR:directory}});
 try{assert.equal(heartbeat().status,1);await fs.writeFile(file,'ready');assert.equal(heartbeat().status,0);const old=new Date(Date.now()-60000);await fs.utimes(file,old,old);assert.equal(heartbeat().status,1);}finally{await fs.unlink(file).catch(()=>{});await fs.rmdir(directory);}
});
