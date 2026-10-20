import { AdminApp } from "@/components/admin-app";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { principal } from "@/server/access";

export default async function AdminPage() {
  const user=await principal(await headers()).catch(()=>null);
  if(!user)redirect('/login');
  return <AdminApp user={user}/>;
}
