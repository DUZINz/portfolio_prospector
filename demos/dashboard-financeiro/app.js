/*
 * Demo: Dashboard Financeiro (/demos/dashboard-financeiro).
 *
 * Graficos em SVG montado na mao — sem biblioteca de chart, sem CDN: a
 * pagina abre instantaneo e funciona offline. Coordenadas em viewBox, entao
 * o desenho escala sozinho do celular ao monitor grande.
 *
 * Depende de /js/script.js (MOEDA) e /demos/demos.js, nessa ordem no HTML.
 */

/* 12 meses fechados. `vendas` = contratos faturados no mes (base do ticket). */
const MESES = [
  { mes: "set/25", receita: 38200, despesa: 26400, vendas: 74 },
  { mes: "out/25", receita: 41800, despesa: 27900, vendas: 81 },
  { mes: "nov/25", receita: 47500, despesa: 30100, vendas: 92 },
  { mes: "dez/25", receita: 58900, despesa: 34600, vendas: 118 },
  { mes: "jan/26", receita: 39400, despesa: 28800, vendas: 78 },
  { mes: "fev/26", receita: 43100, despesa: 29500, vendas: 85 },
  { mes: "mar/26", receita: 51200, despesa: 32400, vendas: 97 },
  { mes: "abr/26", receita: 49800, despesa: 33100, vendas: 94 },
  { mes: "mai/26", receita: 56300, despesa: 35200, vendas: 105 },
  { mes: "jun/26", receita: 61700, despesa: 37800, vendas: 113 },
  { mes: "jul/26", receita: 58400, despesa: 36900, vendas: 108 },
  { mes: "ago/26", receita: 72500, despesa: 41300, vendas: 129 },
];

/* Receita por linha de servico nos 12 meses — soma igual ao total do periodo
   cheio. Em recorte menor a barra e reescalada na mesma proporcao. */
const CATEGORIAS = [
  { nome: "Sistemas de gestão", valor: 214600 },
  { nome: "Sites & landing pages", valor: 128400 },
  { nome: "Automações & IA", valor: 96300 },
  { nome: "Manutenção mensal", valor: 74800 },
  { nome: "Integrações / APIs", valor: 58900 },
  { nome: "Consultoria", valor: 45800 },
];

/* ------------------------------ regras ------------------------------ */

function somar(meses, campo) {
  return meses.reduce((soma, m) => soma + m[campo], 0);
}

/* Variacao do ultimo mes contra o anterior, em % — o numero que o dono do
   negocio olha primeiro. Periodo com um mes so nao tem comparacao. */
function variacaoMensal(meses) {
  if (meses.length < 2) return 0;
  const [penultimo, ultimo] = meses.slice(-2);
  return Math.round(((ultimo.receita - penultimo.receita) / penultimo.receita) * 100);
}

function resumirPeriodo(meses) {
  const receita = somar(meses, "receita");
  const despesa = somar(meses, "despesa");
  const vendas = somar(meses, "vendas");
  const lucro = receita - despesa;
  return {
    receita,
    despesa,
    vendas,
    lucro,
    margem: receita ? Math.round((lucro / receita) * 100) : 0,
    ticket: vendas ? Math.round(receita / vendas) : 0,
    variacao: variacaoMensal(meses),
  };
}

/* ------------------------------ desenho ------------------------------ */

const compacto = (v) => `${Math.round(v / 1000)} mil`;

/* Teto do eixo Y arredondado para a proxima dezena de milhar: as linhas de
   grade caem em numeros redondos em vez de 63.412. */
function tetoDoEixo(meses) {
  const pico = Math.max(...meses.map((m) => Math.max(m.receita, m.despesa)));
  return Math.max(10000, Math.ceil(pico / 10000) * 10000);
}

function montarGraficoLinha(meses) {
  const W = 720, H = 260, L = 54, R = 16, T = 16, B = 30;
  const iw = W - L - R;
  const ih = H - T - B;
  const teto = tetoDoEixo(meses);
  const x = (i) => (meses.length > 1 ? L + (iw * i) / (meses.length - 1) : L + iw / 2);
  const y = (v) => T + ih - (v / teto) * ih;

  const caminho = (campo) =>
    meses
      .map((m, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(m[campo]).toFixed(1)}`)
      .join(" ");

  const grades = [0, 1, 2, 3, 4]
    .map((k) => {
      const valor = (teto * k) / 4;
      const py = y(valor).toFixed(1);
      return `<line class="eixo" x1="${L}" y1="${py}" x2="${W - R}" y2="${py}" />
              <text class="eixo-rotulo" x="${L - 8}" y="${py}" text-anchor="end"
                    dominant-baseline="middle">${compacto(valor)}</text>`;
    })
    .join("");

  const rotulos = meses
    .map(
      (m, i) =>
        `<text class="eixo-rotulo" x="${x(i).toFixed(1)}" y="${H - 10}"
               text-anchor="middle">${m.mes}</text>`
    )
    .join("");

  const pontos = (campo, serie) =>
    meses
      .map(
        (m, i) =>
          `<circle class="serie-ponto serie-ponto--${serie}" r="3.2"
                   cx="${x(i).toFixed(1)}" cy="${y(m[campo]).toFixed(1)}" />`
      )
      .join("");

  // Faixa invisivel por mes: alvo generoso para o mouse, some no toque.
  const passo = meses.length > 1 ? iw / (meses.length - 1) : iw;
  const faixas = meses
    .map(
      (m, i) =>
        `<rect class="faixa" data-mes="${i}"
               data-x="${x(i).toFixed(1)}" data-y="${y(m.receita).toFixed(1)}"
               x="${(x(i) - passo / 2).toFixed(1)}" y="${T}"
               width="${passo.toFixed(1)}" height="${ih}" />`
    )
    .join("");

  return `
    <svg viewBox="0 0 ${W} ${H}" role="img"
         aria-label="Receita e despesa mês a mês no período selecionado">
      ${grades}
      <path class="serie-area" d="${caminho("receita")} L${x(meses.length - 1).toFixed(1)} ${(T + ih).toFixed(1)} L${x(0).toFixed(1)} ${(T + ih).toFixed(1)} Z" />
      <path class="serie-linha serie-linha--despesa" d="${caminho("despesa")}" />
      <path class="serie-linha serie-linha--receita" d="${caminho("receita")}" />
      ${pontos("despesa", "despesa")}
      ${pontos("receita", "receita")}
      ${rotulos}
      ${faixas}
    </svg>`;
}

function montarGraficoBarras(meses) {
  const total12 = somar(MESES, "receita");
  const fator = somar(meses, "receita") / total12;
  const linhas = CATEGORIAS.map((c) => ({
    nome: c.nome,
    valor: Math.round(c.valor * fator),
  }));

  const W = 380;
  const passo = 44;
  const maior = Math.max(...linhas.map((l) => l.valor));

  const barras = linhas
    .map((l, i) => {
      const y = i * passo;
      const largura = Math.max(2, (l.valor / maior) * W);
      return `
        <text class="barra-rotulo" x="0" y="${y + 11}">${l.nome}</text>
        <text class="barra-valor" x="${W}" y="${y + 11}" text-anchor="end">${MOEDA.format(l.valor)}</text>
        <rect class="barra-trilho" x="0" y="${y + 20}" width="${W}" height="9" rx="2" />
        <rect class="barra-cat" x="0" y="${y + 20}" width="${largura.toFixed(1)}" height="9" rx="2">
          <title>${l.nome}: ${MOEDA.format(l.valor)}</title>
        </rect>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${W} ${linhas.length * passo}" role="img"
         aria-label="Receita por linha de serviço no período selecionado">
      ${barras}
    </svg>`;
}

/* ------------------------------ tela ------------------------------ */

let periodo = 12;

function montarMetricas(r) {
  const sobe = r.variacao >= 0;
  document.getElementById("metricas").innerHTML = `
    <div class="metrica">
      <p class="metrica__rotulo">Faturamento</p>
      <p class="metrica__valor">${MOEDA.format(r.receita)}</p>
      <p class="metrica__nota metrica__nota--${sobe ? "sobe" : "desce"}">
        ${sobe ? "▲" : "▼"} ${Math.abs(r.variacao)}% no último mês
      </p>
    </div>
    <div class="metrica">
      <p class="metrica__rotulo">Ticket médio</p>
      <p class="metrica__valor">${MOEDA.format(r.ticket)}</p>
      <p class="metrica__nota">${r.vendas} contratos faturados</p>
    </div>
    <div class="metrica">
      <p class="metrica__rotulo">Despesas</p>
      <p class="metrica__valor">${MOEDA.format(r.despesa)}</p>
      <p class="metrica__nota">${Math.round((r.despesa / r.receita) * 100)}% da receita</p>
    </div>
    <div class="metrica">
      <p class="metrica__rotulo">Lucro do período</p>
      <p class="metrica__valor">${MOEDA.format(r.lucro)}</p>
      <p class="metrica__nota metrica__nota--sobe">margem de ${r.margem}%</p>
    </div>`;
}

function renderizar() {
  const meses = MESES.slice(-periodo);
  const r = resumirPeriodo(meses);

  montarMetricas(r);
  document.getElementById("linha").innerHTML =
    montarGraficoLinha(meses) + '<div class="tooltip" id="tooltip"></div>';
  document.getElementById("barras").innerHTML = montarGraficoBarras(meses);
  document.getElementById("nota-barras").textContent =
    `Receita distribuída nos últimos ${periodo} meses.`;

  document.querySelectorAll("[data-periodo]").forEach((b) => {
    const ativo = Number(b.dataset.periodo) === periodo;
    b.classList.toggle("is-ativo", ativo);
    b.setAttribute("aria-pressed", String(ativo));
  });
}

/*
 * Tooltip posicionado em % do viewBox: o SVG escala com a tela, mas a
 * proporcao das coordenadas nao muda — entao nao precisa medir pixel.
 */
function ligarTooltip() {
  const caixa = document.getElementById("linha");

  caixa.addEventListener("mouseover", (e) => {
    const faixa = e.target.closest(".faixa");
    if (!faixa) return;
    const m = MESES.slice(-periodo)[Number(faixa.dataset.mes)];
    const dica = document.getElementById("tooltip");
    dica.innerHTML = `
      <p class="tooltip__mes">${m.mes}</p>
      <p class="tooltip__linha">Receita <b style="color:var(--accent)">${MOEDA.format(m.receita)}</b></p>
      <p class="tooltip__linha">Despesa <b style="color:var(--pendente)">${MOEDA.format(m.despesa)}</b></p>
      <p class="tooltip__linha">Lucro <b>${MOEDA.format(m.receita - m.despesa)}</b></p>`;
    dica.style.left = `${(Number(faixa.dataset.x) / 720) * 100}%`;
    dica.style.top = `${(Number(faixa.dataset.y) / 260) * 100}%`;
    dica.classList.add("is-visivel");
  });

  caixa.addEventListener("mouseleave", () => {
    document.getElementById("tooltip").classList.remove("is-visivel");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("periodos").addEventListener("click", (e) => {
    const botao = e.target.closest("[data-periodo]");
    if (!botao) return;
    periodo = Number(botao.dataset.periodo);
    renderizar();
  });

  renderizar();
  ligarTooltip();
});
