import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { CharacterModel } from '../player/CharacterModel.js';

// Mineiro: PENSAR → ANDAR até a rocha → QUEBRAR (até encher as costas) → LEVAR ao estoque → DESCARREGAR.
const S = { THINK: 0, TO_ROCK: 1, MINE: 2, TO_STOCK: 3, DROP: 4, REST: 5 };

export class Miner {
  constructor(scene, { nav, quarry, stone, particles }, spawn) {
    this.cfg = CONFIG.miner;
    this.nav = nav; this.quarry = quarry; this.stone = stone; this.particles = particles;
    this.model = new CharacterModel(this.cfg.appearance, { headwear: 'helmet', tool: 'axe' });
    this.object = this.model.group;
    this.position = this.object.position;
    this.position.set(spawn.x, 0, spawn.z);
    scene.add(this.object);
    // pedras nas costas
    const geo = new THREE.DodecahedronGeometry(0.15, 1);
    const m0 = new THREE.MeshLambertMaterial({ color: 0x9a9a94, flatShading: false });
    this.back = new THREE.Group(); this.back.position.set(0, 0.95, -0.36);
    this.backStones = [];
    for (let i = 0; i < this.cfg.capacity; i++) {
      const m = new THREE.Mesh(geo, m0);
      m.position.set(((i % 2) - 0.5) * 0.28, Math.floor(i / 2) * 0.22, 0); m.visible = false; m.castShadow = true;
      this.back.add(m); this.backStones.push(m);
    }
    this.model.body.add(this.back);
    this.state = S.THINK; this.timer = 0.5;
    this.path = null; this.pathIndex = 0;
    this.rock = null; this.carrying = 0;
    this.heading = 0; this.speedNow = 0; this.speedMul = 1; this.multiplier = 1;
    this.mineT = -1;
  }

  get status() { return ['Pensando', 'Indo à pedreira', 'Quebrando pedra', 'Levando pedras', 'Guardando pedras', 'Aguardando'][this.state]; }

  _refresh() { this.backStones.forEach((m, i) => { m.visible = i < this.carrying; }); }
  _release() { if (this.rock) { this.rock.reserved = false; this.rock = null; } }

  _go(tx, tz, next) {
    const path = this.nav.findPath(this.position.x, this.position.z, tx, tz);
    if (!path) { this.state = S.REST; this.timer = 1.5; return false; }
    this.path = path; this.pathIndex = 0; this.state = next;
    return true;
  }

  _goRock() {
    const r = this.quarry.findRock(this.position.x, this.position.z);
    if (!r) return false;
    let dx = this.position.x - r.x, dz = this.position.z - r.z;
    const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const reach = 1.0 * r.scale + 0.5;
    if (!this._go(r.x + dx * reach, r.z + dz * reach, S.TO_ROCK)) return false;
    r.reserved = true; this.rock = r;
    return true;
  }

  _goStock() {
    const Z = this.stone.cfg.zone;
    this._go(Z.x + (Math.random() - 0.5) * (Z.w - 0.6), Z.z + (Math.random() - 0.5) * (Z.d - 0.4), S.TO_STOCK);
  }

  _walk(dt) {
    const wp = this.path[this.pathIndex];
    const dx = wp.x - this.position.x, dz = wp.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    const step = this.cfg.speed * this.speedMul * dt;
    if (dist <= step + 0.02) {
      this.position.x = wp.x; this.position.z = wp.z;
      if (++this.pathIndex >= this.path.length) { this.path = null; return true; }
      return false;
    }
    this.position.x += (dx / dist) * step; this.position.z += (dz / dist) * step;
    this._turnTo(wp.x, wp.z, dt);
    return false;
  }

  _turnTo(x, z, dt, rate = 10) {
    const target = Math.atan2(x - this.position.x, z - this.position.z);
    const diff = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
    this.heading += diff * (1 - Math.exp(-rate * dt));
    this.object.rotation.y = this.heading;
  }

  update(dt, time) {
    let moving = false;
    this.mineT = -1;
    switch (this.state) {
      case S.THINK:
      case S.REST:
        this.timer -= dt;
        if (this.timer > 0) break;
        if (this.carrying >= this.cfg.capacity) { this._goStock(); break; }
        if (!this.quarry.open || this.stone.space <= 0) {
          if (this.carrying > 0) this._goStock(); else { this.state = S.REST; this.timer = 2; }
          break;
        }
        if (!this._goRock()) { if (this.carrying > 0) this._goStock(); else { this.state = S.REST; this.timer = 1.5; } }
        break;
      case S.TO_ROCK:
        if (this.rock.stone <= 0) { this._release(); this.state = S.THINK; this.timer = 0.2; break; }
        moving = true;
        if (this._walk(dt)) { this.state = S.MINE; this.timer = 0; }
        break;
      case S.MINE: {
        const r = this.rock;
        this._turnTo(r.x, r.z, dt, 14);
        const prev = this.timer;
        this.timer += dt * this.multiplier / this.cfg.hitInterval;
        this.mineT = this.timer % 1;
        if (Math.floor(prev + 0.25) < Math.floor(this.timer + 0.25)) {   // impacto em 75% do golpe
          if (this.quarry.mine(r)) {
            this.carrying++; this._refresh();
            this.particles.burst(this.position.x + (r.x - this.position.x) * 0.5, 0.7, this.position.z + (r.z - this.position.z) * 0.5, 3, 1.3);
          }
        }
        if (this.carrying >= this.cfg.capacity || r.stone <= 0) {
          this._release();
          if (this.carrying >= this.cfg.capacity) this._goStock();
          else { this.state = S.THINK; this.timer = 0.1; }
        }
        break;
      }
      case S.TO_STOCK:
        moving = true;
        if (this._walk(dt)) { this.state = S.DROP; this.timer = 0.2; }
        break;
      case S.DROP:
        this.timer -= dt;
        if (this.timer > 0) break;
        if (this.carrying > 0 && this.stone.add(1)) { this.carrying--; this._refresh(); this.timer = 0.12; break; }
        this.state = S.THINK; this.timer = 0.3;
        break;
    }
    this.model.showTool(this.state === S.MINE, 'pick');
    this.speedNow += ((moving ? 1 : 0) - this.speedNow) * (1 - Math.exp(-10 * dt));
    this.model.animate(dt, this.speedNow * Math.min(1.4, (this.cfg.speed * this.speedMul) / CONFIG.player.speed), time,
      this.state === S.MINE ? this.mineT : -1);
  }
}
