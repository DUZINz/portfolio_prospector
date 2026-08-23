/*
 * Camada comum das demos (/demos/*).
 *
 * Depende de /js/script.js, que precisa vir ANTES no HTML: de la saem o
 * `montarLinkWhatsapp` (numero de contato em um lugar so) e o formatador
 * `MOEDA`. Nao redeclare esses nomes aqui — dois `const` iguais no escopo
 * global de scripts classicos e SyntaxError e derruba a pagina inteira.
 *
 * Cada pagina de demo so precisa declarar no <body>:
 *   data-demo-nome="Painel de Gestão de OS"
 */

/* Texto vindo do formulario vai para innerHTML: escapa antes de concatenar. */
function esc(texto) {
  return String(texto).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
  );
}

/*
 * Estado das demos mora no localStorage para o visitante ver o que cadastrou
 * ao voltar. Em aba anonima o acesso pode lancar — nesse caso a demo roda em
 * memoria mesmo, sem quebrar.
 */
function demoCarregar(chave, padrao) {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? JSON.parse(bruto) : padrao;
  } catch {
    return padrao;
  }
}

function demoSalvar(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sem persistencia disponivel: segue so em memoria */
  }
}

function montarTopbar() {
  const nome = document.body.dataset.demoNome;
  if (!nome) return;

  const zap = montarLinkWhatsapp(
    `Olá, Eduardo! Testei a demonstração "${nome}" no seu portfólio e quero um sistema como esse para o meu negócio.`
  );

  const barra = document.createElement("div");
  barra.className = "demo-topbar";
  barra.innerHTML = `
    <div class="demo-topbar__inner">
      <a href="/" class="btn btn--fantasma btn--small">← Voltar ao Portfólio</a>
      <span class="demo-topbar__badge">⚡ Demonstração Interativa · Desenvolvido por Eduardo Grunitzky</span>
      <a class="btn btn--zap btn--small demo-topbar__zap" href="${zap}" target="_blank" rel="noopener">
        Solicitar Projeto Como Este
      </a>
    </div>`;
  document.body.prepend(barra);
}

/* Botao "restaurar dados": limpa a chave da demo e recarrega do zero. */
function ativarReset() {
  document.querySelectorAll("[data-demo-reset]").forEach((botao) => {
    botao.addEventListener("click", () => {
      try {
        localStorage.removeItem(botao.dataset.demoReset);
      } catch {
        /* nada a limpar */
      }
      location.reload();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  montarTopbar();
  ativarReset();
});
