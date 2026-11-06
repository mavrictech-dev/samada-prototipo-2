import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export function deploymentAccess(env){
 const missing=[];
 if(!env.SSH_PASSWORD&&!env.SSH_PRIVATE_KEY)missing.push('SSH_PASSWORD o SSH_PRIVATE_KEY');
 if(!env.ADMIN_EMAIL)missing.push('ADMIN_EMAIL');
 let source='none';
 if(env.MAIL_TRANSPORT==='disabled')source='disabled';
 else if(env.MAIL_CONFIGURED_ON_VPS==='true')source='vps';
 else missing.push('MAIL_CONFIGURED_ON_VPS=true después de preparar SMTP y verificar DNS');
 return {ready:missing.length===0&&source!=='none',source,missing};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=deploymentAccess(process.env);
 if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`configured=${result.ready}\nmail_source=${result.source}\n`);
 if(process.env.GITHUB_STEP_SUMMARY){
  const summary=result.ready?`### Acceso de despliegue preparado\nOrigen del correo: ${result.source}. Se verificará antes de migrar.\n`:`### Despliegue pendiente de configurar\nFalta: ${result.missing.join(', ')}.\nConsulta docs/CONFIGURAR-CORREO-SAMADA.md. No se contactó al VPS.\n`;
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
 }
 console.log(result.ready?'Acceso de despliegue preparado; no se muestran valores.':'Despliegue omitido: configuración pendiente; no se muestran valores.');
}
