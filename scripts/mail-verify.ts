import 'dotenv/config';
import {parseArgs} from 'node:util';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import {createMailService} from '../server/mail-service';

async function main(){
 const {values}=parseArgs({options:{help:{type:'boolean'},'env-file':{type:'string'},'send-to':{type:'string'}}});
 if(values.help){console.log('npm run mail:verify -- --env-file data/mail/google-oauth.env\nVerifica conexión/autorización sin enviar mensajes.\nAñade --send-to correo@dominio.com para solicitar explícitamente un único correo de prueba.');return;}
 const env={...process.env,...(values['env-file']?dotenv.parse(await fs.readFile(values['env-file'],'utf8')):{})};
 const mail=createMailService(env);
 try{
  const result=await mail.verify();console.log('Autorización verificada para '+result.transport+'. No se envió ningún correo.');
  if(values['send-to']){await mail.send(values['send-to'],'Samada · prueba de correo','La conexión de correo de Samada está configurada. Este mensaje fue solicitado desde mail:verify.');console.log('El proveedor aceptó el correo de prueba. Comprueba su recepción; aceptación no garantiza entrega.');}
 }finally{mail.close();}
}
main().catch(error=>{console.error(error instanceof Error&&['MailConfigurationError','MailDeliveryError'].includes(error.name)?error.message:'No se pudo verificar. Revisa el archivo privado, el cliente OAuth y el permiso de Workspace.');process.exitCode=1;});
