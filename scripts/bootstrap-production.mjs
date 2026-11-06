import fs from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {readMailConfig,mailbox} from '../server/mail-config.mjs';

const marker='# Configuración privada inicial de Samada;';
const fieldNames=['MAIL_TRANSPORT','MAIL_FROM','GOOGLE_MAIL_USER','GOOGLE_OAUTH_CLIENT_ID','GOOGLE_OAUTH_CLIENT_SECRET','GOOGLE_OAUTH_REFRESH_TOKEN','SMTP_HOST','SMTP_PORT','SMTP_SECURE','SMTP_USER','SMTP_PASSWORD','ADMIN_EMAIL'];
let current;
try{current=await fs.readFile('.env','utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
if(current!==undefined&&!current.startsWith(marker)){
 if(process.env.DEPLOY_MAIL_TRANSPORT)throw Error('.env existente conservado. No se aplicaron cambios a un archivo ajeno: revisa su gestión antes de reintentar.');
 console.log('.env existente conservado. Configura explícitamente su transporte; la validación no aceptará proveedores antiguos por omisión.');
}else{
 const created=current===undefined;
 let text=current??[
  marker+' Credenciales locales; correo configurable.',
  'POSTGRES_PASSWORD='+randomBytes(32).toString('hex'),
  'BETTER_AUTH_SECRET='+randomBytes(32).toString('hex'),
  'BETTER_AUTH_URL=https://gestion.samadaperu.com',
  'TRUSTED_ORIGINS=https://gestion.samadaperu.com,https://samadaperu.com,https://www.samadaperu.com','',
 ].join('\n');
 const incoming=Object.fromEntries(fieldNames.flatMap(name=>{const value=process.env['DEPLOY_'+name];return value===undefined?[]:[[name,value]];}));
 const hasMail=Boolean(incoming.MAIL_TRANSPORT);
 if(hasMail)readMailConfig(incoming,{production:true});
 if(incoming.ADMIN_EMAIL)mailbox(incoming.ADMIN_EMAIL);
 for(const [name,value] of Object.entries(incoming)){
  if(name!=='ADMIN_EMAIL'&&!hasMail)continue;
  if(/[\r\n\0]/.test(value))throw Error('La configuración contiene saltos de línea no admitidos.');
  const line=name+'='+JSON.stringify(value).replace(/\$/g,()=> '$$'),pattern=new RegExp('^'+name+'=.*$','m');
  text=pattern.test(text)?text.replace(pattern,()=>line):text+line+'\n';
 }
 if(hasMail&&(incoming.MAIL_TRANSPORT.startsWith('gmail-')||incoming.MAIL_TRANSPORT==='disabled')){
  text=text.split('\n').filter(line=>!/^SMTP_(HOST|PORT|SECURE|USER|PASSWORD)=/.test(line)&&!(incoming.MAIL_TRANSPORT==='disabled'&&/^GOOGLE_/.test(line))).join('\n');
 }
 if(text!==current){
  const pending='.env.pending-'+randomUUID();
  try{await fs.writeFile(pending,text,{mode:0o600,flag:'wx'});await fs.rename(pending,'.env');await fs.chmod('.env',0o600);}finally{await fs.unlink(pending).catch(()=>{});}
 }
 console.log(created?'Entorno privado creado; no se muestran valores.':'Claves de base y sesión conservadas; configuración de correo aplicada sin mostrar valores.');
}
