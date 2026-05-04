import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

const valores = [
  {
    titulo: 'Clareza',
    texto:
      'Comunicação e processos transparentes — quem entra na jornada sabe o que esperar em cada etapa.',
  },
  {
    titulo: 'Respeito ao ecossistema',
    texto:
      'Imobiliárias, escritórios, executores e fornecedores merecem ferramentas que honrem o papel de cada um.',
  },
  {
    titulo: 'Excelência operacional',
    texto:
      'Menos atrito administrativo para que equipes foquem em relacionamento, entrega e resultado.',
  },
  {
    titulo: 'Longo prazo',
    texto:
      'Produto pensado para crescer com o mercado, incorporando novas frentes sem perder a identidade.',
  },
]

function About() {
  return (
    <main>
      <section className="border-b-2 border-primary bg-surface px-4 py-14 sm:py-16">
        <div className="landing-wrap">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-secondary">
            A Obra10+
          </p>
          <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight tracking-tight text-primary sm:text-5xl">
            Visão, valores e o futuro que estamos construindo
          </h1>
          <p className="mt-6 max-w-2xl text-base font-medium leading-relaxed text-on-surface-variant sm:text-lg">
            Somos movidos pela convicção de que o setor da construção e do imobiliário precisa de uma
            camada digital que una — não isole — quem faz acontecer.
          </p>
        </div>
      </section>

      <section className="px-4 py-14 sm:py-16">
        <div className="landing-wrap grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="flex h-1.5 w-12 bg-tertiary" aria-hidden />
            <h2 className="mt-6 text-2xl font-black tracking-tight text-primary sm:text-3xl">
              Nossa visão
            </h2>
            <p className="mt-4 text-sm leading-8 text-on-surface-variant sm:text-base">
              Ser a referência em plataformas integradas para negócios ligados a obras, imóveis e
              projetos — onde cada contato vira relacionamento, e cada relacionamento pode evoluir com
              método, governança e dignidade comercial.
            </p>
            <p className="mt-4 text-sm leading-8 text-on-surface-variant sm:text-base">
              Queremos que empresas e profissionais enxerguem na Obra10+ um parceiro estratégico: não
              substituto da relação humana, mas amplificador da capacidade de entregar bem, no prazo e
              com reputação fortalecida.
            </p>
          </div>
          <div className="border-2 border-surface-container-high bg-white p-8 shadow-sm">
            <h2 className="text-xl font-black tracking-tight text-primary sm:text-2xl">
              O futuro que imaginamos
            </h2>
            <p className="mt-4 text-sm leading-7 text-on-surface-variant">
              Um ambiente onde o cliente final, o parceiro e a equipe interna compartilham a mesma
              base de confiança — com informação atualizada, histórico claro e decisões alinhadas ao
              que foi combinado. Onde escala não significa perder o cuidado, e tecnologia aparece
              como suporte à liderança, não como barreira.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-primary px-4 py-14 text-white sm:py-16">
        <div className="landing-wrap">
          <h2 className="text-center text-2xl font-black tracking-tight sm:text-3xl">
            Valores que guiam cada decisão
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {valores.map((v) => (
              <article
                key={v.titulo}
                className="border-l-[3px] border-tertiary bg-white/5 px-5 py-5 backdrop-blur-sm"
              >
                <h3 className="text-sm font-black uppercase tracking-[0.15em] text-tertiary">
                  {v.titulo}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/85">{v.texto}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14">
        <div className="landing-wrap flex flex-col items-center text-center">
          <Link
            to="/"
            className="text-[10px] font-black uppercase tracking-[0.2em] text-tertiary no-underline hover:underline"
          >
            ← Voltar ao início
          </Link>
        </div>
      </section>
    </main>
  )
}
