import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
import { AdminWorkspace } from "@/app/admin/admin-workspace";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
 const supabase=await createClient();
 const {data:claims,error:claimsError}=await supabase.auth.getClaims();
 const userId=claims?.claims?.sub;
 if(claimsError || typeof userId!=="string") redirect("/login");
 const {data:profile}=await supabase.from("profiles").select("full_name,status").eq("id",userId).maybeSingle();
 if(!profile || profile.status!=="active") redirect("/login?error=pending");
 const {data:assignment,error}=await supabase.from("profile_roles").select("roles!inner(code)").eq("profile_id",userId).eq("roles.code","it_admin").maybeSingle();
 if(error || !assignment) redirect("/chat");
 return <main className="min-h-screen bg-slate-100">
  <header className="flex items-center justify-between border-b bg-white px-6 py-4">
   <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">ChatApp</p><h1 className="text-lg font-semibold">Administração de usuários</h1></div>
   <div className="flex items-center gap-3"><a href="/chat" className="text-sm text-blue-700">Voltar ao chat</a><form action={signOutAction}><button className="rounded-lg border px-4 py-2 text-sm">Sair</button></form></div>
  </header><AdminWorkspace currentUserId={userId}/>
 </main>;
}
