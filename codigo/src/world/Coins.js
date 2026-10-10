import * as THREE from 'three';

// Moedinhas douradas que pulam quando um cliente paga (uma malha instanciada)
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
export class Coins {
  constructor(scene, max = 40) {
    const geo = new THREE.CylinderGeometry(0.16, 0.16, 0.04, 12); geo.rotateX(Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xf5c542, emissive: 0x5a3a00 }), max);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, HIDDEN);
    scene.add(this.mesh);
    this.items = Array.from({ length: max }, () => ({ life: 0 }));
    this.next = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1);
  }

  burst(x, y, z, n = 12) {
    for (let k = 0; k < n; k++) {
      const c = this.items[this.next]; this.next = (this.next + 1) % this.items.length;
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2;
      Object.assign(c, { life: 1.1 + Math.random() * 0.4, x, y, z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 4 + Math.random() * 2.5, r: Math.random() * 6 });
    }
  }

  update(dt) {
    let any = false;
    this.items.forEach((c, i) => {
      if (c.life <= 0) return;
      any = true;
      c.life -= dt;
      c.vy -= 12 * dt; c.x += c.vx * dt; c.y = Math.max(0.05, c.y + c.vy * dt); c.z += c.vz * dt; c.r += dt * 12;
      if (c.life <= 0) { this.mesh.setMatrixAt(i, HIDDEN); return; }
      this._e.set(0, c.r, 0); this._q.setFromEuler(this._e); this._p.set(c.x, c.y, c.z);
      this._s.setScalar(Math.min(1, c.life * 3));
      this.mesh.setMatrixAt(i, this._m.compose(this._p, this._q, this._s));
    });
    if (any || this._was) this.mesh.instanceMatrix.needsUpdate = true;
    this._was = any;
  }
}
