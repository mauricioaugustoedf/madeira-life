import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { CharacterModel } from '../player/CharacterModel.js';
import { Stage } from '../sim/Forest.js';

// Lenhador: máquina de estados simples.
// PENSAR → ANDAR até a árvore → CORTAR (machadadas) → ESPERAR a queda → toras no chão → PENSAR
// Sem árvore adulta ou com o pátio cheio: vai para o ponto de descanso e espera.
const S = { THINK: 0, WALK: 1, CHOP: 2, WAIT_FALL: 3, REST: 4 };

export const LumberjackStatus = {
  [S.THINK]: 'Procurando árvore',
  [S.WALK]: 'Indo até a árvore',
  [S.CHOP]: 'Cortando',
  [S.WAIT_FALL]: 'Árvore caindo',
  [S.REST]: 'Aguardando',
};

export class Lumberjack {
  constructor(scene, { nav, colliders, forest, logs, woodcutting }, spawn) {
    this.cfg = CONFIG.lumberjack;
    this.nav = nav; this.colliders = colliders;
    this.forest = forest; this.logs = logs; this.wc = woodcutting;

    this.model = new CharacterModel(this.cfg.appearance, { headwear: 'helmet', tool: 'axe' });
    this.object = this.model.group;
    this.position = this.object.position;
    this.position.set(spawn.x, 0, spawn.z);
    scene.add(this.object);

    this.state = S.THINK;
    this.timer = 0.5;
    this.path = null; this.pathIndex = 0;
    this.tree = null;
    this.heading = 0;
    this.speedNow = 0;
    this.speedMul = 1; // treinamento da equipe
    this.hits = 0;
    this.chopT = -1;
    this.goingToRest = false;
    this.restReason = '';
    this.multiplier = 1; // upgrades futuros (velocidade de corte)
  }

  get status() {
    if (this.state === S.REST || this.goingToRest) return this.restReason || LumberjackStatus[S.REST];
    return LumberjackStatus[this.state];
  }

  _think() {
    if (this.logs.isFull) return this._goRest('Pátio de toras cheio');
    const t = this.forest.findMature(this.position.x, this.position.z);
    if (!t) return this._goRest(this.forest.count(Stage.GROWING) ? 'Esperando as árvores crescerem' : 'Sem árvores: plante mudas nos tocos');

    // Fica do lado da árvore voltado para onde o lenhador está
    let dx = this.position.x - t.x, dz = this.position.z - t.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    const reach = 0.95 * t.scale + 0.15;
    const path = this.nav.findPath(this.position.x, this.position.z, t.x + dx * reach, t.z + dz * reach);
    if (!path) { this.timer = 1; return; }
    this.forest.reserve(t);
    this.tree = t;
    this._setPath(path);
    this.goingToRest = false;
    this.state = S.WALK;
  }

  _goRest(reason) {
    this.restReason = reason;
    const r = this.cfg.restSpot;
    if (Math.hypot(this.position.x - r.x, this.position.z - r.z) < 0.6) {
      this.state = S.REST; this.timer = 1.5; this.goingToRest = false;
      return;
    }
    const path = this.nav.findPath(this.position.x, this.position.z, r.x, r.z);
    if (!path) { this.state = S.REST; this.timer = 1.5; return; }
    this._setPath(path);
    this.goingToRest = true;
    this.state = S.WALK;
  }

  _setPath(p) { this.path = p; this.pathIndex = 0; }

  _turnTo(x, z, dt, rate = 10) {
    const target = Math.atan2(x - this.position.x, z - this.position.z);
    let diff = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
    this.heading += diff * (1 - Math.exp(-rate * dt));
    this.object.rotation.y = this.heading;
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
    this._turnTo(wp.x, wp.z, dt);
    return false;
  }

  update(dt, time) {
    let moving = false;
    switch (this.state) {
      case S.THINK:
        this.timer -= dt;
        if (this.timer <= 0) this._think();
        break;

      case S.WALK: {
        // Se a árvore foi tomada/mudou no caminho, recomeça
        if (this.tree && this.tree.stage !== Stage.MATURE) { this.tree = null; this.state = S.THINK; this.timer = 0.2; break; }
        moving = true;
        if (this._walk(dt)) {
          if (this.goingToRest) { this.state = S.REST; this.timer = 1.5; this.goingToRest = false; }
          else { this.state = S.CHOP; this.hits = 0; this.chopT = 0; }
        }
        break;
      }

      case S.CHOP: {
        const t = this.tree;
        this._turnTo(t.x, t.z, dt, 14);
        const interval = this.cfg.hitInterval / this.multiplier;
        const prev = this.chopT;
        this.chopT += dt / interval;
        // Impacto em 75% do golpe
        if (prev < 0.75 && this.chopT >= 0.75) {
          this.hits++;
          this.wc.hit(t, this.position.x, this.position.z);
        }
        if (this.chopT >= 1) {
          this.chopT = 0;
          if (this.hits >= this.cfg.chopHits) {
            this.state = S.WAIT_FALL;
            this.chopT = -1;
            this.wc.fell(t, this.position.x, this.position.z, () => {
              this.tree = null;
              this.state = S.THINK;
              this.timer = 0.7;
            });
          }
        }
        break;
      }

      case S.WAIT_FALL:
        break;

      case S.REST:
        this.timer -= dt;
        if (this.timer <= 0) { this.state = S.THINK; this.timer = 0; }
        break;
    }

    const target = moving ? 1 : 0;
    this.speedNow += (target - this.speedNow) * (1 - Math.exp(-10 * dt));
    this.model.animate(dt, this.speedNow * Math.min(1.4, (this.cfg.speed * this.speedMul) / CONFIG.player.speed), time,
      this.state === S.CHOP ? Math.max(0, this.chopT) : -1);
  }
}
