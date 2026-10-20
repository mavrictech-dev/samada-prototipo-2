"use client";
import { X } from "lucide-react";
import {useEffect,useRef} from "react";
export function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="cms-field">{label}{children}</label>;}
export function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}){
 const ref=useRef<HTMLElement>(null),close=useRef(onClose);
 useEffect(()=>{close.current=onClose;},[onClose]);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const focusables=()=>Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')||[]).filter(e=>e.getClientRects().length>0);
  (ref.current?.querySelector<HTMLElement>('input:not([type=hidden]),select,textarea')||focusables()[0])?.focus();
  const keydown=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();close.current();}if(event.key==='Tab'){const elements=focusables(),first=elements[0],last=elements.at(-1);if(!first){event.preventDefault();return;}if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};
  document.addEventListener('keydown',keydown);return()=>{document.removeEventListener('keydown',keydown);document.body.style.overflow=oldOverflow;previous?.focus();};
 },[]);
 return <div className="cms-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section ref={ref} className="cms-modal" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button onClick={onClose} className="cms-icon-button" aria-label="Cerrar"><X size={19}/></button></header>{children}</section></div>;
}
export function Badge({children,tone='neutral'}:{children:React.ReactNode;tone?:'green'|'red'|'neutral'|'amber'}){return <span className={`cms-badge cms-badge-${tone}`}>{children}</span>;}
export async function api<T=unknown>(url:string,body?:unknown,method=body===undefined?'GET':'POST'):Promise<T>{
  const res=await fetch(url,{method,cache:'no-store',...(body instanceof FormData?{body}:body!==undefined?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  const data=await res.json();if(!res.ok)throw new Error(data.error||'No se pudo completar la operación.');return data as T;
}
export function PageHeading({eyebrow,title,description,action}:{eyebrow:string;title:string;description?:string;action?:React.ReactNode}){return <div className="cms-page-heading"><div><span className="cms-eyebrow">{eyebrow}</span><h2>{title}</h2>{description&&<p className="cms-muted">{description}</p>}</div>{action}</div>;}
