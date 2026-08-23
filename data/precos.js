/*
 * Tabela de Preços 2026.2 — fonte única da calculadora (#orcamento).
 *
 * Edite só este arquivo quando os valores mudarem: js/script.js monta as
 * opções, o total e a mensagem de WhatsApp a partir daqui.
 *
 * `dias` é estimativa de prazo em dias úteis; os dias dos módulos somam ao
 * da base. São o botão de ajuste quando a agenda apertar — mexa aqui.
 *
 * `destaque` é opcional: quando presente, vira o selo do item na tela
 * ("Sistema web", "IA", "Automação") e tira a linha do visual neutro.
 */

const BASES_PROJETO = [
  { nome: "Landing Page Essencial", preco: 620, dias: 3 },
  { nome: "Landing Page Avançada", preco: 1040, dias: 3 },
  { nome: "Site Institucional Completo", preco: 1590, dias: 5 },
  { nome: "Catálogo / Vitrine", preco: 2790, dias: 8 },
  { nome: "Painel Administrativo / Gestão", preco: 3490, dias: 15, destaque: "Sistema web" },
  { nome: "Sistema de Gestão por Área (OS / Financeiro)", preco: 5900, dias: 25, destaque: "Sistema web" },
  { nome: "MVP de Produto / SaaS", preco: 9900, dias: 40, destaque: "Sistema web" },
  { nome: "Aplicativo Mobile (React Native)", preco: 5900, dias: 20, destaque: "App mobile" },
];

const MODULOS_EXTRAS = [
  { nome: "Atendimento Automático no WhatsApp", preco: 1790, dias: 7, destaque: "Automação" },
  { nome: "Integração com Pagamentos (Pix / Cartão)", preco: 1190, dias: 4 },
  { nome: "Assistente de IA treinado na empresa", preco: 2690, dias: 10, destaque: "IA" },
  { nome: "Robô de Automação de Rotina", preco: 590, dias: 2, destaque: "Automação" },
  { nome: "Integração entre dois sistemas / ERPs", preco: 1390, dias: 5 },
  { nome: "Painel de Indicadores / Dashboard", preco: 1690, dias: 6 },
];
