import 'dotenv/config';
import {parseArgs} from 'node:util';
import {sendInitialAccess} from '../server/initial-admin';
import {db} from '../server/db';
import {closeMail} from '../server/mail';
async function main(){
 const {values}=parseArgs({options:{initial:{type:'boolean'},retry:{type:'boolean'},help:{type:'boolean'}}});
 if(values.help){console.log('npm run admin:send-access -- --initial [--retry]\nEnvía una vez el acceso del administrador creado por admin:ensure. --retry permite repetir explícitamente un envío fallido o interrumpido, tras revisar el proveedor.');return;}
 if(!values.initial)throw Error('Usa --initial; no se admiten destinatarios arbitrarios.');
 const result=await sendInitialAccess({retry:values.retry});console.log(result.sent?'El proveedor aceptó el enlace de acceso. Comprueba la recepción.':'No hay invitación pendiente; no se envió correo.');
}
main().catch(error=>{console.error(error instanceof Error&&error.name==='MailDeliveryError'?error.message:'No se pudo enviar el acceso. Revisa configuración y estado; no se modificaron permisos.');process.exitCode=1;}).finally(async()=>{closeMail();await db.end();});
