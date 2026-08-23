/*
 * Prospector — painel de bolso (/app).
 *
 * Espelha as REGRAS do funil que ja existe em Python (prospector/funil.py e
 * prospector/models.py): mesmos prazos de cadencia, mesmos textos, mesma
 * normalizacao de telefone. Se mudar la, mude aqui — sao duas copias das
 * mesmas regras, nao um sistema falando com o outro.
 *
 * ATENCAO: este painel NAO conversa com o funil.db. Sao dois funis
 * independentes. A ponte entre eles e manual, pelo Exportar/Importar CSV.
 *
 * Nada sai do aparelho: os leads vivem no localStorage deste navegador.
 */

/* ============================ configuracao ============================ */

const PIN_PADRAO = "2026";
const CHAVE_LEADS = "prospector-leads";
const CHAVE_PIN = "prospector-pin";
const CHAVE_ABERTO = "prospector-aberto";

const PORTFOLIO = "https://portfolio-murex-alpha-23.vercel.app/";
const TABELA_URL = "https://portfolio-murex-alpha-23.vercel.app/EG-Tabela-de-Precos-2026.2.pdf";

/* Prazos da cadencia, em HORAS — iguais aos de prospector/funil.py. Contar em
   dias nao resolveria "48h depois do envio": duas mensagens no mesmo dia civil
   dariam 0 dia de diferenca. */
const HORAS_ATE_FOLLOWUP1 = 48;
const HORAS_ATE_FOLLOWUP2 = 72;
const ESTAGIO_FINAL = 3;

/* Status que voce move na mao e que congelam a cadencia: nao se insiste com
   quem ja respondeu nem com quem foi arquivado. Vale mais que o prazo. */
const STATUS_CONGELA = new Set(["interessado", "reuniao", "fechado", "arquivado"]);

/* O estagio e a fonte da verdade da cadencia; o status nomeado e derivado
   dele, nunca uma segunda coluna que pode divergir. */
const STATUS_POR_ESTAGIO = { 0: "novo", 1: "contatado", 2: "followup", 3: "followup" };

const ROTULO_STATUS = {
  novo: "Novo",
  contatado: "Contatado",
  followup: "Follow-up enviado",
  interessado: "Interessado",
  reuniao: "Reunião agendada",
  fechado: "Fechado",
  arquivado: "Arquivado",
};

/* DDDs validos no Brasil — igual a DDDS_VALIDOS de prospector/models.py.
   Sem isso um numero truncado passaria por telefone bom. */
const DDDS_VALIDOS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

const PREFIXOS_SERVICO = ["0800", "0300", "0500", "0900", "4004", "3003", "4003"];

/* ============================ mensagens ============================ */

/*
 * Textos copiados de prospector/models.py, com UMA mudanca: la o PITCH_GERAL
 * diz "estou te enviando em anexo" porque o envio via Playwright anexa mesmo o
 * PDF. O wa.me nao carrega arquivo — entao aqui a tabela vai como link, senao
 * a mensagem prometeria um anexo que nunca chega.
 */
const PITCH_GERAL =
  "{saudacao} Tudo bem?\n\n" +
  "Me chamo Eduardo Grunitzky, sou desenvolvedor de software e crio soluções " +
  "digitais sob medida para empresas — desde sistemas internos de gestão, " +
  "automações de processos e IA, até aplicativos e sites de alta conversão.\n\n" +
  "🌐 Meu portfólio: {portfolio}\n" +
  "(os projetos lá são modelos de demonstração que montei para exemplificar " +
  "o padrão visual e de acabamento)\n\n" +
  "O meu modelo de trabalho é direto: escopo e preço fechados, código 100% " +
  "seu (sem ficar preso a mensalidades de plataformas) e entrega pronta " +
  "rodando no servidor.\n\n" +
  "📄 Minha Tabela de Preços e Serviços 2026.2, com prazos e valores " +
  "transparentes para cada tipo de projeto: {tabela}\n\n" +
  "Se fizer sentido para o momento da {nome_empresa} ou se tiver algum " +
  "processo que queira automatizar, fico à disposição para batermos um papo!";

const ABORDAGEM_FOLLOWUP1 =
  "Fala{saudacao_nome}! Tudo bem?\n\n" +
  "Passando só para saber se você conseguiu dar uma olhada no catálogo e na " +
  "tabela de preços que te enviei outro dia.\n\n" +
  "Se tiver ficado com alguma dúvida sobre como funcionam os projetos ou " +
  "quiser bater um papo rápido sobre alguma demanda da {nome_empresa}, " +
  "estou por aqui!";

const ABORDAGEM_FOLLOWUP2 =
  "Última mensagem por aqui, prometo 🙂\n\n" +
  "Se não for o momento certo pro {negocio}, sem problema algum — fico à " +
  "disposição quando fizer sentido — a tabela de preços continua valendo.";

const PITCH_INTERESSE =
  "Que bom que fez sentido! 🙂\n\n" +
  "Para eu montar um escopo do sistema do {negocio}, preciso de três coisas:\n" +
  "1. Qual processo o sistema precisa resolver primeiro\n" +
  "2. Quantas pessoas vão usar\n" +
  "3. Se precisa conversar com algum sistema que vocês já usam\n\n" +
  "Com isso eu te devolvo escopo, prazo e valor — sem compromisso.";

/*
 * Variavel que o template pede e o lead nao tem vira string vazia — mesmo
 * contrato do _Variaveis de models.py. Sem isso um {link_site} num lead sem
 * site deixaria "{link_site}" cru no meio da mensagem.
 */
function preencher(modelo, lead) {
  const nome = String((lead && lead.empresa) || "").trim();
  const variaveis = {
    saudacao: nome ? `Olá, ${nome}!` : "Olá!",
    saudacao_nome: nome ? `, ${nome}` : "",
    negocio: nome || "seu negócio",
    nome_lead: nome || "seu negócio",
    nome_empresa: nome || "sua empresa",
    contato: (lead && lead.contato) || "",
    link_site: (lead && lead.site) || "",
    portfolio: PORTFOLIO,
    tabela: TABELA_URL,
  };
  return String(modelo).replace(/\{(\w+)\}/g, (_, chave) =>
    chave in variaveis ? variaveis[chave] : ""
  );
}

/* ============================ telefone ============================ */

const soDigitos = (t) => String(t || "").replace(/\D/g, "");

/*
 * Porte de normalizar_telefone() de prospector/models.py. Devolve o numero em
 * e164 e o link do wa.me — vazio quando o numero nao serve para WhatsApp
 * (fixo, 0800, DDD inexistente).
 */
function normalizarTelefone(bruto) {
  let d = soDigitos(bruto);
  if (!d) return { e164: "", whatsapp: "" };
  if (PREFIXOS_SERVICO.some((p) => d.startsWith(p))) return { e164: d, whatsapp: "" };

  d = d.replace(/^0+/, ""); // prefixo nacional/operadora: "0 41 ...", "015 41 ..."
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);

  if (d.length !== 10 && d.length !== 11) return { e164: "", whatsapp: "" };
  if (!DDDS_VALIDOS.has(Number(d.slice(0, 2)))) return { e164: "", whatsapp: "" };

  // So celular (11 digitos, o 9 na frente) existe no WhatsApp.
  const whatsapp = d.length === 11 && d[2] === "9" ? `https://wa.me/55${d}` : "";
  return { e164: `+55${d}`, whatsapp };
}

function formatarTelefone(e164) {
  const d = soDigitos(e164).replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return e164 || "";
}

/* ============================ cadencia ============================ */

function statusDoLead(lead) {
  if (STATUS_CONGELA.has(lead.status)) return lead.status;
  return STATUS_POR_ESTAGIO[lead.estagio] || "followup";
}

const horasDesde = (iso, agora) => (agora - Date.parse(iso)) / 3600000;

/*
 * O que este lead esta esperando agora. `pronto` diz se ha mensagem liberada;
 * `motivo` e o texto que aparece no card quando nao ha. Mesma decisao de
 * funil.py: status marcado na mao vence o prazo.
 */
function situacao(lead, agora = Date.now()) {
  const st = statusDoLead(lead);
  if (STATUS_CONGELA.has(st)) {
    return { pronto: false, etapa: "congelado", motivo: ROTULO_STATUS[st], modelo: null };
  }
  if (lead.estagio >= ESTAGIO_FINAL) {
    return { pronto: false, etapa: "fim", motivo: "sequência concluída", modelo: null };
  }
  if (!lead.estagio) {
    return { pronto: true, etapa: "inicial", motivo: "abordagem inicial", modelo: PITCH_GERAL };
  }

  const espera = lead.estagio === 1 ? HORAS_ATE_FOLLOWUP1 : HORAS_ATE_FOLLOWUP2;
  const modelo = lead.estagio === 1 ? ABORDAGEM_FOLLOWUP1 : ABORDAGEM_FOLLOWUP2;
  const passadas = lead.ultimoContato ? horasDesde(lead.ultimoContato, agora) : Infinity;
  if (passadas >= espera) {
    return {
      pronto: true,
      etapa: "followup",
      motivo: lead.estagio === 1 ? "follow-up 1 liberado" : "follow-up 2 liberado",
      modelo,
    };
  }
  return {
    pronto: false,
    etapa: "aguardando",
    motivo: `aguardando ${Math.ceil(espera - passadas)}h`,
    modelo: null,
  };
}

/* Avanca o estagio e carimba a hora — o equivalente ao "Enviei essa mensagem". */
function registrarEnvio(lead, agora = new Date()) {
  const iso = agora.toISOString();
  return {
    ...lead,
    estagio: Math.min((lead.estagio || 0) + 1, ESTAGIO_FINAL),
    ultimoContato: iso,
    primeiroContato: lead.primeiroContato || iso,
  };
}

/* ============================ filtros ============================ */

const FILTROS = [
  { chave: "todos", rotulo: "Todos" },
  { chave: "sem-site", rotulo: "Sem site" },
  { chave: "com-site", rotulo: "Com site" },
  { chave: "followup", rotulo: "🔔 Follow-up" },
  { chave: "interessados", rotulo: "🔥 Interessados" },
  { chave: "fechados", rotulo: "✓ Fechados" },
];

function combinaBusca(lead, termo) {
  if (!termo) return true;
  return [lead.empresa, lead.contato, lead.nicho, lead.telefone, lead.site]
    .join(" ")
    .toLowerCase()
    .includes(termo);
}

function passaFiltro(lead, filtro, agora) {
  const st = statusDoLead(lead);
  switch (filtro) {
    case "sem-site":
      return !lead.site;
    case "com-site":
      return Boolean(lead.site);
    case "followup":
      return situacao(lead, agora).etapa === "followup";
    case "interessados":
      return st === "interessado" || st === "reuniao";
    case "fechados":
      return st === "fechado";
    default:
      return true;
  }
}

/*
 * Arquivado sai de todas as listas — e o que "arquivar" quer dizer. Mas a
 * busca por texto varre tudo, senao um lead arquivado por engano ficaria
 * inalcancavel pelo celular.
 */
function filtrar(leads, busca, filtro, agora = Date.now()) {
  const termo = String(busca || "").trim().toLowerCase();
  return leads.filter((lead) => {
    if (!combinaBusca(lead, termo)) return false;
    if (statusDoLead(lead) === "arquivado") return Boolean(termo);
    return passaFiltro(lead, filtro, agora);
  });
}

function contarPorFiltro(leads, agora = Date.now()) {
  const contas = {};
  FILTROS.forEach((f) => {
    contas[f.chave] = leads.filter(
      (l) => statusDoLead(l) !== "arquivado" && passaFiltro(l, f.chave, agora)
    ).length;
  });
  return contas;
}

/* ============================ CSV ============================ */

const COLUNAS = ["empresa", "contato", "telefone", "site", "nicho", "status", "estagio", "ultimoContato", "notas"];

/* Campo com vírgula, aspas ou quebra de linha vai entre aspas, e aspas viram
   aspas dobradas. Sem isso uma nota com vírgula desloca todas as colunas. */
function csvEscapar(valor) {
  const t = valor === null || valor === undefined ? "" : String(valor);
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

function paraCSV(leads) {
  const linhas = [COLUNAS.join(",")];
  leads.forEach((l) => linhas.push(COLUNAS.map((c) => csvEscapar(l[c])).join(",")));
  return linhas.join("\r\n");
}

/*
 * Parser de CSV feito na mao porque o formato tem uma regra que split(",") nao
 * cobre: dentro de aspas, virgula e quebra de linha sao texto. Percorre
 * caractere a caractere alternando "dentro/fora de aspas".
 */
function lerCSV(texto) {
  const linhas = [];
  let campo = "";
  let linha = [];
  let dentro = false;

  const conteudo = String(texto).replace(/^﻿/, ""); // BOM do Excel
  for (let i = 0; i < conteudo.length; i++) {
    const c = conteudo[i];
    if (dentro) {
      if (c === '"') {
        if (conteudo[i + 1] === '"') { campo += '"'; i++; } else { dentro = false; }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      dentro = true;
    } else if (c === ",") {
      linha.push(campo); campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && conteudo[i + 1] === "\n") i++;
      linha.push(campo); linhas.push(linha); campo = ""; linha = [];
    } else {
      campo += c;
    }
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }

  if (!linhas.length) return [];
  const cabecalho = linhas[0].map((h) => h.trim());
  return linhas.slice(1)
    .filter((l) => l.some((v) => v !== ""))
    .map((l) => {
      const bruto = {};
      cabecalho.forEach((h, i) => (bruto[h] = l[i] === undefined ? "" : l[i]));
      return bruto;
    });
}

/* Aceita tanto o CSV daqui quanto colunas do prospector em Python (`nome`,
   `categoria`, `observacoes`) — a ponte entre os dois e este import. */
function normalizarImportado(bruto, id) {
  const telefone = bruto.telefone || bruto.telefone_e164 || "";
  return {
    id,
    empresa: (bruto.empresa || bruto.nome || "").trim(),
    contato: (bruto.contato || "").trim(),
    telefone: normalizarTelefone(telefone).e164 || telefone.trim(),
    site: (bruto.site || "").trim(),
    nicho: (bruto.nicho || bruto.categoria || bruto.termo || "").trim(),
    notas: (bruto.notas || bruto.observacoes || "").trim(),
    status: ROTULO_STATUS[bruto.status] ? bruto.status : "novo",
    estagio: Number(bruto.estagio) || 0,
    ultimoContato: bruto.ultimoContato || bruto.data_ultimo_contato || null,
    primeiroContato: bruto.primeiroContato || bruto.data_primeiro_contato || null,
  };
}

/* Deduplicacao por telefone: reimportar a mesma lista nao deve dobrar os cards
   nem, pior, reabrir a cadencia de quem ja foi abordado. */
function mesclar(atuais, novos) {
  const porChave = new Map(atuais.map((l) => [chaveLead(l), l]));
  novos.forEach((n) => {
    const chave = chaveLead(n);
    if (!porChave.has(chave)) porChave.set(chave, n);
  });
  return [...porChave.values()];
}

function chaveLead(lead) {
  return soDigitos(lead.telefone) || `nome:${(lead.empresa || "").toLowerCase()}`;
}

/* ============================ estado ============================ */

let leads = [];
let filtroAtivo = "todos";
let busca = "";
let leadAberto = null;

const ler = (chave, padrao) => {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? JSON.parse(bruto) : padrao;
  } catch {
    return padrao;
  }
};

const gravar = (chave, valor) => {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    aviso("Não consegui salvar — armazenamento cheio ou bloqueado.");
  }
};

const salvarLeads = () => gravar(CHAVE_LEADS, leads);

function novoId() {
  return `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/* ============================ util de tela ============================ */

function esc(texto) {
  return String(texto === null || texto === undefined ? "" : texto).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
  );
}

let timerAviso;
function aviso(texto) {
  const el = document.getElementById("toast");
  el.textContent = texto;
  el.classList.add("is-visivel");
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => el.classList.remove("is-visivel"), 2600);
}

function haQuanto(iso, agora = Date.now()) {
  if (!iso) return "sem contato";
  const h = horasDesde(iso, agora);
  if (h < 1) return "há minutos";
  if (h < 24) return `há ${Math.floor(h)}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}

function dominio(url) {
  return String(url).replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
}

/* Copia com fallback: a Clipboard API exige contexto seguro, e no celular o
   app pode estar sendo aberto por IP local (http), onde ela nao existe. */
async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand && document.execCommand("copy");
    area.remove();
    return Boolean(ok);
  }
}

function baixar(nomeArquivo, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ============================ render ============================ */

function montarFiltros() {
  const contas = contarPorFiltro(leads);
  document.getElementById("filtros").innerHTML = FILTROS.map(
    (f) => `
    <button type="button" class="chip${f.chave === filtroAtivo ? " is-ativo" : ""}"
            data-filtro="${f.chave}" aria-pressed="${f.chave === filtroAtivo}">
      ${f.rotulo}<span class="chip__n">${contas[f.chave]}</span>
    </button>`
  ).join("");
}

function montarLead(lead, agora) {
  const st = statusDoLead(lead);
  const sit = situacao(lead, agora);
  const zap = normalizarTelefone(lead.telefone).whatsapp;
  const href = zap && sit.modelo
    ? `${zap}?text=${encodeURIComponent(preencher(sit.modelo, lead))}`
    : "";

  const selo = lead.site
    ? `<a class="selo selo--site" href="${esc(lead.site)}" target="_blank" rel="noopener">${esc(dominio(lead.site))} ↗</a>`
    : '<span class="selo selo--sem">Sem site</span>';

  const principal = href
    ? `<a class="acao acao--zap" href="${esc(href)}" target="_blank" rel="noopener"
          data-enviar="${lead.id}">${sit.etapa === "followup" ? "🔔 Follow-up" : "WhatsApp"}</a>`
    : `<span class="acao acao--off">${esc(zap ? sit.motivo : "sem WhatsApp")}</span>`;

  return `
    <li class="lead" data-id="${lead.id}">
      <div class="lead__topo">
        <div class="lead__quem">
          <p class="lead__empresa">${esc(lead.empresa)}</p>
          <p class="lead__contato">${esc([lead.contato, lead.nicho].filter(Boolean).join(" · ") || formatarTelefone(lead.telefone))}</p>
        </div>
        <span class="tag tag--${st}">${ROTULO_STATUS[st]}</span>
      </div>
      <div class="lead__meta">
        ${selo}
        <span class="lead__quando">${esc(haQuanto(lead.ultimoContato, agora))}</span>
      </div>
      <div class="lead__acoes">
        ${principal}
        <button type="button" class="acao" data-copiar="${lead.id}">Copiar</button>
        <button type="button" class="acao" data-acoes="${lead.id}">Status</button>
      </div>
    </li>`;
}

function renderizar() {
  const agora = Date.now();
  const visiveis = filtrar(leads, busca, filtroAtivo, agora);
  const lista = document.getElementById("leads");

  lista.innerHTML = visiveis.length
    ? visiveis.map((l) => montarLead(l, agora)).join("")
    : `<li class="vazio">
         <p>${leads.length ? "Nenhum lead com esses filtros." : "Nenhum lead ainda."}</p>
         ${leads.length ? "" : '<button type="button" class="btn-linha" id="exemplos">Carregar 6 leads de exemplo</button>'}
       </li>`;

  document.getElementById("contador").textContent =
    `${visiveis.length} de ${leads.length} leads`;
  montarFiltros();
}

/* ============================ acoes ============================ */

function porId(id) {
  return leads.find((l) => l.id === id);
}

function atualizar(id, mudanca) {
  leads = leads.map((l) => (l.id === id ? { ...l, ...mudanca } : l));
  salvarLeads();
  renderizar();
}

function marcarEnviado(id) {
  const lead = porId(id);
  if (!lead) return;
  leads = leads.map((l) => (l.id === id ? registrarEnvio(l) : l));
  salvarLeads();
  renderizar();
  aviso(lead.estagio ? "Follow-up registrado." : "Marcado como contatado.");
}

async function copiarMensagem(id) {
  const lead = porId(id);
  if (!lead) return;
  const sit = situacao(lead);
  const texto = preencher(sit.modelo || PITCH_GERAL, lead);
  aviso((await copiar(texto)) ? "Mensagem copiada." : "Não consegui copiar.");
}

const EXEMPLOS = [
  { empresa: "Padaria Pão Nosso", contato: "Marcelo", telefone: "+5541999110022", site: "", nicho: "Padaria" },
  { empresa: "Auto Center Zanardi", contato: "Rogério", telefone: "+5541998220133", site: "", nicho: "Automotivo" },
  { empresa: "Clínica Bem Viver", contato: "Dr. Paulo", telefone: "+5541997330244", site: "https://clinicabemviver.com.br", nicho: "Saúde" },
  { empresa: "Ótica Visão Clara", contato: "Helena", telefone: "+5541996440355", site: "https://oticavisaoclara.com.br", nicho: "Varejo" },
  { empresa: "Pet Shop Focinho Feliz", contato: "Camila", telefone: "+5541995550466", site: "", nicho: "Pet" },
  { empresa: "Transportes Kruger", contato: "Anderson", telefone: "+5541994660577", site: "https://transporteskruger.com.br", nicho: "Logística" },
];

function carregarExemplos() {
  leads = mesclar(
    leads,
    EXEMPLOS.map((e) => ({
      ...e, id: novoId(), notas: "", status: "novo", estagio: 0,
      ultimoContato: null, primeiroContato: null,
    }))
  );
  salvarLeads();
  renderizar();
  aviso("6 leads de exemplo carregados.");
}

/* ============================ trava por PIN ============================ */

/*
 * Isto NAO e seguranca: o PIN e o codigo estao no navegador, e quem abrir o
 * devtools ve tudo. E uma cortina contra olhar de passagem quando o celular
 * esta destravado na mao de outra pessoa — o que, no uso real, e o risco que
 * existe. Os leads nunca saem do aparelho, entao nao ha o que interceptar.
 */
function ligarTrava() {
  const trava = document.getElementById("trava");
  const app = document.getElementById("app");
  const campo = document.getElementById("pin");

  const abrir = () => {
    trava.hidden = true;
    app.hidden = false;
    try { sessionStorage.setItem(CHAVE_ABERTO, "1"); } catch { /* aba anonima */ }
  };

  try {
    if (sessionStorage.getItem(CHAVE_ABERTO) === "1") abrir();
  } catch { /* sem sessionStorage: pede o PIN sempre */ }

  document.getElementById("form-pin").addEventListener("submit", (e) => {
    e.preventDefault();
    if (campo.value === ler(CHAVE_PIN, PIN_PADRAO)) {
      campo.value = "";
      abrir();
    } else {
      campo.value = "";
      trava.classList.remove("is-erro");
      void trava.offsetWidth; // reinicia a animacao de erro
      trava.classList.add("is-erro");
    }
  });
}

/* ============================ ligacao com o DOM ============================ */

document.addEventListener("DOMContentLoaded", () => {
  leads = ler(CHAVE_LEADS, []);
  ligarTrava();

  const dlgLead = document.getElementById("dlg-lead");
  const dlgAcoes = document.getElementById("dlg-acoes");
  const dlgMenu = document.getElementById("dlg-menu");

  document.getElementById("busca").addEventListener("input", (e) => {
    busca = e.target.value;
    renderizar();
  });

  document.getElementById("filtros").addEventListener("click", (e) => {
    const botao = e.target.closest("[data-filtro]");
    if (!botao) return;
    filtroAtivo = botao.dataset.filtro;
    renderizar();
  });

  document.getElementById("leads").addEventListener("click", (e) => {
    if (e.target.closest("#exemplos")) return carregarExemplos();

    const enviar = e.target.closest("[data-enviar]");
    if (enviar) {
      // Sem preventDefault: o link precisa mesmo abrir o WhatsApp. So
      // carimbamos o envio junto, como o "Enviei essa mensagem" do desktop.
      //
      // O setTimeout nao e enfeite: marcarEnviado() reescreve a lista inteira,
      // e arrancar o proprio <a> do DOM dentro do handler faz alguns
      // navegadores engolirem a navegacao. Deixa o clique sair primeiro.
      const id = enviar.dataset.enviar;
      setTimeout(() => marcarEnviado(id), 0);
      return;
    }

    const copiarBtn = e.target.closest("[data-copiar]");
    if (copiarBtn) return copiarMensagem(copiarBtn.dataset.copiar);

    const acoes = e.target.closest("[data-acoes]");
    if (acoes) {
      leadAberto = acoes.dataset.acoes;
      const lead = porId(leadAberto);
      document.getElementById("acoes-nome").textContent = lead ? lead.empresa : "";
      dlgAcoes.showModal();
    }
  });

  dlgAcoes.addEventListener("click", (e) => {
    const botao = e.target.closest("[data-status]");
    if (!botao || !leadAberto) return;
    const novo = botao.dataset.status;
    atualizar(leadAberto, { status: novo });
    dlgAcoes.close();
    aviso(`Marcado como "${ROTULO_STATUS[novo]}".`);
  });

  document.getElementById("novo").addEventListener("click", () => dlgLead.showModal());
  document.getElementById("menu").addEventListener("click", () => dlgMenu.showModal());
  document.querySelectorAll("[data-fechar]").forEach((b) =>
    b.addEventListener("click", () => b.closest("dialog").close())
  );

  document.getElementById("form-lead").addEventListener("submit", (e) => {
    const d = new FormData(e.target);
    const telefone = String(d.get("telefone"));
    const { e164, whatsapp } = normalizarTelefone(telefone);
    if (!whatsapp) aviso("Número salvo, mas não parece um WhatsApp válido.");
    leads = [
      {
        id: novoId(),
        empresa: String(d.get("empresa")).trim(),
        contato: String(d.get("contato")).trim(),
        telefone: e164 || telefone.trim(),
        site: String(d.get("site")).trim(),
        nicho: String(d.get("nicho")).trim(),
        notas: String(d.get("notas")).trim(),
        status: "novo",
        estagio: 0,
        ultimoContato: null,
        primeiroContato: null,
      },
      ...leads,
    ];
    salvarLeads();
    e.target.reset();
    renderizar();
    aviso("Lead cadastrado.");
  });

  /* ---------- tabela de preços ---------- */
  document.getElementById("tabela").addEventListener("click", async () => {
    aviso((await copiar(TABELA_URL)) ? "Link da tabela copiado." : "Não consegui copiar.");
  });

  /* ---------- exportar / importar ---------- */
  document.getElementById("exp-json").addEventListener("click", () => {
    baixar(`prospector-leads-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(leads, null, 2), "application/json");
  });

  document.getElementById("exp-csv").addEventListener("click", () => {
    // BOM na frente: sem ele o Excel abre os acentos errados.
    baixar(`prospector-leads-${new Date().toISOString().slice(0, 10)}.csv`,
      "﻿" + paraCSV(leads), "text/csv;charset=utf-8");
  });

  document.getElementById("arquivo").addEventListener("change", async (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    try {
      const texto = await arquivo.text();
      const brutos = arquivo.name.toLowerCase().endsWith(".json")
        ? JSON.parse(texto)
        : lerCSV(texto);
      const importados = brutos
        .map((b, i) => normalizarImportado(b, `${novoId()}${i}`))
        .filter((l) => l.empresa || l.telefone);
      const antes = leads.length;
      leads = mesclar(leads, importados);
      salvarLeads();
      renderizar();
      aviso(`${leads.length - antes} novos leads (${importados.length} no arquivo).`);
    } catch {
      aviso("Arquivo não reconhecido — use o CSV ou o JSON exportado daqui.");
    }
    e.target.value = "";
    dlgMenu.close();
  });

  document.getElementById("trocar-pin").addEventListener("click", () => {
    const atual = ler(CHAVE_PIN, PIN_PADRAO);
    const novo = prompt(`PIN atual: ${atual}\nNovo PIN (4+ dígitos):`, "");
    if (novo === null) return;
    if (!/^\d{4,}$/.test(novo)) return aviso("O PIN precisa ter ao menos 4 dígitos.");
    gravar(CHAVE_PIN, novo);
    aviso("PIN alterado.");
  });

  document.getElementById("exemplos-menu").addEventListener("click", () => {
    carregarExemplos();
    dlgMenu.close();
  });

  renderizar();

  // Service worker: deixa o painel abrir offline depois da 1a visita.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/app/sw.js").catch(() => {
      /* http sem TLS ou navegador sem suporte: o app funciona igual, so nao offline */
    });
  }
});
