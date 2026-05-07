import { Link } from '@tanstack/react-router'
import Obra10Logo from './Obra10Logo'

/** Imagem de obra (Unsplash — substituir por arquivo próprio em produção, se desejado). */
const IMG_OBRA_HERO =
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=2400&q=80'
const IMG_OBRA_BANDA =
  'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=2400&q=80'

const pilares = [
  {
    icon: 'diversity_3',
    title: 'Ecossistema conectado',
    desc: 'Imóveis, obras, arquitetura, engenharia e fornecedores convivem na mesma lógica de relacionamento — sem ilhas de informação.',
  },
  {
    icon: 'verified_user',
    title: 'Confiança e método',
    desc: 'Processos claros, histórico acessível e decisões apoiadas em dados — do primeiro contato à operação.',
  },
  {
    icon: 'handshake',
    title: 'Rede viva',
    desc: 'Parceiros e prestadores ganham visibilidade no tempo certo; clientes e equipes comerciais falam a mesma língua.',
  },
  {
    icon: 'trending_up',
    title: 'Escala com continuidade',
    desc: 'O que começa como oportunidade pode avançar com a mesma consistência — menos retrabalho, mais previsibilidade.',
  },
]

const passos = [
  {
    step: '01',
    title: 'Entrada organizada',
    body: 'Quem busca imóvel, obra, projeto ou parceria é acolhido com clareza — cada conversa começa no lugar certo.',
  },
  {
    step: '02',
    title: 'Inteligência comercial',
    body: 'A demanda é compreendida, qualificada e encaminhada com critério — tempo da equipe aplicado onde gera valor.',
  },
  {
    step: '03',
    title: 'Jornada completa',
    body: 'Negócios que exigem continuidade — contratos, execução e pós-venda — deixam de se perder entre planilhas e canais soltos.',
  },
]

/** Landing institucional (rota canónica: `/`; `/inicio` redireciona para cá). */
export default function LandingHome() {
  return (
    <main className="hub-public-fade-in">
      <section className="landing-hero-intec overflow-hidden px-4 py-16 sm:py-20">
        <div
          className="landing-hero-bg"
          style={{ backgroundImage: `url(${IMG_OBRA_HERO})` }}
          role="img"
          aria-label="Canteiro de obras em preto e branco"
        />
        <div className="landing-hero-overlay" aria-hidden />
        <div className="landing-hero-content landing-wrap w-full text-white">
          <div className="landing-rise flex justify-start">
            <Obra10Logo onDark heightClass="h-9 sm:h-10" />
          </div>
          <h1 className="landing-rise landing-rise-delay-1 mt-5 max-w-4xl text-4xl font-black leading-[1.06] tracking-tight sm:text-5xl lg:text-[3.25rem]">
            A plataforma que{' '}
            <span className="text-white">organiza o ecossistema</span>{' '}
            <span className="text-tertiary">da sua operação</span> em imóveis, obras e projetos.
          </h1>
          <p className="landing-rise landing-rise-delay-2 mt-6 max-w-2xl text-base font-semibold leading-relaxed text-white/85 sm:text-lg">
            Uma visão única para quem vive da construção civil e do mercado imobiliário: menos
            fragmentação, mais governança, parcerias mais fortes e experiências dignas de um produto
            de confiança.
          </p>
          <div className="landing-rise landing-rise-delay-3 mt-10 flex flex-wrap gap-3">
            <Link
              to="/login"
              className="inline-flex items-center justify-center bg-tertiary px-10 py-4 text-[10px] font-black uppercase tracking-[0.22em] text-primary no-underline shadow-lg transition hover:brightness-110"
            >
              Área do cliente
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex items-center justify-center border-2 border-white/90 bg-white/10 px-10 py-4 text-[10px] font-black uppercase tracking-[0.22em] text-white no-underline backdrop-blur-sm transition hover:bg-white/20"
            >
              Saiba mais
            </a>
          </div>
        </div>
      </section>

      <section className="border-y-2 border-primary bg-primary px-4 py-10 text-white">
        <div className="landing-wrap grid gap-10 text-center sm:grid-cols-3">
          {[
            ['01', 'Visão', 'Um ambiente para alinhar comercial, operação e rede de parceiros.'],
            ['100%', 'Foco', 'Construção civil, incorporação, serviços e fornecimento — no mesmo lugar.'],
            ['+', 'Futuro', 'Evolução contínua alinhada às necessidades reais do mercado.'],
          ].map(([n, t, d]) => (
            <div key={t} className="px-2">
              <p className="text-3xl font-black tracking-tighter text-tertiary sm:text-4xl">{n}</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em]">{t}</p>
              <p className="mt-2 text-sm font-medium text-white/80">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-24 bg-surface px-4 py-16 sm:py-20">
        <div className="landing-wrap">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-secondary">
              Como funciona
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-primary sm:text-4xl">
              Do primeiro contato à operação, sem perder o fio
            </h2>
            <p className="mt-4 text-base font-medium text-on-surface-variant">
              A Obra10+ foi pensada para quem precisa de{' '}
              <strong className="font-black text-primary">clareza comercial</strong> sem abrir mão
              da complexidade real de projetos, obras e intermediação.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {passos.map((p, i) => (
              <article
                key={p.step}
                className="border-2 border-surface-container-high bg-white p-6 shadow-sm"
                style={{ animation: `hub-rise 0.65s ease ${i * 0.07}s both` }}
              >
                <span className="text-[10px] font-black text-tertiary">{p.step}</span>
                <h3 className="mt-2 text-lg font-black text-primary">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{p.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-band-photo px-4 py-16 sm:py-20">
        <div
          className="landing-hero-bg"
          style={{ backgroundImage: `url(${IMG_OBRA_BANDA})` }}
          role="img"
          aria-label="Equipamento e estrutura em obra, preto e branco"
        />
        <div className="landing-hero-overlay" aria-hidden />
        <div className="landing-hero-content landing-wrap relative z-10 text-white">
          <p className="max-w-2xl text-[10px] font-black uppercase tracking-[0.28em] text-tertiary">
            Por que existe
          </p>
          <h2 className="mt-4 max-w-2xl text-2xl font-black leading-tight sm:text-3xl">
            Porque o setor merece menos ruído e mais coordenação entre quem vende, projeta, executa
            e fornece.
          </h2>
          <p className="mt-4 max-w-xl text-sm font-medium leading-relaxed text-white/85 sm:text-base">
            A Obra10+ reúne a ambição de um produto sério: digital, humano e preparado para o
            tamanho dos seus desafios — hoje e amanhã.
          </p>
          <a
            href="#plataforma"
            className="mt-8 inline-flex border-2 border-white px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white no-underline transition hover:bg-white hover:text-primary"
          >
            Nossa história e propósito
          </a>
        </div>
      </section>

      <section id="plataforma" className="scroll-mt-24 bg-white px-4 py-16 sm:py-20">
        <div className="landing-wrap">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-secondary">
                O que entregamos
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-primary sm:text-4xl">
                Uma experiência à altura de grandes operações
              </h2>
            </div>
            <Link
              to="/login"
              className="shrink-0 self-start border-2 border-primary bg-primary px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white no-underline transition hover:bg-primary/90 sm:self-auto"
            >
              Entrar
            </Link>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {pilares.map((m, i) => (
              <article
                key={m.title}
                className="group border border-surface-container-high bg-surface p-6 transition hover:border-primary hover:shadow-md"
                style={{ animation: `hub-rise 0.6s ease ${0.05 * i}s both` }}
              >
                <span
                  className="material-symbols-outlined text-3xl text-tertiary transition group-hover:scale-105"
                  aria-hidden
                >
                  {m.icon}
                </span>
                <h3 className="mt-4 text-sm font-black uppercase tracking-[0.12em] text-primary">
                  {m.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{m.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t-2 border-primary bg-surface-container-low px-4 py-16">
        <div className="landing-wrap text-center">
          <h2 className="text-2xl font-black tracking-tight text-primary sm:text-3xl">
            Vamos levar a sua operação para o próximo patamar?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm font-medium text-on-surface-variant">
            Conheça a Obra10+ por dentro, acesse a área do cliente e descubra como simplificar a
            jornada de quem confia no seu negócio.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/login"
              className="inline-flex border-2 border-primary bg-tertiary px-10 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary no-underline shadow-sm transition hover:brightness-105"
            >
              Área do cliente
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex border-2 border-primary bg-white px-10 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary no-underline transition hover:bg-white/90"
            >
              Conheça a Obra10+
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
