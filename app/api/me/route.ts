import { principal } from "@/server/access";
import { errorResponse } from "@/server/errors";
export async function GET(request:Request) {
  try{return Response.json(await principal(request.headers),{headers:{"Cache-Control":"no-store"}});}
  catch(error){return errorResponse(error);}
}
