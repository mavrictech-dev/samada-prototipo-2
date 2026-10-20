import {stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
try{
  const heartbeat=await stat(path.join(os.tmpdir(),'samada-worker-heartbeat'));
  if(Date.now()-heartbeat.mtimeMs>45000)process.exitCode=1;
}catch{process.exitCode=1;}
