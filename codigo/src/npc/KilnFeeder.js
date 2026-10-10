import * as THREE from 'three';
import { softBox } from '../core/Clay.js';
import { CONFIG } from '../config.js';
import { CharacterModel } from '../player/CharacterModel.js';
import { PLANK_COLOR } from '../world/PlankStack.js';

// Abastecedor da estufa: leva tábuas comuns do depósito até a porta da estufa
// (versão automática do que você faz à mão). Deixa uma reserva no depósito para os pedidos.
const S = { THINK: 0, TO_STOCK: 1, LOAD: 2, TO_KILN: 3, UNLOAD: 4 };

export class KilnFeeder {
  constructor(scene, { nav, planks, kiln }, spawn) {
    this.cfg = CONFIG.feeder;
    this.nav = nav; this.planks = planks; this.kiln = kiln;
    this.model = new CharacterModel(this.cfg.appearance, { headwear: 'helmet' });
    this.object = this.model.group;
    this.position = this.object.position;
    this.position.set(spawn.x, 0, spawn.z);
    scene.add(this.object);

    const geo = softBox(0.85, 0.06, 0.2);
    const m0 = new THREE.MeshLambertMaterial({ color: PLANK_COLOR, flatShading: false });
    this.back = new THREE.Group();
    this.back.position.set(0, 0.85, -0.36);
    this.backPlanks = [];
    for (let i = 0; i < this.cfg.capacity; i++) {
      const m = new THREE.Mesh(geo, m0);
      m.position.y = i * 0.07; m.castShadow = true; m.visible = false;
      this.back.add(m); this.backPlanks.push(m);
    }
    this.model.body.add(this.back);

    this.state = S.THINK; this.timer = 0.4;
    this.path = null; this.pathIndex = 0;
    this.carrying = 0; this.heading = 0; this.speedNow = 0;
    this.speedMul = 1;
  }

  get status() { return ['Pensando', 'Indo ao depósito', 'Pegando tábuas', 'Levando à estufa', 'Abastecendo'][this.state]; }

  _refresh() { this.backPlanks.forEach((m, i) => { m.visible = i < this.carrying; }); }

  _goTo(zone, next) {
    const tx = zone.x + (Math.random() - 0.5) * (zone.w - 0.7);
    const tz = zone.z + (Math.random() - 0.5) * (zone.d - 0.5);
    const path = this.nav.findPath(this.position.x, this.position.z, tx, tz);
    if (!path) { this.timer = 1; this.state = S.THINK; return; }
    this.path = path; this.pathIndex = 0; this.state = next;
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
        this.timer -= dt;
        if (this.timer > 0) break;
        if (this.carrying > 0) this._goTo(CONFIG.kiln.inputZone, S.TO_KILN);
        else if (this.kiln.space > 0) this._goTo(CONFIG.planks.pickupZone, S.TO_STOCK);
        else this.timer = 1; // estufa cheia
        break;
      case S.TO_STOCK:
        moving = true;
        if (this._walk(dt)) { this.state = S.LOAD; this.timer = 0; }
        break;
      case S.LOAD:
        this.timer -= dt;
        if (this.timer > 0) break;
        if (this.carrying < Math.min(this.cfg.capacity, this.kiln.space) && this.planks.stock > this.cfg.reserve && this.planks.take(1)) {
          this.carrying++; this._refresh(); this.timer = this.cfg.loadInterval;
        } else if (this.carrying > 0) this._goTo(CONFIG.kiln.inputZone, S.TO_KILN);
        else this.timer = 1; // poucas tábuas no depósito: espera
        break;
      case S.TO_KILN:
        moving = true;
        if (this._walk(dt)) { this.state = S.UNLOAD; this.timer = 0.2; }
        break;
      case S.UNLOAD:
        this.timer -= dt;
        if (this.timer > 0) break;
        if (this.carrying > 0 && this.kiln.addInput(1)) { this.carrying--; this._refresh(); this.timer = this.cfg.unloadInterval; }
        else if (this.carrying === 0) { this.state = S.THINK; this.timer = 0.2; }
        else this.timer = 0.5; // estufa cheia: espera abrir espaço
        break;
    }
    this.speedNow += ((moving ? 1 : 0) - this.speedNow) * (1 - Math.exp(-10 * dt));
    this.model.animate(dt, this.speedNow * Math.min(1.4, (this.cfg.speed * this.speedMul) / CONFIG.player.speed), time);
  }
}
