"use client";
import { useEffect,useState } from "react";
import { api,PageHeading } from "./ui";
export function AuditPanel(){
  const [rows,setRows]=useState<Array<{id:number;created_at:string;user_name:string;action:string;entity_id:string}>>([]),[error,setError]=useState('');
  useEffect(()=>{api<typeof rows>('/api/admin/audit').then(setRows).catch(e=>setError(e.message));},[]);
  return <><PageHeading eyebrow="TRAZABILIDAD" title="Actividad del sistema" description="Últimas 200 operaciones de administración, publicaciones y cargas."/>{error&&<p className="cms-error">{error}</p>}<div className="cms-table-wrap"><table className="cms-table"><thead><tr><th>Fecha</th><th>Persona</th><th>Operación</th><th>Referencia</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{new Date(row.created_at).toLocaleString('es-PE')}</td><td>{row.user_name||'Sistema'}</td><td>{row.action}</td><td><code>{row.entity_id}</code></td></tr>)}</tbody></table></div></>;
}
