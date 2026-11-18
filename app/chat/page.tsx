import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
import { ChatWorkspace } from "@/app/chat/chat-workspace";
import { createClient } from "@/lib/supabase/server";

export default async function ChatPage() {
  const isConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );

  if (!isConfigured) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== "string") {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name,status")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile || profile.status !== "active") {
    redirect("/login?error=pending");
  }

  const { data: adminRole } = await supabase.from("profile_roles").select("roles!inner(code)").eq("profile_id", userId).eq("roles.code", "it_admin").maybeSingle();

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">ChatApp</p>
          <h1 className="mt-1 text-lg font-semibold text-slate-900">Comunicação privada</h1>
        </div>
        <div className="flex items-center gap-3">{adminRole ? <a href="/admin" className="text-sm font-medium text-blue-700">Administração</a> : null}<form action={signOutAction}>
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Sair
          </button>
        </form></div>
      </header>
      <ChatWorkspace userId={userId} userName={profile.full_name} />
    </main>
  );
}
