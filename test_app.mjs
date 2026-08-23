/*
 * Checagem das regras do painel de bolso (/app).
 *
 * Rodar:  node test_app.mjs
 *
 * app/app.js e script de navegador (sem export), entao roda num contexto vm
 * com um `document` de mentira — so o suficiente para o addEventListener do
 * fim do arquivo nao explodir.
 *
 * O foco aqui e o que da prejuizo se quebrar: numero de WhatsApp errado,
 * cadencia disparando cedo (ou nunca), e CSV embaralhando coluna.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const NOMES = [
  "normalizarTelefone", "formatarTelefone", "preencher", "situacao",
  "registrarEnvio", "statusDoLead", "filtrar", "contarPorFiltro",
  "csvEscapar", "paraCSV", "lerCSV", "normalizarImportado", "mesclar",
  "chaveLead", "haQuanto", "dominio",
  "PITCH_GERAL", "ABORDAGEM_FOLLOWUP1", "ABORDAGEM_FOLLOWUP2",
  "HORAS_ATE_FOLLOWUP1", "HORAS_ATE_FOLLOWUP2", "FILTROS", "ROTULO_STATUS",
];

const app = vm.runInNewContext(
  readFileSync("app/app.js", "utf8") + `\n({ ${NOMES.join(", ")} })`,
  { document: { addEventListener() {} }, navigator: {}, localStorage: undefined }
);

/* ============================ telefone ============================ */
/* Porte de normalizar_telefone() do Python: os mesmos casos que o docstring
   de prospector/models.py promete aguentar. */

const tel = app.normalizarTelefone;

assert.equal(tel("(41) 99894-1500").e164, "+5541998941500");
assert.equal(tel("(41) 99894-1500").whatsapp, "https://wa.me/5541998941500");
assert.equal(tel("5541998941500").e164, "+5541998941500", "com DDI");
assert.equal(tel("+55 41 99894-1500").e164, "+5541998941500");

// Fixo existe como telefone, mas nao no WhatsApp.
assert.equal(tel("+55 41 3333-2222").e164, "+554133332222");
assert.equal(tel("+55 41 3333-2222").whatsapp, "", "fixo nao vai pro WhatsApp");
assert.equal(tel("0 41 3262-7373").e164, "+554132627373", "prefixo nacional descartado");

// Numero de servico: guarda o numero, mas nunca gera link.
assert.equal(tel("0800 123 4567").whatsapp, "");
assert.equal(tel("0800 123 4567").e164, "08001234567");

// Lixo nao vira telefone.
assert.equal(tel("999").e164, "", "curto demais");
assert.equal(tel("").e164, "");
// DDD 20 nao existe; ja "(01)" seria lido como prefixo nacional 0 + DDD 19,
// que e o mesmo comportamento do lstrip("0") do Python.
assert.equal(tel("(20) 99999-8888").e164, "", "DDD 20 nao existe");
assert.equal(tel("(01) 99999-8888").e164, "+551999998888", "0 inicial e prefixo nacional");
assert.equal(tel("(41) 89894-1500").whatsapp, "", "celular tem que comecar com 9");

assert.equal(app.formatarTelefone("+5541998941500"), "(41) 99894-1500");
assert.equal(app.formatarTelefone("+554133332222"), "(41) 3333-2222");

/* ============================ mensagens ============================ */

const lead = { empresa: "Padaria Sol", contato: "Marcelo", site: "", telefone: "+5541998941500" };
const pitch = app.preencher(app.PITCH_GERAL, lead);

assert.ok(pitch.startsWith("Olá, Padaria Sol!"), pitch.slice(0, 40));
assert.ok(pitch.includes("da Padaria Sol"), "usa o nome no fecho");
assert.ok(pitch.includes("portfolio-murex-alpha-23.vercel.app"), "leva o portfólio");
assert.ok(pitch.includes("EG-Tabela-de-Precos-2026.2.pdf"), "leva o link da tabela");
// O wa.me nao anexa arquivo: a mensagem nao pode prometer anexo.
assert.ok(!/em anexo/i.test(pitch), "não promete anexo que o wa.me não manda");
// Variavel que sobra e o bug classico: "{link_site}" cru na mensagem do lead.
assert.ok(!/\{\w+\}/.test(pitch), "nenhuma variável sobrou sem preencher");

const semNome = app.preencher(app.PITCH_GERAL, {});
assert.ok(semNome.startsWith("Olá!"), "sem nome a saudação perde a vírgula");
assert.ok(semNome.includes("sua empresa"));
assert.ok(!/\{\w+\}/.test(semNome));

// O vocativo do follow-up cola depois de "Fala".
assert.ok(app.preencher(app.ABORDAGEM_FOLLOWUP1, lead).startsWith("Fala, Padaria Sol!"));
assert.ok(app.preencher(app.ABORDAGEM_FOLLOWUP1, {}).startsWith("Fala!"));

/* ============================ cadência ============================ */
/* Mesmos prazos de prospector/funil.py. Se divergirem, o painel do celular
   manda follow-up numa hora e o do computador em outra. */

assert.equal(app.HORAS_ATE_FOLLOWUP1, 48);
assert.equal(app.HORAS_ATE_FOLLOWUP2, 72);

const T0 = Date.parse("2026-08-20T10:00:00.000Z");
const horas = (n) => T0 + n * 3600000;
const emT0 = (extra) => ({
  empresa: "X", telefone: "+5541998941500", site: "", status: "novo",
  ultimoContato: new Date(T0).toISOString(), ...extra,
});

// Nunca contatado: abordagem inicial liberada na hora.
const novo = emT0({ estagio: 0, ultimoContato: null });
assert.equal(app.situacao(novo, horas(0)).etapa, "inicial");
assert.ok(app.situacao(novo, horas(0)).pronto);
assert.equal(app.situacao(novo, horas(0)).modelo, app.PITCH_GERAL);

// Contatado: segura ate 48h e nao um minuto antes.
const contatado = emT0({ estagio: 1 });
assert.ok(!app.situacao(contatado, horas(10)).pronto);
assert.equal(app.situacao(contatado, horas(10)).motivo, "aguardando 38h");
assert.ok(!app.situacao(contatado, horas(47.9)).pronto, "não libera antes da hora");
assert.ok(app.situacao(contatado, horas(48)).pronto, "libera exatamente em 48h");
assert.equal(app.situacao(contatado, horas(49)).modelo, app.ABORDAGEM_FOLLOWUP1);
assert.equal(app.situacao(contatado, horas(49)).etapa, "followup");

// 1o follow-up enviado: o 2o espera 72h, nao 48h.
const fup1 = emT0({ estagio: 2 });
assert.ok(!app.situacao(fup1, horas(50)).pronto);
assert.ok(app.situacao(fup1, horas(72)).pronto);
assert.equal(app.situacao(fup1, horas(73)).modelo, app.ABORDAGEM_FOLLOWUP2);

// Fim da sequência: não insiste mais, por mais tempo que passe.
const fim = emT0({ estagio: 3 });
assert.ok(!app.situacao(fim, horas(1000)).pronto);
assert.equal(app.situacao(fim, horas(1000)).motivo, "sequência concluída");

// Status marcado na mão vence o prazo — o ponto todo do congelamento.
["interessado", "reuniao", "fechado", "arquivado"].forEach((s) => {
  const congelado = emT0({ estagio: 1, status: s });
  assert.ok(!app.situacao(congelado, horas(500)).pronto, `${s} deveria congelar`);
  assert.equal(app.statusDoLead(congelado), s);
});
// Status derivado do estágio quando não há marcação manual.
assert.equal(app.statusDoLead(emT0({ estagio: 0, status: "novo" })), "novo");
assert.equal(app.statusDoLead(emT0({ estagio: 1, status: "novo" })), "contatado");
assert.equal(app.statusDoLead(emT0({ estagio: 2, status: "novo" })), "followup");

// Registrar envio avança um estágio, carimba a hora e não passa do final.
const enviado = app.registrarEnvio(novo, new Date(T0));
assert.equal(enviado.estagio, 1);
assert.equal(enviado.ultimoContato, new Date(T0).toISOString());
assert.equal(enviado.primeiroContato, new Date(T0).toISOString());
assert.equal(novo.estagio, 0, "não muta o lead original");
assert.equal(app.registrarEnvio(emT0({ estagio: 3 })).estagio, 3, "não passa do estágio final");
// O primeiro contato não é reescrito no follow-up.
const segundo = app.registrarEnvio({ ...enviado }, new Date(horas(50)));
assert.equal(segundo.primeiroContato, new Date(T0).toISOString());
assert.equal(segundo.estagio, 2);

/* ============================ filtros ============================ */

const base = [
  { id: "1", empresa: "Padaria Sol", contato: "Marcelo", nicho: "Padaria", telefone: "+5541998941500", site: "", status: "novo", estagio: 0, ultimoContato: null },
  { id: "2", empresa: "Ótica Clara", contato: "Helena", nicho: "Varejo", telefone: "+5541997770000", site: "https://oticaclara.com.br", status: "novo", estagio: 1, ultimoContato: new Date(T0).toISOString() },
  { id: "3", empresa: "Pet Feliz", contato: "Camila", nicho: "Pet", telefone: "+5541996660000", site: "", status: "interessado", estagio: 1, ultimoContato: new Date(T0).toISOString() },
  { id: "4", empresa: "Auto Zanardi", contato: "Rogério", nicho: "Automotivo", telefone: "+5541995550000", site: "https://zanardi.com.br", status: "fechado", estagio: 2, ultimoContato: new Date(T0).toISOString() },
  { id: "5", empresa: "Bar do Zé", contato: "José", nicho: "Bar", telefone: "+5541994440000", site: "", status: "arquivado", estagio: 1, ultimoContato: new Date(T0).toISOString() },
];

const ids = (lista) => lista.map((l) => l.id).join(",");
const agora60 = horas(60); // passou dos 48h do lead 2

assert.equal(ids(app.filtrar(base, "", "todos", agora60)), "1,2,3,4", "arquivado sai da lista");
assert.equal(ids(app.filtrar(base, "", "sem-site", agora60)), "1,3");
assert.equal(ids(app.filtrar(base, "", "com-site", agora60)), "2,4");
assert.equal(ids(app.filtrar(base, "", "interessados", agora60)), "3");
assert.equal(ids(app.filtrar(base, "", "fechados", agora60)), "4");

// Follow-up: só quem passou do prazo E não está congelado.
assert.equal(ids(app.filtrar(base, "", "followup", agora60)), "2", "só o 2 venceu e está solto");
assert.equal(ids(app.filtrar(base, "", "followup", horas(10))), "", "ninguém antes das 48h");

// Busca varre empresa, contato, nicho e telefone — e acha até o arquivado,
// senão um arquivamento por engano ficaria irreversível no celular.
assert.equal(ids(app.filtrar(base, "helena", "todos", agora60)), "2");
assert.equal(ids(app.filtrar(base, "PADARIA", "todos", agora60)), "1", "busca ignora caixa");
assert.equal(ids(app.filtrar(base, "996660000", "todos", agora60)), "3", "acha por telefone");
assert.equal(ids(app.filtrar(base, "Bar do Zé", "todos", agora60)), "5", "busca acha arquivado");

const contas = app.contarPorFiltro(base, agora60);
assert.equal(contas.todos, 4, "contador ignora arquivado");
assert.equal(contas.followup, 1);
assert.equal(contas.fechados, 1);
assert.equal(app.FILTROS.length, 6);
app.FILTROS.forEach((f) => assert.ok(f.chave in contas, f.chave));

/* ============================ CSV ============================ */

assert.equal(app.csvEscapar("simples"), "simples");
assert.equal(app.csvEscapar("com,vírgula"), '"com,vírgula"');
assert.equal(app.csvEscapar('com "aspas"'), '"com ""aspas"""');
assert.equal(app.csvEscapar("com\nquebra"), '"com\nquebra"');
assert.equal(app.csvEscapar(null), "");
assert.equal(app.csvEscapar(undefined), "");

// Ida e volta com os três casos que quebram um split(","): vírgula, aspas e
// quebra de linha dentro do campo.
const sujo = [{
  empresa: 'Bar "do Zé", Ltda',
  contato: "José",
  telefone: "+5541994440000",
  site: "",
  nicho: "Bar",
  status: "novo",
  estagio: 0,
  ultimoContato: "",
  notas: "linha 1\nlinha 2, com vírgula",
}];
const volta = app.lerCSV(app.paraCSV(sujo));
assert.equal(volta.length, 1);
assert.equal(volta[0].empresa, 'Bar "do Zé", Ltda');
assert.equal(volta[0].notas, "linha 1\nlinha 2, com vírgula");
assert.equal(volta[0].nicho, "Bar");

// CRLF, BOM do Excel e linha vazia no fim não viram lead fantasma.
const comBom = "﻿empresa,telefone\r\nPadaria Sol,+5541998941500\r\n\r\n";
const lido = app.lerCSV(comBom);
assert.equal(lido.length, 1, "linha em branco no fim é ignorada");
assert.equal(lido[0].empresa, "Padaria Sol");

// Importação aceita as colunas do prospector em Python (nome/categoria/observacoes).
const doPython = app.normalizarImportado(
  { nome: "Padaria Sol", categoria: "Padaria", observacoes: "indicação", telefone: "(41) 99894-1500" },
  "x1"
);
assert.equal(doPython.empresa, "Padaria Sol");
assert.equal(doPython.nicho, "Padaria");
assert.equal(doPython.notas, "indicação");
assert.equal(doPython.telefone, "+5541998941500", "normaliza o telefone na entrada");
assert.equal(doPython.status, "novo");
assert.equal(doPython.estagio, 0);
// Status desconhecido não entra e vira "novo" — senão o card sai sem tag.
assert.equal(app.normalizarImportado({ nome: "X", status: "sei_la" }, "x2").status, "novo");
assert.equal(app.normalizarImportado({ nome: "X", status: "fechado" }, "x3").status, "fechado");

/* ============================ deduplicação ============================ */

// Reimportar a mesma lista não pode dobrar os cards nem, pior, reabrir a
// cadência de quem já foi abordado.
const jaContatado = { ...base[1], estagio: 2 };
const mesclado = app.mesclar([jaContatado], [{ ...base[1], estagio: 0, ultimoContato: null }]);
assert.equal(mesclado.length, 1, "mesmo telefone não duplica");
assert.equal(mesclado[0].estagio, 2, "o que já existe manda — não rebobina a cadência");

assert.equal(app.mesclar(base, [base[0]]).length, base.length);
assert.equal(app.mesclar([], [base[0], base[1]]).length, 2);
// Sem telefone a chave cai no nome, para não colar dois leads diferentes.
assert.equal(app.chaveLead({ empresa: "Sem Fone", telefone: "" }), "nome:sem fone");
assert.equal(app.chaveLead({ empresa: "X", telefone: "+5541998941500" }), "5541998941500");

/* ============================ formatação ============================ */

assert.equal(app.haQuanto(null), "sem contato");
assert.equal(app.haQuanto(new Date(T0).toISOString(), horas(0.2)), "há minutos");
assert.equal(app.haQuanto(new Date(T0).toISOString(), horas(5)), "há 5h");
assert.equal(app.haQuanto(new Date(T0).toISOString(), horas(30)), "há 1 dia");
assert.equal(app.haQuanto(new Date(T0).toISOString(), horas(80)), "há 3 dias");

assert.equal(app.dominio("https://www.oticaclara.com.br/contato"), "oticaclara.com.br");
assert.equal(app.dominio("https://zanardi.com.br"), "zanardi.com.br");

console.log("app ok");
