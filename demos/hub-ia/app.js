/*
 * Demo: Hub de Atendimento & Assistente de IA (/demos/hub-ia).
 *
 * O "assistente" aqui e casamento de palavra-chave contra uma base fixa —
 * nao ha chamada de API nenhuma. E o suficiente para o visitante entender a
 * ideia (resposta instantanea, citando o documento que respondeu) sem chave
 * de API exposta no front nem custo por mensagem de curioso.
 *
 * Depende de /js/script.js e /demos/demos.js (esc, demoCarregar,
 * demoSalvar), nessa ordem no HTML.
 */

const CHAVE_HUB = "demo-hub-ia";

/* Documentos que a IA "leu". `id` liga a resposta ao topico que a originou —
   e o que acende o item na coluna da direita. */
const TOPICOS = [
  { id: "catalogo", nome: "Catálogo de serviços", meta: "24 páginas · sincronizado hoje" },
  { id: "precos", nome: "Tabela de Preços 2026.2", meta: "14 itens · atualizada em 02/08" },
  { id: "agenda", nome: "Regras de Agendamento", meta: "8 regras · SLA de 3 min" },
  { id: "atendimento", nome: "Horários e canais", meta: "documento ativo" },
  { id: "faq", nome: "Perguntas frequentes", meta: "46 respostas aprovadas" },
  { id: "garantia", nome: "Garantia e suporte", meta: "6 páginas · revisão trimestral" },
];

/*
 * Ordem importa: quem pede humano tem que cair no gatilho antes de bater em
 * "valor" ou "sistema" e receber resposta automatica.
 */
const BASE = [
  {
    chaves: ["humano", "atendente", "pessoa real", "falar com voce", "falar com eduardo", "alguem de verdade"],
    texto:
      "Claro. Estou passando a conversa para o Eduardo agora — ele responde em até 3 minutos no horário comercial. Seu histórico vai junto, você não precisa repetir nada.",
    fonte: "agenda",
    humano: true,
  },
  {
    chaves: ["preco", "valor", "quanto custa", "quanto fica", "orcamento", "tabela", "investimento"],
    texto:
      "Depende do escopo. Landing page fica em R$ 620, site institucional completo em R$ 1.590 e painel de gestão a partir de R$ 3.490. Automação com IA como esta entra como módulo, a partir de R$ 2.690. Preço fechado, sem mensalidade de plataforma.",
    fonte: "precos",
  },
  {
    chaves: ["prazo", "quanto tempo", "demora", "entrega", "cronograma", "pronto em"],
    texto:
      "Landing page sai em até 3 dias úteis, site institucional em 5 e painel de gestão em cerca de 15. Cada módulo extra soma ao prazo da base — na proposta você recebe a data fechada.",
    fonte: "catalogo",
  },
  {
    chaves: ["horario", "sabado", "domingo", "fim de semana", "aberto", "funciona que horas", "atende quando"],
    texto:
      "O atendimento humano é de segunda a sexta, das 9h às 18h. Eu respondo 24/7 — inclusive sábado e domingo — e deixo o resumo pronto para o Eduardo assim que ele abrir o dia.",
    fonte: "atendimento",
  },
  {
    chaves: ["agendar", "agenda", "marcar", "reuniao", "conversa", "call", "visita", "horario livre"],
    texto:
      "Consigo agendar agora. Tenho janelas na terça às 10h, na quarta às 15h e na quinta às 9h. Me diz qual serve que eu confirmo e já mando o lembrete no WhatsApp.",
    fonte: "agenda",
  },
  {
    chaves: ["sistema", "painel", "gestao", "erp", "crm", "ordem de servico", "os", "dashboard", "relatorio"],
    texto:
      "Fazemos sim. Sistema de gestão sob medida com ordens de serviço, cadastro de clientes, permissão por equipe e relatórios — tudo em código próprio, sem depender de plataforma que cobra por usuário. Quer ver um painel real funcionando?",
    fonte: "catalogo",
  },
  {
    chaves: ["site", "landing", "pagina", "loja", "catalogo", "institucional"],
    texto:
      "Sites e landing pages sob medida, mobile-first e com SEO feito desde o início. Nada de tema pronto: o layout nasce do seu negócio. Posso te mostrar três exemplos publicados.",
    fonte: "catalogo",
  },
  {
    chaves: ["ia", "inteligencia", "automacao", "robo", "bot", "chatbot", "whatsapp automatico", "assistente"],
    texto:
      "É exatamente o que você está usando agora. Treino o assistente nos seus documentos — catálogo, tabela de preços, regras internas — e ele responde citando a fonte. O que fugir da base vai para um humano com o histórico junto.",
    fonte: "faq",
  },
  {
    chaves: ["pagamento", "parcela", "parcelar", "pix", "cartao", "boleto", "como pago"],
    texto:
      "Pix, cartão ou boleto, normalmente em 50% na aprovação e 50% na entrega. Projetos maiores podem ser divididos por etapa entregue.",
    fonte: "precos",
  },
  {
    chaves: ["garantia", "suporte", "manutencao", "bug", "erro", "depois da entrega", "treinamento"],
    texto:
      "Todo projeto sai com treinamento da equipe e 30 dias de ajuste incluso. Depois disso existe plano de manutenção mensal, opcional — o código é seu de qualquer forma.",
    fonte: "garantia",
  },
];

const FALLBACK = {
  texto:
    "Isso não está nos documentos que eu li, e prefiro não inventar. Vou chamar o Eduardo para te responder com precisão — ele assume a conversa daqui.",
  humano: true,
};

const SUGESTOES = [
  "Quanto custa um painel de gestão?",
  "Qual o prazo de entrega?",
  "Vocês atendem no sábado?",
  "Quero agendar uma conversa",
];

const CONVERSA_SEMENTE = [
  { de: "cliente", texto: "Bom dia! Vocês fazem sistema de gestão para oficina mecânica?", hora: "09:12" },
  { de: "ia", texto: BASE[5].texto, fonte: "catalogo", hora: "09:12" },
  { de: "cliente", texto: "Interessante. Qual o prazo de entrega?", hora: "09:13" },
  { de: "ia", texto: BASE[2].texto, fonte: "catalogo", hora: "09:13" },
  { de: "cliente", texto: "E quanto fica mais ou menos?", hora: "09:14" },
  { de: "ia", texto: BASE[1].texto, fonte: "precos", hora: "09:14" },
  { de: "cliente", texto: "Vocês atendem no sábado?", hora: "09:15" },
  { de: "ia", texto: BASE[3].texto, fonte: "atendimento", hora: "09:15" },
];

/* ------------------------------ regras ------------------------------ */

/* Tira acento e caixa: assim a base guarda so "precos" e ainda casa com
   "preços", "PREÇOS" e "Preço". */
function normalizar(texto) {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function responder(pergunta) {
  const alvo = normalizar(pergunta);
  const achou = BASE.find((item) =>
    item.chaves.some((chave) => alvo.includes(normalizar(chave)))
  );
  return achou
    ? { texto: achou.texto, fonte: achou.fonte, humano: Boolean(achou.humano) }
    : { texto: FALLBACK.texto, fonte: null, humano: true };
}

/* Estado da conversa e derivado das mensagens — nada de flag paralela que
   pode divergir do historico. */
function resumirConversa(mensagens) {
  return {
    perguntas: mensagens.filter((m) => m.de === "cliente").length,
    respostas: mensagens.filter((m) => m.de === "ia").length,
    humano: mensagens.some((m) => m.de === "sistema"),
  };
}

function nomeTopico(id) {
  const t = TOPICOS.find((x) => x.id === id);
  return t ? t.nome : "";
}

/* ------------------------------ tela ------------------------------ */

let conversa = demoCarregar(CHAVE_HUB, CONVERSA_SEMENTE);
let respondendo = false;

function agora() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* Fonte do topico da ultima resposta da IA — e o item que acende na direita. */
function fonteAtiva() {
  const ultima = [...conversa].reverse().find((m) => m.de === "ia" && m.fonte);
  return ultima ? ultima.fonte : null;
}

function montarMensagem(m) {
  const fonte = m.fonte
    ? `<span class="msg__fonte">fonte: ${esc(nomeTopico(m.fonte))}</span>`
    : "";
  return `
    <div class="msg msg--${esc(m.de)}">
      <div class="msg__balao">
        <p class="msg__texto">${esc(m.texto)}</p>
        ${fonte}
      </div>
      <span class="msg__hora">${esc(m.hora)}</span>
    </div>`;
}

function montarTopicos() {
  const ativa = fonteAtiva();
  document.getElementById("topicos").innerHTML = TOPICOS.map(
    (t) => `
      <li class="topico${t.id === ativa ? " is-ativo" : ""}">
        <span class="topico__nome">${t.nome}</span>
        <span class="topico__meta">${t.meta}</span>
      </li>`
  ).join("");
}

function renderizar({ digitando = false } = {}) {
  const log = document.getElementById("log");
  log.innerHTML =
    conversa.map(montarMensagem).join("") +
    (digitando
      ? `<div class="msg msg--ia"><div class="msg__balao">
           <span class="digitando" aria-label="assistente digitando">
             <span></span><span></span><span></span>
           </span>
         </div></div>`
      : "");
  log.scrollTop = log.scrollHeight;

  const r = resumirConversa(conversa);
  document.getElementById("sessao").textContent =
    `${r.perguntas} perguntas nesta conversa · ${r.respostas} resolvidas pela IA`;

  const situacao = document.getElementById("situacao");
  situacao.textContent = r.humano ? "Aguardando atendente" : "Online · resposta automática";
  situacao.className = `status status--${r.humano ? "pendente" : "concluido"}`;

  montarTopicos();
}

function registrar(mensagem) {
  conversa = [...conversa, mensagem];
  demoSalvar(CHAVE_HUB, conversa);
}

/*
 * A pausa antes da resposta e proposital: resposta instantanea demais nao
 * parece conversa, parece busca. 600ms com os tres pontinhos vende melhor a
 * ideia — e o "1.2s de tempo medio" do painel ao lado fica coerente.
 */
function perguntar(texto) {
  const limpo = String(texto).trim().slice(0, 300);
  if (!limpo || respondendo) return;

  respondendo = true;
  registrar({ de: "cliente", texto: limpo, hora: agora() });
  renderizar({ digitando: true });

  setTimeout(() => {
    const r = responder(limpo);
    registrar({ de: "ia", texto: r.texto, fonte: r.fonte, hora: agora() });
    if (r.humano) {
      registrar({
        de: "sistema",
        texto: "⚡ Gatilho disparado — conversa transferida para Eduardo Grunitzky com o histórico completo.",
        hora: agora(),
      });
    }
    respondendo = false;
    renderizar();
  }, 600);
}

function chamarHumano() {
  if (respondendo) return;
  registrar({
    de: "sistema",
    texto: "⚡ Gatilho de atendimento humano acionado — conversa na fila do Eduardo. Entrada média: 3 min.",
    hora: agora(),
  });
  renderizar();
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-chat");
  const campo = document.getElementById("pergunta");

  document.getElementById("sugestoes").innerHTML = SUGESTOES.map(
    (s) => `<button type="button" class="filtro" data-sugestao="${s}">${s}</button>`
  ).join("");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    perguntar(campo.value);
    campo.value = "";
  });

  document.getElementById("sugestoes").addEventListener("click", (e) => {
    const botao = e.target.closest("[data-sugestao]");
    if (botao) perguntar(botao.dataset.sugestao);
  });

  document.getElementById("humano").addEventListener("click", chamarHumano);

  renderizar();
});
