import { db } from "@/server/db";
import { getObject } from "@/server/storage";
import { authorize } from "@/server/access";
import { errorResponse, fail } from "@/server/errors";
export async function GET(request:Request,{params}:{params:Promise<{key:string[]}>}) {
  try {
    const key=(await params).key.join('/');
    if(!key.startsWith('images/'))fail("Archivo no encontrado.",404);
    const r=await db.query("SELECT a.created_by,p.brand_id,p.active FROM media_assets a LEFT JOIN products p ON p.id=a.product_id WHERE a.object_key=$1 OR a.thumbnail_key=$1",[key]);
    const asset=r.rows[0];if(!asset)fail("Archivo no encontrado.",404);
    if(!asset.active)await authorize(request.headers,"media.read",asset.brand_id||undefined);
    return new Response(new Uint8Array(await getObject(key)),{headers:{"Content-Type":"image/webp","Cache-Control":asset.active?"public, max-age=31536000, immutable":"private, no-store","X-Content-Type-Options":"nosniff"}});
  } catch(error){return errorResponse(error);}
}
