import * as THREE from 'three';
import { softBox } from '../core/Clay.js';
import { CONFIG } from '../config.js';
import { CharacterModel } from '../player/CharacterModel.js';
import { PLANK_COLOR } from '../world/PlankStack.js';

// Entregador: pega o produto que o cliente pediu (tábuas comuns ou secas) e coloca no caminhão.
// PENSAR → ANDAR ao estoque certo → CARREGAR → ANDAR à entrega → ENTREGAR
// Se o próximo cliente pedir outro produto, devolve o que sobrou ao estoque.
const S = { THINK: 0, TO_STOCK: 1, LOAD: 2, TO_DOCK: 3, UNLOAD: 4, RETURN: 5, PUTBACK: 6 };

export class Deliverer {
  static all = [];   // todos os entregadores/empilhadeiras (para dividir os pedidos entre eles)

  // stocks = { plank: {stack, zone}, dry: {stack, zone} | null }  (objeto compartilhado, a estufa preenche depois)
  // docks = lista compartilhada das vagas de carga (cada uma com seu cliente)
  constructor(scene, { nav, stocks, docks }, spawn) {
    this.cfg = CONFIG.deliverer;
    this.nav = nav; this.stocks = stocks; this.docks = docks;
    this.dock = docks[0];   // vaga escolhida agora
    this.plan = 0;          // quantas unidades pretende levar nesta viagem
    Deliverer.all.push(this);

    this.model = new CharacterModel(this.cfg.appearance, { headwear: 'cap' });
    this.object = this.model.group;
    this.position = this.object.position;
    this.position.set(spawn.x, 0, spawn.z);
    scene.add(this.object);

    const geo = softBox(0.85, 0.06, 0.2);
    this.backMat = new THREE.MeshLambertMaterial({ color: PLANK_COLOR, flatShading: false });
    this.back = new THREE.Group();
    this.back.position.set(0, 0.85, -0.36);
    this.backPlanks = [];
    for (let i = 0; i < this.cfg.capacity; i++) {
      const m = new THREE.Mesh(geo, this.backMat);
      m.position.y = i * 0.07; m.castShadow = true; m.visible = false;
      this.back.add(m); this.backPlanks.push(m);
    }
    this.model.body.add(this.back);

    this.state = S.THINK;
    this.timer = 0.3;
    this.path = null; this.pathIndex = 0;
    this.carrying = 0;
    this.carryType = 'plank';
    this.target = 'plank';
    this.heading = 0;
    this.speedNow = 0;
    this.speedMul = 1; // treinamento da equipe
  }

  get status() {
    if (this.state === S.UNLOAD && !this.dock.canReceive) return 'Esperando o caminhão';
    if (this.state === S.THINK && this.timer > 0.5 && !this.carrying) return 'Sem estoque para os pedidos';
    return ['Pensando', 'Indo ao depósito', 'Pegando tábuas', 'Levando ao caminhão', 'Entregando', 'Devolvendo ao estoque', 'Devolvendo'][this.state];
  }

  _refresh() {
    this.backMat.color.setHex((CONFIG.products[this.carryType] || {}).color || PLANK_COLOR);
    this.backPlanks.forEach((m, i) => { m.visible = i < this.carrying; });
  }

  _goTo(zone, next) {
    const tx = zone.x + (Math.random() - 0.5) * (zone.w - 0.7);
    const tz = zone.z + (Math.random() - 0.5) * (zone.d - 0.5);
    const path = this.nav.findPath(this.position.x, this.position.z, tx, tz);
    if (!path) { this.timer = 1; this.state = S.THINK; return; }
    this.path = path; this.pathIndex = 0;
    this.state = next;
  }

  _walk(dt) {
    const wp = this.path[this.pathIndex];
    const dx = wp.x - this.position.x, dz = wp.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    const step = this.cfg.speed * this.speedMul * dt;
    if (dist <= step + 0.02) {
      this.position.x = wp.x; this.position.z = wp.z;
      this.pathIndex++;
      if (this.pathIndex >= this.path.length) { this.path = null; return true; }
      return false;
    }
    this.position.x += (dx / dist) * step;
    this.position.z += (dz / dist) * step;
    const target = Math.atan2(dx, dz);
    const diff = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
    this.heading += diff * (1 - Math.exp(-10 * dt));
    this.object.rotation.y = this.heading;
    return false;
  }

  _stock(type) { return this.stocks[type] || null; }

  // Vaga aberta cujo cliente quer este produto (a mais perto)
  _dockFor(product) {
    let best = null, bestD = Infinity;
    for (const d of this.docks) {
      if (!d.open || d.wantedProduct !== product) continue;
      const dd = (d.zoneRect.x - this.position.x) ** 2;
      if (dd < bestD) { bestD = dd; best = d; }
    }
    return best;
  }

  // Quanto dos pedidos deste produto ainda não tem ninguém levando
  _need(product) {
    let n = 0;
    for (const d of this.docks) if (d.open && d.wantedProduct === product) n += d.orders.remaining;
    for (const o of Deliverer.all) {
      if (o === this || !o.object.parent) continue;
      if (o.carrying > 0 && o.carryType === product) n -= Math.max(o.carrying, o.plan);
      else if (o.carrying === 0 && o.target === product && (o.state === S.TO_STOCK || o.state === S.LOAD)) n -= o.plan;
    }
    return n;
  }

  // O pedido com mais falta que tenha estoque para pegar
  _pickTarget() {
    let best = null, bestNeed = 0;
    const seen = new Set();
    for (const d of this.docks) {
      const w = d.open && d.wantedProduct;
      if (!w || seen.has(w) || !this._stock(w)) continue;
      seen.add(w);
      if (this._stock(w).stack.stock <= 0) continue;
      const need = this._need(w);
      if (need > bestNeed) { bestNeed = need; best = w; }
    }
    if (best) this.plan = Math.min(this.cfg.capacity, bestNeed);
    return best;
  }

  get _anyWanted() { return this.docks.some((d) => d.open && d.wantedProduct); }

  update(dt, time) {
    let moving = false;
    switch (this.state) {
      case S.THINK: {
        this.timer -= dt;
        if (this.timer > 0) break;
        if (this.carrying > 0) {
          const d = this._dockFor(this.carryType);
          if (d) { this.dock = d; this._goTo(d.zoneRect, S.TO_DOCK); }
          // nenhum cliente quer o que está carregando: devolve ao estoque
          else if (this._anyWanted) this._goTo(this._stock(this.carryType).zone, S.RETURN);
          else this.timer = 0.8;
          break;
        }
        const want = this._pickTarget();
        if (!want) { this.timer = 0.8; break; }
        this.target = want;
        this._goTo(this._stock(want).zone, S.TO_STOCK);
        break;
      }

      case S.TO_STOCK:
        moving = true;
        if (this._walk(dt)) { this.state = S.LOAD; this.timer = 0; }
        break;

      case S.LOAD: {
        this.timer -= dt;
        if (this.timer > 0) break;
        // nenhum cliente quer mais este produto e ainda está de mãos vazias: repensa
        const wanted = this._dockFor(this.target);
        if (!this.carrying && !wanted) { this.state = S.THINK; this.timer = 0; break; }
        const st = this._stock(this.target);
        if (this.carrying < Math.min(this.cfg.capacity, Math.max(1, this.plan)) && st && st.stack.take(1)) {
          this.carryType = this.target;
          this.carrying++; this._refresh(); this.timer = this.cfg.loadInterval;
        } else if (this.carrying > 0) {
          this.state = S.THINK; this.timer = 0;   // escolhe a vaga certa
        } else {
          this.state = S.THINK; this.timer = 0.8; // acabou o estoque: escolhe outro pedido (ou espera)
        }
        break;
      }

      case S.TO_DOCK:
        moving = true;
        if (this._walk(dt)) { this.state = S.UNLOAD; this.timer = 0.2; }
        break;

      case S.UNLOAD: {
        this.timer -= dt;
        if (this.timer > 0) break;
        if (this.carrying > 0 && this.dock.accepts(this.carryType)) {
          if (this.dock.receive(this.carryType)) { this.carrying--; this._refresh(); }
          this.timer = this.cfg.unloadInterval;
        } else if (this.carrying === 0) {
          this.state = S.THINK; this.timer = 0.2;
        } else if (!this.dock.accepts(this.carryType) && this._dockFor(this.carryType) !== this.dock) {
          this.state = S.THINK; this.timer = 0; // este cliente já foi/quer outro: procura outra vaga
        } else {
          this.timer = 0.3; // aguarda o próximo caminhão
        }
        break;
      }

      case S.RETURN:
        moving = true;
        if (this._walk(dt)) { this.state = S.PUTBACK; this.timer = 0; }
        break;

      case S.PUTBACK:
        this.timer -= dt;
        if (this.timer > 0) break;
        if (this.carrying > 0) {
          this._stock(this.carryType).stack.add(1);
          this.carrying--; this._refresh(); this.timer = this.cfg.loadInterval;
        } else { this.state = S.THINK; this.timer = 0; }
        break;
    }
    // Ao entregar, vira para o caminhão (sul)
    if (this.state === S.UNLOAD) {
      const diff = Math.atan2(Math.sin(0 - this.heading), Math.cos(0 - this.heading));
      this.heading += diff * (1 - Math.exp(-8 * dt));
      this.object.rotation.y = this.heading;
    }
    this.speedNow += ((moving ? 1 : 0) - this.speedNow) * (1 - Math.exp(-10 * dt));
    this.model.animate(dt, this.speedNow * Math.min(1.4, (this.cfg.speed * this.speedMul) / CONFIG.player.speed), time);
  }
}
