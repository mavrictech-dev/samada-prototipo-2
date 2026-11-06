export const GOOGLE_SEND_SCOPE='https://www.googleapis.com/auth/gmail.send';
export const GOOGLE_SMTP_SCOPE='https://mail.google.com/';
export const googleScope=transport=>transport==='gmail-api'?GOOGLE_SEND_SCOPE:transport==='gmail-oauth-smtp'?GOOGLE_SMTP_SCOPE:undefined;
export const mailEnabled=(env=process.env)=>env.MAIL_TRANSPORT!=='disabled'&&(env.MAIL_TRANSPORT!=='smtp-vps'||env.MAIL_DNS_READY==='true');
export class MailConfigurationError extends Error {constructor(message){super(message);this.name='MailConfigurationError';}}
export function mailbox(value){
 if(typeof value!=='string'||/[\r\n\0]/.test(value))throw new MailConfigurationError('Dirección de correo inválida.');
 const trimmed=value.trim(),bracketed=trimmed.match(/^[^<>]*<([^<>]+)>$/),address=bracketed?bracketed[1]:trimmed;
 if(!/^[^\s<>@,;"']+@[^\s<>@,;"']+\.[^\s<>@,;"']+$/.test(address))throw new MailConfigurationError('Dirección de correo inválida.');
 return address.toLowerCase();
}
/** @typedef {{kind:'google',transport:'gmail-api'|'gmail-oauth-smtp',from:string,user:string,clientId:string,clientSecret:string,refreshToken:string}} GoogleConfig */
/** @typedef {{kind:'smtp',transport:'smtp'|'smtp-local'|'smtp-vps',from:string,host:string,port:number,secure:boolean,user:string,password:string,caFile:string,servername:string,deliveryEnabled:boolean}} SmtpConfig */
/** @param {Record<string,string|undefined>} env @returns {GoogleConfig|SmtpConfig|{kind:'disabled',transport:'disabled'}} */
export function readMailConfig(env=process.env,{production=false}={}){
 const field=name=>{const value=env[name]?.trim();if(!value||/CAMBIAR|GENERAR_/i.test(value))throw new MailConfigurationError('Falta configurar '+name+'.');if(/[\r\n\0]/.test(value))throw new MailConfigurationError('Valor inválido en '+name+'.');return value;};
 const mode=env.MAIL_TRANSPORT||(production?'':env.SMTP_HOST?'smtp-local':'');
 if(mode==='disabled')return {kind:'disabled',transport:'disabled'};
 if(mode==='gmail-api'||mode==='gmail-oauth-smtp'){
  const user=mailbox(field('GOOGLE_MAIL_USER')),from=env.MAIL_FROM||`Samada <${user}>`;
  if(mailbox(from)!==user)throw new MailConfigurationError('MAIL_FROM debe coincidir con GOOGLE_MAIL_USER; no se permiten alias sin validar.');
  return {kind:'google',transport:mode,from,user,clientId:field('GOOGLE_OAUTH_CLIENT_ID'),clientSecret:field('GOOGLE_OAUTH_CLIENT_SECRET'),refreshToken:field('GOOGLE_OAUTH_REFRESH_TOKEN')};
 }
 if(!['smtp','smtp-local','smtp-vps'].includes(mode))throw new MailConfigurationError('Configura MAIL_TRANSPORT: smtp-vps, smtp o smtp-local.');
 const host=field('SMTP_HOST'),port=Number(env.SMTP_PORT||587),secure=env.SMTP_SECURE==='true';
 if(!Number.isInteger(port)||port<1||port>65535)throw new MailConfigurationError('SMTP_PORT inválido.');
 if(env.SMTP_SECURE&&!['true','false'].includes(env.SMTP_SECURE))throw new MailConfigurationError('SMTP_SECURE debe ser true o false.');
 if(production&&(mode==='smtp-local'||['localhost','127.0.0.1','::1'].includes(host)))throw new MailConfigurationError('smtp-local y localhost no se admiten en producción.');
 if(production&&(!secure&&port!==587))throw new MailConfigurationError('Usa SMTPS o puerto 587 con STARTTLS en producción.');
 const user=env.SMTP_USER||'',password=env.SMTP_PASSWORD||'';
 if(Boolean(user)!==Boolean(password))throw new MailConfigurationError('Configura SMTP_USER y SMTP_PASSWORD juntos.');
 if(production&&(!user||!password))throw new MailConfigurationError('SMTP de producción requiere autenticación.');
 const from=env.MAIL_FROM||'Samada <acceso@samada.local>';mailbox(from);
 const caFile=env.SMTP_CA_FILE||'',servername=env.SMTP_TLS_SERVERNAME||host;
 if(mode==='smtp-vps'){
  if(!secure||port!==465)throw new MailConfigurationError('smtp-vps requiere TLS en el puerto 465.');
  if(!user||!password||!caFile)throw new MailConfigurationError('smtp-vps requiere usuario, contraseña y SMTP_CA_FILE.');
  if(mailbox(from)!==mailbox(user))throw new MailConfigurationError('El remitente debe coincidir con la cuenta SMTP del VPS.');
 }
 return {kind:'smtp',transport:mode,from,host,port,secure,user,password,caFile,servername,deliveryEnabled:mode!=='smtp-vps'||env.MAIL_DNS_READY==='true'};
}
