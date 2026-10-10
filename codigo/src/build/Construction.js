import * as THREE from 'three';
import { softBox } from '../core/Clay.js';
import { mat } from '../world/World.js';

// Efeito curto de obra: andaime de madeira sobe, solta poeira e some revelando a construção.
export class Construction {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.jobs = [];
  }

  play(x, z, w, d, h, onDone, duration = 2.2) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const wood = mat(0xd8b585);
    const post = softBox(0.14, 1, 0.14);
    for (const [px, pz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
      const m = new THREE.Mesh(post, wood);
      m.position.set(px, 0.5, pz); m.castShadow = true;
      g.add(m);
    }
    const beamX = softBox(w, 0.1, 0.1), beamZ = softBox(0.1, 0.1, d);
    for (let i = 0; i < 3; i++) {
      const y = (i + 1) / 3;
      for (const [geo, px, pz] of [[beamX, 0, -d / 2], [beamX, 0, d / 2], [beamZ, -w / 2, 0], [beamZ, w / 2, 0]]) {
        const m = new THREE.Mesh(geo, wood);
        m.position.set(px, y, pz);
        g.add(m);
      }
    }
    g.scale.y = 0.01;
    this.scene.add(g);
    this.jobs.push({ g, t: 0, duration, h, onDone, x, z, w, d, dust: 0, done: false });
  }

  update(dt) {
    for (const j of this.jobs) {
      j.t += dt;
      const k = Math.min(1, j.t / j.duration);
      // Sobe até a altura final, depois encolhe e some
      if (k < 0.75) j.g.scale.y = Math.max(0.01, j.h * (k / 0.75));
      else {
        if (!j.done) { j.done = true; if (j.onDone) j.onDone(); }
        const f = 1 - (k - 0.75) / 0.25;
        j.g.scale.set(Math.max(0.01, f), j.h * Math.max(0.01, f), Math.max(0.01, f));
      }
      j.dust -= dt;
      if (j.dust <= 0 && k < 0.9) {
        j.dust = 0.12;
        this.particles.burst(j.x + (Math.random() - 0.5) * j.w, 0.3, j.z + (Math.random() - 0.5) * j.d, 4, 1.6);
      }
    }
    for (let i = this.jobs.length - 1; i >= 0; i--) {
      if (this.jobs[i].t >= this.jobs[i].duration) {
        this.scene.remove(this.jobs[i].g);
        this.jobs.splice(i, 1);
      }
    }
  }
}
