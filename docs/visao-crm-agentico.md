# Visão CRM agentico — Obra10+ HUB

Documento de **conceito e alinhamento**: como o HUB encaixa a transição do “software como painel preenchido à mão” para **operação assistida e automatizada por agentes de IA** (internos ou externos), em linha com a direção do mercado de CRM — narrativas como as do [Salesforce Blog](https://www.salesforce.com/blog/) sobre **Agentic AI**, dados confiáveis e plataforma como base para agentes, não como destino final do trabalho humano.

**Relação com outros docs:** complementa [spec.md](./spec.md) (princípios e entidades) e [guia-implementacao.md](./guia-implementacao.md) (marcos técnicos). Não substitui decisões de schema; guia o **desenho** de integrações e prioridades.

---

## 1. Tese: do utilizador que alimenta o CRM ao agente que o mantém vivo

Durante décadas, “produtividade” em CRM significou muitas vezes: **um login, um dashboard, dezenas de abas e um humano a digitar** para alimentar uma máquina que devia ajudar esse mesmo humano. O resultado foi o oposto da promessa: trabalho administrativo pesado, dados desatualizados e métricas que medem **higiene de entrada** em vez de **julgamento, relacionamento e resultado**.

Esse modelo está a ser substituído, em tempo real, por outro:

- Quem **atualiza o estado do CRM** deixa de ser, por defeito, só o utilizador humano — passa a ser **combinação de ingestão automática, agentes e validação humana onde o risco o justifica**.
- Quem **prepara relatórios repetitivos** (ex.: pacotes de revisão com cliente) deixa de depender só de horas humanas copiando dados — passa a depender de **agentes com contexto** sobre o mesmo sistema de verdade.
- **RevOps e operações** deixam de ser apenas “SQL e planilhas como ofício” — passam a **orquestrar regras, qualidade e exceções**, enquanto rotinas e síntese são **delegáveis a agentes**.
- **Gestão** deixa de premiar só “campos preenchidos”; passa a premiar **decisão, alinhamento com cliente e outcome** — o que agentes não substituem.

A mudança relevante **não é “colar IA por cima do mesmo CRM”**. É desenhar o produto para que **o trabalho aconteça onde as equipas já estão** (canais, docs, voz, e-mail, WhatsApp) e o HUB seja **fonte de verdade, política e histórico** — com agentes a **propor, executar tarefas seguras e pedir confirmação** no que for sensível.

**Implicação estratégica:** os próximos ciclos de produto não se ganham só com “melhor stack técnica”, mas com **métricas certas** (resultado, qualidade de relação, velocidade de decisão) e com **dados confiáveis o suficiente** para agentes externos ou internos operarem sem alucinar nem violar governação.

---

## 2. O que isso significa para o Obra10+ HUB (em termos de produto)

| Dimensão | Visão agentica |
|----------|------------------|
| **Triagem** | Entradas (formulário, WhatsApp, manual) convergem para **um mesmo tipo de registo**; agentes podem **classificar, resumir e sugerir próximo passo**; humanos HUB **confirmam ou corrigem** (julgamento). |
| **CRM como sistema de registo** | O utilizador não é o único “ escritor ”; **eventos** (`domain_events` e evoluções do modelo) documentam **quem ou o quê** mudou o estado (pessoa, agente, integração). |
| **Cadastros e relacionamento** | Dados mestres continuam **governados** (RLS, perfis); agentes **propem** alterações ou **preenchem** campos de baixo risco; alterações de alto risco exigem **confirmação explícita**. |
| **Operação pós-fecho** | Continuidade do negócio (obra, contrato, fornecedor) gera **volume de eventos** ideal para **síntese por agente** sem substituir a decisão humana em marcos críticos. |

O SPEC já antecipa **operação orientada a eventos** e **inteligência futura**; esta visão explicita que **“inteligência futura” inclui, por defeito, agentes** — não só dashboards.

---

## 3. Arquitetura: pronto para agentes externos e internos

Objetivo: o HUB **não fecha** o mundo numa única UI; **expõe contratos claros** para que agentes (da equipa, de parceiros ou de ferramentas third-party) possam:

1. **Ler** o que a política de segurança permitir (via **API**, **Edge Functions** ou **integrações** com chaves adequadas — nunca expor segredos no browser).
2. **Escrever** através de **caminhos auditáveis**: mutações que registam **ator** (utilizador ou `service`/agente identificado) e **evento de domínio** sempre que fizer sentido.
3. **Respeitar RLS e papéis**: agentes não são “superusers morais”; operam com **identidade técnica** (ex.: service role só em backend) ou **JWT** de utilizador com **escopo limitado**, conforme o caso de uso.

### 3.1 Princípios de integração (para documentar agora, implementar depois)

- **Sistema de verdade único** — Postgres/Supabase como fonte; agentes **sincronizam ou consultam** o HUB, não cópias opacas.
- **Append-only onde importa** — eventos e histórico permitem **replay**, auditoria e treino/regra de ouro para prompts (“o que aconteceu com este lead?”).
- **Contratos explícitos** — payloads estáveis (JSON schema ou equivalente) para: criar/atualizar lead, mudar etapa, registar nota, disparar classificação.
- **Human-in-the-loop por defeito em risco** — especialmente: financeiro, dados pessoais sensíveis, compromissos legais com terceiros.
- **Idempotência** — entradas por canal (ex.: WhatsApp) usam chaves externas; **o mesmo conceito serve webhooks de agentes**.

### 3.2 “Agentes externos”

Entende-se por **agentes externos**: modelos ou orquestradores **fora** do monólito da app (ex.: fluxos em plataformas de automação, assistentes ligados a e-mail/WhatsApp, copilotos empresariais), desde que:

- conversem com o HUB por **APIs definidas** e credenciais **rotacionáveis**;
- deixem **rastro** compatível com auditoria (tipo de evento, `actor_id` ou identificador de serviço, payload).

Não é obrigatório escolher um fornecedor agora; é obrigatório **não** desenhar telas que só um humano consegue operar **sem** caminho máquina-legível equivalente.

---

## 4. Métricas e cultura (o que o projeto premia)

**Menos** (como objetivo explícito de produto):

- Glorificar “campos atualizados por semana” como sucesso isolado.
- Tratar o CRM como armazém de dados que **só humanos** alimentam.

**Mais**:

- **Tempo até decisão** na triagem.
- **Qualidade da classificação** (acerto humano + agente vs. retrabalho).
- **Continuidade pós-encerro** medida por eventos de negócio reais, não por login count.
- **Confiança nos dados** (duplicados, conflitos, políticas violadas).

Isto alinha a narrativa de “era dos agentes” com o que o HUB já ambiciona ser para construção civil e ecossistema imobiliário: **menos ruído operacional, mais coordenação e governação**.

---

## 5. Próximos passos (só conceito → entrega futura)

Ordem sugerida, quando a engenharia avançar:

1. Fechar **contrato mínimo** de eventos para a triagem (tipos, payloads, `actor`).
2. Expor **API interna** (Edge Function ou route servidor) para **ações de agente** com autenticação forte.
3. Pilotar **um agente** (ex.: resumo + sugestão de etapa) **só leitura + sugestão**, depois escalonar para escrita com confirmação.
4. Avaliar **sync/query** (TanStack Query, filas, ou motor de sync no médio prazo) conforme volume — sem antecipar vendor; manter **Postgres como núcleo**.

---

## 6. Resumo em uma frase

O Obra10+ HUB deve ser construído para que **humanos excelam em julgamento e relação**, e **agentes excelam em consistência, síntese e execução de tarefas repetitivas** — com **dados e eventos** como alicerce, e **CRM** como sistema vivo, não como arquivo alimentado à força.
