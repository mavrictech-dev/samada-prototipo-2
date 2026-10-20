import { readJson } from "@/server/request";
import { z } from "zod";
import { principal, authorize, checkOrigin, allowedBrands, audit } from "@/server/access";
import { loadState, saveProduct, saveTaxonomy, savePage, deleteCatalog, taxonomyResources, type TaxonomyResource, sorts, parsed } from "@/server/catalog";
import { errorResponse, fail } from "@/server/errors";
import { db } from "@/server/db";
type Context={params:Promise<{resource:string;id?:string[]}>};
export async function GET(request:Request,ctx:Context){
  try {
    const {resource}=await ctx.params;
    if(resource==='settings'){const user=await authorize(request.headers,'settings.read');if(await allowedBrands(user,'settings.read')!==null)fail('Se requiere permiso global.',403);return Response.json((await db.query('SELECT * FROM settings')).rows);}
    if(resource==='audit'){const user=await authorize(request.headers,'audit.read');if(await allowedBrands(user,'audit.read')!==null)fail('Se requiere permiso global.',403);return Response.json((await db.query('SELECT a.*,u.name AS user_name FROM audit_log a LEFT JOIN "user" u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 200')).rows);}
    const user=await authorize(request.headers,resource==='products'?'products.read':resource==='pages'?'pages.read':'taxonomy.read');
    const state=await loadState(user);
    if(!['products','pages',...taxonomyResources].includes(resource))fail('Recurso no encontrado.',404);
    const list=state[resource as keyof typeof state];return Response.json(list);
  }catch(error){return errorResponse(error);}
}
async function mutate(request:Request,ctx:Context){
  try {
    checkOrigin(request);const user=await principal(request.headers);const {resource,id:parts}=await ctx.params;const id=parts?.[0];
    if(request.method==='DELETE'){if(!id)fail('Falta el identificador.');await deleteCatalog(user,resource,id);return Response.json({ok:true});}
    const input=await readJson(request);if(id)input.id=id;
    if(resource==='products')return Response.json({id:await saveProduct(user,input)});
    if(taxonomyResources.includes(resource as TaxonomyResource))return Response.json({id:await saveTaxonomy(user,resource as TaxonomyResource,input)});
    if(resource==='pages')return Response.json({id:await savePage(user,input)});
    if(resource==='settings') {
      const editor=await authorize(request.headers,'settings.update');if(await allowedBrands(editor,'settings.update')!==null)fail('Se requiere permiso global.',403);
      const settings=parsed(z.object({sort:z.enum(sorts),branches:z.array(z.object({id:z.string().min(1),name:z.string().min(1),phone:z.string().regex(/^\d{0,16}$/),address:z.string().max(1000)})).max(100)}),input);
      for(const [key,value] of Object.entries(settings))await db.query('INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[key,JSON.stringify(value)]);
      await audit(user.id,'settings.update',null);return Response.json({ok:true});
    }
    fail('Recurso no encontrado.',404);
  }catch(error){return errorResponse(error);}
}
export const POST=mutate;export const PUT=mutate;export const DELETE=mutate;
