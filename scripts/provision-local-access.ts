import 'dotenv/config';
import {provisionLocalAccess} from '../server/local-access';
import {db} from '../server/db';
async function main(){
 if(!process.env.ACCESS_EMAIL||!process.env.ACCESS_PUBLIC_KEY)throw Error('Falta el correo o la clave pública de entrega.');
 const encrypted=await provisionLocalAccess(process.env.ACCESS_EMAIL,process.env.ACCESS_PUBLIC_KEY);
 console.log('SAMADA_ACCESS_ENCRYPTED='+encrypted);
 console.log('Acceso local preparado; solo se publica el sobre cifrado para el solicitante.');
}
main().catch(()=>{console.error('No se pudo provisionar el acceso local. No se muestran credenciales.');process.exitCode=1;}).finally(()=>db.end());
