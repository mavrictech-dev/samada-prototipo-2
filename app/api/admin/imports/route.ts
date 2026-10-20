import { readForm } from "@/server/request";
import { authorize,checkOrigin } from "@/server/access";
import { parseFile,previewImport } from "@/server/imports";
import { errorResponse,fail } from "@/server/errors";
export async function POST(request:Request){try{checkOrigin(request);const user=await authorize(request.headers,'imports.upload');const form=await readForm(request);const file=form.get('file');if(!(file instanceof File))fail('Selecciona un archivo.');if(file.size>20*1024*1024)fail('El archivo supera 20 MB.');const records=await parseFile(Buffer.from(await file.arrayBuffer()),file.name,String(form.get('delimiter')||','));return Response.json({id:await previewImport(user,records,file.name,String(form.get('mode')||'upsert'))});}catch(error){return errorResponse(error);}}
