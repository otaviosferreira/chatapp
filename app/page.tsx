export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Ambiente de desenvolvimento</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">ChatApp</h1>
        <p className="mt-4 leading-7 text-slate-600">
          Fundação inicial do sistema de comunicação privada. A autenticação, o backend e os módulos de conversa
          ainda não estão configurados; esta página não representa um chat funcional.
        </p>
        <div className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Utilize somente contas, mensagens e arquivos fictícios durante o desenvolvimento.
        </div>
      </section>
    </main>
  );
}
