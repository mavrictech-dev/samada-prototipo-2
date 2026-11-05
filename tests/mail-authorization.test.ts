import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OAuth2Client,LoginTicket} from 'google-auth-library';
import {authorizeGoogleMail} from '../server/mail-authorization';
import {GOOGLE_SEND_SCOPE} from '../server/mail-config.mjs';
function fake(redirect:string,email='sender@example.test'){
 const client=new OAuth2Client({clientId:'test-client',clientSecret:'test-secret',redirectUri:redirect});
 client.getToken=(async(options:{codeVerifier?:string})=>{assert.ok(options.codeVerifier&&options.codeVerifier.length>=43);return {tokens:{access_token:'access',refresh_token:'refresh',id_token:'id'},res:null};}) as OAuth2Client['getToken'];
 client.verifyIdToken=(async()=>new LoginTicket('test',{iss:'https://accounts.google.com',aud:'test-client',iat:1,exp:9999999999,sub:'test-user',email,email_verified:true})) as OAuth2Client['verifyIdToken'];
 client.getTokenInfo=async()=>({email,scopes:[GOOGLE_SEND_SCOPE],expiry_date:Date.now()+300000,aud:'test-client'});
 return client;
}
test('Callback loopback: valida state y PKCE, no entrega tokens al navegador y se cierra',async()=>{
 let finish!:(url:string)=>void;const ready=new Promise<string>(resolve=>{finish=resolve;});
 const authorize=authorizeGoogleMail({clientId:'test-client',clientSecret:'test-secret',user:'sender@example.test',transport:'gmail-api',port:0,onUrl:finish,oauthFactory:redirect=>fake(redirect)});
 const google=new URL(await ready),callback=new URL(google.searchParams.get('redirect_uri')!);
 assert.equal(callback.hostname,'127.0.0.1');assert.equal(google.searchParams.get('code_challenge_method'),'S256');assert.equal(google.searchParams.get('access_type'),'offline');
 callback.searchParams.set('state','wrong');callback.searchParams.set('code','test-code');assert.equal((await fetch(callback)).status,400);
 callback.searchParams.set('state',google.searchParams.get('state')!);const response=await fetch(callback);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.ok(!(await response.text()).includes('refresh'));
 assert.deepEqual(await authorize,{user:'sender@example.test',refreshToken:'refresh'});await assert.rejects(()=>fetch(callback));
});
test('Una cuenta distinta no puede vincularse al remitente esperado',async()=>{
 let finish!:(url:string)=>void;const ready=new Promise<string>(resolve=>{finish=resolve;});
 const authorization=authorizeGoogleMail({clientId:'test-client',clientSecret:'test-secret',user:'sender@example.test',transport:'gmail-api',port:0,onUrl:finish,oauthFactory:redirect=>fake(redirect,'other@example.test')});
 const rejected=assert.rejects(authorization,/No se validó/);
 const google=new URL(await ready),callback=new URL(google.searchParams.get('redirect_uri')!);callback.searchParams.set('state',google.searchParams.get('state')!);callback.searchParams.set('code','test-code');assert.equal((await fetch(callback)).status,400);await rejected;
});
test('Autorización sin respuesta vence y libera el puerto',async()=>{
 await assert.rejects(authorizeGoogleMail({clientId:'test-client',clientSecret:'test-secret',user:'sender@example.test',transport:'gmail-api',port:0,timeoutMs:100,onUrl:()=>{},oauthFactory:redirect=>fake(redirect)}),/venció/);
});
test('Google denegado no crea credenciales ni expone datos en el callback',async()=>{
 let finish!:(url:string)=>void;const ready=new Promise<string>(resolve=>{finish=resolve;});
 const authorization=authorizeGoogleMail({clientId:'test-client',clientSecret:'private-client-secret',user:'sender@example.test',transport:'gmail-api',port:0,onUrl:finish,oauthFactory:redirect=>fake(redirect)});
 const rejected=assert.rejects(authorization,/Google rechazó/);
 const google=new URL(await ready),callback=new URL(google.searchParams.get('redirect_uri')!);callback.searchParams.set('state',google.searchParams.get('state')!);callback.searchParams.set('error','admin_policy_enforced');
 const response=await fetch(callback);assert.equal(response.status,400);assert.ok(!(await response.text()).includes('private-client-secret'));await rejected;
});
