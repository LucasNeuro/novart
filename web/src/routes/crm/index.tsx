import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/crm/')({
  component: CrmTriagemHome,
})

function CrmTriagemHome() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="border-2 border-primary bg-white p-6 md:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-secondary">Triagem</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-primary md:text-3xl">
          Fila de leads
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-on-surface-variant">
          Esta é a sua fila única de triagem: em seguida ligamos a listagem (tabela ou quadro) ao pipeline
          configurável — novos contactos, mudança de etapas e histórico, tudo na mesma experiência.
        </p>
        <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-on-surface-variant">
          <li>O acesso já exige administrador HUB (convite no Supabase).</li>
          <li>Cadastros alargados (organizações, membros) seguem nas próximas migrações.</li>
        </ul>
      </div>
    </div>
  )
}
