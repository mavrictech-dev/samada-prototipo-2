import { auth } from "@/server/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { mailEnabled } from "@/server/mail-config.mjs";
const handlers=toNextJsHandler(auth);
function unavailable(request:Request){
 const path=new URL(request.url).pathname.replace(/\/+$/,'');
 return !mailEnabled()&&['/sign-up/email','/request-password-reset','/forget-password','/send-verification-email','/reset-password','/verify-email'].some(endpoint=>path.endsWith(endpoint));
}
export async function GET(request:Request){return unavailable(request)?Response.json({message:'El registro y la recuperación por correo están desactivados temporalmente.'},{status:503}):handlers.GET(request);}
export async function POST(request:Request){return unavailable(request)?Response.json({message:'El registro y la recuperación por correo están desactivados temporalmente.'},{status:503}):handlers.POST(request);}
export const runtime="nodejs";
