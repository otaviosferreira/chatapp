import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
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

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">ChatApp</p>
          <h1 className="mt-1 text-lg font-semibold text-slate-900">Ambiente de conversas</h1>
        </div>
        <form action={signOutAction}>
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Sair
          </button>
        </form>
      </header>
      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-500">Sessão autenticada</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Olá, {profile.full_name}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            A autenticação e a verificação do status da conta estão conectadas. A interface de conversas,
            mensagens e notificações ainda está em desenvolvimento.
          </p>
          <div className="mt-6 rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
            As consultas de dados serão protegidas pelas políticas RLS do banco. Utilize somente dados fictícios nesta fase.
          </div>
        </div>
      </section>
    </main>
  );
}
