import { CONFIG } from '../config.js';

// Regras do corte, compartilhadas por quem corta (você ou um lenhador NPC).
export class Woodcutting {
  constructor({ forest, forestView, logs, particles }) {
    this.forest = forest; this.forestView = forestView;
    this.logs = logs; this.particles = particles;
  }

  // Uma machadada: a árvore treme e solta lascas
  hit(t, fromX, fromZ) {
    this.forest.hit(t);
    this.particles.burst(fromX + (t.x - fromX) * 0.7, 0.8, fromZ + (t.z - fromZ) * 0.7, 7);
  }

  // Derruba a árvore para longe de quem cortou; quando ela cai, nascem as toras
  fell(t, fromX, fromZ, onDone) {
    let dx = t.x - fromX, dz = t.z - fromZ;
    const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    this.forest.fell(t);
    this.forestView.playFall(t, dx, dz, () => {
      this.logs.addPile(t.x + dx * 1.5 * t.scale, t.z + dz * 1.5 * t.scale, dx, dz, CONFIG.forest.logsPerTree);
      this.particles.burst(t.x + dx * 2.2, 0.2, t.z + dz * 2.2, 10, 1.6);
      this.forest.landed(t);
      if (onDone) onDone();
    });
  }
}
