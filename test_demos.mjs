/*
 * Checagem das regras das demos interativas (/demos/*).
 *
 * Rodar:  node test_demos.mjs
 *
 * Os arquivos sao scripts de navegador (sem export), entao cada demo e
 * avaliada num contexto vm na MESMA ordem em que o HTML carrega
 * (script.js -> demos.js -> app.js), com um `document` de mentira — so o
 * suficiente para os addEventListener do fim de cada arquivo nao explodirem.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function carregar(appPath, nomes) {
  const fonte = ["js/script.js", "demos/demos.js", appPath]
    .map((a) => readFileSync(a, "utf8"))
    .concat(`({ ${nomes.join(", ")} })`)
    .join("\n");
  return vm.runInNewContext(fonte, {
    document: { addEventListener() {}, body: { dataset: {} } },
  });
}

/* ============================ painel de OS ============================ */

const painel = carregar("demos/painel-gestao/app.js", [
  "OS_SEMENTE", "STATUS", "filtrarOS", "resumirOS", "proximoId",
  "dataCurta", "estaAtrasada",
]);

const os = painel.OS_SEMENTE;
assert.equal(os.length, 14);
assert.equal(painel.STATUS.length, 3);
// Toda OF da semente usa um status conhecido — senao o badge sai sem cor.
const chaves = painel.STATUS.map((s) => s.chave);
os.forEach((o) => assert.ok(chaves.includes(o.status), o.id));

// Filtro por status.
assert.equal(painel.filtrarOS(os, "", "todos").length, 14);
assert.equal(painel.filtrarOS(os, "", "concluido").length, 5);
assert.equal(painel.filtrarOS(os, "", "andamento").length, 4);
assert.equal(painel.filtrarOS(os, "", "pendente").length, 5);

// Busca livre: numero da OS, cliente, servico e tecnico — e so isso.
assert.equal(painel.filtrarOS(os, "carla", "todos").length, 5);
assert.equal(painel.filtrarOS(os, "CARLA", "todos").length, 5, "busca ignora caixa");
assert.equal(painel.filtrarOS(os, "OS-2418", "todos").length, 1);
assert.equal(painel.filtrarOS(os, "câmeras", "todos").length, 1);
assert.equal(painel.filtrarOS(os, "Portão", "todos").length, 0, "bairro nao entra na busca");
// Os dois filtros se acumulam (nao e "ou").
assert.equal(painel.filtrarOS(os, "carla", "concluido").length, 2);
assert.equal(painel.filtrarOS(os, "   ", "todos").length, 14, "espaco em branco nao filtra");

// Faturamento conta so o que foi concluido.
const r = painel.resumirOS(os);
assert.equal(r.concluidas, 5);
assert.equal(r.abertas, 9);
assert.equal(r.faturamento, 5680);
assert.equal(r.ticket, 1136);
// join() e nao deepEqual: objeto vindo do vm tem outro prototype e o
// deepStrictEqual reprova por isso mesmo com os valores iguais.
assert.equal(Object.values(painel.resumirOS([])).join(), "0,0,0,0,0,0", "lista vazia nao divide por zero");

assert.equal(painel.proximoId(os), "OS-2432");
assert.equal(painel.proximoId([]), "OS-1");

assert.equal(painel.dataCurta("2026-08-05"), "05/08");
assert.equal(painel.dataCurta(""), "—");
assert.ok(painel.estaAtrasada({ status: "pendente", prazo: "2026-08-21" }, "2026-08-23"));
assert.ok(!painel.estaAtrasada({ status: "pendente", prazo: "2026-08-25" }, "2026-08-23"));
assert.ok(!painel.estaAtrasada({ status: "concluido", prazo: "2026-08-01" }, "2026-08-23"));

/* ============================ crm kanban ============================ */

const crm = carregar("demos/crm-vendas/app.js", [
  "LEADS_SEMENTE", "ETAPAS", "moverLead", "etapaVizinha", "resumirPipeline", "porEtapa",
]);

const leads = crm.LEADS_SEMENTE;
assert.equal(crm.ETAPAS.length, 4);
assert.equal(leads.length, 12);
crm.ETAPAS.forEach((e) => assert.ok(crm.porEtapa(leads, e.chave).length, e.chave));

const p = crm.resumirPipeline(leads);
assert.equal(p.aberto, 120000);
assert.equal(p.fechado, 27900);
assert.equal(p.fechados, 3);
assert.equal(p.conversao, 25);
assert.equal(p.ticket, 9300);
assert.equal(p.parados, 3, "abertos parados ha mais de 7 dias");

// Mover avanca a etapa, zera os dias e nao mexe na lista original.
const movido = crm.moverLead(leads, 1, "proposta");
assert.equal(movido.find((l) => l.id === 1).etapa, "proposta");
assert.equal(movido.find((l) => l.id === 1).dias, 0);
assert.equal(leads.find((l) => l.id === 1).etapa, "novo", "lista original intacta");
// Destino invalido, id inexistente ou mesma coluna: nada acontece.
assert.equal(crm.moverLead(leads, 1, "arquivado"), leads);
assert.equal(crm.moverLead(leads, 999, "proposta"), leads);
assert.equal(crm.moverLead(leads, 1, "novo"), leads);

assert.equal(crm.etapaVizinha("novo", -1), null, "primeira coluna nao volta");
assert.equal(crm.etapaVizinha("fechado", 1), null, "ultima coluna nao avanca");
assert.equal(crm.etapaVizinha("proposta", 1), "negociacao");
assert.equal(crm.etapaVizinha("proposta", -1), "novo");

/* ========================= dashboard financeiro ========================= */

const dash = carregar("demos/dashboard-financeiro/app.js", [
  "MESES", "CATEGORIAS", "resumirPeriodo", "tetoDoEixo", "somar",
  "montarGraficoLinha", "montarGraficoBarras",
]);

assert.equal(dash.MESES.length, 12);

const ano = dash.resumirPeriodo(dash.MESES);
assert.equal(ano.receita, 618800);
assert.equal(ano.despesa, 394000);
assert.equal(ano.lucro, 224800);
assert.equal(ano.margem, 36);
assert.equal(ano.ticket, 527);
assert.equal(ano.variacao, 24, "ago/26 contra jul/26");

// O grafico de barras so fecha com o card de faturamento se as categorias
// somarem o mesmo que os 12 meses.
assert.equal(dash.somar(dash.CATEGORIAS, "valor"), ano.receita);

const semestre = dash.resumirPeriodo(dash.MESES.slice(-6));
assert.equal(semestre.receita, 349900);
assert.ok(semestre.receita < ano.receita, "recorte menor fatura menos");
assert.equal(dash.resumirPeriodo([dash.MESES[0]]).variacao, 0, "um mes nao tem comparacao");

// Eixo sobe para a proxima dezena de milhar acima do pico (72.500 -> 80 mil).
assert.equal(dash.tetoDoEixo(dash.MESES), 80000);
assert.equal(dash.tetoDoEixo([{ receita: 100, despesa: 50 }]), 10000, "piso do eixo");

// Um ponto por serie por mes e uma faixa de hover por mes.
const svg = dash.montarGraficoLinha(dash.MESES);
assert.equal(svg.match(/class="faixa"/g).length, 12);
assert.equal(svg.match(/<circle/g).length, 24);
assert.ok(!/NaN|undefined/.test(svg), "coordenada invalida no SVG");
assert.equal(dash.montarGraficoLinha(dash.MESES.slice(-6)).match(/class="faixa"/g).length, 6);

const barras = dash.montarGraficoBarras(dash.MESES);
assert.equal(barras.match(/class="barra-cat"/g).length, dash.CATEGORIAS.length);
assert.ok(!/NaN|undefined/.test(barras), "coordenada invalida no SVG");

console.log("demos ok");
