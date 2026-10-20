import "dotenv/config";
import { queue,processJob } from "../server/jobs";
import { db } from "../server/db";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
async function main(){
  const boss=await queue();
  await boss.work<{id:string}>('samada-process',{batchSize:1,pollingIntervalSeconds:1},async jobs=>{
    for(const job of jobs)try{await processJob(job.data.id);}catch(error){await db.query("UPDATE import_jobs SET status='failed',data=data||$2::jsonb WHERE id=$1 AND status<>'cancelled'",[job.data.id,JSON.stringify({error:error instanceof Error?error.message:'Trabajo fallido.'})]);throw error;}
  });
  const heartbeatFile=path.join(os.tmpdir(),'samada-worker-heartbeat');
  const heartbeat=async()=>{await db.query('SELECT 1');await fs.writeFile(heartbeatFile,String(Date.now()),{mode:0o600});};
  await heartbeat();const timer=setInterval(()=>void heartbeat().catch(()=>{}),10000);
  console.log('Worker Samada activo. Los trabajos continúan aunque se cierre el navegador.');
  const close=async()=>{clearInterval(timer);await boss.stop();await fs.rm(heartbeatFile,{force:true});await db.end();process.exit(0);};process.on('SIGINT',close);process.on('SIGTERM',close);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
