import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMailService,MailDeliveryError,safeMailError} from '../server/mail-service';
import {readMailConfig,GOOGLE_SEND_SCOPE,GOOGLE_SMTP_SCOPE} from '../server/mail-config.mjs';
test('Modo sin correo rechaza envíos explícitamente y no contacta proveedores',async()=>{
 let requests=0;const mail=createMailService({MAIL_TRANSPORT:'disabled'},{request:async()=>{requests++;return Response.json({});}});
 await assert.rejects(mail.verify(),/desactivado/);
 await assert.rejects(mail.send('recipient@example.test','Prueba','No enviar'),/desactivado/);
 assert.equal(requests,0);mail.close();
});
const env={MAIL_TRANSPORT:'gmail-api',GOOGLE_MAIL_USER:'sender@example.test',GOOGLE_OAUTH_CLIENT_ID:'client-id',GOOGLE_OAUTH_CLIENT_SECRET:'private-secret',GOOGLE_OAUTH_REFRESH_TOKEN:'private-refresh',MAIL_FROM:'Samada <sender@example.test>'};
const oauth=(options:{email?:string;scopes?:string[];revoked?:boolean}={})=>({
 async getAccessToken(){if(options.revoked)throw {response:{data:{error:'invalid_grant'}},message:'private-refresh invalid_grant'};return {token:'access-private'};},
 async getTokenInfo(){return {email:options.email||env.GOOGLE_MAIL_USER,scopes:options.scopes||[GOOGLE_SEND_SCOPE],expiry_date:Date.now()+3600000,aud:'client-id'};},
});
test('OAuth no necesita SMTP_PASSWORD y exige remitente consistente',()=>{
 assert.equal(readMailConfig(env,{production:true}).transport,'gmail-api');
 assert.throws(()=>readMailConfig({...env,MAIL_FROM:'Samada <other@example.test>'}),/coincidir/);
 for(const name of ['GOOGLE_OAUTH_CLIENT_ID','GOOGLE_OAUTH_CLIENT_SECRET','GOOGLE_OAUTH_REFRESH_TOKEN'])assert.throws(()=>readMailConfig({...env,[name]:''}),new RegExp(name));
 assert.throws(()=>readMailConfig({...env,MAIL_TRANSPORT:''},{production:true}),/MAIL_TRANSPORT/);
 assert.throws(()=>readMailConfig({MAIL_TRANSPORT:'smtp-local',SMTP_HOST:'mail'},{production:true}),/no se admiten/);
});
test('Gmail API compone MIME con Nodemailer y envía una sola solicitud autenticada',async()=>{
 let calls=0;const service=createMailService(env,{oauth:oauth(),request:async(url,options)=>{
  calls++;assert.equal(url,'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');assert.equal(options?.method,'POST');
  assert.equal((options?.headers as Record<string,string>).Authorization,'Bearer access-private');
  const raw=Buffer.from(JSON.parse(String(options?.body)).raw,'base64url').toString();
  assert.match(raw,/From: Samada <sender@example.test>/);assert.match(raw,/To: recipient@example.test/);assert.match(raw,/Mensaje de prueba/);
  return Response.json({id:'gmail-message-1'});
 }});
 try{await service.verify();assert.equal(calls,0,'verify no debe enviar correo');assert.deepEqual(await service.send('recipient@example.test','Prueba','Mensaje de prueba'),{accepted:true,messageId:'gmail-message-1'});assert.equal(calls,1);}finally{service.close();}
});
test('Tokens caducados se solicitan de nuevo; no se almacena un access token fijo',async()=>{
 let renewals=0;const client=oauth();client.getAccessToken=async()=>({token:'token-'+(++renewals)});
 const service=createMailService(env,{oauth:client,request:async()=>Response.json({id:'mail'})});
 try{await service.verify();await service.send('recipient@example.test','Prueba','Mensaje');assert.equal(renewals,2);}finally{service.close();}
});
test('Cuenta incorrecta y scope SMTP no se aceptan como permiso de solo envío',async()=>{
 for(const credentials of [oauth({email:'other@example.test'}),oauth({scopes:[GOOGLE_SMTP_SCOPE]})]){
  let calls=0;const service=createMailService(env,{oauth:credentials,request:async()=>{calls++;return Response.json({id:'unexpected'});}});
  try{await assert.rejects(service.send('recipient@example.test','Prueba','Mensaje'),MailDeliveryError);assert.equal(calls,0);}finally{service.close();}
 }
});
test('Revocación, cuota y respuesta ambigua no filtran secretos ni reenvían mensajes',async()=>{
 const revoked=createMailService(env,{oauth:oauth({revoked:true})});
 try{await assert.rejects(revoked.verify(),error=>error instanceof MailDeliveryError&&error.code==='authorization'&&!error.message.includes('private-refresh'));}finally{revoked.close();}
 for(const [status,code] of [[401,'authorization'],[403,'authorization'],[429,'temporary'],[503,'temporary']] as const){
  let calls=0;const service=createMailService(env,{oauth:oauth(),request:async()=>{calls++;return new Response('private-response',{status});}});
  try{await assert.rejects(service.send('recipient@example.test','Prueba','Mensaje'),error=>error instanceof MailDeliveryError&&error.code===code&&!error.message.includes('private-response'));assert.equal(calls,1);}finally{service.close();}
 }
 let calls=0;const uncertain=createMailService(env,{oauth:oauth(),request:async()=>{calls++;throw Error('access-private network-failure');}});
 try{await assert.rejects(uncertain.send('recipient@example.test','Prueba','Mensaje'),error=>error instanceof MailDeliveryError&&error.code==='uncertain'&&!error.message.includes('access-private'));assert.equal(calls,1);}finally{uncertain.close();}
 assert.ok(!safeMailError(Error('secret-value')).message.includes('secret-value'));
});
