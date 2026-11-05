import "dotenv/config";
import {ensureInitialAdmin} from "../server/initial-admin";
import {db} from "../server/db";
async function main(){
 const result=await ensureInitialAdmin(process.env.ADMIN_EMAIL);
 console.log(result.created?'Administrador inicial preparado sin enviar correo. El enlace se solicitará tras activar la aplicación.':'Ya existe un superadministrador activo. No se alteraron cuentas ni se enviaron mensajes.');
}
main().catch(()=>{console.error('No se pudo preparar el acceso inicial. Revisa ADMIN_EMAIL y las cuentas existentes; no se elevaron usuarios preexistentes.');process.exitCode=1;}).finally(()=>db.end());
