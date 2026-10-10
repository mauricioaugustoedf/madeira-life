import * as THREE from 'three';
import { softBox } from '../core/Clay.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _e = new THREE.Euler();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

// Partículas simples (lascas de madeira, poeira) com um pool fixo.
export class Particles {
  constructor(scene, max = 64) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(
      softBox(0.09, 0.05, 0.12),
      new THREE.MeshLambertMaterial({ color: 0xe9c48a }),
      max
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, HIDDEN);
    scene.add(this.mesh);
    this.items = Array.from({ length: max }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0 }));
    this.next = 0;
    this.alive = 0;
  }

  burst(x, y, z, n = 8, spread = 2.2) {
    for (let k = 0; k < n; k++) {
      const p = this.items[this.next];
      this.next = (this.next + 1) % this.max;
      const a = Math.random() * Math.PI * 2;
      const sp = 0.6 + Math.random() * spread;
      p.x = x; p.y = y; p.z = z;
      p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp; p.vy = 1.5 + Math.random() * 2.2;
      p.r = Math.random() * 6;
      if (p.life <= 0) this.alive++;
      p.life = 0.6 + Math.random() * 0.4;
    }
  }

  update(dt) {
    if (this.alive <= 0) return;
    for (let i = 0; i < this.max; i++) {
      const p = this.items[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { this.alive--; this.mesh.setMatrixAt(i, HIDDEN); continue; }
      p.vy -= 9 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.03) { p.y = 0.03; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      p.r += dt * 10;
      _e.set(p.r, p.r * 0.7, 0); _q.setFromEuler(_e);
      _p.set(p.x, p.y, p.z); _s.setScalar(Math.min(1, p.life * 2.5));
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
