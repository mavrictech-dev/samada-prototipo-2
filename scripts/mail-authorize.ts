import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {authorizeGoogleMail} from '../server/mail-authorization';
import {mailbox,MailConfigurationError} from '../server/mail-config.mjs';

async function main(){
 const {values}=parseArgs({options:{help:{type:'boolean'},'client-config':{type:'string'},user:{type:'string'},transport:{type:'string',default:'gmail-api'},port:{type:'string',default:'43821'},output:{type:'string',default:'data/mail/google-oauth.env'},'accept-full-mail-scope':{type:'boolean'}}});
 if(values.help){console.log('npm run mail:authorize -- --client-config RUTA/client.json --user BUZON --transport gmail-api\nCallback: http://127.0.0.1:43821/oauth/google/callback\nSMTP: --transport gmail-oauth-smtp --accept-full-mail-scope (permiso amplio al buzón).\nLa cuenta y el cliente deben permitir OAuth. Se genera un archivo privado, no se suben secretos.');return;}
 const transport=values.transport;if(transport!=='gmail-api'&&transport!=='gmail-oauth-smtp')throw Error('Elige gmail-api o gmail-oauth-smtp.');
 if(transport==='gmail-oauth-smtp'&&!values['accept-full-mail-scope'])throw Error('SMTP necesita acceso amplio https://mail.google.com/. Confírmalo con --accept-full-mail-scope o usa gmail-api (solo envío).');
 if(!values['client-config']||!values.user)throw Error('Faltan --client-config y --user. Consulta --help.');
 const user=mailbox(values.user),port=Number(values.port);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Puerto local inválido.');
 const output=path.resolve(values.output!),privateRoot=path.resolve('data/mail');
 if(!output.startsWith(privateRoot+path.sep)||path.extname(output)!=='.env')throw Error('El archivo de salida debe ser .env dentro de data/mail, excluido de Git.');
 await fs.mkdir(privateRoot,{recursive:true,mode:0o700});
 const parent=await fs.realpath(path.dirname(output));if(parent!==await fs.realpath(privateRoot))throw Error('Usa un archivo directamente dentro de data/mail.');
 const file=await fs.open(output,'wx',0o600);
 try{
  const config=JSON.parse(await fs.readFile(values['client-config'],'utf8')).web;
  if(!config?.client_id||!config?.client_secret||!config.redirect_uris?.includes(`http://127.0.0.1:${port}/oauth/google/callback`))throw Error('Usa un cliente Web con el callback local exacto registrado en Google.');
  const result=await authorizeGoogleMail({clientId:config.client_id,clientSecret:config.client_secret,user,transport,port,onUrl:url=>{console.log('Abre este enlace de consentimiento en tu navegador (no contiene contraseñas ni tokens):');console.log(url);}});
  const data={MAIL_TRANSPORT:transport,GOOGLE_MAIL_USER:result.user,GOOGLE_OAUTH_CLIENT_ID:config.client_id,GOOGLE_OAUTH_CLIENT_SECRET:config.client_secret,GOOGLE_OAUTH_REFRESH_TOKEN:result.refreshToken,MAIL_FROM:`Samada <${result.user}>`};
  await file.writeFile(Object.entries(data).map(([key,value])=>key+'='+JSON.stringify(value)).join('\n')+'\n','utf8');
  console.log('Configuración OAuth guardada en data/mail. No se ha enviado correo ni transferido secretos. Usa mail:verify con --env-file.');
 }catch(error){await file.close();await fs.unlink(output);throw error;}
 await file.close();
}
main().catch(error=>{console.error(error instanceof MailConfigurationError?error.message:error instanceof Error&&/^(Elige|SMTP necesita|Faltan|Puerto|El archivo|Usa |Google |La autorización|No se validó)/.test(error.message)?error.message:'No se pudo autorizar. Revisa cliente, cuenta, callback y políticas de Workspace. Si el archivo ya existe, elige otro nombre sin sobrescribirlo.');process.exitCode=1;});
