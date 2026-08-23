/*
 * Demo: CRM / Pipeline de Vendas (/demos/crm-vendas).
 *
 * Kanban de leads em 4 etapas. Arrastar funciona no desktop; as setas ‹ ›
 * de cada cartao existem porque tela de toque nao dispara drag-and-drop.
 *
 * Depende de /js/script.js (MOEDA) e /demos/demos.js (esc, demoCarregar,
 * demoSalvar), nessa ordem no HTML.
 */

const CHAVE_CRM = "demo-crm-vendas";

const ETAPAS = [
  { chave: "novo", rotulo: "Novo Contato" },
  { chave: "proposta", rotulo: "Proposta Enviada" },
  { chave: "negociacao", rotulo: "Negociação" },
  { chave: "fechado", rotulo: "Fechado" },
];

/* `dias` = ha quantos dias o lead esta parado na etapa atual. Acima de 7 o
   cartao acende em vermelho — e o sinal que o vendedor precisa ver. */
const LEADS_SEMENTE = [
  { id: 1, empresa: "Mercado Vila Nova", contato: "Sandra Ribeiro", valor: 8400, etapa: "novo", dias: 2, tags: ["Indicação", "Varejo"] },
  { id: 2, empresa: "Transportes Kruger", contato: "Anderson Kruger", valor: 15900, etapa: "novo", dias: 1, tags: ["Google", "Logística"] },
  { id: 3, empresa: "Ateliê Casa Bonita", contato: "Marina Prado", valor: 3200, etapa: "novo", dias: 9, tags: ["Instagram", "Decoração"] },
  { id: 4, empresa: "Clínica Bem Viver", contato: "Dr. Paulo Menezes", valor: 12500, etapa: "proposta", dias: 4, tags: ["Indicação", "Saúde"] },
  { id: 5, empresa: "Auto Center Zanardi", contato: "Rogério Zanardi", valor: 6800, etapa: "proposta", dias: 6, tags: ["WhatsApp", "Automotivo"] },
  { id: 6, empresa: "Escola Novo Rumo", contato: "Cristiane Alves", valor: 21400, etapa: "proposta", dias: 11, tags: ["Licitação", "Educação"] },
  { id: 7, empresa: "Rede Pão Nosso", contato: "Vitor Camargo", valor: 34800, etapa: "negociacao", dias: 3, tags: ["Indicação", "Alimentação"] },
  { id: 8, empresa: "Ótica Visão Clara", contato: "Helena Ferraz", valor: 9700, etapa: "negociacao", dias: 8, tags: ["Google", "Varejo"] },
  { id: 9, empresa: "Academia Corpo em Foco", contato: "Bruno Tavares", valor: 7300, etapa: "negociacao", dias: 2, tags: ["Instagram", "Fitness"] },
  { id: 10, empresa: "Doce Ponto Confeitaria", contato: "Letícia Moraes", valor: 5600, etapa: "fechado", dias: 5, tags: ["WhatsApp", "Alimentação"] },
  { id: 11, empresa: "Studio Fernandes Advocacia", contato: "Dra. Renata Fernandes", valor: 18200, etapa: "fechado", dias: 12, tags: ["Indicação", "Jurídico"] },
  { id: 12, empresa: "Pet Shop Focinho Feliz", contato: "Camila Duarte", valor: 4100, etapa: "fechado", dias: 19, tags: ["Google", "Pet"] },
];

/* ------------------------------ regras ------------------------------ */

const indiceEtapa = (chave) => ETAPAS.findIndex((e) => e.chave === chave);

/*
 * Mover devolve uma lista nova (nunca muta a antiga) e zera o contador de
 * dias: o lead acabou de entrar na etapa de destino. Destino invalido ou
 * fora das 4 colunas devolve a lista intacta.
 */
function moverLead(leads, id, etapaDestino) {
  const alvo = leads.find((l) => l.id === id);
  // Soltar o cartao na propria coluna nao e movimento: nao zera os dias.
  if (indiceEtapa(etapaDestino) === -1 || !alvo || alvo.etapa === etapaDestino) {
    return leads;
  }
  return leads.map((l) =>
    l.id === id ? { ...l, etapa: etapaDestino, dias: 0 } : l
  );
}

function etapaVizinha(chave, passo) {
  const destino = indiceEtapa(chave) + passo;
  return ETAPAS[destino] ? ETAPAS[destino].chave : null;
}

function porEtapa(leads, chave) {
  return leads.filter((l) => l.etapa === chave);
}

function somar(leads) {
  return leads.reduce((soma, l) => soma + l.valor, 0);
}

/* Conversao = fechados sobre o total de leads no funil, em %. */
function resumirPipeline(leads) {
  const fechados = porEtapa(leads, "fechado");
  const abertos = leads.filter((l) => l.etapa !== "fechado");
  return {
    aberto: somar(abertos),
    abertos: abertos.length,
    fechado: somar(fechados),
    fechados: fechados.length,
    conversao: leads.length ? Math.round((fechados.length / leads.length) * 100) : 0,
    ticket: fechados.length ? Math.round(somar(fechados) / fechados.length) : 0,
    parados: abertos.filter((l) => l.dias > 7).length,
  };
}

/* ------------------------------ tela ------------------------------ */

let leads = demoCarregar(CHAVE_CRM, LEADS_SEMENTE);

function textoIdade(dias) {
  if (dias === 0) return "movido agora";
  if (dias === 1) return "há 1 dia na etapa";
  return `há ${dias} dias na etapa`;
}

function montarMetricas() {
  const r = resumirPipeline(leads);
  document.getElementById("metricas").innerHTML = `
    <div class="metrica">
      <p class="metrica__rotulo">Pipeline em aberto</p>
      <p class="metrica__valor">${MOEDA.format(r.aberto)}</p>
      <p class="metrica__nota">${r.abertos} negociações ativas</p>
    </div>
    <div class="metrica">
      <p class="metrica__rotulo">Fechado no mês</p>
      <p class="metrica__valor">${MOEDA.format(r.fechado)}</p>
      <p class="metrica__nota metrica__nota--sobe">${r.fechados} contratos assinados</p>
    </div>
    <div class="metrica">
      <p class="metrica__rotulo">Taxa de conversão</p>
      <p class="metrica__valor">${r.conversao}%</p>
      <p class="metrica__nota">ticket médio ${MOEDA.format(r.ticket)}</p>
    </div>
    <div class="metrica">
      <p class="metrica__rotulo">Parados +7 dias</p>
      <p class="metrica__valor">${r.parados}</p>
      <p class="metrica__nota${r.parados ? " metrica__nota--desce" : ""}">
        ${r.parados ? "precisam de follow-up" : "funil em dia"}
      </p>
    </div>`;
}

function montarCartao(lead) {
  const anterior = etapaVizinha(lead.etapa, -1);
  const proxima = etapaVizinha(lead.etapa, 1);
  const tags = lead.tags
    .map((t) => `<li class="lead__tag">${esc(t)}</li>`)
    .join("");

  return `
    <article class="lead" draggable="true" data-id="${lead.id}">
      <p class="lead__nome">${esc(lead.empresa)}</p>
      <p class="lead__contato">${esc(lead.contato)}</p>
      <p class="lead__valor">${MOEDA.format(lead.valor)}</p>
      <ul class="lead__tags">${tags}</ul>
      <div class="lead__rodape">
        <span class="lead__idade${lead.dias > 7 ? " lead__idade--parado" : ""}">
          ${textoIdade(lead.dias)}
        </span>
        <span class="lead__mover">
          <button type="button" class="mover" data-mover="${anterior || ""}"
                  ${anterior ? "" : "disabled"} title="Voltar etapa"
                  aria-label="Voltar ${esc(lead.empresa)} uma etapa">‹</button>
          <button type="button" class="mover" data-mover="${proxima || ""}"
                  ${proxima ? "" : "disabled"} title="Avançar etapa"
                  aria-label="Avançar ${esc(lead.empresa)} uma etapa">›</button>
        </span>
      </div>
    </article>`;
}

function montarColuna(etapa) {
  const daEtapa = porEtapa(leads, etapa.chave);
  return `
    <section class="coluna" data-etapa="${etapa.chave}">
      <header class="coluna__head">
        <h2 class="coluna__nome">
          ${etapa.rotulo}
          <span class="coluna__contagem">${daEtapa.length} ${daEtapa.length === 1 ? "lead" : "leads"}</span>
        </h2>
        <span class="coluna__total">${MOEDA.format(somar(daEtapa))}</span>
      </header>
      <div class="coluna__lista">${daEtapa.map(montarCartao).join("")}</div>
    </section>`;
}

function renderizar() {
  document.getElementById("kanban").innerHTML = ETAPAS.map(montarColuna).join("");
  montarMetricas();
}

function aplicar(id, destino) {
  const antes = leads;
  leads = moverLead(leads, id, destino);
  if (leads !== antes) {
    demoSalvar(CHAVE_CRM, leads);
    renderizar();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const quadro = document.getElementById("kanban");

  quadro.addEventListener("click", (e) => {
    const botao = e.target.closest("[data-mover]");
    if (!botao || botao.disabled) return;
    aplicar(Number(botao.closest(".lead").dataset.id), botao.dataset.mover);
  });

  // Arrastar: so o dataTransfer carrega o id entre os eventos.
  quadro.addEventListener("dragstart", (e) => {
    const cartao = e.target.closest(".lead");
    if (!cartao) return;
    e.dataTransfer.setData("text/plain", cartao.dataset.id);
    e.dataTransfer.effectAllowed = "move";
    cartao.classList.add("is-arrastando");
  });

  quadro.addEventListener("dragend", (e) => {
    const cartao = e.target.closest(".lead");
    if (cartao) cartao.classList.remove("is-arrastando");
  });

  // preventDefault no dragover e o que autoriza o drop — sem ele nada cai.
  quadro.addEventListener("dragover", (e) => {
    const coluna = e.target.closest(".coluna");
    if (!coluna) return;
    e.preventDefault();
    coluna.classList.add("is-alvo");
  });

  quadro.addEventListener("dragleave", (e) => {
    const coluna = e.target.closest(".coluna");
    if (coluna && !coluna.contains(e.relatedTarget)) coluna.classList.remove("is-alvo");
  });

  quadro.addEventListener("drop", (e) => {
    const coluna = e.target.closest(".coluna");
    if (!coluna) return;
    e.preventDefault();
    coluna.classList.remove("is-alvo");
    aplicar(Number(e.dataTransfer.getData("text/plain")), coluna.dataset.etapa);
  });

  renderizar();
});
