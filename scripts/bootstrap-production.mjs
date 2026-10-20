import fs from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';

const marker='# Configuración privada inicial de Samada;';
let current;
try{current=await fs.readFile('.env','utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
if(current!==undefined&&!current.startsWith(marker)){
 console.log('.env existente conservado; configura SMTP directamente en el servidor.');
}else{
 const created=current===undefined;
 let text=current??[
  marker+' correo mediante Resend.',
  'POSTGRES_PASSWORD='+randomBytes(32).toString('hex'),
  'BETTER_AUTH_SECRET='+randomBytes(32).toString('hex'),
  'BETTER_AUTH_URL=https://gestion.samadaperu.com',
  'TRUSTED_ORIGINS=https://gestion.samadaperu.com,https://samadaperu.com,https://www.samadaperu.com',
  'SMTP_HOST=smtp.resend.com','SMTP_PORT=465','SMTP_SECURE=true',
  'SMTP_USER=resend','SMTP_PASSWORD=','MAIL_FROM="Samada <acceso@samadaperu.com>"','',
 ].join('\n');
 const key=process.env.DEPLOY_RESEND_API_KEY;
 const email=process.env.DEPLOY_ADMIN_EMAIL?.trim().toLowerCase();
 if(email){
  if(!/^[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+$/.test(email))throw Error('ADMIN_EMAIL no tiene un formato válido.');
  const line='ADMIN_EMAIL='+JSON.stringify(email),pattern=/^ADMIN_EMAIL=.*$/m;
  text=pattern.test(text)?text.replace(pattern,()=>line):text+line+'\n';
 }
 if(key){
  if(!/^re_[A-Za-z0-9_-]{10,}$/.test(key))throw Error('SMTP_PASSWORD no parece una clave API de Resend válida; no se guardó.');
  const settings={SMTP_HOST:'smtp.resend.com',SMTP_PORT:'465',SMTP_SECURE:'true',SMTP_USER:'resend',SMTP_PASSWORD:key,MAIL_FROM:'Samada <acceso@samadaperu.com>'};
  for(const [name,value] of Object.entries(settings)){
   const line=name+'='+JSON.stringify(value),pattern=new RegExp('^'+name+'=.*$','m');
   text=pattern.test(text)?text.replace(pattern,()=>line):text+line+'\n';
  }
 }
 if(text!==current){
  const pending='.env.pending-'+randomUUID();
  try{await fs.writeFile(pending,text,{mode:0o600,flag:'wx'});await fs.rename(pending,'.env');await fs.chmod('.env',0o600);}finally{await fs.unlink(pending).catch(()=>{});}
 }
 console.log(created?'Entorno privado creado con claves aleatorias; no se muestran valores.':'Claves de base y sesión conservadas; configuración de correo revisada.');
 if(!key)console.log('Falta configurar SMTP_PASSWORD en GitHub con la clave API de Resend. El despliegue exige el correo antes de migrar.');
}
