import { loadState } from "@/server/catalog";
import { errorResponse } from "@/server/errors";
export async function GET(){try{return Response.json(await loadState(),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
export async function POST(){return Response.json({error:"La escritura global fue retirada. Utiliza las operaciones autenticadas del CMS."},{status:405});}
