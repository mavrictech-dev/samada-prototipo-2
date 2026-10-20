import { readJson } from "@/server/request";
import { principal, checkOrigin, authorize, audit } from "@/server/access";
import { securityList,saveSecurity,deleteSecurity,globalPermission } from "@/server/security";
import { errorResponse,fail } from "@/server/errors";
import { db } from "@/server/db";
import { auth } from "@/server/auth";
type Context={params:Promise<{resource:string;id?:string[]}>};
export async function GET(request:Request,ctx:Context){try{const {resource}=await ctx.params;if(!['users','roles','permissions'].includes(resource))fail('Recurso no encontrado.',404);return Response.json(await securityList(await principal(request.headers),resource));}catch(error){return errorResponse(error);}}
async function mutate(request:Request,ctx:Context){try{
  checkOrigin(request);const user=await principal(request.headers);const {resource,id:parts}=await ctx.params;const id=parts?.[0];
  if(!['users','roles','permissions'].includes(resource))fail('Recurso no encontrado.',404);
  if(resource==='users'&&parts?.[1]==='sessions'){
    await globalPermission(user,'users.sessions');await db.query('DELETE FROM session WHERE "userId"=$1',[id]);await audit(user.id,'users.revoke-sessions',id||null);return Response.json({ok:true});
  }
  if(resource==='users'&&parts?.[1]==='recovery'){
    await authorize(request.headers,'users.update');const r=await db.query('SELECT email FROM "user" WHERE id=$1',[id]);if(!r.rows[0])fail('Usuario no encontrado.',404);
    await auth.api.requestPasswordReset({body:{email:r.rows[0].email,redirectTo:`${process.env.BETTER_AUTH_URL}/reset-password`}});return Response.json({ok:true});
  }
  if(request.method==='DELETE'){if(!id)fail('Falta el identificador.');await deleteSecurity(user,resource,id);return Response.json({ok:true});}
  return Response.json({id:await saveSecurity(user,resource,id,await readJson(request))});
}catch(error){return errorResponse(error);}}
export const POST=mutate;export const PUT=mutate;export const DELETE=mutate;
