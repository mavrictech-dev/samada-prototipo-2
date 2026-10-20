import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { db } from "./db";
import { sendMail } from "./mail";

export const auth=betterAuth({
  appName:"Samada", baseURL:process.env.BETTER_AUTH_URL||"http://localhost:3000", secret:process.env.BETTER_AUTH_SECRET,
  database:db,
  trustedOrigins:(process.env.TRUSTED_ORIGINS||process.env.BETTER_AUTH_URL||"http://localhost:3000").split(","),
  emailAndPassword:{
    enabled:true, autoSignIn:false, requireEmailVerification:true, minPasswordLength:12,
    resetPasswordTokenExpiresIn:1800, revokeSessionsOnPasswordReset:true,
    sendResetPassword:async({user,url})=>{await sendMail(user.email,"Recupera tu acceso a Samada",`Hola ${user.name},\n\nEstablece tu contraseña mediante este enlace válido por 30 minutos:\n${url}\n\nSi no lo solicitaste, ignora este correo.`);},
  },
  emailVerification:{
    sendOnSignUp:true, autoSignInAfterVerification:false,
    sendVerificationEmail:async({user,url})=>{await sendMail(user.email,"Verifica tu correo de Samada",`Hola ${user.name},\n\nVerifica tu correo:\n${url}\n\nEl acceso al CMS requiere aprobación del administrador.`);},
  },
  session:{expiresIn:60*60*24*7,updateAge:60*60*24,cookieCache:{enabled:false}},
  user:{additionalFields:{approved:{type:"boolean",defaultValue:false,input:false},status:{type:"string",defaultValue:"pending",input:false}}},
  databaseHooks:{session:{create:{before:async(session)=>{
    const result=await db.query('SELECT approved,status FROM "user" WHERE id=$1',[session.userId]);
    const user=result.rows[0];
    if(!user?.approved||user.status!=="active")throw new APIError("FORBIDDEN",{message:"Tu cuenta requiere aprobación o está suspendida."});
  }}}},
  rateLimit:{enabled:true,storage:"database",window:60,max:30},
});
