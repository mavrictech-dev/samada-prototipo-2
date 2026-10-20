"use client";
import { createContext,useCallback,useContext,useEffect,useMemo,useState } from "react";
import { usePathname } from "next/navigation";
import { seedState } from "@/lib/seed";
import type { CmsState,Product,CatalogPage } from "@/lib/types";
import { api } from "./cms/ui";
const emptyState:CmsState={...seedState,products:[],pages:[],brands:[],categories:[],subcategories:[],sizes:[],branches:[]};
type CmsContextValue={state:CmsState;ready:boolean;error:string;refresh:()=>Promise<void>;saveProduct:(p:Product)=>Promise<void>;deleteProduct:(id:string)=>Promise<void>;savePage:(p:CatalogPage)=>Promise<void>;deletePage:(id:string)=>Promise<void>;mutate:(resource:string,value:unknown,id?:string,method?:string)=>Promise<void>};
const Context=createContext<CmsContextValue|null>(null);
export function CmsProvider({children}:{children:React.ReactNode}){
 const pathname=usePathname();const [state,setState]=useState<CmsState>(emptyState),[loadedPath,setLoadedPath]=useState(''),[error,setError]=useState('');
 const ready=loadedPath===pathname;
 const refresh=useCallback(async()=>{
  try{const management=pathname.startsWith('/admin')||window.location.hostname==='gestion.samadaperu.com';const data=await api<CmsState>(management?'/api/admin/state':'/api/cms');setState(data);setError('');}catch(error){setError(error instanceof Error?error.message:'No se pudo cargar el catálogo.');}finally{setLoadedPath(pathname);}
 },[pathname]);
 useEffect(()=>{if(pathname.startsWith('/admin')||pathname==='/')void refresh();else setLoadedPath(pathname);},[pathname,refresh]);
 const mutate=useCallback(async(resource:string,value:unknown,id?:string,method?:string)=>{await api(`/api/admin/${resource}${id?`/${id}`:''}`,value,method);await refresh();},[refresh]);
 const saveProduct=useCallback(async(p:Product)=>{await mutate('products',p);},[mutate]);
 const deleteProduct=useCallback(async(id:string)=>{await mutate('products',{},id,'DELETE');},[mutate]);
 const savePage=useCallback(async(p:CatalogPage)=>{await mutate('pages',p);},[mutate]);
 const deletePage=useCallback(async(id:string)=>{await mutate('pages',{},id,'DELETE');},[mutate]);
 const value=useMemo(()=>({state,ready,error,refresh,mutate,saveProduct,deleteProduct,savePage,deletePage}),[state,ready,error,refresh,mutate,saveProduct,deleteProduct,savePage,deletePage]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useCms(){const context=useContext(Context);if(!context)throw new Error('CmsProvider requerido');return context;}
