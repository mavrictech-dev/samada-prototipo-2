import "dotenv/config";
import {db} from "../server/db";
async function main(){
 const jobs=await db.query("SELECT id,filename,status,total,done,errors,data->>'error' AS error FROM import_jobs ORDER BY created_at DESC LIMIT 8");
 console.log(JSON.stringify(jobs.rows,null,2));
 console.log(JSON.stringify((await db.query("SELECT pid,state,wait_event_type,wait_event,left(query,180) AS query FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND state<>'idle' ")).rows,null,2));
 console.log(JSON.stringify((await db.query("SELECT id,state,retry_count,output FROM pgboss.job WHERE name='samada-process' ORDER BY created_on DESC LIMIT 5")).rows,null,2));
 for(const job of jobs.rows){const errors=await db.query("SELECT row_number,sku,status,errors FROM import_rows WHERE job_id=$1 AND status IN ('error','invalid') ORDER BY row_number LIMIT 3",[job.id]);if(errors.rowCount)console.log(JSON.stringify({job:job.id,examples:errors.rows},null,2));}
}
main().finally(()=>db.end());
