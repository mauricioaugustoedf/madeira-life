// Configurações centrais do jogo. Ajuste valores aqui sem mexer na lógica.
export const CONFIG = {
  version: '0.22.0-parque',

  render: {
    maxPixelRatio: 2,      // iPhone tem tela 3x; 2x já fica nítido e economiza GPU
    minPixelRatio: 1.25,   // limite inferior do ajuste automático de qualidade
    shadowMapSize: 1024,
    shadowRadius: 16,      // área ao redor do jogador que recebe sombras
    fogNear: 38,
    fogFar: 90,
  },

  // Paleta "aconchegante colorida"
  colors: {
    sky: 0xcfe9f5,
    grassOuter: 0x7cbc5a,
    grassPlot: 0x93cf66,
    dirt: 0xdcae78,
    path: 0xebc893,
    trunk: 0x8b5a3c,
    pine: 0x3e9a56,
    pineLight: 0x67bf68,
    wood: 0xcf8a52,
    woodDark: 0x7c5034,
    roof: 0xd65a40,
    concrete: 0xc9c2b4,
    rock: 0xa9a59b,
    fence: 0xc88a55,
  },

  // Dia e noite: um dia inteiro dura `dayLength` segundos (noite curta, nunca escura demais)
  dayNight: { dayLength: 600 },

  // Terreno inicial (o "lote 0"). O mapa crescerá a partir daqui.
  plot: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },

  player: {
    speed: 5.5,          // metros por segundo
    accel: 14,           // quão rápido atinge a velocidade
    radius: 0.45,        // raio de colisão
    turnSpeed: 12,
    spawn: { x: 0, z: 6 },
    // Trabalho manual do dono (antes de ter funcionários)
    work: {
      chopHits: 4,
      hitInterval: 0.6,       // um pouco mais rápido que o lenhador NPC
      reach: 1.5,             // distância máxima até o tronco para cortar
      bagCapacity: 10,        // itens nas costas (qualquer mistura: toras, tábuas, pedras...)
      pickupRadius: 1.4,
      pickupInterval: 0.12,
      depositInterval: 0.1,
      plantSeconds: 1.1,      // tempo para plantar uma muda num toco
      mineInterval: 0.55,     // uma picaretada = 1 pedra nas costas
    },
    // Aparência padrão (base do futuro menu de personalização)
    appearance: {
      skin: 0xe0ac7e,
      hair: 0x3a2618,
      shirt: 0x2a8f86,
      pants: 0x3d4a5c,
      shoes: 0x2b2b2b,
      cap: 0xf2b134,
    },
  },

  // Floresta produtiva (canto noroeste do lote)
  forest: {
    origin: { x: -17, z: -17 },
    cols: 6, rows: 5,
    spacingX: 2.4, spacingZ: 2.5,
    growSeconds: 40,        // muda até árvore adulta
    stumpSeconds: 6,        // (legado) os tocos agora só viram muda quando alguém planta
    matureAtStart: 0.4,     // fração de árvores já adultas no início
    logsPerTree: 3,
    tickInterval: 0.25,     // a lógica da floresta roda 4x por segundo, não a cada frame
  },

  // Plantador: anda até os tocos e planta mudas (sem ele, você planta)
  planter: {
    speed: 3.0,
    plantSeconds: 1.6,
    restSpot: { x: -9.0, z: -1.6 },
    appearance: { skin: 0x8d5a3b, hair: 0x2a1a10, shirt: 0x5c8f3a, pants: 0x6b5338, shoes: 0x3b2a1e, cap: 0xd8b56a },
  },

  lumberjack: {
    hiredAtStart: false,    // no início é você quem corta; o lenhador vira contratação
    speed: 3.2,
    chopHits: 4,
    hitInterval: 0.8,       // segundos entre machadadas
    restSpot: { x: -6.5, z: -3.5 },
    appearance: {
      skin: 0xc68a5e,
      hair: 0x1f1510,
      shirt: 0xb83a2f,
      pants: 0x34495e,
      shoes: 0x3b2a1e,
      cap: 0xff8c1a,        // capacete
    },
  },

  // Carregador: leva as toras do chão até o pátio
  hauler: {
    speed: 3.6,
    capacity: 6,
    pickInterval: 0.25,
    dropInterval: 0.18,
    extraPileRange: 6,       // pega outra pilha próxima antes de voltar, se couber
    restSpot: { x: -0.6, z: -2.2 },
    appearance: {
      skin: 0xd9a066, hair: 0x5a3a22, shirt: 0xe07b24, pants: 0x3b4a3a, shoes: 0x2b2b2b,
      cap: 0xf2f2f2,         // capacete branco
    },
  },

  // Entregador: leva tábuas do depósito ao caminhão do cliente
  deliverer: {
    speed: 3.8,
    capacity: 10,
    loadInterval: 0.15,
    unloadInterval: 0.2,
    restSpot: { x: 10.8, z: 1.6 },
    appearance: {
      skin: 0xb9805a, hair: 0x1b1210, shirt: 0x6c4fa3, pants: 0x2f3542, shoes: 0x2b2b2b,
      cap: 0x2f6fb3,         // boné azul
    },
  },

  logs: { maxOnGround: 150 },

  // Pátio de toras ao lado do galpão: você entra na faixa marcada para descarregar
  yard: {
    drop: { x: 1.5, z: -0.6, w: 3.0, d: 1.6 },
    stack: { x: 1.5, z: -3.0 },
  },

  // Serra de fita (primeira máquina). Fica no pátio, entre a pilha de toras e a pilha de tábuas.
  sawmill: {
    pos: { x: 5.6, z: -3.0 },        // centro da máquina
    infeedStart: 3.2,                // x onde a tora entra na esteira
    outfeedEnd: 7.6,                 // x onde a tábua sai
    operatorZone: { x: 4.2, z: -1.45, w: 1.6, d: 1.1 },  // ao lado da entrada, sem tampar a lâmina
    level: 1,
    cycleSeconds: 3.0,               // tempo total para transformar 1 tora
    planksPerLog: 1,                 // início: 1 tora = 1 tábua (upgrades aumentam)
  },

  // Descascador + esteiras: tira a casca das toras do pátio e entrega direto na serra.
  // Tora descascada é serrada mais rápido.
  debarker: {
    pos: { x: 2.0, z: -6.8 }, size: { w: 1.6, d: 1.4, h: 1.5 },
    buildZone: { x: -1.2, z: -6.6, w: 2.0, d: 1.2 },
    cost: 8000, planks: 120,
    seconds: 0.9,                    // tempo para descascar uma tora
    sawBonus: 0.6,                   // ciclo da serra com tora descascada (60% do tempo)
    beltSpeed: 1.4, spacing: 0.55,
    inBelt: [[1.5, -4.2], [1.5, -6.05]],                    // pátio → descascador
    outBelt: [[2.85, -6.8], [3.6, -6.8], [3.6, -3.7]],      // descascador → entrada da serra
  },

  planks: {
    stack: { x: 9.0, z: -3.0 },
    pickupZone: { x: 9.0, z: -1.4, w: 1.8, d: 1.1 },  // fique aqui para pegar tábuas
    capacity: 200,                   // limite do depósito inicial
  },

  // Estufa de secagem (segunda máquina): tábua comum → tábua seca (vale o triplo)
  kiln: {
    pos: { x: 16, z: -7 }, size: { w: 4, d: 3.6, h: 2.8 },
    inputZone: { x: 15.0, z: -4.3, w: 1.6, d: 1.0 },   // onde você coloca as tábuas
    batchSize: 10,
    dryingSeconds: 20,
    inputCapacity: 20,
    buildZone: { x: 15.6, z: -1.6, w: 2.2, d: 1.2 },
    buildCost: 12000, buildPlanks: 150,
    feederZone: { x: 15.4, z: -1.6, w: 1.6, d: 1.0 },
    feederCost: 3000,
  },

  dry: {
    stack: { x: 17.9, z: -3.2 },
    pickupZone: { x: 17.9, z: -1.7, w: 1.6, d: 1.0 },
    capacity: 300,
  },

  // Abastecedor da estufa: leva tábuas do depósito até a estufa
  feeder: {
    speed: 3.6, capacity: 10, loadInterval: 0.15, unloadInterval: 0.15,
    reserve: 20,                    // deixa pelo menos 20 tábuas comuns para os pedidos
    restSpot: { x: 14.6, z: -0.4 },
    appearance: {
      skin: 0xe0b48a, hair: 0x7a4a2a, shirt: 0xc0392b, pants: 0x2f3542, shoes: 0x2b2b2b,
      cap: 0x333333,
    },
  },

  economy: { startMoney: 0 },

  save: {
    key: 'cerne.save.v1',
    autosaveSeconds: 10,
  },

  // Produção com o jogo fechado (cálculo matemático, sem simular cada NPC)
  offline: {
    maxHours: 8,                      // limite de tempo contabilizado
    minSecondsToReport: 60,           // só mostra o painel se ficou fora mais que isso
    secondsPerTreePerLumberjack: 6.5, // ritmo médio medido de um lenhador (5,8 s no teste)
    secondsPerTripPerHauler: 16,      // ida e volta média de um carregador (6 toras)
    secondsPerTripPerDeliverer: 18,   // ida e volta média de um entregador (10 tábuas)
    secondsPerTruck: 13,
    secondsPerTripPerFeeder: 12,
    secondsPerTreePerPlanter: 3.6,
    secondsPerTripPerMiner: 34,       // pedreira ↔ estoque de pedras (10 pedras)
    logTruckHaulBoost: 1.6,           // com caminhão de toras, carregadores fazem viagens curtas
    secondsPerTripPerForklift: 22,    // anda até o toco + planta      // abastecedor da estufa (10 tábuas por viagem)
    // obs.: o treinamento da equipe acelera lenhadores, carregadores e entregadores              // caminhão sai, chega o próximo e estaciona
  },

  // Pontos de compra fixos no mapa (cada um com sua área no chão)
  shop: {
    lumberjack: { zone: { x: -2.6, z: -4.2, w: 1.8, d: 1.2 }, costs: [150, 500, 1200, 3000, 7000, 15000] },
    planter:    { zone: { x: -5.4, z: -1.0, w: 1.8, d: 1.2 }, costs: [120, 400, 1000, 2500, 6000, 13000] },
    operator:   { zone: { x: 4.2, z: 0.45, w: 1.8, d: 1.0 }, cost: 250 },
    hauler:     { zone: { x: -1.6, z: 1.5, w: 1.8, d: 1.2 }, costs: [200, 600, 1400, 3500, 8000, 17000] },
    deliverer:  { zone: { x: 9.2, z: 1.6, w: 1.8, d: 1.2 }, costs: [400, 1200, 4000, 10000] },
    training:   { zone: { x: -6.2, z: 10.6, w: 1.8, d: 1.2 } },   // em frente ao escritório
    backpack:   { zone: { x: -3.0, z: 10.6, w: 1.8, d: 1.2 } },   // ao lado do treinamento
    depot:      { zone: { x: 12.1, z: -1.4, w: 1.8, d: 1.1 } },   // ao lado do depósito de tábuas
    sawUpgrade: { zone: { x: 6.6, z: 0.45, w: 1.8, d: 1.0 } },
  },

  // Níveis da serra (o nível 1 é o inicial, definido em sawmill)
  sawLevels: [
    null,
    { level: 2, cost: 300,  planksPerLog: 2, cycleSeconds: 3.0, color: 0x3a6fa8, label: '2 tábuas por tora' },
    { level: 3, cost: 900,  planksPerLog: 2, cycleSeconds: 2.0, color: 0xc77d2b, label: 'Corte 50% mais rápido' },
    { level: 4, cost: 2500, planksPerLog: 3, cycleSeconds: 1.6, color: 0xb59a2a, label: '3 tábuas por tora e mais rápida' },
  ],

  // Treinamento da equipe: todos os funcionários andam e trabalham mais rápido
  trainingLevels: [
    { cost: 3000,   mul: 1.2 },
    { cost: 8000,   mul: 1.4 },
    { cost: 20000,  mul: 1.6 },
    { cost: 50000,  mul: 1.8 },
    { cost: 120000, mul: 2.0 },
  ],

  // Mochila do dono: quanto você carrega nas costas (nível 0 = 6 toras / 10 tábuas)
  backpackLevels: [
    { cost: 300,   items: 15 },
    { cost: 1500,  items: 25 },
    { cost: 5000,  items: 40 },
    { cost: 12000, items: 60 },
    { cost: 30000, items: 80 },
    { cost: 60000, items: 100 },
  ],

  // Depósito de pedras (cobertura sobre o estoque de pedras)
  stoneDepotLevels: [
    { cost: 2500,  planks: 60,  capacity: 1000, label: 'Depósito coberto de pedras: guarda 1.000 pedras' },
    { cost: 12000, planks: 150, stone: 100, capacity: 3000, label: 'Depósito grande de pedras: guarda 3.000 pedras' },
  ],

  // Caçamba de descarte: jogue fora o que está nas costas
  trash: { pos: { x: -3.6, z: 6.9 }, zone: { x: -3.6, z: 8.4, w: 1.8, d: 1.0 } },
  // Parque de diversões (joguinhos valendo dinheiro)
  park: {
    tent: { x: -14.5, z: 0.2, r: 2.0 }, wheel: { x: -17.4, z: -2.6, r: 1.5 },
    zone: { x: -14.5, z: 3.6, w: 2.0, d: 1.2 }, signAt: { x: -12.2, z: 3.2 },
    cost: 300, planks: 10,
  },

  // Ampliação do depósito de tábuas (construção: dinheiro + tábuas)
  depotLevels: [
    { cost: 5000,  planks: 100, capacity: 500,  label: 'Galpão coberto: 500 tábuas' },
    { cost: 25000, planks: 300, stone: 60, capacity: 1500, label: 'Armazém grande: 1.500 tábuas' },
  ],

  // Terrenos à venda (um único mapa que cresce)
  lands: [
    {
      id: 'leste', name: 'Terreno Leste', cost: 2000,
      rect: { minX: 20, maxX: 44, minZ: -20, maxZ: 20 },
      sign: { x: 18.4, z: 4.5 },   // longe da estufa
      grove: { origin: { x: 25, z: -17 }, cols: 6, rows: 6, spacingX: 2.5, spacingZ: 2.6 },
    },
    {
      id: 'norte', name: 'Terreno Norte', cost: 15000, requires: 'leste',
      rect: { minX: -20, maxX: 44, minZ: -44, maxZ: -20 },
      sign: { x: 12, z: -18.4 },
      grove: { origin: { x: -14, z: -40 }, cols: 12, rows: 6, spacingX: 2.5, spacingZ: 2.6 },
    },
    {
      id: 'oeste', name: 'Terreno Oeste', cost: 50000, requires: 'norte',
      rect: { minX: -44, maxX: -20, minZ: -44, maxZ: 20 },
      sign: { x: -18.4, z: 2 },
      grove: { origin: { x: -40, z: -38 }, cols: 8, rows: 20, spacingX: 2.5, spacingZ: 2.6 },
    },
    {
      id: 'pedreira', name: 'Pedreira', cost: 30000, requires: 'norte',
      rect: { minX: 44, maxX: 68, minZ: -44, maxZ: 20 },
      sign: { x: 42.2, z: -1 },
      quarry: true,              // sem bosque: rochas para tirar pedra
    },
  ],

  // Pedreira: rochas grandes que você (ou o mineiro) quebra com a picareta
  quarry: {
    origin: { x: 51, z: -15 }, cols: 4, rows: 4, spacingX: 4.4, spacingZ: 4.4,
    stonePerRock: 25,
    regrowSeconds: 90,          // rocha esgotada volta a crescer depois disso
    reach: 1.9,
  },

  // Estoque de pedras (no pátio principal): as obras grandes usam daqui
  stone: {
    stack: { x: 18.0, z: 8.8 },
    zone: { x: 18.0, z: 10.6, w: 2.0, d: 1.1 },     // entregue as pedras aqui
    pickupZone: { x: 18.0, z: 7.0, w: 2.0, d: 1.0 }, // pegue pedras aqui para levar às obras
    depotZone: { x: 15.4, z: 5.7, w: 1.8, d: 1.0 },  // obra do depósito de pedras
    buyZone: { x: 15.4, z: 8.6, w: 1.8, d: 1.1 },   // comprar pedras com dinheiro
    capacity: 400,
    buyQty: 20, buyCost: 1200,
  },

  // Mineiro: quebra pedra na pedreira e leva ao estoque
  miner: {
    speed: 3.6, capacity: 10, hitInterval: 0.7,
    restSpot: { x: 46.5, z: 3 },
    shopZone: { x: 47.5, z: 7.5, w: 1.8, d: 1.2 },
    costs: [2500, 6000, 12000, 25000],
    appearance: { skin: 0xa86c43, hair: 0x141010, shirt: 0x7a7a7a, pants: 0x3d4a5c, shoes: 0x3b2a1e, cap: 0xf2b134 },
  },

  // Caminhão de toras: busca as toras nos pontos de carga dos terrenos novos e leva ao pátio
  logTruck: {
    shopZone: { x: 7.4, z: 4.4, w: 1.8, d: 1.2 },
    garage: { x: 2.4, z: 4.3 },          // onde estaciona para descarregar no pátio
    cost: 6000,
    levels: [                            // nível 1 = compra; os outros são melhorias
      { capacity: 24, speed: 6.5 },
      { cost: 9000,  capacity: 36, speed: 8.0, label: 'Carroceria maior (36 toras) e mais rápido' },
      { cost: 25000, capacity: 48, speed: 9.5, label: 'Carroceria gigante (48 toras) e motor forte' },
    ],
    loadInterval: 0.09, unloadInterval: 0.07,
    minLoad: 8,                          // só sai para buscar com pelo menos isso (ou após esperar)
    radius: 1.25,                        // folga para desviar de árvores, prédios e placas
    loadPoints: {                        // um ponto de carga por terreno novo
      leste: { x: 31.5, z: -1.2, w: 2.8, d: 2.0 },
      norte: { x: 0, z: -24.6, w: 2.8, d: 2.0 },
      oeste: { x: -19.4, z: -2.6, w: 2.4, d: 2.8 },
    },
    loadPointCapacity: 60,
  },

  // Empilhadeira: leva muitas tábuas de uma vez do depósito ao caminhão do cliente
  forklift: {
    shopZone: { x: 11.8, z: 3.8, w: 1.8, d: 1.2 },
    restSpot: { x: 11.8, z: 6.2 },
    cost: 8000,
    levels: [
      { capacity: 24, speed: 4.8 },
      { cost: 12000, capacity: 36, speed: 5.6, label: 'Garfo maior (36 tábuas) e mais rápida' },
      { cost: 30000, capacity: 48, speed: 6.4, label: 'Garfo duplo (48 tábuas) e motor forte' },
    ],
    loadInterval: 0.05, unloadInterval: 0.08,
    appearance: { skin: 0xc68a5e, hair: 0x2a1a10, shirt: 0xf2b134, pants: 0x2f3542, shoes: 0x2b2b2b, cap: 0xf2f2f2 },
  },

  // Produtos vendidos aos clientes (preço por unidade, cor, peso no sorteio dos pedidos)
  products: {
    plank:      { label: 'Tábuas', unit: 'tábuas', price: 15, color: 0xe2bd85, weight: 1, qtyMul: 1 },
    dry:        { label: 'Tábuas secas', unit: 'secas', price: 45, color: 0xb9763c, weight: 1, qtyMul: 1 },
    viga:       { label: 'Vigas', unit: 'vigas', price: 70, color: 0xc4925a, weight: 0.9, qtyMul: 0.6,
                  size: [1.35, 0.2, 0.2], perLayer: 6, layers: 10 },
    pallet:     { label: 'Pallets', unit: 'pallets', price: 90, color: 0xd9b884, weight: 0.9, qtyMul: 0.5,
                  size: [1.1, 0.16, 1.1], perLayer: 1, layers: 24 },
    compensado: { label: 'Compensados', unit: 'compens.', price: 220, color: 0xc89f62, weight: 0.8, qtyMul: 0.4,
                  size: [1.25, 0.05, 0.95], perLayer: 1, layers: 44 },
    serragem:   { label: 'Serragem', unit: 'sacos', price: 6, color: 0xefe3c4, weight: 0.5, qtyMul: 1.4,
                  size: [0.55, 0.28, 0.42], perLayer: 3, layers: 12 },
    lenha:      { label: 'Lenha', unit: 'feixes', price: 8, color: 0x9a6a3c, weight: 1, qtyMul: 1.5,
                  size: [0.9, 0.3, 0.32], perLayer: 4, layers: 12 },
    mourao:     { label: 'Mourões', unit: 'mourões', price: 22, color: 0x8a6a45, weight: 0.9, qtyMul: 1.0,
                  size: [1.7, 0.15, 0.15], perLayer: 8, layers: 14 },
  },

  // Tipos de comprador por produto (nome do cliente e cor do caminhão)
  buyers: {
    plank: [['Marcenaria Ipê', 0x2f6fb3], ['Carpintaria Aroeira', 0x27ae60], ['Obra da Rua 7', 0xe67e22], ['Seu Joaquim', 0x7f8c8d]],
    dry: [['Móveis Jequitibá', 0x8e44ad], ['Marcenaria Fina', 0x16a085]],
    viga: [['Construtora Vale Verde', 0xc0392b], ['Telhados Peroba', 0xd35400]],
    pallet: [['Transportadora Rota Sul', 0x2c3e50], ['Atacadão do Porto', 0xf1c40f]],
    compensado: [['Loja de Móveis Cedro', 0x6c4fa3], ['Fábrica de Portas Bela', 0x1abc9c]],
    serragem: [['Granja Bom Ovo', 0xe8b931], ['Haras Pé de Vento', 0x795548]],
    lenha: [['Pizzaria Forno a Lenha', 0xc0392b], ['Padaria do Zé', 0xe67e22], ['Churrascaria Brasa Viva', 0x922b21]],
    mourao: [['Fazenda Boa Vista', 0x2e7d32], ['Sítio Recanto', 0x558b2f], ['Cercas & Currais', 0x6d4c41]],
  },

  // Serragem: sai da serra (1 saco por tora serrada) e fica num monte ao norte da serra
  sawdust: { perLog: 1, stack: { x: 6.2, z: -5.0 }, pickupZone: { x: 7.9, z: -5.0, w: 1.2, d: 1.4 }, capacity: 200 },

  // Máquinas de produtos novos (construção: dinheiro + tábuas + pedras). Ficam em fila ao sul do pátio.
  // input = o que entra ('log' tora, 'plank' tábua, 'dry' tábua seca); inputPer unidades viram 1 produto.
  machines: [
    { id: 'viga', name: 'Serra de vigas', product: 'viga', input: 'log', inputPer: 1, seconds: 4,
      x: 2.5, color: 0x3f6f8f, cost: 15000, planks: 150, stone: 40, inputCap: 12, outCap: 120, feederCost: 5000,
      desc: 'Transforma 1 tora em 1 viga ($70). Traga toras ou contrate um abastecedor.' },
    { id: 'pallet', name: 'Montadora de pallets', product: 'pallet', input: 'plank', inputPer: 4, seconds: 5,
      x: 8, color: 0x8f6a3f, cost: 25000, planks: 200, stone: 60, inputCap: 24, outCap: 60, feederCost: 7000,
      desc: 'Monta 1 pallet ($90) com 4 tábuas comuns.' },
    { id: 'compensado', name: 'Prensa de compensado', product: 'compensado', input: 'dry', inputPer: 3, seconds: 7,
      x: 13.5, color: 0x7a4f8f, cost: 40000, planks: 300, stone: 100, inputCap: 18, outCap: 80, feederCost: 10000,
      requiresKiln: true,
      desc: 'Prensa 3 tábuas secas em 1 compensado ($220).' },
    { id: 'lenha', name: 'Rachador de lenha', product: 'lenha', input: 'log', inputPer: 1, outPer: 3, seconds: 3,
      x: 15.5, z: -14, color: 0x9a4a2a, cost: 4000, planks: 60, inputCap: 12, outCap: 150, feederCost: 3000, early: true,
      desc: 'Racha 1 tora em 3 feixes de lenha ($8 cada). Pizzarias e padarias compram.' },
    { id: 'mourao', name: 'Torno de mourões', product: 'mourao', input: 'log', inputPer: 1, outPer: 2, seconds: 4,
      x: -1, z: -14, color: 0x5d7a3a, cost: 9000, planks: 100, stone: 20, inputCap: 12, outCap: 120, feederCost: 4000,
      desc: 'Transforma 1 tora em 2 mourões de cerca ($22 cada). Fazendas e sítios compram.' },
  ],
  machineRow: { z: 10.5, w: 3.0, d: 2.2, h: 2.4 },
  machineFeeder: { speed: 3.6, capacity: 10, loadInterval: 0.15, unloadInterval: 0.15,
    reserve: { log: 10, plank: 20, dry: 10 },
    appearance: { skin: 0xd9a066, hair: 0x3a2618, shirt: 0x2f5d9e, pants: 0x2f3542, shoes: 0x2b2b2b, cap: 0xf2b134 } },

  // Pedidos de clientes entregues no caminhão parado do lado de fora da cerca (sul)
  orders: {
    plankPrice: 15,                  // $ por tábua no início
    dryPrice: 45,                    // $ por tábua seca
    dryShare: 0.5,                   // depois da estufa, metade dos pedidos é de tábuas secas
    firstQty: 3,                     // primeiro pedido pequeno, para aprender
    minQty: 3, maxQty: 8,
    maxQtyCap: 36,                   // limite da carroceria
    bonusPerOrder: 0.04,             // pedidos ficam um pouco maiores/melhores com o tempo
    nextTruckDelay: 3,               // segundos até o próximo cliente chegar
    // cliente que você não quer atender: toque 2x no caminhão e ele vai embora (vem outro)
  },

  dock: {
    zone: { x: 13, z: 18.6, w: 2.8, d: 1.6 },   // área de entrega (dentro da cerca) da vaga 1
    park: { x: 13, z: 23.2 },                   // onde o caminhão estaciona (fora da cerca)
    // Vagas de carga: vários clientes ao mesmo tempo (a 1ª é grátis, as outras se compram)
    bays: [
      { x: 13, cost: 0 },
      { x: 5, cost: 800 },
      { x: -3, cost: 3000 },
    ],
    parkZ: 22.2, laneZ: 24.6,                   // estacionado (perto da cerca) / faixa de rodagem
    roadZ: 23.2,
    enterX: 42, exitX: -42,
    truckSpeed: 9,
  },

  camera: {
    offset: { x: 0, y: 15, z: 12.5 },
    lookHeight: 1.0,
    smoothing: 6,
    fov: 50,
    zoomMin: 0.6,        // mais perto
    zoomMax: 2.8,        // mais longe
    zoomDefault: 1.6,
    zoomStep: 1.25,      // quanto cada toque nos botões +/- muda
  },
};
