import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { CharacterModel } from './CharacterModel.js';

// Jogador: movimento a pé por joystick ou seguindo um caminho até o ponto tocado.
export class Player {
  constructor(scene, colliders, nav) {
    const C = CONFIG.player;
    this.cfg = C;
    this.colliders = colliders;
    this.nav = nav;
    this.model = new CharacterModel(C.appearance, { tool: 'axe' });
    this.model.showTool(false);
    this.object = this.model.group;
    this.position = this.object.position;
    this.position.set(C.spawn.x, 0, C.spawn.z);
    this.velocity = new THREE.Vector2(0, 0);
    this.heading = Math.PI;
    this.object.rotation.y = this.heading;
    scene.add(this.object);

    this.path = null;            // lista de pontos {x, z}
    this.pathIndex = 0;
    this.onArrive = null;
    this._checkT = 0;
    this._lastDist = 0;
    this._dir = { x: 0, y: 0 };
  }

  get target() { return this.path ? this.path[this.path.length - 1] : null; }

  // Devolve o destino final (pode ser ajustado se o toque caiu dentro de algo) ou null
  goTo(x, z) {
    const path = this.nav.findPath(this.position.x, this.position.z, x, z);
    if (!path || !path.length) { this.cancelTarget(); return null; }
    this.path = path;
    this.pathIndex = 0;
    this._checkT = 0;
    this._lastDist = Infinity;
    return path[path.length - 1];
  }

  cancelTarget() {
    if (!this.path) return;
    this.path = null;
    if (this.onArrive) this.onArrive();
  }

  _steer(dt) {
    const last = this.pathIndex === this.path.length - 1;
    const wp = this.path[this.pathIndex];
    const dx = wp.x - this.position.x, dz = wp.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < (last ? 0.15 : 0.35)) {
      if (last) { this.cancelTarget(); return null; }
      this.pathIndex++;
      this._lastDist = Infinity;
      return this._steer(0);
    }
    // Segurança: se não avançar por 1,2 s (algo mudou no caminho), desiste
    this._checkT += dt;
    if (this._checkT > 1.2) {
      if (this._lastDist - dist < 0.3) { this.cancelTarget(); return null; }
      this._lastDist = dist; this._checkT = 0;
    }
    const slow = last ? Math.min(1, dist / 1.0) : 1;
    this._dir.x = (dx / dist) * slow;
    this._dir.y = (-dz / dist) * slow;
    return this._dir;
  }

  // Vira o personagem para um ponto (usado ao cortar)
  faceTowards(x, z, dt) {
    const target = Math.atan2(x - this.position.x, z - this.position.z);
    const diff = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
    this.heading += diff * (1 - Math.exp(-14 * dt));
    this.object.rotation.y = this.heading;
  }

  // Parado e sem comando = pode trabalhar
  get isIdle() {
    return !this.path && !this._hasInput && this.velocity.length() < 0.4;
  }

  update(dt, input, time, chop = -1) {
    const C = this.cfg;
    this._hasInput = Math.hypot(input.x, input.y) > 0.05;
    let dir = input;
    if (Math.hypot(input.x, input.y) > 0.05) this.cancelTarget();
    else if (this.path) dir = this._steer(dt) || input;

    // Câmera olha para -Z: "para cima" na tela = -Z no mundo
    const tx = dir.x * C.speed, tz = -dir.y * C.speed;
    const k = 1 - Math.exp(-C.accel * dt);
    this.velocity.x += (tx - this.velocity.x) * k;
    this.velocity.y += (tz - this.velocity.y) * k;

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.y * dt;
    this.colliders.resolve(this.position, C.radius);

    const speed = this.velocity.length();
    if (speed > 0.2) {
      const target = Math.atan2(this.velocity.x, this.velocity.y);
      let diff = target - this.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.heading += diff * (1 - Math.exp(-C.turnSpeed * dt));
      this.object.rotation.y = this.heading;
    }
    this.model.animate(dt, Math.min(1, speed / C.speed), time, chop);
  }
}
