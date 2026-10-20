import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { randomUUID } from "node:crypto";
import { db,transaction } from "./db";
import { loadState,validateProduct } from "./catalog";
import { permit } from "./access";
import { fail } from "./errors";
import { normalizeSku } from "@/lib/catalog";
import { importFields,importHeaders } from "@/lib/import-fields";
import type { CurrentUser,Product,CmsState } from "@/lib/types";

export function safeCell(value:unknown) {const text=String(value??'');return /^[=+\-@\t\r]/.test(text)?`'${text}`:text;}
export function csvBuffer(rows:unknown[][]) {return Buffer.from('\ufeff'+rows.map(row=>row.map(value=>`"${safeCell(value).replaceAll('"','""')}"`).join(',')).join('\r\n'),'utf8');}
export async function template(user:CurrentUser,format:string,exportData=false){
  const state=await loadState(user);
  if(format==='csv')return csvBuffer([importHeaders,...(exportData?state.products.map(p=>productRow(p,state)):[])]);
  const wb=new ExcelJS.Workbook();wb.creator='Samada';
  const guide=wb.addWorksheet('Instrucciones');
  guide.addRows([['SAMADA · Plantilla catálogo v1','Cómo rellenarla'],['Una fila = un SKU','Cada tamaño vendible debe tener su propio SKU. Usa codigo_grupo para reunir variantes.'],['Obligatorios al crear','sku, nombre, marca_codigo, categoria_codigo, tamano_codigo, precio_mayorista'],['Datos editables','Rellena Productos. Ejemplos y hojas de referencia son ilustrativas; no se importan.'],['Listas actuales','Usa códigos de las hojas. MarcaCategoria, MarcaSubcategoria y MarcaTamano muestran combinaciones habilitadas.'],['Actualizar','SKU obligatorio. Celda vacía o columna ausente conserva el valor previo. 0 y NO sí actualizan.'],['Borrar campo opcional','__BORRAR__ en descripcion, uso, presentacion, codigo_grupo, imagen_archivo o subcategoria_codigo.'],['Valores por defecto','Stock 0, mínimo 1, caja 1, moneda PEN, publicado NO y destacado NO.'],['Imágenes','Carga la carpeta después: SKU.jpg, SKU.png, SKU.webp. Galería: SKU__01.jpg.'],['Números','Punto decimal, sin S/ ni separadores de miles. Los SKU y códigos son TEXTO.'],['Importación','Vista previa obligatoria. Fórmulas y macros no se ejecutan; pega valores. Filas vacías se ignoran.'],['CSV','UTF-8 con coma o punto y coma seleccionado al importar. No convertir SKU a números.']]);
  const sheet=wb.addWorksheet('Productos');sheet.addRow(importHeaders);
  for(let row=2;row<=1501;row++)for(let c=1;c<=importHeaders.length;c++){
    const cell=sheet.getCell(row,c);cell.numFmt=[9,10,11,12,13,18].includes(c)?'0.00':'@';cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'F4F8EF'}};
  }
  if(exportData)state.products.forEach((p,i)=>{sheet.getRow(i+2).values=productRow(p,state);});
  const examples=wb.addWorksheet('Ejemplos');examples.addRow(importHeaders);
  if(state.products[0])examples.addRow(productRow(state.products[0],state));
  const fields=wb.addWorksheet('Campos');fields.addRow(['campo','regla','obligatorio_crear','ejemplo']);importFields.forEach(f=>fields.addRow([...f]));
  const references:[string,string[],unknown[][]][]=[
    ['Marcas',['codigo','nombre'],state.brands.map(b=>[b.code||b.id,b.name])],
    ['Categorias',['codigo','nombre'],state.categories.map(b=>[b.code||b.id,b.name])],
    ['Subcategorias',['codigo','nombre','categoria_codigo'],state.subcategories.map(b=>[b.code||b.id,b.name,state.categories.find(c=>c.id===b.categoryId)?.code])],
    ['Tamanos',['codigo','etiqueta','tipo','valor','unidad','orden'],state.sizes.map(b=>[b.code||b.id,b.name,b.type,b.value,b.unit,b.position])],
    ['MarcaCategoria',['marca_codigo','categoria_codigo'],state.brands.flatMap(b=>(b.categoryIds||[]).map(id=>[b.code||b.id,state.categories.find(c=>c.id===id)?.code]))],
    ['MarcaSubcategoria',['marca_codigo','subcategoria_codigo'],state.brands.flatMap(b=>(b.subcategoryIds||[]).map(id=>[b.code||b.id,state.subcategories.find(c=>c.id===id)?.code]))],
    ['MarcaTamano',['marca_codigo','tamano_codigo'],state.brands.flatMap(b=>(b.sizeIds||[]).map(id=>[b.code||b.id,state.sizes.find(c=>c.id===id)?.code]))],
  ];
  references.forEach(([name,headers,rows])=>{const ws=wb.addWorksheet(name);ws.addRow(headers);ws.addRows(rows);});
  const schema=wb.addWorksheet('_Schema');schema.addRow(['version','samada-catalogo-v1']);schema.state='veryHidden';
  wb.worksheets.forEach(ws=>{
    ws.views=[{state:'frozen',ySplit:1}];ws.columns.forEach((c,i)=>{c.width=ws===guide?(i===0?28:110):i===1?36:24;});
    ws.eachRow(row=>row.eachCell(cell=>{cell.font={name:'Arial',size:10,color:{argb:'24321D'}};cell.alignment={vertical:'top',wrapText:true};}));
    ws.getRow(1).eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'24321D'}};cell.font={name:'Arial',bold:true,color:{argb:'FFFFFF'},size:10};});ws.getRow(1).height=30;
    ws.autoFilter={from:'A1',to:{row:Math.max(ws.rowCount,2),column:ws.columnCount}};
  });
  importFields.forEach((f,i)=>{sheet.getCell(1,i+1).note=`${f[2]==='SI'?'Obligatorio al crear. ':'Opcional. '}${f[1]}`;if(f[2]==='SI')sheet.getCell(1,i+1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'558B2F'}};});
  for(const [column,name] of [[3,'Marcas'],[4,'Categorias'],[5,'Subcategorias'],[6,'Tamanos']] as const){const ws=wb.getWorksheet(name)!;if(ws.rowCount>1){wb.definedNames.add(`'${name}'!$A$2:$A$${ws.rowCount}`,`Lista${name}`);for(let r=2;r<=1501;r++)sheet.getCell(r,column).dataValidation={type:'list',allowBlank:true,formulae:[`Lista${name}`],showErrorMessage:true,error:'Selecciona un código de referencia.'};}}
  for(let r=2;r<=1501;r++)for(const c of [16,17])sheet.getCell(r,c).dataValidation={type:'list',allowBlank:true,formulae:['"SI,NO"']};
  return Buffer.from(await wb.xlsx.writeBuffer());
}
function productRow(p:Product,state:CmsState){return [p.sku,p.name,state.brands.find(b=>b.id===p.brand)?.code,state.categories.find(b=>b.id===p.category)?.code,state.subcategories.find(b=>b.id===p.subcategory)?.code||'',state.sizes.find(b=>b.id===p.sizeId)?.code,p.groupCode,p.presentation,p.wholesalePrice,p.retailPrice,p.stock,p.minOrder,p.unitsPerCase,p.description,p.use,p.active?'SI':'NO',p.featured?'SI':'NO',p.position,p.currency||'PEN',p.imageFile||''];}
function inspectZip(buffer:Buffer){
  let total=0,count=0;
  for(let i=0;i<buffer.length-46;i++)if(buffer.readUInt32LE(i)===0x02014b50){total+=buffer.readUInt32LE(i+24);count++;if(total>150*1024*1024||count>3000)fail('El Excel descomprimido supera los límites. Divide el archivo.');i+=45;}
}
export async function parseFile(buffer:Buffer,filename:string,delimiter=','):Promise<Record<string,unknown>[]> {
  if(buffer.length>20*1024*1024)fail('El archivo supera 20 MB.');
  let records:Record<string,unknown>[]=[];
  if(filename.toLowerCase().endsWith('.csv')){
    if(![',',';'].includes(delimiter))fail('Separador no válido.');
    records=parse(buffer,{columns:(headers:string[])=>{if(new Set(headers).size!==headers.length)fail('Hay encabezados duplicados.');return headers;},bom:true,delimiter,skip_empty_lines:true,trim:true,max_record_size:100000}) as Record<string,unknown>[];
  }else if(filename.toLowerCase().endsWith('.xlsx')){
    inspectZip(buffer);const wb=new ExcelJS.Workbook();await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const version=wb.getWorksheet('_Schema')?.getCell('B1').text;if(version&&version!=='samada-catalogo-v1')fail('Versión de plantilla incompatible. Descarga una plantilla nueva.');
    const sheet=wb.getWorksheet('Productos');if(!sheet)fail('Falta la hoja Productos.');if(sheet.rowCount>10001)fail('Máximo 10.000 filas por archivo.');
    const headers=(sheet.getRow(1).values as unknown[]).slice(1).map(v=>String(v||'').trim());
    if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)fail('Hay encabezados duplicados.');
    sheet.eachRow((row,index)=>{if(index===1)return;const record:Record<string,unknown>={};const errors:string[]=[];
      headers.forEach((header,i)=>{if(!header)return;const value=row.getCell(i+1).value;if(value&&typeof value==='object'){if('formula' in value||'sharedFormula' in value)errors.push(`${header}: pega valores; no fórmulas.`);else errors.push(`${header}: formato de celda no admitido.`);record[header]='';}else{record[header]=value??'';if((header==='sku'||header.endsWith('_codigo'))&&typeof value==='number')errors.push(`${header}: debe ser texto para conservar ceros iniciales.`);}});
      if(Object.values(record).some(v=>v!==''&&v!==null)){if(errors.length)record.__parseErrors=errors;records.push(record);}
    });
  }else fail('Usa un archivo .xlsx o .csv.');
  if(!records.length)fail('No hay productos para importar.');if(records.length>10000)fail('Máximo 10.000 filas por archivo.');
  if(!Object.hasOwn(records[0],'sku'))fail('Falta la columna sku.');
  const unknown=Object.keys(records[0]).filter(k=>k!=='__parseErrors'&&!importHeaders.includes(k as typeof importHeaders[number]));if(unknown.length)fail(`Columnas desconocidas: ${unknown.join(', ')}.`);
  return records;
}
export async function previewImport(user:CurrentUser,records:Record<string,unknown>[],filename:string,mode:string) {
  if(!['create','update','upsert'].includes(mode))fail('Modo no válido.');
  const state=await loadState(user);const bySku=new Map(state.products.map(p=>[p.sku,p]));
  const allSku=await db.query('SELECT sku FROM products');const occupied=new Set(allSku.rows.map(p=>p.sku));
  const codeId=(items:Array<{id:string;code?:string}>,value:unknown)=>items.find(item=>(item.code||item.id).toUpperCase()===String(value).trim().toUpperCase())?.id||'';
  const counts=new Map<string,number>();for(const record of records){const sku=normalizeSku(String(record.sku||''));counts.set(sku,(counts.get(sku)||0)+1);}
  const rows:Array<{number:number;sku:string;status:string;errors:string[];data:{product:Product;version?:number;action:string}}>=[];
  for(const [index,record] of records.entries()){
    const sku=normalizeSku(String(record.sku||'')), old=bySku.get(sku),errors=[...((record.__parseErrors||[]) as string[])];
    if((counts.get(sku)||0)>1)errors.push('SKU duplicado dentro del archivo.');
    if(!old&&occupied.has(sku))errors.push('SKU existente fuera de tu alcance.');
    if(mode==='create'&&old)errors.push('El SKU ya existe.');if(mode==='update'&&!old)errors.push('El SKU no existe o no es accesible.');
    const p:Product=old?{...old}:{id:randomUUID(),sku,name:'',brand:'',category:'',subcategory:'',sizeId:'',presentation:'',wholesalePrice:0,retailPrice:0,stock:0,minOrder:1,unitsPerCase:1,description:'',use:'',image:'/assets/product-sage.svg',active:false,featured:false,position:0,currency:'PEN',groupCode:'',imageFile:''};
    const filled=(key:string)=>record[key]!==undefined&&record[key]!==null&&String(record[key]).trim()!=='';
    if(!old)for(const f of importFields)if(f[2]==='SI'&&!filled(f[0]))errors.push(`${f[0]}: obligatorio para un producto nuevo.`);
    const textMap:Record<string,keyof Product>={nombre:'name',codigo_grupo:'groupCode',presentacion:'presentation',descripcion:'description',uso:'use',imagen_archivo:'imageFile',moneda:'currency'};
    for(const [key,target] of Object.entries(textMap))if(filled(key)){const value=String(record[key]).trim();Object.assign(p,{[target]:value==='__BORRAR__'&&['codigo_grupo','presentacion','descripcion','uso','imagen_archivo'].includes(key)?'':value});}
    if(filled('marca_codigo'))p.brand=codeId(state.brands,record.marca_codigo);
    if(filled('categoria_codigo'))p.category=codeId(state.categories,record.categoria_codigo);
    if(filled('subcategoria_codigo'))p.subcategory=record.subcategoria_codigo==='__BORRAR__'?'':codeId(state.subcategories,record.subcategoria_codigo);
    if(filled('subcategoria_codigo')&&record.subcategoria_codigo!=='__BORRAR__'&&!p.subcategory)errors.push('subcategoria_codigo: código no encontrado.');
    if(filled('tamano_codigo'))p.sizeId=codeId(state.sizes,record.tamano_codigo);
    const numberMap:Record<string,keyof Product>={precio_mayorista:'wholesalePrice',precio_sugerido:'retailPrice',stock:'stock',pedido_minimo:'minOrder',unidades_caja:'unitsPerCase',orden:'position'};
    for(const [key,target] of Object.entries(numberMap))if(filled(key)){const raw=String(record[key]);if(!/^\d+(?:\.\d+)?$/.test(raw))errors.push(`${key}: número inválido; usa punto decimal y sin separadores.`);else Object.assign(p,{[target]:Number(raw)});}
    for(const [key,target] of [['publicado','active'],['destacado','featured']] as const)if(filled(key)){const v=String(record[key]).trim().toUpperCase();if(!['SI','NO'].includes(v))errors.push(`${key}: escribe SI o NO.`);else p[target]=v==='SI';}
    try {
      if(old)await permit(user,'products.update',old.brand);
      await permit(user,old?'products.update':'products.create',p.brand);if(p.active!==Boolean(old?.active))await permit(user,'products.publish',p.brand);
      await validateProduct(p,state);
    }catch(error){errors.push(error instanceof Error?error.message:'Fila no válida.');}
    rows.push({number:index+2,sku,status:errors.length?'invalid':'valid',errors,data:{product:p,version:old?.version,action:old?'update':'create'}});
  }
  const id=randomUUID();
  await transaction(async client=>{
    await client.query("INSERT INTO import_jobs(id,user_id,kind,filename,mode,total,errors) VALUES($1,$2,'products',$3,$4,$5,$6)",[id,user.id,filename,mode,rows.length,rows.filter(r=>r.errors.length).length]);
    for(const row of rows)await client.query('INSERT INTO import_rows(job_id,row_number,status,sku,data,errors) VALUES($1,$2,$3,$4,$5,$6)',[id,row.number,row.status,row.sku,JSON.stringify(row.data),JSON.stringify(row.errors)]);
  });return id;
}
