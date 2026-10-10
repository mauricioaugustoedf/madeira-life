import * as THREE from 'three';
import { softBox } from '../core/Clay.js';
import { mat } from '../world/World.js';
import { PLANK_COLOR } from '../world/PlankStack.js';

// Caminhão low-poly (sempre controlado pelo jogo, nunca pelo jogador).
// Frente apontando para +X no espaço local.
export class Truck {
  constructor(scene, cabColor = 0x2f6fb3) {
    this.group = new THREE.Group();
    const add = (geo, color, x, y, z, parent = this.group) => {
      const m = new THREE.Mesh(geo, color instanceof THREE.Material ? color : mat(color));
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
      parent.add(m); return m;
    };
    this.cabMat = new THREE.MeshLambertMaterial({ color: cabColor, flatShading: false });
    add(softBox(4.4, 0.32, 1.7), 0x3a3a3a, 0, 0.62, 0);            // chassi
    add(softBox(1.3, 1.3, 1.75), this.cabMat, 1.55, 1.42, 0);      // cabine
    add(softBox(0.5, 0.55, 1.6), 0xbfe6f5, 2.0, 1.72, 0);          // para-brisa
    add(softBox(0.2, 0.25, 1.8), 0x2b2b2b, 2.25, 0.82, 0);         // para-choque
    // Carroceria de madeira
    add(softBox(2.8, 0.1, 1.8), 0x8a5a33, -0.65, 0.83, 0);
    add(softBox(2.8, 0.45, 0.08), 0x8a5a33, -0.65, 1.1, 0.86);
    add(softBox(2.8, 0.45, 0.08), 0x8a5a33, -0.65, 1.1, -0.86);
    add(softBox(0.08, 0.45, 1.8), 0x8a5a33, -2.02, 1.1, 0);
    // Rodas
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
    wheelGeo.rotateX(Math.PI / 2);
    this.wheels = [];
    for (const [x, z] of [[1.45, 0.82], [1.45, -0.82], [-1.3, 0.82], [-1.3, -0.82]]) {
      this.wheels.push(add(wheelGeo, 0x222222, x, 0.38, z));
    }
    // Carga (tábuas na carroceria)
    this.cargo = [];
    const plankGeo = softBox(1.25, 0.07, 0.22);
    this.cargoMat = new THREE.MeshLambertMaterial({ color: PLANK_COLOR, flatShading: false });
    for (let i = 0; i < 36; i++) {
      // 2 metades (frente/trás da carroceria) x 6 tábuas lado a lado, em camadas
      const col = i % 6, half = Math.floor(i / 6) % 2, layer = Math.floor(i / 12);
      const m = add(plankGeo, this.cargoMat, -0.65 + (half ? 0.66 : -0.66), 0.92 + layer * 0.075, (col - 2.5) * 0.25);
      m.visible = false;
      this.cargo.push(m);
    }
    scene.add(this.group);
  }

  setColor(c) { this.cabMat.color.setHex(c); }

  setCargoColor(c) { this.cargoMat.color.setHex(c); }

  setCargo(n) { for (let i = 0; i < this.cargo.length; i++) this.cargo[i].visible = i < n; }

  // Posição no mundo da tábua de índice i na carroceria
  cargoWorld(i, out = new THREE.Vector3()) {
    const m = this.cargo[Math.min(i, this.cargo.length - 1)];
    return m.getWorldPosition(out);
  }

  roll(dist) { for (const w of this.wheels) w.rotation.z -= dist / 0.38; }
}
