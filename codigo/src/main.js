import * as THREE from 'three';
import { softBox } from './core/Clay.js';
import { CONFIG } from './config.js';
import { Engine } from './core/Engine.js';
import { Input } from './core/Input.js';
import { World } from './world/World.js';
import { Player } from './player/Player.js';
import { FollowCamera } from './camera/FollowCamera.js';
import { Hud } from './ui/Hud.js';
import { TapMarker } from './ui/TapMarker.js';
import { rng } from './world/World.js';
import { Forest } from './sim/Forest.js';
import { ForestView } from './world/ForestView.js';
import { LogPiles } from './world/LogPiles.js';
import { Particles } from './world/Particles.js';
import { Lumberjack } from './npc/Lumberjack.js';
import { Woodcutting } from './sim/Woodcutting.js';
import { LogYard } from './world/LogYard.js';
import { PlayerWork } from './player/PlayerWork.js';
import { Stage } from './sim/Forest.js';
import { Planter } from './npc/Planter.js';
import { Sawmill } from './sim/Sawmill.js';
import { SawmillView } from './world/SawmillView.js';
import { PlankStack } from './world/PlankStack.js';
import { ZoneMarker } from './world/ZoneMarker.js';
import { Economy } from './sim/Economy.js';
import { Orders, OrderSlot } from './sim/Orders.js';
import { DeliveryDock } from './world/DeliveryDock.js';
import { Shop, BuyCard } from './build/Shop.js';
import { Operator } from './npc/Operator.js';
import { Hauler } from './npc/Hauler.js';
import { Deliverer } from './npc/Deliverer.js';
import { SaveManager } from './save/SaveManager.js';
import { simulateOffline, formatDuration } from './sim/OfflineSim.js';
import { Menu } from './ui/Menu.js';
import { Construction } from './build/Construction.js';
import { Kiln } from './sim/Kiln.js';
import { KilnView } from './world/KilnView.js';
import { KilnFeeder } from './npc/KilnFeeder.js';
import { Wardrobe } from './sim/Wardrobe.js';
import { FunPark } from './world/FunPark.js';
import { FunPanel } from './ui/FunPanel.js';
import { Customizer } from './ui/Customizer.js';
import { NavGrid } from './world/NavGrid.js';
import { LoadPoint } from './world/LoadPoint.js';
import { LogTruck } from './vehicles/LogTruck.js';
import { Forklift } from './npc/Forklift.js';
import { Debarker } from './sim/Debarker.js';
import { DebarkerView } from './world/DebarkerView.js';
import { Quarry } from './sim/Quarry.js';
import { QuarryView } from './world/QuarryView.js';
import { StoneStack } from './world/StoneStack.js';
import { Miner } from './npc/Miner.js';
import { Machine } from './sim/Machine.js';
import { MachineView } from './world/MachineView.js';
import { MachineFeeder } from './npc/MachineFeeder.js';
import { TeamPanel } from './ui/TeamPanel.js';
import { Decor, DECOR } from './world/Decor.js';
import { Editor } from './ui/Editor.js';
import { DayNight } from './core/DayNight.js';
import { Coins } from './world/Coins.js';

// Bloqueia zoom por pinça do Safari, toque duplo e "puxar a página"
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => {
  // deixa rolar dentro dos painéis (equipe, menu, visual...); no resto da tela, nada de rolar a página
  if (e.target && e.target.closest && e.target.closest('.panel')) return;
  e.preventDefault();
}, { passive: false });

// Preferências locais (o save completo chega na etapa de save)
const SETTINGS_KEY = 'cerne.settings';
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (_) { return {}; }
}
function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (_) {}
}

// Impede o jogador de atravessar o NPC (empurra só o jogador)
function pushApart(a, b, minDist) {
  const dx = a.x - b.x, dz = a.z - b.z;
  const d2 = dx * dx + dz * dz;
  if (d2 >= minDist * minDist || d2 < 1e-6) return;
  const d = Math.sqrt(d2);
  a.x = b.x + (dx / d) * minDist;
  a.z = b.z + (dz / d) * minDist;
}

function boot() {
  const settings = loadSettings();
  const engine = new Engine(document.getElementById('game'));
  const input = new Input(
    document.getElementById('touch-layer'),
    document.getElementById('joy-base'),
    document.getElementById('joy-knob')
  );
  const world = new World(engine.scene);
  const decor = new Decor(engine.scene, world.colliders);   // escritório, pedras e enfeites (editáveis)
  const forest = new Forest(world.colliders, rng(11));
  const yard = new LogYard(engine.scene, world.colliders);
  const planks = new PlankStack(engine.scene, world.colliders);
  const sawmill = new Sawmill(yard, planks);
  const particles = new Particles(engine.scene);
  const sawView = new SawmillView(engine.scene, sawmill, world.colliders, particles);
  const plankZone = new ZoneMarker(engine.scene, CONFIG.planks.pickupZone);
  {
    // ícone: três tábuas
    const icon = [-0.22, 0, 0.22].map((y) => {
      const r = new THREE.Shape();
      r.moveTo(-0.4, y - 0.07); r.lineTo(0.4, y - 0.07); r.lineTo(0.4, y + 0.07); r.lineTo(-0.4, y + 0.07); r.closePath();
      return r;
    });
    plankZone.addIcon(icon);
  }
  const quarry = new Quarry(world.colliders);
  const quarryView = new QuarryView(engine.scene, quarry, CONFIG.lands.find((l) => l.quarry));
  const stoneStack = new StoneStack(engine.scene, world.colliders);
  // Máquinas de produtos novos (vigas, pallets, compensados)
  const machines = CONFIG.machines.map((def) => {
    const m = new Machine(def);
    return { m, view: new MachineView(engine.scene, m, world.colliders), building: false };
  });
  const debarker = new Debarker(yard);
  sawmill.debarker = debarker;
  const debarkerView = new DebarkerView(engine.scene, debarker, world.colliders, particles);
  const kiln = new Kiln();
  const kilnView = new KilnView(engine.scene, kiln, world.colliders);
  // Estoques que o entregador conhece (a estufa acrescenta o de secas)
  const stocks = { plank: { stack: planks, zone: CONFIG.planks.pickupZone }, dry: null };
  const economy = new Economy();
  const orders = new Orders(economy, rng(23));
  // Vagas de carga: cada uma recebe um cliente por vez (a 1ª já vem liberada)
  const docks = [];
  CONFIG.dock.bays.forEach((bay, i) => {
    const slot = new OrderSlot(orders, () => docks.filter((d) => d.orders !== slot && d.orders.current).map((d) => d.orders.current.product));
    const d = new DeliveryDock(engine.scene, slot, bay, i);
    d.setOpen(i === 0);
    docks.push(d);
  });
  const dock = docks[0];
  const nav = world.buildNav();
  const forestView = new ForestView(engine.scene, forest, world.timeUniform);

  // Pontos de carga do caminhão de toras (um por terreno novo; aparecem com o caminhão)
  const loadPoints = Object.entries(CONFIG.logTruck.loadPoints).map(([id, z]) => {
    const lp = new LoadPoint(engine.scene, id, z);
    lp.setVisible(false);
    return lp;
  });
  // Grade de navegação dos veículos: mais folga e evita áreas marcadas e placas
  let shopRef = null;
  const vehicleBlocks = () => {
    const list = [CONFIG.yard.drop, CONFIG.planks.pickupZone, CONFIG.kiln.inputZone, CONFIG.dry.pickupZone, CONFIG.stone.zone, CONFIG.stone.pickupZone, CONFIG.sawdust.pickupZone, CONFIG.trash.zone, ...docks.map((d) => d.zoneRect)];
    for (const mm of machines) list.push(...mm.view.zones);
    if (shopRef) for (const it of shopRef.items) { list.push(it.zone); list.push({ x: it.signAt.x, z: it.signAt.z, w: 1.6, d: 0.4 }); }
    return list;
  };
  let _blocks = [];
  const vcoll = {
    isFree(x, z, r) {
      if (!world.colliders.isFree(x, z, r)) return false;
      for (const b of _blocks) if (Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r) return false;
      return true;
    },
  };
  const vnav = new NavGrid(vcoll, world.colliders.bounds, 0.5, CONFIG.logTruck.radius);
  {
    const rb = nav.rebuild.bind(nav), rs = nav.resize.bind(nav);
    const vrb = vnav.rebuild.bind(vnav);
    vnav.rebuild = () => { _blocks = vehicleBlocks(); vrb(); };
    nav.rebuild = () => { rb(); vnav.rebuild(); };
    nav.resize = (b) => { rs(b); vnav.b = b; vnav.resize(b); };
  }
  const logs = new LogPiles(engine.scene);
  const woodcutting = new Woodcutting({ forest, forestView, logs, particles });
  const player = new Player(engine.scene, world.colliders, nav);
  const work = new PlayerWork(player, { forest, logs, yard, woodcutting, particles, planks, plankZone, docks, kilnRef: { kiln, view: kilnView } });

  work.loadPoints = loadPoints;
  // Caçamba de descarte
  const trashZone = new ZoneMarker(engine.scene, CONFIG.trash.zone, 0x6b4e3a);
  {
    const TP = CONFIG.trash.pos, g = new THREE.Group();
    const green = new THREE.MeshLambertMaterial({ color: 0x2e7d4f, flatShading: false });
    const body = new THREE.Mesh(softBox(2.0, 1.0, 1.3), green); body.position.y = 0.55; body.castShadow = true; g.add(body);
    const rim = new THREE.Mesh(softBox(2.1, 0.1, 1.4), new THREE.MeshLambertMaterial({ color: 0x1f5a38 })); rim.position.y = 1.08; g.add(rim);
    const dirt = new THREE.Mesh(softBox(1.8, 0.05, 1.1), new THREE.MeshLambertMaterial({ color: 0x5a4632 })); dirt.position.y = 0.98; g.add(dirt);
    g.position.set(TP.x, 0, TP.z); engine.scene.add(g);
    world.colliders.addBox(TP.x, TP.z, 1.0, 0.65);
  }
  work.trash = { zone: trashZone, point: new THREE.Vector3(CONFIG.trash.pos.x, 1.1, CONFIG.trash.pos.z) };
  nav.rebuild();
  work.quarry = quarry; work.stone = stoneStack;
  const machinesForPlayer = [...machines];
  work.machines = machinesForPlayer; work.stocks = stocks;
  // Funcionários contratados (no início, nenhum)
  const workers = [];
  let lumberjackCount = 0;
  let sawOperator = null;
  function hireLumberjack(spawn = CONFIG.lumberjack.restSpot) {
    const lj = new Lumberjack(engine.scene, { nav, colliders: world.colliders, forest, logs, woodcutting }, spawn);
    workers.push(lj); applyTeamSpeed();
    lumberjackCount++; lj.role = 'lumberjack';
    return lj;
  }
  let planterCount = 0;
  function hirePlanter(spawn = CONFIG.planter.restSpot) {
    const pl = new Planter(engine.scene, { nav, forest, particles }, spawn);
    workers.push(pl); applyTeamSpeed();
    planterCount++; pl.role = 'planter';
    return pl;
  }
  let haulerCount = 0;
  function hireHauler(spawn = CONFIG.hauler.restSpot) {
    const h = new Hauler(engine.scene, { nav, logs, yard, loadPoints }, spawn);
    workers.push(h); applyTeamSpeed();
    haulerCount++; h.role = 'hauler';
    return h;
  }
  let delivererCount = 0;
  function hireDeliverer(spawn = CONFIG.deliverer.restSpot) {
    const d = new Deliverer(engine.scene, { nav, stocks, docks }, spawn);
    workers.push(d); applyTeamSpeed();
    delivererCount++; d.role = 'deliverer';
    return d;
  }
  let kilnFeeder = null;
  function hireFeeder(spawn = CONFIG.feeder.restSpot) {
    kilnFeeder = new KilnFeeder(engine.scene, { nav, planks, kiln }, spawn);
    workers.push(kilnFeeder); applyTeamSpeed();
  }
  function hireOperator() {
    const Z = CONFIG.sawmill.operatorZone;
    sawOperator = new Operator(engine.scene, Z, CONFIG.sawmill.pos.x, CONFIG.sawmill.pos.z);
    workers.push(sawOperator);
  }
  if (CONFIG.lumberjack.hiredAtStart) hireLumberjack();
  const cam = new FollowCamera(engine.camera, player.object);
  const marker = new TapMarker(engine.scene);
  const hud = new Hud();
  const dayNight = new DayNight(engine);
  hud.dayNight = dayNight;
  hud.setMoney(economy.money);
  economy.onChange((m, delta) => hud.setMoney(m, delta));
  const _proj = new THREE.Vector3();
  const coins = new Coins(engine.scene);
  const onPaid = (order, pos) => {
    coins.burst(pos.x, 2.0, pos.z - 1.2, Math.min(24, 6 + Math.round(order.reward / 60)));
    _proj.set(pos.x, 3, pos.z).project(engine.camera);
    const sx = (_proj.x * 0.5 + 0.5) * window.innerWidth, sy = (-_proj.y * 0.5 + 0.5) * window.innerHeight;
    hud.floatText('+$' + order.reward.toLocaleString('pt-BR'), sx, sy);
  };
  for (const d of docks) d.onPaid = onPaid;
  input.onFirstMove = () => hud.hideHint();

  // ---- Loja: pontos de compra no mapa ----
  const shop = new Shop(engine.scene, economy, new BuyCard(), { planks, stone: stoneStack });
  shopRef = shop;
  const construction = new Construction(engine.scene, particles);
  const SH = CONFIG.shop;
  shop.add({
    id: 'lumberjack', zone: SH.lumberjack.zone,
    signAt: { x: SH.lumberjack.zone.x, z: SH.lumberjack.zone.z - 1.1 },
    offer: () => lumberjackCount < SH.lumberjack.costs.length ? {
      title: `Contratar lenhador ${lumberjackCount + 1}`, short: 'Lenhador',
      desc: 'Corta as árvores adultas sozinho. Sem salário.',
      cost: SH.lumberjack.costs[lumberjackCount],
    } : null,
    buy: () => hireLumberjack({ x: SH.lumberjack.zone.x - 2.2, z: SH.lumberjack.zone.z + 0.4 }), // ao lado, sem empurrar você
  });
  shop.add({
    id: 'planter', zone: SH.planter.zone,
    signAt: { x: SH.planter.zone.x, z: SH.planter.zone.z - 1.1 },
    offer: () => planterCount < SH.planter.costs.length ? {
      title: `Contratar plantador ${planterCount + 1}`, short: 'Plantador',
      desc: 'Planta mudas nos tocos para a floresta nunca acabar. Sem salário.',
      cost: SH.planter.costs[planterCount],
    } : null,
    buy: () => hirePlanter({ x: SH.planter.zone.x - 1.9, z: SH.planter.zone.z }),
  });
  shop.add({
    id: 'hauler', zone: SH.hauler.zone,
    signAt: { x: SH.hauler.zone.x, z: SH.hauler.zone.z - 1.1 },
    offer: () => haulerCount < SH.hauler.costs.length ? {
      title: `Contratar carregador ${haulerCount + 1}`, short: 'Carregador',
      desc: 'Recolhe as toras do chão e leva até o pátio. Sem salário.',
      cost: SH.hauler.costs[haulerCount],
    } : null,
    buy: () => hireHauler({ x: SH.hauler.zone.x + 2.0, z: SH.hauler.zone.z }),
  });
  shop.add({
    id: 'deliverer', zone: SH.deliverer.zone,
    signAt: { x: SH.deliverer.zone.x, z: SH.deliverer.zone.z + 1.1 },
    offer: () => delivererCount < SH.deliverer.costs.length ? {
      title: `Contratar entregador ${delivererCount + 1}`, short: 'Entregador',
      desc: 'Leva as tábuas do depósito até o caminhão do cliente. O dinheiro entra sozinho.',
      cost: SH.deliverer.costs[delivererCount],
    } : null,
    buy: () => hireDeliverer({ x: SH.deliverer.zone.x + 1.9, z: SH.deliverer.zone.z }),
  });
  shop.add({
    id: 'operator', zone: SH.operator.zone,
    signAt: { x: SH.operator.zone.x, z: SH.operator.zone.z + 1.0 },
    offer: () => !sawOperator ? {
      title: 'Contratar operador da serra', short: 'Operador',
      desc: 'Fica na serra e transforma as toras do pátio em tábuas sem você.',
      cost: SH.operator.cost,
    } : null,
    buy: () => hireOperator(),
  });
  shop.add({
    id: 'saw', zone: SH.sawUpgrade.zone,
    signAt: { x: SH.sawUpgrade.zone.x, z: SH.sawUpgrade.zone.z + 1.0 },
    offer: () => {
      const L = CONFIG.sawLevels[sawmill.level];
      return L ? { title: `Melhorar serra (nível ${L.level})`, short: `Serra nv. ${L.level}`, desc: L.label, cost: L.cost } : null;
    },
    buy: () => { const L = CONFIG.sawLevels[sawmill.level]; sawmill.applyLevel(L); sawView.setLevel(L); },
  });
  // ---- Treinamento da equipe ----
  let teamLevel = 0;
  const teamMul = () => (teamLevel ? CONFIG.trainingLevels[teamLevel - 1].mul : 1);
  function applyTeamSpeed() {
    const m = teamMul();
    for (const w of workers) {
      if (w.speedMul !== undefined) w.speedMul = m;
      if (w.multiplier !== undefined) w.multiplier = m;   // lenhador corta mais rápido
    }
  }
  shop.add({
    id: 'training', zone: SH.training.zone,
    signAt: { x: SH.training.zone.x, z: SH.training.zone.z + 1.1 },
    offer: () => {
      const L = CONFIG.trainingLevels[teamLevel];
      if (!L) return null;
      const pct = Math.round((L.mul - 1) * 100);
      return { title: `Treinar equipe (nível ${teamLevel + 1})`, short: `Treinamento ${teamLevel + 1}`,
        desc: `Lenhadores, carregadores e entregadores ficam ${pct}% mais rápidos que no início.`, cost: L.cost };
    },
    buy: () => { teamLevel++; applyTeamSpeed(); },
  });

  // ---- Mochila do dono ----
  let bagLevel = 0;
  function applyBag() {
    if (!bagLevel) return;
    const L = CONFIG.backpackLevels[bagLevel - 1];
    work.setBag(L.items);
  }
  shop.add({
    id: 'backpack', zone: SH.backpack.zone,
    signAt: { x: SH.backpack.zone.x + 0.3, z: SH.backpack.zone.z + 1.1 },
    offer: () => {
      const L = CONFIG.backpackLevels[bagLevel];
      if (!L) return null;
      return { title: `Mochila maior (nível ${bagLevel + 1})`, short: `Mochila ${bagLevel + 1}`,
        desc: `Você passa a carregar ${L.items} itens de uma vez, misturando toras, tábuas, pedras e produtos.`, cost: L.cost };
    },
    buy: () => { bagLevel++; applyBag(); },
  });

  // ---- Ampliação do depósito (construção) ----
  function applyDepot(level, animate) {
    const L = CONFIG.depotLevels[level - 1];
    const done = () => planks.setLevel(level, L.capacity);
    if (animate) construction.play(CONFIG.planks.stack.x, CONFIG.planks.stack.z - 0.3, level >= 2 ? 3.4 : 2.3, level >= 2 ? 2.8 : 2.1, level >= 2 ? 3.1 : 2.4, done);
    else done();
  }
  shop.add({
    id: 'depot', zone: SH.depot.zone,
    signAt: { x: SH.depot.zone.x + 0.4, z: SH.depot.zone.z + 1.2 },
    offer: () => {
      const L = CONFIG.depotLevels[planks.level];
      return L ? { title: planks.level ? 'Construir armazém grande' : 'Construir galpão coberto', short: 'Depósito',
        desc: L.label, cost: L.cost, planks: L.planks, stone: L.stone } : null;
    },
    buy: () => applyDepot(planks.level + 1, true),
  });

  // ---- Estufa de secagem ----
  let kilnBuilding = false;
  function buildKiln(animate) {
    const K = CONFIG.kiln;
    kilnBuilding = true;
    const done = () => {
      kilnView.build();
      world.nav.rebuild();
      stocks.dry = { stack: kiln.dry, zone: CONFIG.dry.pickupZone };
      orders.dryEnabled = true;
      hud.showDry(true);
    };
    if (animate) construction.play(K.pos.x, K.pos.z, K.size.w, K.size.d, K.size.h, done, 2.8);
    else done();
  }
  shop.add({
    id: 'kiln', zone: CONFIG.kiln.buildZone,
    signAt: { x: CONFIG.kiln.buildZone.x + 0.6, z: CONFIG.kiln.buildZone.z + 1.2 },
    offer: () => (kiln.built || kilnBuilding) ? null : {
      title: 'Construir estufa de secagem', short: 'Estufa',
      desc: 'Seca as tábuas comuns. Tábua seca vale $45 (a comum vale $15).',
      cost: CONFIG.kiln.buildCost, planks: CONFIG.kiln.buildPlanks,
    },
    buy: () => buildKiln(true),
  });
  // ---- Parque de diversões ----
  const PK = CONFIG.park;
  const funPark = new FunPark(engine.scene, world.colliders, PK);
  const funPanel = new FunPanel(economy, {
    onResult: (profit) => {
      if (profit > 0) coins.burst && coins.burst(PK.zone.x, 1.2, PK.zone.z, Math.min(12, 3 + Math.round(profit / 100)));
      saver && saver.save();
    },
  });
  let parkBuilding = false;
  function buildPark(animate) {
    parkBuilding = true;
    const done = () => { funPark.build(); world.nav.rebuild(); };
    if (animate) construction.play(PK.tent.x, PK.tent.z, PK.tent.r * 2, PK.tent.r * 2, 3.2, done, 3.0);
    else done();
  }
  shop.add({
    id: 'park', zone: PK.zone, signAt: PK.signAt,
    offer: () => funPark.built ? {
      title: 'Parque de diversões', short: 'Parque', sign: 'Jogar!', action: 'JOGAR', costText: 'Entrada grátis',
      desc: 'Machado no alvo, copinhos e cronômetro. Aposte e ganhe dinheiro jogando.', cost: 0,
    } : parkBuilding ? { hidden: true } : {
      title: 'Construir parque de diversões', short: 'Parque',
      desc: 'Um lugar para gastar e ganhar dinheiro se divertindo: três joguinhos com apostas.',
      cost: PK.cost, planks: PK.planks,
    },
    buy: () => { if (funPark.built) funPanel.open(); else buildPark(true); },
  });
  shop.add({
    id: 'feeder', zone: CONFIG.kiln.feederZone,
    signAt: { x: CONFIG.kiln.feederZone.x + 0.2, z: CONFIG.kiln.feederZone.z + 1.2 },
    offer: () => !kiln.built ? { hidden: true } : kilnFeeder ? null : {
      title: 'Contratar abastecedor da estufa', short: 'Abastecedor',
      desc: 'Leva tábuas comuns do depósito até a estufa (deixa 20 para os pedidos).',
      cost: CONFIG.kiln.feederCost,
    },
    buy: () => hireFeeder({ x: CONFIG.kiln.feederZone.x, z: CONFIG.kiln.feederZone.z + 1.2 }),
  });

  // ---- Descascador + esteiras (construção) ----
  let debarkerBuilding = false;
  function buildDebarker(animate) {
    const D = CONFIG.debarker;
    debarkerBuilding = true;
    const done = () => { debarkerView.build(); world.nav.rebuild(); debarker.built = true; };
    if (animate) construction.play(D.pos.x + 0.6, D.pos.z + 0.6, 3.0, 2.8, D.size.h, done, 2.6);
    else done();
  }
  shop.add({
    id: 'debarker', zone: CONFIG.debarker.buildZone,
    signAt: { x: CONFIG.debarker.buildZone.x, z: CONFIG.debarker.buildZone.z - 1.1 },
    offer: () => (debarker.built || debarkerBuilding) ? null : !sawOperator ? { hidden: true } : {
      title: 'Construir descascador + esteiras', short: 'Descascador',
      desc: 'Esteiras levam as toras do pátio ao descascador e dele direto para a serra. Tora sem casca é serrada 40% mais rápido.',
      cost: CONFIG.debarker.cost, planks: CONFIG.debarker.planks,
    },
    buy: () => buildDebarker(true),
  });

  const ownedLands = new Set();
  // ---- Pedra: estoque, compra e mineiros ----
  const stoneOn = () => stoneStack.stock > 0 || planks.level >= 1 || ownedLands.has('norte');
  let minerCount = 0;
  function hireMiner(spawn = CONFIG.miner.restSpot) {
    const m = new Miner(engine.scene, { nav, quarry, stone: stoneStack, particles }, spawn);
    workers.push(m); applyTeamSpeed();
    minerCount++; m.role = 'miner';
    return m;
  }
  shop.add({
    id: 'buystone', zone: CONFIG.stone.buyZone,
    signAt: { x: CONFIG.stone.buyZone.x, z: CONFIG.stone.buyZone.z - 1.1 },
    offer: () => !stoneOn() ? { hidden: true } : {
      title: `Comprar ${CONFIG.stone.buyQty} pedras`, short: `${CONFIG.stone.buyQty} pedras`,
      desc: 'Um fornecedor entrega pedras no estoque. Mais barato é tirar da sua própria pedreira.',
      cost: CONFIG.stone.buyCost,
    },
    buy: () => stoneStack.add(CONFIG.stone.buyQty),
  });
  // Depósito de pedras: cobertura e mais espaço (obra com dinheiro + tábuas, o 2º também pedras)
  function applyStoneDepot(level, animate) {
    const L = CONFIG.stoneDepotLevels[level - 1];
    const done = () => stoneStack.setLevel(level, L.capacity);
    if (animate) construction.play(CONFIG.stone.stack.x, CONFIG.stone.stack.z, 3.2, 2.8, 2.6, done);
    else done();
  }
  shop.add({
    id: 'stonedepot', zone: CONFIG.stone.depotZone,
    signAt: { x: CONFIG.stone.depotZone.x, z: CONFIG.stone.depotZone.z - 1.1 },
    offer: () => {
      const L = CONFIG.stoneDepotLevels[stoneStack.level];
      return L ? { title: stoneStack.level ? 'Construir depósito grande de pedras' : 'Construir depósito de pedras', short: 'Depósito de pedras',
        desc: L.label, cost: L.cost, planks: L.planks, stone: L.stone } : null;
    },
    buy: () => applyStoneDepot(stoneStack.level + 1, true),
  });
  shop.add({
    id: 'miner', zone: CONFIG.miner.shopZone,
    signAt: { x: CONFIG.miner.shopZone.x, z: CONFIG.miner.shopZone.z + 1.1 },
    offer: () => !quarry.open ? { hidden: true } : minerCount < CONFIG.miner.costs.length ? {
      title: `Contratar mineiro ${minerCount + 1}`, short: 'Mineiro',
      desc: 'Quebra pedra na pedreira e leva ao estoque de pedras. Sem salário.',
      cost: CONFIG.miner.costs[minerCount],
    } : null,
    buy: () => hireMiner({ x: CONFIG.miner.shopZone.x - 2, z: CONFIG.miner.shopZone.z }),
  });

  // ---- Serragem: sai da serra e vira produto vendável ----
  const SD = CONFIG.sawdust, SP = CONFIG.products.serragem;
  const sawdust = new PlankStack(engine.scene, world.colliders, { pos: SD.stack, capacity: SD.capacity, color: SP.color, size: SP.size, perLayer: SP.perLayer, layers: SP.layers });
  const sawdustZone = new ZoneMarker(engine.scene, SD.pickupZone);
  stocks.serragem = { stack: sawdust, zone: SD.pickupZone };
  sawmill.onSawn = () => {
    sawdust.add(SD.perLog);
  };
  // aparece para você como uma "máquina" só de saída (pegar sacos)
  machinesForPlayer.push({ m: { built: true, out: sawdust, def: { product: 'serragem', input: 'none', name: 'Serragem' }, space: 0, input: 0 },
    view: { inZone: { contains: () => false }, outZone: sawdustZone } });

  // Clientes só pedem o que você já consegue fazer (tábua no início; secas com a estufa;
  // produtos de máquina depois de construir; serragem quando tem pelo menos 8 sacos)
  orders.available = () => {
    const a = ['plank'];
    if (kiln.built) a.push('dry');
    for (const mm of machines) if (mm.m.built) a.push(mm.m.def.product);
    if (sawdust.stock >= 8) a.push('serragem');
    return a;
  };
  orders.stockOf = (k) => (stocks[k] && stocks[k].stack ? stocks[k].stack.stock : 0);
  let _ordChk = 0;

  // ---- Vagas de carga extras (mais clientes ao mesmo tempo) ----
  docks.forEach((d, i) => {
    if (i === 0) return;
    const bay = CONFIG.dock.bays[i];
    shop.add({
      id: 'bay-' + i, zone: d.zoneRect,
      signAt: { x: d.zoneRect.x, z: d.zoneRect.z - 1.3 },
      offer: () => d.open ? null : (i > 1 && !docks[i - 1].open) ? { hidden: true } : {
        title: `Abrir vaga de carga ${i + 1}`, short: `Vaga ${i + 1}`,
        desc: 'Mais um cliente estaciona e compra ao mesmo tempo que os outros.', cost: bay.cost,
      },
      buy: () => d.setOpen(true),
    });
  });

  // ---- Máquinas de produtos (obra com dinheiro + tábuas + pedras) ----
  function buildMachine(mm, animate) {
    mm.building = true;
    const R = CONFIG.machineRow, prod = mm.m.def.product;
    const done = () => {
      mm.view.build();
      world.nav.rebuild();
      stocks[prod] = { stack: mm.m.out, zone: mm.view.outZoneRect };
      orders.enabled.add(prod);
    };
    if (animate) construction.play(mm.view.pos.x, mm.view.pos.z, R.w, R.d, R.h, done, 2.6);
    else done();
  }
  function hireMachineFeeder(mm) {
    const D = mm.m.def;
    const source = D.input === 'log' ? { stack: yard, zone: CONFIG.yard.drop } : stocks[D.input];
    if (!source) return;
    const z = mm.view.buildZone;
    mm.feeder = new MachineFeeder(engine.scene, { nav, source, target: mm.m, inZone: mm.view.inZoneRect, inputType: D.input }, { x: z.x, z: z.z + 0.8 });
    workers.push(mm.feeder); applyTeamSpeed();
  }
  const UNIT_NAME = { log: 'toras', plank: 'tábuas comuns', dry: 'tábuas secas' };
  for (const mm of machines) {
    const D = mm.m.def;
    shop.add({
      id: 'machine-' + D.id, zone: mm.view.buildZone,
      signAt: { x: mm.view.buildZone.x - 1.6, z: mm.view.buildZone.z + 0.2 },   // ao lado: não tapa você na máquina
      offer: () => {
        if (mm.m.built) {
          if (mm.feeder) return null;
          return { title: `Contratar abastecedor (${D.name})`, short: 'Abastecedor',
            desc: `Leva ${UNIT_NAME[D.input]} até a ${D.name.toLowerCase()} sozinho. Sem salário.`, cost: D.feederCost };
        }
        if (mm.building) return { hidden: true };
        if ((D.early ? !sawOperator : !stoneOn()) || (D.requiresKiln && !kiln.built)) return { hidden: true };
        return { title: `Construir ${D.name.toLowerCase()}`, short: D.name, desc: D.desc, cost: D.cost, planks: D.planks, stone: D.stone };
      },
      buy: () => (mm.m.built ? hireMachineFeeder(mm) : buildMachine(mm, true)),
    });
  }

  // ---- Equipe: trocar a função de um funcionário (sem custo) ----
  const ROLES = [
    { id: 'lumberjack', label: 'Lenhador' }, { id: 'planter', label: 'Plantador' },
    { id: 'hauler', label: 'Carregador' }, { id: 'deliverer', label: 'Entregador' }, { id: 'miner', label: 'Mineiro' },
  ];
  const HIRE = { lumberjack: (p) => hireLumberjack(p), planter: (p) => hirePlanter(p), hauler: (p) => hireHauler(p), deliverer: (p) => hireDeliverer(p), miner: (p) => hireMiner(p) };
  // devolve o que o funcionário carregava e solta o que tinha reservado
  function unloadWorker(w) {
    const r = w.role;
    if ((r === 'lumberjack' && w.state !== 3) || r === 'planter') { if (w.tree) forest.release(w.tree); w.tree = null; }
    if (r === 'hauler') { w._release(); if (w.carrying) yard.add(w.carrying); }
    if (r === 'deliverer' && w.carrying) { const st = stocks[w.carryType]; if (st) st.stack.add(w.carrying); }
    if (r === 'miner') { w._release(); if (w.carrying) stoneStack.add(w.carrying); }
    w.carrying = 0;
    if (w._refresh) w._refresh();
    if (w._refreshBack) w._refreshBack();
    w.path = null;
  }
  function dismissWorker(w) {
    const r = w.role;
    unloadWorker(w);
    engine.scene.remove(w.object);
    workers.splice(workers.indexOf(w), 1);
    const di = Deliverer.all.indexOf(w); if (di >= 0) Deliverer.all.splice(di, 1);
    if (r === 'lumberjack') lumberjackCount--;
    else if (r === 'planter') planterCount--;
    else if (r === 'hauler') haulerCount--;
    else if (r === 'deliverer') delivererCount--;
    else if (r === 'miner') minerCount--;
  }
  // ---- Descanso: o funcionário para de trabalhar e vai para dentro de casa ----
  function homeDoor() {
    const h = decor.items.find((i) => i.type === 'escritorio') || decor.items.find((i) => i.type === 'casa' || i.type === 'galpao');
    if (!h) return { x: -9, z: 10.6 };
    const d = DECOR[h.type].col.d / 2 + 0.8;
    return { x: h.x + Math.sin(h.rot) * d, z: h.z + Math.cos(h.rot) * d };
  }
  function restWorker(w, on, instant = false) {
    if (on) {
      if (w.resting) return;
      unloadWorker(w);
      const door = homeDoor();
      const path = instant ? null : nav.findPath(w.position.x, w.position.z, door.x, door.z);
      w.resting = { phase: path ? 'go' : 'in', path, i: 0 };
      w.state = 0; w.plan = 0;
      if (!path) { w.position.set(door.x, 0, door.z); w.object.visible = false; }
    } else {
      if (!w.resting) return;
      const door = homeDoor();
      if (w.resting.phase === 'in') w.position.set(door.x, 0, door.z);
      w.object.visible = true;
      w.resting = null;
      w.state = 0; w.timer = 0.3; w.path = null;
    }
  }
  function updateResting(w, dt, t) {
    const R = w.resting;
    if (R.phase !== 'go') return;
    const wp = R.path[R.i];
    const dx = wp.x - w.position.x, dz = wp.z - w.position.z, dist = Math.hypot(dx, dz), step = 3.2 * dt;
    if (dist <= step) { w.position.x = wp.x; w.position.z = wp.z; if (++R.i >= R.path.length) { R.phase = 'in'; w.object.visible = false; } }
    else {
      w.position.x += dx / dist * step; w.position.z += dz / dist * step;
      w.object.rotation.y = Math.atan2(dx, dz); if (w.heading !== undefined) w.heading = w.object.rotation.y;
    }
    if (w.model && w.model.animate) w.model.animate(dt, 1, t);
  }
  // Você está bem na frente de quem está andando?
  function blocksWay(w, dist) {
    const path = w.path || (w.resting && w.resting.path);
    if (!path) return false;
    const wp = path[w.pathIndex ?? 0];
    if (!wp) return false;
    const px = player.position.x - w.position.x, pz = player.position.z - w.position.z;
    const d = Math.hypot(px, pz);
    if (d > dist || d < 0.01) return false;
    const dx = wp.x - w.position.x, dz = wp.z - w.position.z, dl = Math.hypot(dx, dz) || 1;
    return (px * dx + pz * dz) / (d * dl) > 0.35;   // mais ou menos na direção em que vai
  }
  function truckBlocked(T) {
    const fx = Math.cos(T.heading), fz = -Math.sin(T.heading);
    const rx = player.position.x - T.position.x, rz = player.position.z - T.position.z;
    const along = rx * fx + rz * fz, side = -rx * fz + rz * fx;
    // movendo para a frente: área à frente; descarregando/carregando não mexe
    return along > 1.2 && along < 5.2 && Math.abs(side) < 1.6;
  }
  const activeCount = (role) => workers.filter((w) => w.role === role && !w.resting).length;

  const teamPanel = new TeamPanel(ROLES, {
    rest: (w, on) => { restWorker(w, on); saver.save(); },
    status: (w) => (w.resting ? (w.resting.phase === 'in' ? 'Descansando em casa' : 'Indo descansar') : (w.status || '')),
    list: () => workers.filter((w) => w.role).sort((a, b) => ROLES.findIndex((r) => r.id === a.role) - ROLES.findIndex((r) => r.id === b.role))
      .map((w) => ({ worker: w, role: w.role, status: w.status })),
    available: (id) => id !== 'miner' || quarry.open,
    change: (w, id) => {
      if (w.role === id) return;
      const pos = { x: w.position.x, z: w.position.z };
      dismissWorker(w);
      HIRE[id](pos);
      particles.burst(pos.x, 1, pos.z, 8, 1.5);
      saver.save();
    },
  });

  // ---- Veículos internos ----
  let logTruck = null;
  const LT = CONFIG.logTruck;
  function refreshLoadPoints() {
    for (const lp of loadPoints) lp.setVisible(!!logTruck && ownedLands.has(lp.id));
  }
  function buyLogTruck(level = 1) {
    if (!logTruck) logTruck = new LogTruck(engine.scene, { vnav, yard, loadPoints });
    logTruck.setLevel(level);
    refreshLoadPoints();
  }
  shop.add({
    id: 'logtruck', zone: LT.shopZone,
    signAt: { x: LT.shopZone.x, z: LT.shopZone.z + 1.1 },
    offer: () => {
      if (!ownedLands.size) return { hidden: true };
      if (!logTruck) return { title: 'Comprar caminhão de toras', short: 'Caminhão de toras',
        desc: `Busca as toras nos pontos de carga dos terrenos novos e leva ao pátio. Leva ${LT.levels[0].capacity} toras por viagem.`, cost: LT.cost };
      const L = LT.levels[logTruck.level];
      return L ? { title: `Melhorar caminhão de toras (nível ${logTruck.level + 1})`, short: `Caminhão nv. ${logTruck.level + 1}`, desc: L.label, cost: L.cost } : null;
    },
    buy: () => buyLogTruck(logTruck ? logTruck.level + 1 : 1),
  });
  let forklift = null;
  const FK = CONFIG.forklift;
  function buyForklift(level = 1) {
    if (!forklift) {
      forklift = new Forklift(engine.scene, { nav, stocks, docks }, FK.restSpot);
      workers.push(forklift); applyTeamSpeed();
    }
    forklift.setLevel(level);
  }
  shop.add({
    id: 'forklift', zone: FK.shopZone,
    signAt: { x: FK.shopZone.x, z: FK.shopZone.z + 1.1 },
    offer: () => {
      if (!delivererCount && !forklift) return { hidden: true };
      if (!forklift) return { title: 'Comprar empilhadeira', short: 'Empilhadeira',
        desc: `Leva ${FK.levels[0].capacity} tábuas de uma vez do depósito até o caminhão do cliente.`, cost: FK.cost };
      const L = FK.levels[forklift.level];
      return L ? { title: `Melhorar empilhadeira (nível ${forklift.level + 1})`, short: `Empilhadeira nv. ${forklift.level + 1}`, desc: L.label, cost: L.cost } : null;
    },
    buy: () => buyForklift(forklift ? forklift.level + 1 : 1),
  });

  function unlockLand(land, quiet = false) {
    ownedLands.add(land.id);
    refreshLoadPoints();
    world.expand(land.rect);
    if (land.grove) forest.addGrove(land.grove, 0, 0.6);   // mudas surgem e crescem
    if (land.quarry) {
      quarry.openUp();
      quarryView.setVisible(true);
    }
    world.nav.rebuild();
    if (quiet) return;
    const cx = (land.rect.minX + land.rect.maxX) / 2, cz = (land.rect.minZ + land.rect.maxZ) / 2;
    for (let i = 0; i < 6; i++) particles.burst(cx - 6 + i * 2.4, 0.5, cz - 8 + i * 3, 10, 3);
  }
  for (const land of CONFIG.lands) {
    shop.add({
      id: 'land-' + land.id, zone: { x: land.sign.x, z: land.sign.z, w: 2.2, d: 1.6 },
      signAt: { x: land.sign.x, z: land.sign.z - 1.2 },
      offer: () => ownedLands.has(land.id) ? null
        : (land.requires && !ownedLands.has(land.requires)) ? { hidden: true } : {
        title: `Desbloquear ${land.name}`, short: land.name,
        desc: land.grove ? `Amplia a propriedade com um bosque novo de ${land.grove.cols * land.grove.rows} árvores.`
          : 'Rochas para tirar pedra com a picareta. Pedra é usada nas construções grandes.',
        cost: land.cost,
      },
      buy: () => unlockLand(land),
    });
  }
  vnav.rebuild();
  shop.onBought = (item, o) => {
    particles.burst(item.zone.x, 0.6, item.zone.z, 14, 2.6);
    _proj.set(item.zone.x, 2.5, item.zone.z).project(engine.camera);
    hud.floatText('-$' + o.cost.toLocaleString('pt-BR'),
      (_proj.x * 0.5 + 0.5) * window.innerWidth, (-_proj.y * 0.5 + 0.5) * window.innerHeight, true);
  };

  // ---- Visual do personagem ----
  const wardrobe = new Wardrobe();
  wardrobe.apply(player.model);
  const customizer = new Customizer(wardrobe, economy, () => { wardrobe.apply(player.model); saver && saver.save(); });

  // ---- Save ----
  function snapshot() {
    return {
      v: 1, version: CONFIG.version, savedAt: Date.now(),
      money: economy.money, totalEarned: economy.totalEarned,
      yard: yard.stock + debarker.inTransit, planks: planks.stock, debarker: debarker.built,
      piles: logs.piles.map((p) => ({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), dx: +p.dx.toFixed(3), dz: +p.dz.toFixed(3), n: p.ids.length })),
      trees: forest.toRows(),   // posição de cada árvore (o modo editar pode mudar)
      lands: [...ownedLands],
      lumberjacks: lumberjackCount, planters: planterCount, haulers: haulerCount, deliverers: delivererCount, operator: !!sawOperator, sawLevel: sawmill.level,
      teamLevel, bagLevel, depotLevel: planks.level,
      siteDeposits: Object.fromEntries(shop.items.filter((i) => i.deposited).map((i) => [i.id, i.deposited])),
      siteStone: Object.fromEntries(shop.items.filter((i) => i.stoneDep).map((i) => [i.id, i.stoneDep])),
      parkBuilt: funPark.built, park: funPanel.toJSON(),
      kilnBuilt: kiln.built, kilnInput: kiln.input + kiln.batch, dry: kiln.dry ? kiln.dry.stock : 0, feeder: !!kilnFeeder,
      orders: { completed: orders.completed, slots: docks.map((d) => d.orders.current), enabled: [...orders.enabled] },
      docksOpen: docks.map((d) => d.open), sawdust: sawdust.stock,
      player: { x: +player.position.x.toFixed(2), z: +player.position.z.toFixed(2), items: work.items.slice() },
      wardrobe: wardrobe.toJSON(),
      logTruck: logTruck ? { level: logTruck.level, cargo: logTruck.cargo + logTruck.inFlight } : null,
      loadPoints: Object.fromEntries(loadPoints.map((lp) => [lp.id, lp.stock])),
      forklift: forklift ? forklift.level : 0,
      stone: stoneStack.stock, stoneDepot: stoneStack.level, miners: minerCount,
      resting: workers.filter((w) => w.resting && w.role).map((w) => w.role),
      machines: Object.fromEntries(machines.map((mm) => [mm.m.id, { built: mm.m.built, input: mm.m.input + (mm.m.busy ? mm.m.def.inputPer : 0), out: mm.m.out ? mm.m.out.stock : 0, feeder: !!mm.feeder }])),
      rocks: quarry.toRows(), decor: decor.toJSON(),
      stats: { treesCut: forest.totalCut, planted: forest.totalPlanted || 0, logsProcessed: sawmill.logsProcessed },
    };
  }

  function restore(d) {
    economy.money = d.money || 0;
    economy.totalEarned = d.totalEarned || 0;
    for (const land of CONFIG.lands) if ((d.lands || []).includes(land.id)) unlockLand(land, true);
    // Estado de cada árvore (a ordem é sempre a mesma porque o mapa é gerado com semente fixa)
    if (d.trees && d.trees[0] && d.trees[0].length >= 5) forest.loadRows(d.trees);
    else (d.trees || []).forEach((row, i) => {   // save antigo: só o estado, na ordem da semente
      const t = forest.trees[i];
      if (!t) return;
      [t.stage, t.growth, t.timer] = row;
      t.reserved = false;
      forest.dirty.add(t);
    });
    if (d.decor) decor.load(d.decor);
    for (let i = 0; i < (d.lumberjacks || 0); i++) hireLumberjack(CONFIG.lumberjack.restSpot);
    for (let i = 0; i < (d.planters || 0); i++) hirePlanter(CONFIG.planter.restSpot);
    for (let i = 0; i < (d.haulers || 0); i++) hireHauler(CONFIG.hauler.restSpot);
    for (let i = 0; i < (d.deliverers || 0); i++) hireDeliverer(CONFIG.deliverer.restSpot);
    if (d.operator) hireOperator();
    for (let L = 2; L <= (d.sawLevel || 1); L++) {
      const lv = CONFIG.sawLevels[L - 1];
      if (lv) { sawmill.applyLevel(lv); sawView.setLevel(lv, true); }
    }
    wardrobe.load(d.wardrobe);
    wardrobe.apply(player.model);
    for (const [id, n] of Object.entries(d.siteDeposits || {})) {
      const it = shop.items.find((i) => i.id === id);
      if (it) it.deposited = n;
    }
    for (const [id, n] of Object.entries(d.siteStone || {})) {
      const it = shop.items.find((i) => i.id === id);
      if (it) it.stoneDep = n;
    }
    bagLevel = Math.min(d.bagLevel || 0, CONFIG.backpackLevels.length);
    applyBag();
    teamLevel = Math.min(d.teamLevel || 0, CONFIG.trainingLevels.length);
    applyTeamSpeed();
    if (d.depotLevel) applyDepot(d.depotLevel, false);
    if (d.debarker) buildDebarker(false);
    if (d.parkBuilt) buildPark(false);
    funPanel.load(d.park);
    if (d.kilnBuilt) {
      buildKiln(false);
      kiln.input = Math.min(d.kilnInput || 0, kiln.inputCapacity);
      kiln.dry.add(d.dry || 0);
      if (d.feeder) hireFeeder();
    }
    if (d.logTruck) { buyLogTruck(d.logTruck.level || 1); yard.add(d.logTruck.cargo || 0); }
    for (const lp of loadPoints) lp.add((d.loadPoints || {})[lp.id] || 0);
    if (d.forklift) buyForklift(d.forklift);
    if (d.stoneDepot) applyStoneDepot(d.stoneDepot, false);
    stoneStack.add(d.stone || 0);
    for (const mm of machines) {
      const md = (d.machines || {})[mm.m.id];
      if (!md || !md.built) continue;
      buildMachine(mm, false);
      mm.m.input = Math.min(md.input || 0, mm.m.def.inputCap);
      mm.m.out.add(md.out || 0);
      if (md.feeder) hireMachineFeeder(mm);
    }
    if (d.rocks && d.rocks[0] && d.rocks[0].length >= 4) quarry.loadRows(d.rocks);
    else (d.rocks || []).forEach(([n, tm], i) => { const r = quarry.rocks[i]; if (r) { r.stone = n; r.timer = tm; } });
    quarry.dirty = true;
    for (let i = 0; i < (d.miners || 0); i++) hireMiner();
    yard.add(d.yard || 0);
    planks.add(d.planks || 0);
    for (const p of d.piles || []) logs.addPile(p.x, p.z, p.dx, p.dz, p.n);
    if (d.orders) {
      orders.completed = d.orders.completed || 0;
      const slots = d.orders.slots || [d.orders.current || null];
      docks.forEach((dk, i) => { dk.orders.current = slots[i] || null; });
      for (const e of d.orders.enabled || []) if (CONFIG.products[e]) orders.enabled.add(e);
    }
    (d.docksOpen || []).forEach((v, i) => { if (docks[i]) docks[i].setOpen(v || i === 0); });
    sawdust.add(d.sawdust || 0);
    // quem estava descansando continua em casa
    for (const role of d.resting || []) {
      const w = workers.find((x) => x.role === role && !x.resting);
      if (w) restWorker(w, true, true);
    }
    if (d.player) {
      player.position.set(d.player.x, 0, d.player.z);
      if (d.player.items) work.loadItems(d.player.items);
      else if (d.player.carrying > 0) work.loadItems(Array(d.player.carrying).fill(d.player.carryType));
    }
    if (d.stats) { forest.totalCut = d.stats.treesCut || 0; forest.totalPlanted = d.stats.planted || 0; sawmill.logsProcessed = d.stats.logsProcessed || 0; }
    hud.setMoney(economy.money);
  }

  // Produção com o jogo fechado → aplica no mundo e devolve o resumo
  function applyOffline(seconds) {
    const r = simulateOffline(seconds, {
      miners: quarry.open ? activeCount('miner') * teamMul() : 0, minerCapacity: CONFIG.miner.capacity, stoneSpace: stoneStack.space,
      lumberjacks: activeCount('lumberjack') * teamMul(), planters: activeCount('planter') * teamMul(),
      matureTrees: forest.matureCount, growingTrees: forest.count(Stage.GROWING), stumps: forest.count(Stage.STUMP), operator: !!sawOperator,
      haulers: activeCount('hauler') * teamMul() * (logTruck ? CONFIG.offline.logTruckHaulBoost : 1), haulCapacity: CONFIG.hauler.capacity,
      deliverers: activeCount('deliverer') * teamMul(), deliverCapacity: CONFIG.deliverer.capacity,
      forkliftRate: forklift ? forklift.cfg.capacity * teamMul() / CONFIG.offline.secondsPerTripPerForklift : 0, plankStock: planks.stock,
      groundLogs: logs.count, maxGround: logs.max,
      treeCount: forest.trees.length, growSeconds: CONFIG.forest.growSeconds / forest.growthMultiplier,
      stumpSeconds: CONFIG.forest.stumpSeconds, logsPerTree: CONFIG.forest.logsPerTree,
      groundSpace: logs.free.length, yardStock: yard.stock, plankSpace: planks.space,
      cycleSeconds: debarker.built ? Math.max(sawmill.cycleSeconds * CONFIG.debarker.sawBonus, CONFIG.debarker.seconds) : sawmill.cycleSeconds, planksPerLog: sawmill.planksPerLog,
      kilnFeeder: kilnFeeder ? teamMul() : 0, feederCapacity: CONFIG.feeder.capacity,
      kilnBatch: kiln.batchSize, kilnSeconds: kiln.dryingSeconds,
    });
    // A floresta cresceu nesse tempo
    const grow = r.counted / CONFIG.forest.growSeconds * forest.growthMultiplier;
    for (const t of forest.trees) {
      if (t.stage === Stage.GROWING) { t.growth = Math.min(1, t.growth + grow); if (t.growth >= 1) t.stage = Stage.MATURE; }
      forest.dirty.add(t);
    }
    // Estado final: r.stumpsFinal tocos; parte das árvores replantadas ainda é muda
    const pick = (arr) => arr.splice(Math.floor(Math.random() * arr.length), 1)[0];
    let stumps = forest.trees.filter((t) => t.stage === Stage.STUMP);
    const standing = forest.trees.filter((t) => t.stage === Stage.MATURE || t.stage === Stage.GROWING);
    while (stumps.length < r.stumpsFinal && standing.length) { const t = pick(standing); t.stage = Stage.STUMP; t.growth = 0; stumps.push(t); }
    let recent = r.replantedRecently;
    while (stumps.length > r.stumpsFinal) {
      const t = pick(stumps);
      if (recent > 0) { recent--; t.stage = Stage.GROWING; t.growth = Math.random() * 0.8; }
      else { t.stage = Stage.MATURE; t.growth = 1; }
    }
    const mature = forest.trees.filter((t) => t.stage === Stage.MATURE);
    for (let i = 0; i < Math.min(recent, mature.length); i++) {
      const t = pick(mature); t.stage = Stage.GROWING; t.growth = Math.random() * 0.8;
    }
    forest.totalPlanted = (forest.totalPlanted || 0) + r.planted;
    // Toras no chão: estado final = antes + cortadas − levadas ao pátio
    const finalGround = Math.min(logs.max, logs.count + r.logsCut - r.hauled);
    if (finalGround < logs.count) logs.removeLogs(logs.count - finalGround);
    let missing = finalGround - logs.count;
    while (missing > 0) {
      const t = forest.trees[Math.floor(Math.random() * forest.trees.length)];
      const a = Math.random() * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
      missing -= logs.addPile(t.x + dx * 1.4, t.z + dz * 1.4, dx, dz, Math.min(CONFIG.forest.logsPerTree, missing)) || missing;
    }
    if (r.hauled) yard.add(r.hauled);
    if (r.stoneMined) stoneStack.add(r.stoneMined);
    forest.totalCut += r.treesCut;
    if (r.logsSawn) { yard.take(r.logsSawn); sawmill.logsProcessed += r.logsSawn; }
    if (kiln.built) r.dryMade += kiln.finishOffline();

    // Serra, estufa e entregas dividem o tempo em fatias, como no jogo aberto:
    // tábuas chegam aos poucos, a estufa seca o que passa da reserva e os caminhões
    // levam o produto que cada cliente pediu (se faltar, o caminhão espera).
    let P = planks.stock, D = kiln.dry ? kiln.dry.stock : 0;
    const capP = planks.capacity, capD = kiln.dry ? kiln.dry.capacity : 0;
    const N = Math.max(1, Math.min(240, Math.ceil(r.counted / 30)));
    const share = (tot, i) => Math.floor(tot * (i + 1) / N) - Math.floor(tot * i / N);
    const before = economy.money;
    let truckTime = 0;
    // Máquinas de produtos: terminam o que tinham; com abastecedor seguem produzindo
    const X = {};
    let Y = yard.stock;
    r.products = {}; r.deliveredOther = 0;
    const fed = [];
    for (const mm of machines) {
      if (!mm.m.built) continue;
      const made = mm.m.finishOffline();
      if (made) r.products[mm.m.def.product] = made;
      X[mm.m.def.product] = mm.m.out.stock;
      if (mm.feeder) fed.push({ D: mm.m.def, max: Math.floor(r.counted * teamMul() / mm.m.def.seconds) });
    }
    const RES = CONFIG.machineFeeder.reserve;
    const slots = docks.filter((d) => d.open).map((d) => d.orders);
    let si = 0;
    X.serragem = Math.min(sawdust.capacity, sawdust.stock + r.logsSawn * CONFIG.sawdust.perLog);
    for (let i = 0; i < N; i++) {
      P = Math.min(capP, P + share(r.planksMade, i));
      if (kiln.built && r.kilnPotential) {
        const n = Math.max(0, Math.min(share(r.kilnPotential, i), P - CONFIG.feeder.reserve, capD - D));
        P -= n; D += n; r.dryMade += n;
      }
      for (const { D: M, max } of fed) {
        const src = M.input === 'log' ? Y : M.input === 'plank' ? P : D;
        const n = Math.max(0, Math.min(share(max, i), Math.floor((src - RES[M.input]) / M.inputPer), M.outCap - X[M.product]));
        if (!n) continue;
        if (M.input === 'log') Y -= n * M.inputPer; else if (M.input === 'plank') P -= n * M.inputPer; else D -= n * M.inputPer;
        X[M.product] += n;
        r.products[M.product] = (r.products[M.product] || 0) + n;
      }
      let cap = share(r.deliverCap, i);
      truckTime += r.truckBudget / N;
      let tried = 0;
      while (cap > 0 && truckTime > 0 && slots.length) {
        const sl = slots[si % slots.length];
        if (!sl.current || sl.current.delivered >= sl.current.qty) sl.next();
        const prod = sl.current.product;
        const n = Math.min(cap, sl.remaining, prod === 'dry' ? D : prod === 'plank' ? P : (X[prod] || 0));
        if (n <= 0) { si++; if (++tried >= slots.length) break; continue; }
        tried = 0;
        for (let k = 0; k < n; k++) sl.deliverOne();
        if (prod === 'dry') { D -= n; r.deliveredDry += n; } else if (prod === 'plank') { P -= n; r.delivered += n; }
        else { X[prod] -= n; r.deliveredOther += n; }
        cap -= n;
        if (sl.remaining === 0) { r.orders++; truckTime -= CONFIG.offline.secondsPerTruck / slots.length; }
        si++;
      }
    }
    if (P < planks.stock) planks.take(planks.stock - P); else planks.add(P - planks.stock);
    if (Y < yard.stock) yard.take(yard.stock - Y);
    if (X.serragem < sawdust.stock) sawdust.take(sawdust.stock - X.serragem); else sawdust.add(X.serragem - sawdust.stock);
    for (const mm of machines) {
      if (!mm.m.built) continue;
      const v = X[mm.m.def.product], o = mm.m.out;
      if (v < o.stock) o.take(o.stock - v); else o.add(v - o.stock);
    }
    if (kiln.dry) { if (D < kiln.dry.stock) kiln.dry.take(kiln.dry.stock - D); else kiln.dry.add(D - kiln.dry.stock); }
    r.money = economy.money - before;
    return r;
  }

  const saver = new SaveManager(snapshot);
  const saved = saver.load();
  let offlineReport = null;
  if (saved) {
    try {
      restore(saved);
      const away = (Date.now() - (saved.savedAt || Date.now())) / 1000;
      if (away >= CONFIG.offline.minSecondsToReport) offlineReport = applyOffline(away);
    } catch (err) {
      console.error('Falha ao carregar o save', err);
    }
  }
  // Salva ao sair do app ou trocar de aba
  document.addEventListener('visibilitychange', () => { if (document.hidden) saver.save(); });
  window.addEventListener('pagehide', () => saver.save());

  // ---- Zoom da câmera ----
  if (typeof settings.zoom === 'number') { cam.setZoom(settings.zoom); cam.snap(); }
  const zoomIn = document.getElementById('zoom-in');
  const zoomOut = document.getElementById('zoom-out');
  const zoomFill = document.getElementById('zoom-fill');
  let saveTimer = 0;
  const refreshZoomUi = () => {
    zoomFill.style.height = Math.round((1 - cam.zoom01) * 100) + '%';
    zoomIn.disabled = cam.zoomTarget <= CONFIG.camera.zoomMin + 0.001;
    zoomOut.disabled = cam.zoomTarget >= CONFIG.camera.zoomMax - 0.001;
    engine.setViewDistance(cam.distance);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { settings.zoom = cam.zoomTarget; saveSettings(settings); }, 400);
  };
  cam.onZoomChange = refreshZoomUi;
  refreshZoomUi();
  const step = CONFIG.camera.zoomStep;
  zoomIn.addEventListener('click', () => { cam.zoomBy(step); refreshZoomUi(); });
  zoomOut.addEventListener('click', () => { cam.zoomBy(1 / step); refreshZoomUi(); });
  input.onPinch = (f) => cam.zoomBy(f);
  input.onWheel = (dy) => cam.zoomBy(dy > 0 ? 1 / 1.1 : 1.1);

  // ---- Tocar para andar ----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const P = world.bounds; // cresce quando um terreno é liberado
  // ---- Modo editar (mover / girar / excluir / adicionar) ----
  const editor = new Editor({
    engine, input, world, forest, quarry, decor, economy, player, particles,
    blocks: () => [...vehicleBlocks(), CONFIG.sawmill.operatorZone, { x: LT.garage.x, z: LT.garage.z, w: 4.8, d: 2.0 },
      ...loadPoints.filter((l) => l.visible).map((l) => l.zone)],
    onDone: () => saver.save(),
  });

  let lastTap = { t: 0, dock: null };
  input.onTap = (sx, sy) => {
    if (editor.on) { editor.tap(sx, sy); return; }
    // Toque duplo no caminhão do cliente: dispensa e chama outro
    {
      ndc.set((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
      ray.setFromCamera(ndc, engine.camera);
      if (ray.ray.intersectPlane(ground, hit)) {
        const d = docks.find((k) => k.hit(hit.x, hit.z));
        if (d) {
          const now = performance.now();
          if (lastTap.dock === d && now - lastTap.t < 450) {
            d.giveUp(); lastTap = { t: 0, dock: null };
            particles.burst(d.truck.group.position.x, 1.5, d.truck.group.position.z, 12, 2.5);
          } else {
            lastTap = { t: now, dock: d };
            hud.floatText('Toque de novo para dispensar', sx, sy - 30);
          }
          return;
        }
      }
      lastTap = { t: 0, dock: null };
    }
    ndc.set((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, engine.camera);
    if (!ray.ray.intersectPlane(ground, hit)) return;
    const m = CONFIG.player.radius + 0.6;
    const x = Math.min(P.maxX - m, Math.max(P.minX + m, hit.x));
    const z = Math.min(P.maxZ - m, Math.max(P.minZ + m, hit.z));
    // Tocou numa árvore? Vai até o lado dela (e corta ao chegar, se estiver adulta)
    let tx = x, tz = z;
    let best = null, bestD = 1.6 * 1.6;
    for (const tr of forest.trees) {
      if (tr.stage === Stage.FALLING) continue;
      const d = (tr.x - hit.x) ** 2 + (tr.z - hit.z) ** 2;
      if (d < bestD) { bestD = d; best = tr; }
    }
    if (!best && quarry.open) {
      const r = quarry.findRock(hit.x, hit.z, 1.8, true) || quarry.rocks.find((q) => (q.x - hit.x) ** 2 + (q.z - hit.z) ** 2 < 1.8 * 1.8);
      if (r) {
        let dx = player.position.x - r.x, dz = player.position.z - r.z;
        const dl = Math.hypot(dx, dz) || 1;
        tx = r.x + (dx / dl) * (1.0 * r.scale + 0.6); tz = r.z + (dz / dl) * (1.0 * r.scale + 0.6);
      }
    }
    if (best) {
      let dx = player.position.x - best.x, dz = player.position.z - best.z;
      const dl = Math.hypot(dx, dz) || 1;
      const off = best.stage === Stage.STUMP ? 0.9 : 1.1;
      tx = best.x + (dx / dl) * off; tz = best.z + (dz / dl) * off;
    }
    const dest = player.goTo(tx, tz);
    if (dest) marker.show(dest.x, dest.z);
  };
  player.onArrive = () => marker.hide();

  engine.onUpdate((dt, t) => {
    forest.update(dt);
    for (const w of workers) {
      if (w.resting) { updateResting(w, dt, t); continue; }
      // Dá passagem: se você está logo à frente no caminho, espera (depois de um tempo, desvia por você)
      if (blocksWay(w, w === forklift ? 1.9 : 1.15)) {
        w._yieldT = (w._yieldT || 0) + dt;
        if (w._yieldT < 2.5) { if (w.model && w.model.animate) w.model.animate(dt, 0, t); continue; }
      } else w._yieldT = 0;
      w.update(dt, t);
    }
    player.update(dt, input.vector(), t, work.chopT >= 0 ? work.chopT : work.mineT);
    work.update(dt, player.isIdle);
    // só quem está parado bloqueia você (ninguém em movimento te empurra)
    for (const w of workers) if ((!w.resting || w.resting.phase !== 'in') && !w.path && !(w.resting && w.resting.phase === 'go')) pushApart(player.position, w.position, w === forklift ? 1.2 : 0.8);
    if (logTruck) {
      // o caminhão para se você estiver na frente dele
      const ahead = logTruck.path && truckBlocked(logTruck);
      logTruck._yieldT = ahead ? (logTruck._yieldT || 0) + dt : 0;
      if (!ahead || logTruck._yieldT > 4) logTruck.update(dt);
      // não atravessa o caminhão: empurra o jogador para fora da carroceria
      const tp = logTruck.position, h = logTruck.heading;
      const fx = Math.cos(h), fz = -Math.sin(h);
      const rx = player.position.x - tp.x, rz = player.position.z - tp.z;
      const along = rx * fx + rz * fz, side = -rx * fz + rz * fx;
      if (Math.abs(along) < 2.6 && Math.abs(side) < 1.3) {
        const push = 1.3 - Math.abs(side);
        const sgn = side >= 0 ? 1 : -1;
        player.position.x += -fz * push * sgn;
        player.position.z += fx * push * sgn;
      }
    }

    // Serra: você opera ficando na área marcada em frente à máquina
    const atSaw = sawView.zone.contains(player.position.x, player.position.z);
    const operated = atSaw || !!sawOperator;
    debarker.update(dt);
    teamPanel.update(dt);
    dayNight.update(dt, player.position);
    coins.update(dt);
    funPark.update(dt);
    editor.update();
    {
      const prods = [];
      for (const mm of machines) {
        mm.m.update(dt);
        mm.view.update(dt, t, work.atMIn === mm, work.atMOut === mm);
        if (mm.m.built) prods.push([CONFIG.products[mm.m.def.product].label, mm.m.out.stock]);
      }
      hud.setProducts(prods);
    }
    quarry.update(dt);
    quarryView.update(t);
    {
      const on = true;   // o estoque de pedras existe desde o início
      if (on !== stoneStack.visible) { stoneStack.setVisible(on); hud.showStone(on); if (on) world.nav.rebuild(); }
      if (on) hud.setStone(stoneStack.stock, stoneStack.capacity);
    }
    debarkerView.update(dt);
    sawmill.update(dt, operated);
    sawView.update(dt, t, operated);
    if (sawOperator) sawOperator.working = sawmill.running;
    shop.update(dt, t, player.position.x, player.position.z);
    // Obra: o jogador deposita tábuas carregadas nas costas
    let siteMsg = '';
    const site = shop.active;
    const so = site && site.offer();
    if (so && !so.hidden && (so.planks || so.stone)) {
      const needP = shop.plankNeed(site), needS = shop.stoneNeed(site);
      const to = new THREE.Vector3(site.signAt.x, 1.0, site.signAt.z);
      if (needP > 0 && work.has('plank')) {
        site.pending++;
        if (work.giveTo('plank', to, () => { site.pending--; site.deposited++; })) particles.burst(site.zone.x, 0.4, site.zone.z, 2, 1.2);
        else site.pending--;
        siteMsg = 'Depositando tábuas na obra…';
      } else if (needS > 0 && work.has('stone')) {
        site.stonePending++;
        if (work.giveTo('stone', to, () => { site.stonePending--; site.stoneDep++; })) particles.burst(site.zone.x, 0.4, site.zone.z, 2, 1.2);
        else site.stonePending--;
        siteMsg = 'Depositando pedras na obra…';
      } else if (needP > 0 || needS > 0) {
        const want = [needP > 0 ? `${needP} tábuas` : '', needS > 0 ? `${needS} pedras` : ''].filter(Boolean).join(' e ');
        siteMsg = `A obra precisa de ${want} (traga nas costas)`;
        if (work.carrying && !work.has('plank') && !work.has('stone')) siteMsg += ' — o que você carrega não serve aqui';
      } else siteMsg = 'Material completo! Toque em CONSTRUIR';
    }
    if (atSaw && player.isIdle) player.faceTowards(CONFIG.sawmill.pos.x, CONFIG.sawmill.pos.z, dt);
    planks.update(dt);
    construction.update(dt);
    kiln.update(dt);
    kilnView.update(dt, t, work.atKilnIn, work.atDry);
    if (kiln.dry) { kiln.dry.update(dt); hud.setDry(kiln.dry.stock, kiln.dry.capacity); }
    _ordChk -= dt;
    if (_ordChk <= 0) { _ordChk = 1; for (const d of docks) d.checkOrder(); }
    for (const d of docks) d.update(dt, t, work.atDock === d);
    sawdust.update(dt);
    sawdustZone.setActive(work.atMOut && work.atMOut.m.out === sawdust && sawdust.stock > 0, t);
    plankZone.setActive(work.atPlanks && planks.stock > 0 && work.space > 0, t);
    hud.setOrders(docks);
    world.update(dt, t);
    forestView.update(dt, t, cam.focus);
    logs.update(dt);
    yard.update(dt);
    particles.update(dt);
    hud.setLogs(yard.stock);
    hud.setPlanks(planks.stock, planks.capacity);
    hud.setCarry(work.carrying, work.capacity, work.summary);
    trashZone.setActive(work.carrying > 0 && trashZone.contains(player.position.x, player.position.z), t);
    if (siteMsg) hud.setStatus(siteMsg, 'busy');
    else if (atSaw) {
      if (sawmill.running) hud.setStatus('Operando a serra…', 'busy');
      else hud.setStatus(sawmill.blocked || 'Serra pronta', 'idle');
    } else {
      hud.setStatus(work.hint, work.isChopping || work.isPlanting || work.isMining ? 'busy' : (work.carrying ? '' : 'idle'));
    }
    cam.update(dt);
    marker.update(dt);
    engine.focusShadow(player.position);
    hud.update(dt, engine);
    saver.update(dt);
  });
  engine.start();
  cam.snap();

  const menu = new Menu(saver, CONFIG);
  // ---- Modo teste (menu): dinheiro infinito / obras sem material — fica guardado neste aparelho ----
  const tMoney = document.getElementById('t-money'), tFree = document.getElementById('t-free');
  const applyTest = () => {
    hud.infinite = !!settings.testMoney;
    economy.setInfinite(!!settings.testMoney);
    shop.freeMaterials = !!settings.testFree;
    tMoney.checked = !!settings.testMoney; tFree.checked = !!settings.testFree;
    hud.setMoney(economy.money);
  };
  const tLow = document.getElementById('t-low');
  tLow.checked = !!settings.lowGfx;
  if (settings.lowGfx) engine.setLowQuality(true);
  tLow.addEventListener('change', () => { settings.lowGfx = tLow.checked; saveSettings(settings); engine.setLowQuality(tLow.checked); });
  tMoney.addEventListener('change', () => { settings.testMoney = tMoney.checked; saveSettings(settings); applyTest(); });
  tFree.addEventListener('change', () => { settings.testFree = tFree.checked; saveSettings(settings); applyTest(); });
  applyTest();
  if (offlineReport) menu.showAway(offlineReport, formatDuration, { miners: minerCount, lumberjacks: lumberjackCount, planters: planterCount, haulers: haulerCount, deliverers: delivererCount, operator: !!sawOperator, kiln: kiln.built, feeder: !!kilnFeeder });
  saver.save();
  document.getElementById('loading').hidden = true;

  window.__game = { funPark, funPanel, buildPark, dayNight, editor, decor, hireDeliverer, docks, sawdust, teamPanel, buildKiln, machines, buildMachine, hireMachineFeeder, quarry, stoneStack, hireMiner, debarker, buildDebarker, hireOperator, loadPoints, vnav, get logTruck() { return logTruck; }, get forklift() { return forklift; }, buyLogTruck, buyForklift, unlockLand, hireHauler, hirePlanter, wardrobe, customizer, kiln, kilnView, stocks, construction, saver, snapshot, applyOffline, shop, economy, orders, dock, engine, world, player, input, cam, forest, logs, yard, work, workers, hireLumberjack, sawmill, planks };
}

try {
  boot();
} catch (err) {
  const el = document.getElementById('loading');
  el.hidden = false;
  el.textContent = 'Erro ao iniciar: ' + (err && err.message ? err.message : err);
  console.error(err);
}
