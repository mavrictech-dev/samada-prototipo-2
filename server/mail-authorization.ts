import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {OAuth2Client,CodeChallengeMethod} from 'google-auth-library';
import {googleScope,mailbox} from './mail-config.mjs';
import {safeMailError} from './mail-service';
type Options={clientId:string;clientSecret:string;user:string;transport:'gmail-api'|'gmail-oauth-smtp';port?:number;timeoutMs?:number;onUrl:(url:string)=>void;oauthFactory?:(redirect:string)=>OAuth2Client};
export async function authorizeGoogleMail(options:Options){
 const user=mailbox(options.user),state=randomBytes(32).toString('base64url');
 const server=createServer();server.requestTimeout=10000;server.headersTimeout=10000;
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(options.port??43821,'127.0.0.1',()=>{server.off('error',reject);resolve();});});
 const address=server.address();if(!address||typeof address==='string')throw Error('No se pudo preparar el callback local.');
 const origin=`http://127.0.0.1:${address.port}`,redirect=origin+'/oauth/google/callback';
 const oauth=options.oauthFactory?.(redirect)||new OAuth2Client({clientId:options.clientId,clientSecret:options.clientSecret,redirectUri:redirect,transporterOptions:{timeout:15000,retry:false}});
 let finishTimer:NodeJS.Timeout|undefined;
 try{
  const pkce=await oauth.generateCodeVerifierAsync();
  const url=oauth.generateAuthUrl({access_type:'offline',prompt:'consent',scope:['openid','email',googleScope(options.transport)!],state,login_hint:user,code_challenge:pkce.codeChallenge,code_challenge_method:CodeChallengeMethod.S256});
  const pending=new Promise<{refreshToken:string;user:string}>((resolve,reject)=>{
   let consumed=false;
   finishTimer=setTimeout(()=>reject(Error('La autorización venció. Ejecuta mail:authorize nuevamente.')),options.timeoutMs??180000);
   server.on('request',(request,response)=>{
    response.setHeader('Cache-Control','no-store');response.setHeader('Referrer-Policy','no-referrer');response.setHeader('Content-Type','text/plain; charset=utf-8');
    if(request.method!=='GET'||request.headers.host!==new URL(origin).host){response.writeHead(400).end('Solicitud inválida.');return;}
    let callback:URL;try{callback=new URL(request.url||'/',origin);}catch{response.writeHead(400).end('URL inválida.');return;}
    if(callback.origin!==origin){response.writeHead(400).end('Origen inválido.');return;}
    if(callback.pathname!=='/oauth/google/callback'){response.writeHead(404).end('Ruta no disponible.');return;}
    const received=callback.searchParams.get('state')||'',a=Buffer.from(received),b=Buffer.from(state);
    if(consumed||a.length!==b.length||!timingSafeEqual(a,b)){response.writeHead(400).end('Estado de autorización inválido o utilizado.');return;}
    consumed=true;
    if(callback.searchParams.has('error')){response.writeHead(400).end('Google no autorizó la conexión. Revisa sus políticas.');reject(Error('Google rechazó el consentimiento. Revisa las políticas de Workspace.'));return;}
    const code=callback.searchParams.get('code');if(!code){response.writeHead(400).end('Código ausente.');reject(Error('Google no devolvió un código de autorización.'));return;}
    void (async()=>{
     try{
      const {tokens}=await oauth.getToken({code,codeVerifier:pkce.codeVerifier,redirect_uri:redirect});
      if(!tokens.refresh_token||!tokens.id_token||!tokens.access_token)throw Error('Falta autorización offline. Revoca el consentimiento anterior y vuelve a autorizar.');
      const identity=await oauth.verifyIdToken({idToken:tokens.id_token,audience:options.clientId});
      const payload=identity.getPayload();
      if(!payload?.email_verified||payload.email?.toLowerCase()!==user)throw Error('La cuenta autorizada no coincide con el buzón solicitado.');
      const info=await oauth.getTokenInfo(tokens.access_token);
      if(!info.scopes.includes(googleScope(options.transport)!))throw Error('Google no concedió el permiso solicitado.');
      response.end('Autorización completada. Vuelve a la terminal y cierra esta pestaña.');resolve({refreshToken:tokens.refresh_token,user});
     }catch{response.writeHead(400).end('No se pudo validar la autorización. Vuelve a la terminal.');reject(Error('No se validó el consentimiento: revisa cuenta, permiso, acceso offline y cliente OAuth.'));}
    })();
   });
  });
  options.onUrl(url);
  return await pending;
 }catch(error){if(error instanceof Error&&(/autoriz|consent|Google|cuenta/i.test(error.message)))throw error;throw safeMailError(error);}
 finally{if(finishTimer)clearTimeout(finishTimer);server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
}
