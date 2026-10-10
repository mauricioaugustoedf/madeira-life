import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { CharacterModel } from '../player/CharacterModel.js';
import { Stage } from '../sim/Forest.js';

// Plantador: PENSAR → ANDAR até um toco → PLANTAR a muda → PENSAR.
// Sem tocos: espera no ponto de descanso.
const S = { THINK: 0, WALK: 1, PLANT: 2, REST: 3 };

let _sapling = null;
function saplingParts() {
  if (_sapling) return _sapling;
  _sapling = {
    pot: new THREE.CylinderGeometry(0.09, 0.07, 0.12, 6),
    leaf: new THREE.ConeGeometry(0.12, 0.3, 5),
    potMat: new THREE.MeshLambertMaterial({ color: 0x8a5a33, flatShading: false }),
    leafMat: new THREE.MeshLambertMaterial({ color: 0x7cc66b, flatShading: false }),
  };
  return _sapling;
}

// Muda na mão (usada pelo plantador e por você)
export function makeSapling() {
  const P = saplingParts();
  const g = new THREE.Group();
  const pot = new THREE.Mesh(P.pot, P.potMat);
  const leaf = new THREE.Mesh(P.leaf, P.leafMat); leaf.position.y = 0.2;
  g.add(pot, leaf);
  return g;
}

export class Planter {
  constructor(scene, { nav, forest, particles }, spawn) {
    this.cfg = CONFIG.planter;
    this.nav = nav; this.forest = forest; this.particles = particles;
    this.model = new CharacterModel(this.cfg.appearance, { headwear: 'hat' });
    this.object = this.model.group;
    this.position = this.object.position;
    this.position.set(spawn.x, 0, spawn.z);
    scene.add(this.object);
    // muda na mão esquerda
    this.sapling = makeSapling();
    this.sapling.position.set(0, -0.62, 0.12);
    this.model.armL.add(this.sapling);

    this.state = S.THINK; this.timer = 0.4;
    this.path = null; this.pathIndex = 0;
    this.tree = null; this.heading = 0; this.speedNow = 0;
    this.speedMul = 1; this.multiplier = 1;
    this.goingToRest = false;
  }

  get status() { return this.state === S.PLANT ? 'Plantando' : this.tree ? 'Indo até o toco' : 'Aguardando tocos'; }

  _think() {
    const t = this.forest.findStump(this.position.x, this.position.z);
    if (!t) return this._goRest();
    let dx = this.position.x - t.x, dz = this.position.z - t.z;
    const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const reach = 0.75 * t.scale + 0.15;
    const path = this.nav.findPath(this.position.x, this.position.z, t.x + dx * reach, t.z + dz * reach);
    if (!path) { this.timer = 1; return; }
    this.forest.reserve(t);
    this.tree = t;
    this.path = path; this.pathIndex = 0;
    this.goingToRest = false;
    this.state = S.WALK;
  }

  _goRest() {
    const r = this.cfg.restSpot;
    if (Math.hypot(this.position.x - r.x, this.position.z - r.z) < 0.6) { this.state = S.REST; this.timer = 1.2; return; }
    const path = this.nav.findPath(this.position.x, this.position.z, r.x, r.z);
    if (!path) { this.state = S.REST; this.timer = 1.2; return; }
    this.path = path; this.pathIndex = 0;
    this.goingToRest = true; this.state = S.WALK;
  }

  _turnTo(x, z, dt, rate = 10) {
    const target = Math.atan2(x - this.position.x, z - this.position.z);
    const diff = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
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
      if (++this.pathIndex >= this.path.length) { this.path = null; return true; }
      return false;
    }
    this.position.x += (dx / dist) * step;
    this.position.z += (dz / dist) * step;
    this._turnTo(wp.x, wp.z, dt);
    return false;
  }

  update(dt, time) {
    let moving = false, plantK = -1;
    switch (this.state) {
      case S.THINK:
        this.timer -= dt;
        if (this.timer <= 0) this._think();
        break;
      case S.WALK:
        if (this.tree && this.tree.stage !== Stage.STUMP) { this.tree = null; this.state = S.THINK; this.timer = 0.2; break; }
        moving = true;
        if (this._walk(dt)) {
          if (this.goingToRest) { this.state = S.REST; this.timer = 1.2; this.goingToRest = false; }
          else { this.state = S.PLANT; this.timer = 0; }
        }
        break;
      case S.PLANT: {
        const t = this.tree;
        this._turnTo(t.x, t.z, dt, 14);
        this.timer += dt * this.multiplier;
        plantK = Math.min(1, this.timer / this.cfg.plantSeconds);
        if (this.timer >= this.cfg.plantSeconds) {
          if (this.forest.plant(t) && this.particles) this.particles.burst(t.x, 0.2, t.z, 6, 1.0);
          else this.forest.release(t);
          this.tree = null; this.state = S.THINK; this.timer = 0.15;
        }
        break;
      }
      case S.REST:
        this.timer -= dt;
        if (this.timer <= 0) { this.state = S.THINK; this.timer = 0; }
        break;
    }
    this.sapling.visible = this.state !== S.REST && !(this.state === S.WALK && this.goingToRest);
    this.speedNow += ((moving ? 1 : 0) - this.speedNow) * (1 - Math.exp(-10 * dt));
    this.model.planting = plantK;
    this.model.animate(dt, this.speedNow * Math.min(1.4, (this.cfg.speed * this.speedMul) / CONFIG.player.speed), time);
  }
}
