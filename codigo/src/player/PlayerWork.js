import * as THREE from 'three';
import { softBox } from '../core/Clay.js';
import { CONFIG } from '../config.js';
import { Stage } from '../sim/Forest.js';
import { getTreeAssets } from '../world/TreeAssets.js';
import { makeSapling } from '../npc/Planter.js';

// Trabalho manual do dono:
// - Parado perto de uma árvore adulta → corta; de um toco → planta; de uma rocha → quebra pedra.
// - Passando por toras no chão → recolhe. Nas áreas marcadas: pega ou entrega cada coisa.
// As costas levam uma MISTURA de itens (toras, tábuas, pedras, produtos) até a capacidade da mochila.
// `items` guarda a ordem em que entraram: o último a entrar é o primeiro a sair.
const PLANK_HEX = new Proxy({}, { get: (_, k) => (CONFIG.products[k] || {}).color || 0xe2bd85 });
const UNIT = (k) => (k === 'log' ? 'toras' : k === 'stone' ? 'pedras' : k === 'dry' ? 'tábuas secas' : (CONFIG.products[k] || {}).unit || 'tábuas');
const SHORT = (k) => (k === 'log' ? 'toras' : k === 'stone' ? 'pedras' : k === 'plank' ? 'tábuas' : k === 'dry' ? 'secas' : (CONFIG.products[k] || {}).unit || k);
const ITEM_H = (k) => (k === 'log' ? 0.24 : k === 'stone' ? 0.2 : (CONFIG.products[k] && CONFIG.products[k].size ? Math.max(0.07, CONFIG.products[k].size[1] * 0.7) : 0.07));
const MAX_VISIBLE = 30;

export class PlayerWork {
  constructor(player, { forest, logs, yard, woodcutting, particles, planks, plankZone, docks, kilnRef }) {
    this.k = kilnRef || {};   // { kiln, view } — preenchido quando a estufa é construída
    this.player = player;
    this.forest = forest; this.logs = logs; this.yard = yard;
    this.wc = woodcutting; this.particles = particles;
    this.planks = planks; this.plankZone = plankZone; this.docks = docks;
    this.cfg = { ...CONFIG.player.work };
    this.items = [];      // tipos nas costas, em ordem

    this.tree = null;
    this.chopT = -1;
    this.hits = 0;
    this.waitingFall = false;
    this.plantTree = null;
    this.plantT = -1;     // 0..1 enquanto planta
    this.mineRock = null;
    this.mineT = -1;      // fase da picaretada (-1 = parado)
    this.quarry = null;   // pedreira e estoque de pedras (main preenche)
    this.stone = null;
    this.trash = null;    // caçamba de descarte (main preenche)
    this._pickT = 0;
    this._dropT = 0;
    this.hint = '';

    const A = getTreeAssets();
    const geo = A.logGeo.clone();
    geo.scale(0.62, 0.8, 0.8);
    this.logGeo = geo;
    this.logMat = A.trunkMat;
    this.plankGeo = softBox(0.85, 0.06, 0.2);
    this.stoneGeo = new THREE.DodecahedronGeometry(0.15, 1);
    this.stoneMat = new THREE.MeshLambertMaterial({ color: 0x9a9a94, flatShading: false });
    this.prodMats = {};
    // Pilha nas costas: uma malha por posição (troca forma/cor conforme o item)
    this.backStack = new THREE.Group();
    this.backStack.position.set(0, 0.85, -0.38);
    this.slots = [];
    for (let i = 0; i < MAX_VISIBLE; i++) {
      const m = new THREE.Mesh(geo, A.trunkMat);
      m.castShadow = true; m.visible = false;
      this.backStack.add(m); this.slots.push(m);
    }
    player.model.body.add(this.backStack);
    this.sapling = makeSapling();
    this.sapling.position.set(0, -0.62, 0.12);
    this.sapling.visible = false;
    player.model.armL.add(this.sapling);

    // Itens voando (pilha → costas, costas → pátio/caminhão)
    this.flyers = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(geo, A.trunkMat);
      m.visible = false;
      player.object.parent.add(m);
      this.flyers.push({ m, t: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), done: null });
    }
    this._v = new THREE.Vector3();
    this.inFlight = {};       // destino → quantos itens voando até lá
    this.loadPoints = [];   // pontos de carga do caminhão de toras (main preenche)
    this.machines = [];     // máquinas de produtos [{ m, view }] (main preenche)
    this.stocks = {};       // produto → { stack, zone } (main preenche)
  }

  // ---- mochila ----
  get carrying() { return this.items.length; }
  get carryType() { return this.items.length ? this.items[this.items.length - 1] : null; }
  get capacity() { return this.cfg.bagCapacity; }
  get space() { return this.cfg.bagCapacity - this.items.length; }
  count(type) { let n = 0; for (const t of this.items) if (t === type) n++; return n; }
  has(type) { return this.items.includes(type); }
  get summary() {
    const c = {};
    for (const t of this.items) c[t] = (c[t] || 0) + 1;
    return Object.entries(c).map(([k, n]) => `${n} ${SHORT(k)}`).join(' · ');
  }
  get _anyProduct() { return this.items.some((t) => CONFIG.products[t]); }

  // Mochila maior
  setBag(n) { this.cfg.bagCapacity = n; this._refreshBack(); }

  // Coloca/carrega a mochila salva (lista de tipos)
  loadItems(list) { this.items = list.slice(0, this.capacity); this._refreshBack(); }

  _fl(key, d) { this.inFlight[key] = (this.inFlight[key] || 0) + d; }
  _flying(key) { return this.inFlight[key] || 0; }

  // Entrega 1 item das costas para um ponto (ex.: obra). Devolve true se entregou.
  giveTo(type, to, onLand) {
    if (!this.has(type) || this._dropT > 0) return false;
    this._dropT = this.cfg.depositInterval;
    this._send(type, to, 'site', onLand);
    return true;
  }

  get isChopping() { return this.chopT >= 0 || this.waitingFall; }

  // Tira o último item desse tipo das costas e manda voando até `to`
  _send(type, to, key, onLand) {
    const from = this._backPoint();
    const i = this.items.lastIndexOf(type);
    if (i < 0) return false;
    this.items.splice(i, 1);
    this._refreshBack();
    this._fl(key, 1);
    this._fly(from, to, () => { this._fl(key, -1); onLand(); }, type);
    return true;
  }

  // Põe um item nas costas, vindo de `from`
  _take(type, from) {
    this.items.push(type);
    this._fly(from, this._backPoint(), () => this._refreshBack(), type);
  }

  _matFor(type) {
    if (type === 'log') return this.logMat;
    if (type === 'stone') return this.stoneMat;
    if (!this.prodMats[type]) this.prodMats[type] = new THREE.MeshLambertMaterial({ color: PLANK_HEX[type], flatShading: false });
    return this.prodMats[type];
  }
  _geoFor(type) { return type === 'log' ? this.logGeo : type === 'stone' ? this.stoneGeo : this.plankGeo; }

  _fly(from, to, done, type = 'log') {
    const f = this.flyers.find((x) => x.t >= 1);
    if (!f) { if (done) done(); return; }
    f.m.geometry = this._geoFor(type);
    f.m.material = this._matFor(type);
    f.from.copy(from); f.to.copy(to); f.t = 0; f.done = done;
    f.m.visible = true;
  }

  _refreshBack() {
    // pilha única: cada item ocupa a altura do seu tipo; se ficar alta demais, "achata"
    let y = 0;
    const n = Math.min(this.items.length, MAX_VISIBLE);
    for (let i = 0; i < MAX_VISIBLE; i++) {
      const m = this.slots[i];
      if (i >= n) { m.visible = false; continue; }
      const t = this.items[i];
      m.geometry = this._geoFor(t); m.material = this._matFor(t);
      const h = ITEM_H(t);
      m.position.set(t === 'stone' ? ((i % 2) - 0.5) * 0.12 : 0, y + h / 2, 0);
      m.rotation.y = t === 'log' ? 0 : 0;
      m.visible = true;
      y += h;
    }
    this._stackH = y;
    this.backStack.scale.y = y > 1.8 ? 1.8 / y : 1;
  }

  _backPoint() {
    return new THREE.Vector3(this.player.position.x, 1.2 + Math.min(1.8, this._stackH || 0), this.player.position.z);
  }

  _cancelChop() {
    if (this.tree && !this.waitingFall) this.forest.release(this.tree);
    if (!this.waitingFall) this.tree = null;
    this.chopT = -1;
    this.hits = 0;
  }

  // Árvore adulta livre mais próxima ao alcance
  _treeInReach() {
    const p = this.player.position;
    let best = null, bestD = this.cfg.reach * this.cfg.reach;
    for (const t of this.forest.trees) {
      if (t.stage !== Stage.MATURE || t.reserved) continue;
      const d = (t.x - p.x) ** 2 + (t.z - p.z) ** 2;
      if (d <= bestD) { bestD = d; best = t; }
    }
    return best;
  }

  // Toco livre mais próximo ao alcance
  _stumpInReach() {
    const p = this.player.position;
    let best = null, bestD = this.cfg.reach * this.cfg.reach;
    for (const t of this.forest.trees) {
      if (t.stage !== Stage.STUMP || t.reserved) continue;
      const d = (t.x - p.x) ** 2 + (t.z - p.z) ** 2;
      if (d <= bestD) { bestD = d; best = t; }
    }
    return best;
  }

  _cancelPlant() {
    if (this.plantTree) this.forest.release(this.plantTree);
    this.plantTree = null; this.plantT = -1;
  }

  get isPlanting() { return this.plantT >= 0; }
  get isMining() { return this.mineT >= 0; }
  _cancelMine() { this.mineRock = null; this.mineT = -1; }

  // Devolve a fase do golpe (-1 quando não está cortando) para a animação
  update(dt, idle) {
    const p = this.player.position;
    this.hint = '';

    // ---- Corte ----
    if (!idle && this.chopT >= 0) this._cancelChop();
    if (idle && this.chopT < 0 && !this.waitingFall) {
      const t = this._treeInReach();
      if (t) {
        this.tree = t; this.forest.reserve(t);
        this.chopT = 0; this.hits = 0;
      }
    }
    if (this.chopT >= 0 && this.tree) {
      const t = this.tree;
      this.player.faceTowards(t.x, t.z, dt);
      const prev = this.chopT;
      this.chopT += dt / this.cfg.hitInterval;
      if (prev < 0.75 && this.chopT >= 0.75) { this.hits++; this.wc.hit(t, p.x, p.z); }
      if (this.chopT >= 1) {
        this.chopT = 0;
        if (this.hits >= this.cfg.chopHits) {
          this.chopT = -1;
          this.waitingFall = true;
          this.wc.fell(t, p.x, p.z, () => { this.waitingFall = false; this.tree = null; });
        }
      }
      this.hint = 'Cortando…';
    }

    // ---- Plantar muda num toco (parado ao lado dele) ----
    if (!idle && this.plantT >= 0) this._cancelPlant();
    if (idle && this.plantT < 0 && this.chopT < 0 && !this.waitingFall) {
      const t = this._stumpInReach();
      if (t) { this.plantTree = t; this.forest.reserve(t); this.plantT = 0; }
    }
    if (this.plantT >= 0) {
      const t = this.plantTree;
      const far = (t.x - p.x) ** 2 + (t.z - p.z) ** 2 > (this.cfg.reach * 1.4) ** 2;
      if (t.stage !== Stage.STUMP || far) this._cancelPlant();
      else {
        this.player.faceTowards(t.x, t.z, dt);
        this.plantT += dt / this.cfg.plantSeconds;
        this.hint = 'Plantando muda…';
        if (this.plantT >= 1) {
          this.forest.plant(t);
          this.particles.burst(t.x, 0.2, t.z, 6, 1.0);
          this.plantTree = null; this.plantT = -1;
        }
      }
    }
    this.sapling.visible = this.plantT >= 0;
    this.player.model.planting = this.plantT;

    // ---- Pedreira: parado ao lado de uma rocha → quebra pedra (vai direto para as costas) ----
    const Q = this.quarry;
    if (!idle && this.mineT >= 0) this._cancelMine();
    if (idle && Q && Q.open && this.mineT < 0 && this.chopT < 0 && this.plantT < 0 && !this.waitingFall && this.space > 0) {
      const r = Q.findRock(p.x, p.z, CONFIG.quarry.reach, true);
      if (r) { this.mineRock = r; this.mineT = 0; }
    }
    if (this.mineT >= 0) {
      const r = this.mineRock;
      const far = (r.x - p.x) ** 2 + (r.z - p.z) ** 2 > (CONFIG.quarry.reach * 1.3) ** 2;
      if (r.removed || r.stone <= 0 || far || this.space <= 0) this._cancelMine();
      else {
        this.player.faceTowards(r.x, r.z, dt);
        const prev = this.mineT;
        this.mineT += dt / this.cfg.mineInterval;
        if (prev < 0.75 && this.mineT >= 0.75 && Q.mine(r)) {
          this.particles.burst(p.x + (r.x - p.x) * 0.5, 0.7, p.z + (r.z - p.z) * 0.5, 4, 1.4);
          this._take('stone', new THREE.Vector3(r.x, 0.9, r.z));
        }
        if (this.mineT >= 1) this.mineT = 0;
        this.hint = 'Quebrando pedra…';
      }
    }
    this.player.model.showTool(this.chopT >= 0 || this.mineT >= 0, this.mineT >= 0 ? 'pick' : 'axe');

    this._pickT -= dt;
    this._dropT -= dt;
    const canPick = this._pickT <= 0 && this.space > 0;
    const canDrop = this._dropT <= 0;
    const V = () => new THREE.Vector3();

    // ---- Recolher toras do chão ----
    if (canPick) {
      const from = this.logs.takeNearest(p.x, p.z, this.cfg.pickupRadius);
      if (from) { this._pickT = this.cfg.pickupInterval; this._take('log', new THREE.Vector3(from.x, from.y, from.z)); }
    }

    // ---- Caçamba de descarte: joga fora tudo que está nas costas ----
    const atTrash = !!(this.trash && this.trash.zone.contains(p.x, p.z));
    if (atTrash && this.carrying > 0 && canDrop) {
      this._dropT = this.cfg.depositInterval * 0.7;
      this._send(this.carryType, this.trash.point, 'trash', () => this.particles.burst(this.trash.point.x, 1.0, this.trash.point.z, 2, 1.0));
    }

    // ---- Depósito de tábuas: pegar ----
    const atPlanks = this.plankZone.contains(p.x, p.z);
    if (atPlanks && canPick && this._pickT <= 0 && this.planks.stock > 0) {
      this._pickT = this.cfg.pickupInterval;
      const from = this.planks.slotPosition(this.planks.stock - 1, V());
      this.planks.take(1);
      this._take('plank', from);
    }

    // ---- Estufa: colocar tábuas comuns / pegar tábuas secas ----
    const kv = this.k.view, kiln = this.k.kiln;
    const built = !!(kiln && kiln.built && kv && kv.inZone);
    const atKilnIn = built && kv.inZone.contains(p.x, p.z);
    const atDry = built && kv.dryZone.contains(p.x, p.z);
    if (atKilnIn && this.has('plank') && this._dropT <= 0 && kiln.space - this._flying('kiln') > 0) {
      this._dropT = this.cfg.depositInterval;
      this._send('plank', kv.doorPoint, 'kiln', () => { if (!kiln.addInput(1)) this.planks.add(1); });
    }
    if (atDry && this._pickT <= 0 && this.space > 0 && kiln.dry.stock > 0) {
      this._pickT = this.cfg.pickupInterval;
      const from = kiln.dry.slotPosition(kiln.dry.stock - 1, V());
      kiln.dry.take(1);
      this._take('dry', from);
    }

    // ---- Máquinas de produtos: levar insumo / pegar produto pronto ----
    let atMIn = null, atMOut = null;
    for (const mm of this.machines) {
      if (!mm.m.built) continue;
      if (mm.view.inZone.contains(p.x, p.z)) atMIn = mm;
      else if (mm.view.outZone.contains(p.x, p.z)) atMOut = mm;
    }
    if (atMIn && this.has(atMIn.m.def.input) && this._dropT <= 0 && atMIn.m.space - this._flying('m-' + atMIn.m.id) > 0) {
      this._dropT = this.cfg.depositInterval;
      const type = atMIn.m.def.input, mm = atMIn;
      this._send(type, mm.view.doorPoint, 'm-' + mm.m.id, () => {
        if (!mm.m.addInput(1)) { const st = type === 'log' ? this.yard : (this.stocks[type] && this.stocks[type].stack); if (st) st.add(1); }
      });
    }
    if (atMOut && this._pickT <= 0 && this.space > 0 && atMOut.m.out.stock > 0) {
      const prodId = atMOut.m.def.product, out = atMOut.m.out;
      this._pickT = this.cfg.pickupInterval;
      const from = out.slotPosition(out.stock - 1, V());
      out.take(1);
      this._take(prodId, from);
    }

    // ---- Entregar no caminhão (o que o cliente daquela vaga pediu) ----
    const dock = this.docks.find((d) => d.open && d.zone.contains(p.x, p.z)) || null;
    const atDock = !!dock;
    const want = dock && dock.orders.current && dock.orders.current.product;
    const dockKey = dock ? 'dock-' + dock.index : '';
    if (atDock && want && this.has(want) && this._dropT <= 0 && dock.accepts(want) && this._flying(dockKey) < dock.orders.remaining) {
      this._dropT = this.cfg.depositInterval * 1.5;
      const back = (this.stocks[want] && this.stocks[want].stack) || this.planks;
      const dk = dock, prod = want;
      // se outro entregador completar antes, o item volta ao estoque
      this._send(prod, dk.nextCargoPoint(), dockKey, () => { if (!dk.receive(prod)) back.add(1); });
    }

    // ---- Descarregar toras no pátio ----
    const inZone = this.yard.inDropZone(p.x, p.z);
    if (inZone && this.has('log') && this._dropT <= 0) {
      this._dropT = this.cfg.depositInterval;
      const slot = this.yard.stock + this._flying('yard');
      const to = this.yard.slotPosition(Math.min(slot, this.yard.visibleMax - 1), V());
      this._send('log', to, 'yard', () => this.yard.add(1));
    }
    // ---- Descarregar num ponto de carga do caminhão ----
    let atLP = null;
    for (const lp of this.loadPoints) if (lp.contains(p.x, p.z)) { atLP = lp; break; }
    if (atLP && this.has('log') && this._dropT <= 0 && atLP.space - this._flying('lp-' + atLP.id) > 0) {
      this._dropT = this.cfg.depositInterval;
      const lp = atLP;
      const to = lp.slotPosition(lp.stock + this._flying('lp-' + lp.id), V());
      this._send('log', to, 'lp-' + lp.id, () => { if (!lp.add(1)) this.yard.add(1); });
    }
    // ---- Entregar pedras no estoque de pedras ----
    const atStone = !!(this.stone && this.stone.contains(p.x, p.z));
    if (atStone && this.has('stone') && this._dropT <= 0 && this.stone.space - this._flying('stone') > 0) {
      this._dropT = this.cfg.depositInterval;
      const to = this.stone.slotPosition(this.stone.stock + this._flying('stone'), V());
      this._send('stone', to, 'stone', () => this.stone.add(1));
    }
    // ---- Pegar pedras do estoque (para levar às obras) ----
    const atStonePick = !!(this.stone && this.stone.inPickup(p.x, p.z));
    if (atStonePick && this._pickT <= 0 && this.space > 0 && this.stone.stock > 0) {
      this._pickT = this.cfg.pickupInterval;
      const from = this.stone.slotPosition(this.stone.stock - 1, V());
      this.stone.take(1);
      this._take('stone', from);
    }

    // ---- Dicas no painel ----
    if (!this.hint) {
      const full = this.space <= 0;
      if (atTrash) this.hint = this.carrying ? 'Jogando fora o que está nas costas…' : 'Caçamba de descarte: entre aqui para esvaziar as costas';
      else if (atStonePick) this.hint = !this.stone.stock ? 'Estoque de pedras vazio' : full ? 'Costas cheias' : 'Pegando pedras… leve até a obra';
      else if (atStone) this.hint = this.has('stone') ? (this.stone.space > 0 ? 'Guardando pedras…' : 'Estoque de pedras cheio') : `Estoque de pedras: ${this.stone.stock}/${this.stone.capacity}`;
      else if (inZone && this.has('log')) this.hint = 'Descarregando toras no pátio…';
      else if (atLP) this.hint = this.has('log') ? (atLP.space > 0 ? 'Deixando toras para o caminhão…' : 'Ponto de carga cheio: espere o caminhão') : `Ponto de carga: ${atLP.stock}/${atLP.capacity} toras`;
      else if (atDock) {
        if (want && this.has(want) && dock.accepts(want)) this.hint = 'Entregando ao cliente…';
        else if (dock.canReceive) {
          const WHERE = { plank: 'no depósito de tábuas', dry: 'ao lado da estufa', serragem: 'nos sacos atrás da serra' };
          const where = WHERE[want] || 'na saída da máquina';
          this.hint = `Este cliente quer ${(CONFIG.products[want] || {}).label || 'outro produto'}: pegue ${where} (ou toque 2x no caminhão para trocar de cliente)`;
        }
        else this.hint = dock.statusText || 'Aguarde o caminhão';
      }
      else if (atMIn) {
        const D = atMIn.m.def;
        if (this.has(D.input)) this.hint = atMIn.m.space > 0 ? `Abastecendo: ${D.name}…` : `${D.name} cheia: espere`;
        else this.hint = `${D.name}: traga ${UNIT(D.input)} (${atMIn.m.input}/${D.inputCap})`;
      }
      else if (atMOut) {
        const D = atMOut.m.def;
        if (!atMOut.m.out.stock) this.hint = `Nenhum(a) ${UNIT(D.product)} pronto(a) ainda`;
        else this.hint = full ? 'Costas cheias' : `Pegando ${UNIT(D.product)}…`;
      }
      else if (atKilnIn) this.hint = this.has('plank') ? (kiln.space > 0 ? 'Colocando tábuas na estufa…' : 'Estufa cheia: espere secar') : 'Traga tábuas comuns para secar';
      else if (atDry) this.hint = kiln.dry.stock === 0 ? 'Nenhuma tábua seca pronta ainda' : full ? 'Costas cheias' : 'Pegando tábuas secas…';
      else if (atPlanks) this.hint = this.planks.stock === 0 ? 'Sem tábuas: opere a serra primeiro' : full ? 'Costas cheias' : 'Pegando tábuas…';
      else if (full) this.hint = `Costas cheias (${this.carrying}/${this.capacity}): entregue ou jogue na caçamba`;
      else if (this.waitingFall) this.hint = 'Madeiraaa!';
      else if (this.carrying > 0) this.hint = `Nas costas: ${this.summary}`;
      else if (Q && Q.open && p.x > 44) this.hint = 'Pare ao lado de uma rocha para quebrar pedra';
      else if (!this.forest.matureCount && this.forest.count(Stage.STUMP)) this.hint = 'Pare ao lado de um toco para plantar uma muda';
      else this.hint = 'Pare ao lado de uma árvore adulta para cortar';
    }
    this.atKilnIn = atKilnIn;
    this.atDry = atDry;
    this.atDock = dock;
    this.atPlanks = atPlanks;
    this.atMIn = atMIn; this.atMOut = atMOut;

    // ---- Animação das toras voando ----
    for (const f of this.flyers) {
      if (f.t >= 1) continue;
      f.t = Math.min(1, f.t + dt * 4.5);
      const k = f.t;
      f.m.position.lerpVectors(f.from, f.to, k);
      f.m.position.y += Math.sin(k * Math.PI) * 0.9;
      f.m.rotation.y = k * 3;
      if (k >= 1) { f.m.visible = false; if (f.done) { const d = f.done; f.done = null; d(); } }
    }

    return this.chopT;
  }
}
