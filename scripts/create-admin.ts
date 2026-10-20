import "dotenv/config";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import { auth } from "../server/auth";
import { db, transaction } from "../server/db";

async function main(){
  const args=process.argv.slice(2);const email=args[args.indexOf('--email')+1];
  if(!args.includes('--email')||!email?.includes('@'))throw new Error('Uso: npm run admin:create -- --email admin@samada.local');
  const password=randomBytes(21).toString('base64url')+'aA1!';
  const exists=await db.query('SELECT id FROM "user" WHERE email=$1',[email.toLowerCase()]);
  if(exists.rowCount)throw new Error('El usuario ya existe. No se alteraron sus credenciales.');
  const result=await auth.api.signUpEmail({body:{name:'Administrador Samada',email,password}});
  await transaction(async client=>{
    await client.query('UPDATE "user" SET approved=true,status=\'active\',"emailVerified"=true WHERE id=$1',[result.user.id]);
    await client.query("INSERT INTO user_roles(user_id,role_id) VALUES($1,'superadmin')",[result.user.id]);
    await client.query("INSERT INTO audit_log(user_id,action,entity_id) VALUES($1,'setup.admin',$1)",[result.user.id]);
  });
  await fs.mkdir('data',{recursive:true});
  await fs.writeFile('data/ACCESO-LOCAL.txt',`URL: ${process.env.BETTER_AUTH_URL}/login\nCorreo: ${email}\nContraseña temporal aleatoria: ${password}\n\nCambia la contraseña desde Mi cuenta. No compartas este archivo.\n`,{mode:0o600,flag:'wx'});
  console.log('Administrador creado. Credenciales locales en data/ACCESO-LOCAL.txt (archivo excluido de Git).');
}
main().then(()=>db.end()).catch(async error=>{console.error(error);await db.end();process.exitCode=1;});
