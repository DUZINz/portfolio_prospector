/*
 * Demo: Painel de Gestão de Ordens de Serviço (/demos/painel-gestao).
 *
 * Dados ficticios de uma assistencia tecnica. O que o visitante cadastra fica
 * no localStorage do proprio navegador — nao existe servidor aqui.
 *
 * Depende de /js/script.js (MOEDA) e /demos/demos.js (esc, demoCarregar,
 * demoSalvar), nessa ordem no HTML.
 */

const CHAVE_OS = "demo-painel-os";
const TODOS = "todos";

const STATUS = [
  { chave: "pendente", rotulo: "Pendente" },
  { chave: "andamento", rotulo: "Em Andamento" },
  { chave: "concluido", rotulo: "Concluído" },
];

const OS_SEMENTE = [
  { id: "OS-2418", cliente: "Padaria Pão Nosso", local: "Portão", servico: "Manutenção preventiva do forno turbo", tecnico: "Rafael Lima", valor: 480, abertura: "2026-08-05", prazo: "2026-08-08", status: "concluido" },
  { id: "OS-2419", cliente: "Studio Fernandes Advocacia", local: "Batel", servico: "Instalação de rede Wi-Fi mesh (3 pontos)", tecnico: "Carla Souza", valor: 1250, abertura: "2026-08-06", prazo: "2026-08-11", status: "concluido" },
  { id: "OS-2420", cliente: "Barbearia Malandro", local: "Água Verde", servico: "Troca de fonte e limpeza do PC do caixa", tecnico: "Rafael Lima", valor: 320, abertura: "2026-08-07", prazo: "2026-08-09", status: "concluido" },
  { id: "OS-2421", cliente: "Doce Ponto Confeitaria", local: "Bigorrilho", servico: "Reparo na câmara fria — troca do termostato", tecnico: "Diego Martins", valor: 890, abertura: "2026-08-10", prazo: "2026-08-13", status: "concluido" },
  { id: "OS-2422", cliente: "Mercado Vila Nova", local: "Boqueirão", servico: "Instalação de 6 câmeras + DVR", tecnico: "Carla Souza", valor: 2740, abertura: "2026-08-11", prazo: "2026-08-18", status: "concluido" },
  { id: "OS-2423", cliente: "Clínica Bem Viver", local: "Cristo Rei", servico: "Migração dos prontuários para o servidor novo", tecnico: "Diego Martins", valor: 1980, abertura: "2026-08-12", prazo: "2026-08-20", status: "andamento" },
  { id: "OS-2424", cliente: "Auto Center Zanardi", local: "CIC", servico: "Cabeamento estruturado da oficina", tecnico: "Rafael Lima", valor: 3150, abertura: "2026-08-13", prazo: "2026-08-26", status: "andamento" },
  { id: "OS-2425", cliente: "Pet Shop Focinho Feliz", local: "Santa Felicidade", servico: "Configuração do sistema de PDV e impressora fiscal", tecnico: "Carla Souza", valor: 640, abertura: "2026-08-14", prazo: "2026-08-19", status: "andamento" },
  { id: "OS-2426", cliente: "Escola Novo Rumo", local: "Pinheirinho", servico: "Formatação de 12 máquinas do laboratório", tecnico: "Diego Martins", valor: 1440, abertura: "2026-08-17", prazo: "2026-08-24", status: "andamento" },
  { id: "OS-2427", cliente: "Restaurante Fogo de Barro", local: "Mercês", servico: "Troca do nobreak e revisão do quadro elétrico", tecnico: "Rafael Lima", valor: 1120, abertura: "2026-08-18", prazo: "2026-08-21", status: "pendente" },
  { id: "OS-2428", cliente: "Ótica Visão Clara", local: "Centro", servico: "Suporte no sistema de pedidos — lentes não sincronizam", tecnico: "Carla Souza", valor: 380, abertura: "2026-08-19", prazo: "2026-08-25", status: "pendente" },
  { id: "OS-2429", cliente: "Transportes Kruger", local: "Cajuru", servico: "Rastreadores em 4 veículos da frota", tecnico: "Diego Martins", valor: 2260, abertura: "2026-08-20", prazo: "2026-08-29", status: "pendente" },
  { id: "OS-2430", cliente: "Academia Corpo em Foco", local: "Portão", servico: "Catraca travando na leitura da biometria", tecnico: "Rafael Lima", valor: 560, abertura: "2026-08-21", prazo: "2026-08-27", status: "pendente" },
  { id: "OS-2431", cliente: "Floricultura Jardim Sul", local: "Novo Mundo", servico: "Instalação do computador da recepção", tecnico: "Carla Souza", valor: 290, abertura: "2026-08-22", prazo: "2026-09-01", status: "pendente" },
];

/* ------------------------------ regras ------------------------------ */

/*
 * Um filtro so: status + texto livre. A busca varre numero da OS, cliente,
 * servico e tecnico — os quatro campos por onde alguem procura no balcao.
 */
function filtrarOS(lista, busca, status) {
  const termo = String(busca || "").trim().toLowerCase();
  return lista.filter((os) => {
    if (status !== TODOS && os.status !== status) return false;
    if (!termo) return true;
    return [os.id, os.cliente, os.servico, os.tecnico]
      .join(" ")
      .toLowerCase()
      .includes(termo);
  });
}

/* Faturamento conta so OS concluida — servico em aberto ainda nao e receita. */
function resumirOS(lista) {
  const concluidas = lista.filter((o) => o.status === "concluido");
  const faturamento = concluidas.reduce((soma, o) => soma + o.valor, 0);
  return {
    pendentes: lista.filter((o) => o.status === "pendente").length,
    andamento: lista.filter((o) => o.status === "andamento").length,
    concluidas: concluidas.length,
    abertas: lista.length - concluidas.length,
    faturamento,
    ticket: concluidas.length ? Math.round(faturamento / concluidas.length) : 0,
  };
}

function proximoId(lista) {
  const maior = lista.reduce(
    (max, o) => Math.max(max, Number(String(o.id).replace(/\D/g, "")) || 0),
    0
  );
  return `OS-${maior + 1}`;
}

/* ISO "2026-08-12" -> "12/08". Split e nao new Date() para o fuso nao roubar
   um dia de quem abre a pagina de madrugada. */
function dataCurta(iso) {
  const [, mes, dia] = String(iso).split("-");
  return dia && mes ? `${dia}/${mes}` : "—";
}

function estaAtrasada(os, hoje) {
  return os.status !== "concluido" && os.prazo < hoje;
}

/* ------------------------------ tela ------------------------------ */

let ordens = demoCarregar(CHAVE_OS, OS_SEMENTE);
let filtroStatus = TODOS;

const rotuloStatus = (chave) =>
  (STATUS.find((s) => s.chave === chave) || {}).rotulo || chave;

function montarMetricas() {
  const r = resumirOS(ordens);
  document.getElementById("metricas").innerHTML = `
    <div class="metrica">
      <p class="metrica__rotulo">OS em aberto</p>
      <p class="metrica__valor">${r.abertas}</p>
      <p class="metrica__nota">${r.pendentes} aguardando triagem</p>
    </div>
    <div class="metrica">
      <p class="metrica__rotulo">Em andamento</p>
      <p class="metrica__valor">${r.andamento}</p>
      <p class="metrica__nota">com técnico designado</p>
    </div>
    <div class="metrica">
      <p class="metrica__rotulo">Concluídas no mês</p>
      <p class="metrica__valor">${r.concluidas}</p>
      <p class="metrica__nota metrica__nota--sobe">+18% vs. julho</p>
    </div>
    <div class="metrica">
      <p class="metrica__rotulo">Faturamento do mês</p>
      <p class="metrica__valor">${MOEDA.format(r.faturamento)}</p>
      <p class="metrica__nota">ticket médio ${MOEDA.format(r.ticket)}</p>
    </div>`;
}

function montarChips() {
  const chips = document.getElementById("chips");
  const abas = [{ chave: TODOS, rotulo: "Todas" }, ...STATUS];
  chips.innerHTML = abas
    .map((a) => {
      const total =
        a.chave === TODOS
          ? ordens.length
          : ordens.filter((o) => o.status === a.chave).length;
      const ativo = a.chave === filtroStatus;
      return `<button type="button" class="filtro${ativo ? " is-ativo" : ""}"
                 data-status="${a.chave}" aria-pressed="${ativo}">
                ${a.rotulo} <span class="filtro__contagem">${total}</span>
              </button>`;
    })
    .join("");
}

function montarLinha(os, hoje) {
  const atrasada = estaAtrasada(os, hoje);
  return `
    <tr>
      <td>
        <span class="tabela__os">${esc(os.id)}</span>
        <span class="tabela__sec">aberta ${dataCurta(os.abertura)}</span>
      </td>
      <td>
        ${esc(os.cliente)}
        ${os.local ? `<span class="tabela__sec">${esc(os.local)}</span>` : ""}
      </td>
      <td>${esc(os.servico)}</td>
      <td>${esc(os.tecnico)}</td>
      <td>
        ${dataCurta(os.prazo)}
        ${atrasada ? '<span class="tabela__sec" style="color:var(--pendente)">em atraso</span>' : ""}
      </td>
      <td class="tabela__valor">${MOEDA.format(os.valor)}</td>
      <td><span class="status status--${esc(os.status)}">${esc(rotuloStatus(os.status))}</span></td>
    </tr>`;
}

function renderizar() {
  const busca = document.getElementById("busca").value;
  const visiveis = filtrarOS(ordens, busca, filtroStatus);
  const hoje = new Date().toISOString().slice(0, 10);

  document.getElementById("corpo").innerHTML = visiveis.length
    ? visiveis.map((os) => montarLinha(os, hoje)).join("")
    : `<tr><td colspan="7" class="tabela__vazio">
         Nenhuma ordem de serviço encontrada com esses filtros.
       </td></tr>`;

  document.getElementById("contador").textContent =
    `Mostrando ${visiveis.length} de ${ordens.length} ordens de serviço.`;

  montarMetricas();
  montarChips();
}

function cadastrar(dados) {
  ordens = [
    {
      id: proximoId(ordens),
      cliente: dados.get("cliente"),
      local: "",
      servico: dados.get("servico"),
      tecnico: dados.get("tecnico"),
      valor: Number(dados.get("valor")) || 0,
      abertura: new Date().toISOString().slice(0, 10),
      prazo: dados.get("prazo"),
      status: dados.get("status"),
    },
    ...ordens,
  ];
  demoSalvar(CHAVE_OS, ordens);
  renderizar();
}

document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("modal");
  const form = document.getElementById("form-os");

  document.getElementById("busca").addEventListener("input", renderizar);

  document.getElementById("chips").addEventListener("click", (e) => {
    const botao = e.target.closest("[data-status]");
    if (!botao) return;
    filtroStatus = botao.dataset.status;
    renderizar();
  });

  document.getElementById("nova").addEventListener("click", () => {
    // Prazo sugerido: hoje + 5 dias, que e o SLA padrao do exemplo.
    const daqui = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    form.elements.prazo.value = daqui;
    modal.showModal();
  });

  document.getElementById("cancelar").addEventListener("click", () => modal.close());

  // <form method="dialog">: o submit fecha o modal sozinho depois daqui.
  form.addEventListener("submit", () => {
    cadastrar(new FormData(form));
    form.reset();
  });

  renderizar();
});
