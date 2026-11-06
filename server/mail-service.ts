import nodemailer from 'nodemailer';
import {readFileSync} from 'node:fs';
import {OAuth2Client} from 'google-auth-library';
import {googleScope,mailbox,readMailConfig,MailConfigurationError} from './mail-config.mjs';

export class MailDeliveryError extends Error {
 constructor(public code:'authorization'|'temporary'|'uncertain'|'rejected',message:string){super(message);this.name='MailDeliveryError';}
}
export function safeMailError(error:unknown):Error{
 if(error instanceof MailDeliveryError||error instanceof MailConfigurationError)return error;
 const e=error as {code?:string;responseCode?:number;response?:{status?:number;data?:{error?:string}};message?:string};
 const status=e?.responseCode||e?.response?.status;
 if(e?.code==='EAUTH'||status===401||status===403||status===535||e?.response?.data?.error==='invalid_grant'||e?.message?.includes('invalid_grant'))return new MailDeliveryError('authorization','Google o SMTP rechazó la autorización. Reconecta el correo o solicita aprobación de Workspace.');
 if(status===429||(status&&status>=400&&status<500)||status===503)return new MailDeliveryError('temporary','El servidor de correo rechazó temporalmente el envío. Revisa su estado antes de reintentar.');
 return new MailDeliveryError('uncertain','No se pudo confirmar el envío. Revisa el proveedor antes de repetirlo; el mensaje pudo haberse aceptado.');
}
type OAuth=Pick<OAuth2Client,'getAccessToken'|'getTokenInfo'>;
type Dependencies={oauth?:OAuth;request?:typeof fetch};
export function createMailService(env:Record<string,string|undefined>=process.env,dependencies:Dependencies={}){
 const config=readMailConfig(env);
 if(config.kind==='disabled')return {
  transport:config.transport,
  async verify():Promise<{transport:string;authenticated:boolean}>{throw new MailConfigurationError('El correo está desactivado temporalmente.');},
  async send(...args:[string,string,string]):Promise<{accepted:boolean;messageId:string}>{void args;throw new MailDeliveryError('temporary','El correo está desactivado temporalmente. Solicita ayuda al administrador.');},
  close(){},
 };
 const options={connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000,logger:false as const,debug:false,disableFileAccess:true,disableUrlAccess:true};
 const oauth=config.kind==='google'?(dependencies.oauth||new OAuth2Client({clientId:config.clientId,clientSecret:config.clientSecret,transporterOptions:{timeout:15000,retry:false}})):undefined;
 if(config.kind==='google'&&oauth instanceof OAuth2Client)oauth.setCredentials({refresh_token:config.refreshToken});
 let ca:Buffer|undefined;
 if(config.kind==='smtp'&&config.caFile){try{ca=readFileSync(config.caFile);}catch{throw new MailConfigurationError('No se pudo leer el certificado público SMTP_CA_FILE.');}}
 const smtp=config.kind==='smtp'?nodemailer.createTransport({...options,host:config.host,port:config.port,secure:config.secure,requireTLS:config.transport!=='smtp-local'&&!config.secure,tls:{rejectUnauthorized:true,servername:config.servername,...(ca?{ca}:{})},...(config.user?{auth:{user:config.user,pass:config.password}}:{})}):config.transport==='gmail-oauth-smtp'?nodemailer.createTransport({...options,host:'smtp.gmail.com',port:465,secure:true,auth:{type:'OAuth2',user:config.user,clientId:config.clientId,clientSecret:config.clientSecret,refreshToken:config.refreshToken}}):undefined;
 const composer=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'windows',disableFileAccess:true,disableUrlAccess:true});
 async function googleToken(){
  const token=(await oauth!.getAccessToken()).token;if(!token)throw new MailDeliveryError('authorization','No se obtuvo autorización de Google.');
  const info=await oauth!.getTokenInfo(token);
  if(!info.scopes.includes(googleScope(config.transport)!))throw new MailDeliveryError('authorization','El token no tiene el permiso requerido para el transporte elegido. Vuelve a autorizarlo.');
  if(!info.email||info.email.toLowerCase()!==(config.kind==='google'?config.user:''))throw new MailDeliveryError('authorization','El token pertenece a una cuenta distinta del remitente.');
  return token;
 }
 return {
  transport:config.transport,
  async verify(){try{if(oauth)await googleToken();if(smtp)await smtp.verify();return {transport:config.transport,authenticated:true};}catch(error){throw safeMailError(error);}},
  async send(to:string,subject:string,text:string){
   try{
    if(config.kind==='smtp'&&!config.deliveryEnabled)throw new MailDeliveryError('temporary','Envío pendiente de verificar DNS, DKIM y PTR del correo propio. No se envió el mensaje.');
    mailbox(to);if(/[\r\n\0]/.test(subject))throw new MailConfigurationError('Asunto inválido.');
    if(smtp){const result=await smtp.sendMail({from:config.from,to,subject,text});if(!result.accepted?.length)throw new MailDeliveryError('rejected','El servidor no aceptó el destinatario.');return {accepted:true,messageId:result.messageId};}
    const token=await googleToken(),message=await composer.sendMail({from:config.from,to,subject,text});
    if(!Buffer.isBuffer(message.message))throw new MailDeliveryError('rejected','No se pudo componer el correo.');
    const raw=message.message.toString('base64url');
    const response=await (dependencies.request||fetch)('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({raw}),signal:AbortSignal.timeout(30000)});
    if(!response.ok){if([401,403].includes(response.status))throw new MailDeliveryError('authorization','Google rechazó el permiso de envío. Reautoriza el correo o solicita aprobación de Workspace.');if(response.status===429||response.status>=500)throw new MailDeliveryError('temporary','Google no aceptó el envío temporalmente. Revisa cuota y estado.');throw new MailDeliveryError('rejected','Google rechazó el mensaje. Revisa remitente y configuración.');}
    const result=await response.json() as {id?:string};if(!result.id)throw new MailDeliveryError('uncertain','Google no confirmó el identificador del mensaje. Revisa antes de reintentar.');
    return {accepted:true,messageId:result.id};
   }catch(error){throw safeMailError(error);}
  },
  close(){smtp?.close();composer.close();},
 };
}
