"use client";
import {useCallback,useEffect,useMemo,useState,type FormEvent} from "react";
import {createClient} from "@/lib/supabase/client";
import type {Tables} from "@/lib/supabase/database.types";
type Profile=Pick<Tables<"profiles">,"id"|"full_name"|"employee_code"|"status"|"disabled_at">;
export function AdminWorkspace({currentUserId}:{currentUserId:string}) {
 const supabase=useMemo(()=>createClient(),[]);
 const [profiles,setProfiles]=useState<Profile[]>([]);
 const [roles,setRoles]=useState<Record<string,string[]>>({});
 const [reason,setReason]=useState("");
 const [busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState<string|null>(null);
 const [notice,setNotice]=useState<string|null>(null);
 const [inviteName,setInviteName]=useState("");
 const [inviteEmail,setInviteEmail]=useState("");
 const [inviteBusy,setInviteBusy]=useState(false);
 const load=useCallback(async()=>{
  const [p,r]=await Promise.all([
   supabase.from("profiles").select("id,full_name,employee_code,status,disabled_at").order("full_name"),
   supabase.from("profile_roles").select("profile_id,roles!inner(code)")
  ]);
  if(p.error||r.error){setError("Falha ao carregar contas. Verifique suas permissões.");return;}
  setProfiles(p.data??[]);
  const next:Record<string,string[]>={};
  for(const item of r.data??[]){const role=item.roles as unknown as {code:string};(next[item.profile_id]??=[]).push(role.code);}
  setRoles(next);
 },[supabase]);
 useEffect(()=>{void Promise.resolve().then(load);},[load]);
 async function statusChange(id:string,status:"active"|"disabled"){
  if(id===currentUserId||busy)return;
  if(reason.trim().length<8){setError("Informe um motivo com pelo menos 8 caracteres.");return;}
  setBusy(id);setError(null);setNotice(null);
  const result=await supabase.rpc("admin_set_profile_status",{_profile_id:id,_status:status,_reason:reason.trim()});
  if(result.error)setError(result.error.message);else{setNotice(status==="disabled"?"Conta desativada.":"Conta reativada.");setReason("");await load();}
  setBusy(null);
 }
 async function roleChange(id:string,code:string,grant:boolean){
  if(id===currentUserId||busy)return;
  if(reason.trim().length<8){setError("Informe um motivo com pelo menos 8 caracteres.");return;}
  setBusy(id);setError(null);setNotice(null);
  const result=await supabase.rpc("admin_set_profile_role",{_profile_id:id,_role_code:code,_grant:grant,_reason:reason.trim()});
  if(result.error)setError(result.error.message);else{setNotice(grant?"Permissão concedida.":"Permissão removida.");setReason("");await load();}
  setBusy(null);
 }
 async function sendInvite(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(inviteBusy)return;
  setInviteBusy(true);setError(null);setNotice(null);
  const {data,error:inviteError}=await supabase.functions.invoke("invite-employee",{body:{email:inviteEmail.trim().toLowerCase(),full_name:inviteName.trim()}});
  if(inviteError){setError("Não foi possível enviar o convite. Verifique a configuração da função e o domínio corporativo permitido.");}
  else if(data?.error){setError(data.error==="domain_allowlist_not_configured"?"Configure ALLOWED_EMAIL_DOMAINS na função de convite.":data.error==="email_domain_not_allowed"?"O domínio do e-mail não está autorizado.":"Convite não enviado: verifique os dados e tente novamente.");}
  else{setNotice("Convite enviado. O perfil será criado como pendente e precisará ser ativado pela TI após o primeiro acesso.");setInviteName("");setInviteEmail("");await load();}
  setInviteBusy(false);
 }
 return <section className="mx-auto max-w-6xl space-y-5 p-6">
  <div className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Convidar funcionário</h2><p className="mb-4 text-sm text-slate-500">O convite é enviado pelo Supabase Auth. O funcionário permanece pendente até a ativação pela TI.</p><form onSubmit={sendInvite} className="grid gap-3 md:grid-cols-3"><input required minLength={2} maxLength={120} value={inviteName} onChange={e=>setInviteName(e.target.value)} placeholder="Nome completo" className="rounded-lg border px-3 py-2 text-sm"/><input required type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="E-mail corporativo" className="rounded-lg border px-3 py-2 text-sm"/><button disabled={inviteBusy} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{inviteBusy?"Enviando...":"Enviar convite"}</button></form></div>
  <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Todas as operações exigem justificativa e são registradas na auditoria. Sua própria conta não pode ser alterada por esta tela.</p>
  <div className="rounded-lg border bg-white p-4"><label htmlFor="reason" className="mb-2 block text-sm font-medium">Motivo obrigatório (mínimo 8 caracteres)</label><input id="reason" value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Ex.: desligamento confirmado pelo RH"/></div>
  {error?<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>:null}
  {notice?<p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>:null}
  <div className="overflow-hidden rounded-xl border bg-white"><div className="border-b p-4"><h2 className="font-semibold">Contas e permissões</h2><p className="text-sm text-slate-500">{profiles.length} perfis</p></div><div className="divide-y">
   {profiles.map(p=>{const assigned=roles[p.id]??[];const self=p.id===currentUserId;return <article key={p.id} className="space-y-3 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-medium">{p.full_name}</h3><p className="text-xs text-slate-500">{p.employee_code?"Matrícula: "+p.employee_code+" · ":""}{p.status}</p><p className="text-xs text-slate-600">Papéis: {assigned.join(", ")||"nenhum"}</p></div>
     {p.status==="disabled"?<button disabled={self||busy===p.id} onClick={()=>void statusChange(p.id,"active")} className="rounded border border-green-200 px-3 py-2 text-xs text-green-800 disabled:opacity-40">Reativar</button>:<button disabled={self||busy===p.id} onClick={()=>void statusChange(p.id,"disabled")} className="rounded border border-red-200 px-3 py-2 text-xs text-red-700 disabled:opacity-40">Desativar</button>}
    </div>
    <div className="flex flex-wrap gap-2">{(["employee","it_admin","security_admin"] as const).map(code=>{const granted=assigned.includes(code);return <button key={code} disabled={self||p.status!=="active"||busy===p.id} onClick={()=>void roleChange(p.id,code,!granted)} className={"rounded-full border px-3 py-1.5 text-xs disabled:opacity-40 "+(granted?"border-blue-200 bg-blue-50 text-blue-800":"border-slate-200 text-slate-600")}>{granted?"Remover ":"Conceder "}{code}</button>;})}</div>
    {self?<p className="text-xs text-slate-400">Sua conta administrativa</p>:null}
   </article>;})}
   {profiles.length===0?<p className="p-6 text-sm text-slate-500">Nenhum perfil encontrado.</p>:null}
  </div></div>
 </section>;
}
