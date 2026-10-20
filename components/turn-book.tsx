"use client";
import { useCallback,useEffect,useMemo,useRef,useState } from "react";
import { ChevronLeft,ChevronRight,MessageCircle,PackageCheck } from "lucide-react";
import type { CatalogPage,Product } from "@/lib/types";
declare global {interface Window {jQuery?:JQueryTurnFactory;$?:JQueryTurnFactory;}}
type TurnCommand=string|Record<string,unknown>;
type JQueryTurnInstance={turn:(command:TurnCommand,...args:unknown[])=>unknown};
type JQueryTurnFactory=((element:HTMLElement)=>JQueryTurnInstance)&{fn?:{turn?:unknown}};
type Sheet={id:string;label:string;node:React.ReactNode};
const scripts=new Map<string,Promise<void>>();
function loadScript(src:string){
 if(scripts.has(src))return scripts.get(src)!;
 const promise=new Promise<void>((resolve,reject)=>{const found=document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);if(found?.dataset.loaded==='true')return resolve();const script=found||document.createElement('script');script.src=src;script.async=false;script.addEventListener('load',()=>{script.dataset.loaded='true';resolve();},{once:true});script.addEventListener('error',()=>{scripts.delete(src);reject(new Error('No se pudo cargar la revista.'));},{once:true});if(!found)document.body.appendChild(script);});scripts.set(src,promise);return promise;
}
function PageHeader({label}:{label:string}){return <div className="mb-4 flex items-center justify-between gap-4 text-[9px] text-[#747b70]"><img src="/assets/samada-logo.webp" alt="Samada" className="w-20"/><span className="text-right">{label}</span></div>;}
export function TurnBook({pages,products,onProduct,onContact}:{pages:CatalogPage[];products:Product[];onProduct:(p:Product)=>void;onContact:()=>void}){
 const bookRef=useRef<HTMLDivElement>(null),sourceRef=useRef<HTMLDivElement>(null);
 const [segment,setSegment]=useState(0),[active,setActive]=useState(2),[ready,setReady]=useState(false),[mobile,setMobile]=useState(false),[dimensions,setDimensions]=useState({width:920,height:652}),[error,setError]=useState('');
 const sheets=useMemo<Sheet[]>(()=>{
  const output:Sheet[]=[
   {id:'cover',label:'Portada',node:<div className="book-photo-page"><img src="/assets/editorial.png" alt="Colección de cuidado Samada"/><div className="absolute inset-0 flex flex-col bg-gradient-to-b from-black/20 via-transparent to-black/40 p-[9%] text-white"><img src="/assets/samada-logo-negative.webp" alt="Samada" className="w-36"/><span className="mt-3 text-[9px] tracking-[.2em]">CATÁLOGO PARA DISTRIBUIDORES</span><h2 className="mt-auto text-3xl leading-tight tracking-tight">Productos que<br/>mueven tu negocio.</h2></div></div>},
   {id:'welcome',label:'Bienvenida',node:<div className="book-page"><PageHeader label="Canal distribuidores"/><PackageCheck size={34} className="mt-[10%] text-[#558B2F]"/><h2 className="mt-6 text-4xl leading-[1.05] tracking-[-.06em]">Tu catálogo.<br/>Tu próxima venta.</h2><p className="mt-6 text-sm leading-6 text-[#596056]">Marcas, tamaños y presentaciones para armar una selección que se adapte a tu negocio.</p><button data-contact="true" className="mt-7 flex w-fit items-center gap-2 rounded-xl bg-[#7CB342] px-5 py-3 text-xs text-[#18240e]"><MessageCircle size={16}/>Hablar con un asesor</button><span className="mt-auto border-t pt-4 text-[10px] text-[#747b70]">{products.length} productos en esta selección</span></div>}
  ];
  const lookup=new Map(products.map(p=>[p.id,p]));
  pages.filter(p=>p.published&&p.type==='products').forEach(page=>{
   const items=page.productIds.map(id=>lookup.get(id)).filter((p):p is Product=>!!p);
   if(!items.length)return;const [hero,...rest]=items;
   output.push({id:`${page.id}-hero`,label:page.title,node:<div className={`book-page page-theme-${page.theme}`}><PageHeader label={page.subtitle}/><span className="w-fit rounded-full bg-[#7CB342] px-3 py-1 text-[9px] text-[#24301a]">Selección para tu negocio</span><h2 className="mt-3 text-2xl leading-tight tracking-[-.05em]">{page.title}</h2><button data-product-id={hero.id} className="my-3 grid min-h-0 flex-1 place-items-center overflow-hidden"><img src={hero.image} alt={hero.name} loading="lazy" className="max-h-52 w-full object-contain"/></button><h3 className="line-clamp-2 text-base font-semibold">{hero.name}</h3><p className="mt-1 text-[9px] text-[#6f766b]">{hero.sku} · {hero.presentation} · mínimo {hero.minOrder} u.</p><div className="mt-4 flex items-end justify-between gap-2"><div><small className="text-[8px] text-[#6f766b]">Precio distribuidor</small><p className="text-xl font-semibold">S/ {hero.wholesalePrice.toFixed(2)}</p></div><button data-product-id={hero.id} className="rounded-lg bg-[#7CB342] px-4 py-2 text-[9px] text-[#25301c]">Ver producto</button></div></div>});
   for(let offset=0;offset<rest.length;offset+=6){
    const chunk=rest.slice(offset,offset+6);
    output.push({id:`${page.id}-grid-${offset}`,label:page.title,node:<div className="book-page"><PageHeader label={page.subtitle}/><h2 className="text-2xl tracking-[-.04em]">{page.title}</h2><div className="mt-4 grid min-h-0 flex-1 grid-cols-2 gap-3">{chunk.map(p=><button key={p.id} data-product-id={p.id} className="flex min-h-0 flex-col border-b border-[#e2e5de] pb-2 text-left"><span className="grid h-20 w-full place-items-center overflow-hidden rounded-lg bg-[#f1f4ec] p-1"><img src={p.image} alt="" loading="lazy" className="h-full w-full object-contain"/></span><b className="mt-2 line-clamp-2 text-[9px] leading-tight">{p.name}</b><span className="mt-auto flex w-full justify-between pt-2 text-[8px] text-[#747b70]"><span>{p.sku}</span><strong>S/ {p.wholesalePrice.toFixed(2)}</strong></span></button>)}</div><span className="mt-3 text-[8px] text-[#747b70]">Presentaciones y stock sujetos a confirmación</span></div>});
   }
  });
  output.push({id:'back',label:'Contacto',node:<div className="book-back"><img src="/assets/samada-logo.webp" alt="Samada" className="w-52"/><p className="mt-6 text-sm">Bienestar que se siente.<br/>Negocios que crecen.</p><button data-contact="true" className="mt-8 flex items-center gap-2 rounded-xl bg-[#7CB342] px-5 py-3 text-xs"><MessageCircle size={16}/>Cotizar mi selección</button></div>});
  if(output.length%2)output.push({id:'blank',label:'Samada',node:<div className="book-page"><PageHeader label="Gracias por elegirnos"/></div>});
  return output;
 },[pages,products]);
 const segmentCount=Math.ceil(sheets.length/16),currentSegment=Math.min(segment,segmentCount-1);
 const visibleSheets=useMemo(()=>sheets.slice(currentSegment*16,currentSegment*16+16),[sheets,currentSegment]);
 const sync=useCallback((page:number,single:boolean)=>{
  const shown=single?[page]:page%2===0?[page,page+1]:[page-1,page];
  bookRef.current?.querySelectorAll<HTMLElement>('.book-sheet').forEach(sheet=>{const visible=shown.includes(Number(sheet.dataset.page));sheet.inert=!visible;sheet.setAttribute('aria-hidden',String(!visible));});
 },[]);
 useEffect(()=>{
  let cancelled=false;const element=bookRef.current;const source=sourceRef.current;if(!element||!source)return;
  setReady(false);setError('');
  // React owns the hidden templates. Turn.js owns only these disposable DOM clones.
  element.replaceChildren(...Array.from(source.children).map(child=>child.cloneNode(true)));
  const click=(event:MouseEvent)=>{const target=event.target instanceof Element?event.target.closest<HTMLElement>('[data-product-id],[data-contact]'):null;if(!target)return;if(target.dataset.productId){const product=products.find(p=>p.id===target.dataset.productId);if(product)onProduct(product);}else onContact();};
  element.addEventListener('click',click);
  const start=async()=>{
   await loadScript('/vendor/jquery-1.7.js');await loadScript('/vendor/turn.js');if(cancelled||!window.jQuery?.fn?.turn)return;
   const single=window.innerWidth<900;setMobile(single);
   const available=(element.closest<HTMLElement>('[data-book-stage]')?.clientWidth||window.innerWidth)-(single?28:120);
   const width=Math.max(260,Math.min(available,single?430:920)),height=Math.round(width/(single?.705:1.41));
   setDimensions({width,height});const initial=currentSegment===0?Math.min(2,visibleSheets.length):1;setActive(initial);
   window.jQuery(element).turn({width,height,display:single?'single':'double',page:initial,autoCenter:!single,elevation:single?0:50,gradients:!single,duration:single?350:600,when:{turning:(_:unknown,page:number)=>{setActive(page);sync(page,window.innerWidth<900);},turned:(_:unknown,page:number)=>{setActive(page);sync(page,window.innerWidth<900);}}});sync(initial,single);setReady(true);
  };
  void start().catch(e=>{if(!cancelled)setError(e.message);});
  return ()=>{cancelled=true;element.removeEventListener('click',click);try{const book=window.jQuery?.(element);if(book?.turn('is'))book.turn('destroy');}catch{}element.replaceChildren();};
 },[visibleSheets,currentSegment,products,onProduct,onContact,sync]);
 useEffect(()=>{const resize=()=>{const element=bookRef.current;if(!element||!window.jQuery?.fn?.turn)return;const single=window.innerWidth<900;const available=(element.closest<HTMLElement>('[data-book-stage]')?.clientWidth||window.innerWidth)-(single?28:120);const width=Math.max(260,Math.min(available,single?430:920)),height=Math.round(width/(single?.705:1.41));setDimensions({width,height});setMobile(single);try{const book=window.jQuery(element);if(book.turn('is')){book.turn('display',single?'single':'double');book.turn('size',width,height);sync(active,single);}}catch{}};window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[active,sync]);
 const move=(direction:'next'|'previous')=>{try{if(bookRef.current)window.jQuery?.(bookRef.current).turn(direction);}catch{}};
 const view=mobile?[active]:active%2===0?[active,active+1]:[active-1,active];
 return <div className="w-full">
  <div hidden aria-hidden="true" ref={sourceRef}>{visibleSheets.map((sheet,index)=><article className="book-sheet" data-page={index+1} key={sheet.id} aria-label={`Página ${currentSegment*16+index+1}: ${sheet.label}`}>{sheet.node}</article>)}</div>
  <div data-book-stage="true" className="relative mx-auto flex max-w-[1100px] items-center justify-center px-3 sm:px-8 md:px-16">
   <button onClick={()=>move('previous')} disabled={active<=1} className="book-arrow left-0 hidden sm:grid disabled:opacity-30" aria-label="Página anterior"><ChevronLeft/></button>
   <div className={`book-frame ${mobile?'book-frame-single':'book-frame-spread'}`} style={{width:dimensions.width,height:dimensions.height}}><div ref={bookRef} className="flipbook"/></div>
   <button onClick={()=>move('next')} disabled={active>=visibleSheets.length} className="book-arrow right-0 hidden sm:grid disabled:opacity-30" aria-label="Página siguiente"><ChevronRight/></button>
  </div>
  <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-4 text-xs text-[#6f766b]"><button aria-label="Retroceder una página" disabled={active<=1} onClick={()=>move('previous')}><ChevronLeft size={18}/></button><span>{view.filter(n=>n>0&&n<=visibleSheets.length).map(n=>String(currentSegment*16+n).padStart(2,'0')).join('–')} / {sheets.length}</span><button aria-label="Avanzar una página" disabled={active>=visibleSheets.length} onClick={()=>move('next')}><ChevronRight size={18}/></button>{segmentCount>1&&<label className="flex items-center gap-2">Sección<select aria-label="Sección de la revista" className="rounded-lg border bg-transparent px-3 py-2" value={currentSegment} onChange={e=>setSegment(Number(e.target.value))}>{Array.from({length:segmentCount},(_,i)=><option key={i} value={i}>{i+1} de {segmentCount}</option>)}</select></label>}</div>
  {!ready&&<p className="mt-3 text-center text-xs">{error||'Preparando la revista…'}</p>}
 </div>;
}
