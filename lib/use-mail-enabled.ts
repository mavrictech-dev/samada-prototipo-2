"use client";
import {useEffect,useState} from 'react';
export function useMailEnabled(){
 const [enabled,setEnabled]=useState(false);
 useEffect(()=>{const controller=new AbortController();fetch('/api/auth-options',{cache:'no-store',signal:controller.signal}).then(r=>r.ok?r.json():null).then(value=>setEnabled(value?.mailEnabled===true)).catch(()=>{});return()=>controller.abort();},[]);
 return enabled;
}
