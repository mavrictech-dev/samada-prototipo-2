import {db} from "@/server/db";
export const dynamic="force-dynamic";
export async function GET(){
  try{
    await db.query({text:"SELECT 1",query_timeout:3000});
    return Response.json({status:"ok",revision:process.env.APP_REVISION||"development"},{headers:{"Cache-Control":"no-store"}});
  }catch{
    return Response.json({status:"unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
