import { readJson, readForm } from "@/server/request";
import { authorize,checkOrigin } from "@/server/access";
import { createMediaJob,addMedia } from "@/server/jobs";
import { errorResponse,fail } from "@/server/errors";
export async function POST(request:Request){try{
  checkOrigin(request);const user=await authorize(request.headers,'media.upload');
  if(request.headers.get('content-type')?.includes('application/json'))return Response.json({id:await createMediaJob(user,String((await readJson(request)).filename||'Carpeta de imágenes'))});
  const form=await readForm(request);const id=String(form.get('jobId')||'');const files=form.getAll('files').filter((item):item is File=>item instanceof File);if(!id||!files.length)fail('Selecciona imágenes y un lote válido.');
  await addMedia(user,id,files);return Response.json({ok:true});
}catch(error){return errorResponse(error);}}
