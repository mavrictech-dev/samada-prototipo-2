import { fail } from "./errors";
async function bodyBytes(request:Request,limit:number){
  const declared=Number(request.headers.get('content-length')||0);if(declared>limit)fail('La solicitud supera el tamaño permitido.',413);
  const reader=request.body?.getReader();if(!reader)return new Uint8Array();
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();fail('La solicitud supera el tamaño permitido.',413);}chunks.push(value);}
  return new Uint8Array(Buffer.concat(chunks));
}
export async function readJson(request:Request){try{return JSON.parse(Buffer.from(await bodyBytes(request,2*1024*1024)).toString('utf8'));}catch(error){if(error instanceof SyntaxError)fail('El cuerpo JSON no es válido.');throw error;}}
export async function readForm(request:Request,limit=26*1024*1024){return new Request(request.url,{method:'POST',headers:{'content-type':request.headers.get('content-type')||''},body:await bodyBytes(request,limit)}).formData();}
