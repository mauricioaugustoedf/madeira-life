import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { CharacterModel } from '../player/CharacterModel.js';
import { getTreeAssets } from '../world/TreeAssets.js';

// Carregador: recolhe toras do chão e leva até o pátio (versão automática do que você faz à mão).
// PENSAR → ANDAR até a pilha → PEGAR → (outra pilha, se couber) → ANDAR até o pátio → DESCARREGAR → PENSAR
const S = { THINK: 0, TO_PILE: 1, PICK: 2, TO_YARD: 3, DROP: 4, REST: 5 };

export class Hauler {
  constructor(scene, { nav, logs, yard, loadPoints = [] }, spawn) {
    this.cfg = CONFIG.hauler;
    this.nav = nav; this.logs = logs; this.yard = yard;
    this.loadPoints = loadPoints;   // pontos de carga do caminhão de toras (quando existir)
    this.dest = yard;

    this.model = new CharacterModel(this.cfg.appearance, { headwear: 'helmet' });
    this.object = this.model.group;
    this.position = this.object.position;
    this.position.set(spawn.x, 0, spawn.z);
    scene.add(this.object);

    // Toras nas costas
    const A = getTreeAssets();
    const geo = A.logGeo.clone();
    geo.scale(0.62, 0.8, 0.8);
    this.back = new THREE.Group();
    this.back.position.set(0, 1.0, -0.38);
    this.backLogs = [];
    for (let i = 0; i < this.cfg.capacity; i++) {
      const m = new THREE.Mesh(geo, A.trunkMat);
      m.position.y = i * 0.25; m.castShadow = true; m.visible = false;
      this.back.add(m); this.backLogs.push(m);
    }
    this.model.body.add(this.back);

    this.state = S.THINK;
    this.timer = 0.4;
    this.path = null; this.pathIndex = 0;
    this.pile = null;
    this.carrying = 0;
    this.heading = 0;
    this.speedNow = 0;
    this.speedMul = 1; // treinamento da equipe
  }

  get status() {
    return ['Procurando toras', 'Indo buscar toras', 'Pegando toras', 'Levando as toras', 'Descarregando', 'Sem toras no chão'][this.state];
  }

  _refreshBack() { this.backLogs.forEach((m, i) => { m.visible = i < this.carrying; }); }

  _release() { if (this.pile) { this.pile.reserved = false; this.pile = null; } }

  _goPile() {
    const p = this.logs.nearestPile(this.position.x, this.position.z);
    if (!p) return false;
    const path = this.nav.findPath(this.position.x, this.position.z, p.x, p.z);
    if (!path) return false;
    p.reserved = true;
    this.pile = p;
    this.path = path; this.pathIndex = 0;
    this.state = S.TO_PILE;
    return true;
  }

  // Destino mais perto: o pátio ou um ponto de carga do caminhão com espaço
  _goYard() {
    let best = this.yard, bestD = (this.yard.drop.x - this.position.x) ** 2 + (this.yard.drop.z - this.position.z) ** 2;
    for (const lp of this.loadPoints) {
      if (!lp.visible || lp.space < this.carrying) continue;
      const d = (lp.zone.x - this.position.x) ** 2 + (lp.zone.z - this.position.z) ** 2;
      if (d < bestD) { bestD = d; best = lp; }
    }
    this.dest = best;
    const d = best.drop;
    const tx = d.x + (Math.random() - 0.5) * (d.w - 0.8), tz = d.z + (Math.random() - 0.5) * (d.d - 0.6);
    const path = this.nav.findPath(this.position.x, this.position.z, tx, tz);
    if (!path) { this.state = S.REST; this.timer = 1; return; }
    this.path = path; this.pathIndex = 0;
    this.state = S.TO_YARD;
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

  update(dt, time) {
    let moving = false;
    switch (this.state) {
      case S.THINK:
      case S.REST:
        this.timer -= dt;
        if (this.timer > 0) break;
        if (this.carrying >= this.cfg.capacity) { this._goYard(); break; }
        if (!this._goPile()) {
          if (this.carrying > 0) this._goYard();
          else { this.state = S.REST; this.timer = 1.5; }
        }
        break;

      case S.TO_PILE:
        // Você ou outro carregador pegou a pilha antes: procura outra
        if (!this.logs.piles.includes(this.pile)) { this._release(); this.state = S.THINK; this.timer = 0.2; break; }
        moving = true;
        if (this._walk(dt)) { this.state = S.PICK; this.timer = 0; }
        break;

      case S.PICK:
        this.timer -= dt;
        if (this.timer > 0) break;
        if (this.carrying < this.cfg.capacity && this.logs.takeFrom(this.pile)) {
          this.carrying++; this._refreshBack(); this.timer = this.cfg.pickInterval;
          break;
        }
        this._release();
        // Ainda cabe? Tenta outra pilha perto antes de voltar
        if (this.carrying < this.cfg.capacity) {
          const p = this.logs.nearestPile(this.position.x, this.position.z);
          if (p && Math.hypot(p.x - this.position.x, p.z - this.position.z) < this.cfg.extraPileRange && this._goPile()) break;
        }
        this._goYard();
        break;

      case S.TO_YARD:
        moving = true;
        if (this._walk(dt)) { this.state = S.DROP; this.timer = 0.2; }
        break;

      case S.DROP:
        this.timer -= dt;
        if (this.timer > 0) break;
        if (this.carrying > 0) {
          if (this.dest !== this.yard && !this.dest.add(1)) { this._goYard(); break; }
          if (this.dest === this.yard) this.yard.add(1);
          this.carrying--; this._refreshBack();
          this.timer = this.cfg.dropInterval;
          break;
        }
        this.state = S.THINK; this.timer = 0.3;
        break;
    }
    this.speedNow += ((moving ? 1 : 0) - this.speedNow) * (1 - Math.exp(-10 * dt));
    this.model.animate(dt, this.speedNow * Math.min(1.4, (this.cfg.speed * this.speedMul) / CONFIG.player.speed), time);
  }
}
