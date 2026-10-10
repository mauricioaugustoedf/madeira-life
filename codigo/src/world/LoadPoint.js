import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { ZoneMarker } from './ZoneMarker.js';
import { getTreeAssets } from './TreeAssets.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

// Ponto de carga do caminhão de toras: você e os carregadores deixam toras aqui,
// o caminhão busca e leva ao pátio. Fica na beira de cada bosque novo.
export class LoadPoint {
  constructor(scene, id, zone) {
    this.id = id;
    this.zone = zone;
    this.drop = zone;                       // mesma interface do pátio (x, z, w, d)
    this.capacity = CONFIG.logTruck.loadPointCapacity;
    this.stock = 0;
    this.reservedByTruck = false;
    this.marker = new ZoneMarker(scene, zone, 0x8a6a42);
    // seta de "descarregue aqui"
    const arrow = new THREE.Shape();
    arrow.moveTo(-0.22, 0.2); arrow.lineTo(0.22, 0.2); arrow.lineTo(0.22, -0.05);
    arrow.lineTo(0.4, -0.05); arrow.lineTo(0, -0.4); arrow.lineTo(-0.4, -0.05); arrow.lineTo(-0.22, -0.05);
    this.marker.addIcon(arrow, Math.PI);

    // Pilha visível: 2 colunas x 4 por camada x 5 camadas = 40
    this.perLayer = 8; this.visibleMax = 40;
    const A = getTreeAssets();
    const geo = A.logGeo.clone(); geo.scale(0.75, 0.9, 0.9);
    this.mesh = new THREE.InstancedMesh(geo, A.trunkMat, this.visibleMax);
    this.mesh.castShadow = true; this.mesh.frustumCulled = false;
    for (let i = 0; i < this.visibleMax; i++) this.mesh.setMatrixAt(i, HIDDEN);
    scene.add(this.mesh);
    this.visible = true;
  }

  get space() { return this.capacity - this.stock; }
  get isFull() { return this.stock >= this.capacity; }

  setVisible(v) {
    this.visible = v;
    this.marker.group.visible = v;
    this.mesh.visible = v;
  }

  contains(x, z) { return this.visible && this.marker.contains(x, z); }

  slotPosition(i, out = new THREE.Vector3()) {
    const k = Math.min(i, this.visibleMax - 1);
    const layer = Math.floor(k / this.perLayer), j = k % this.perLayer;
    const col = Math.floor(j / 4), row = j % 4;
    const Z = this.zone;
    out.set(Z.x + (col - 0.5) * 1.0, 0.16 + layer * 0.27, Z.z + (row - 1.5) * 0.36 + (layer % 2 ? 0.1 : 0));
    return out;
  }

  _write() {
    for (let i = 0; i < this.visibleMax; i++) {
      if (i < this.stock) {
        this.slotPosition(i, _p);
        _q.setFromAxisAngle(UP, 0); _s.setScalar(1);
        this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      } else this.mesh.setMatrixAt(i, HIDDEN);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  add(n = 1) {
    const k = Math.min(n, this.space);
    this.stock += k;
    this._write();
    return k;
  }

  take(n = 1) {
    const k = Math.min(n, this.stock);
    this.stock -= k;
    this._write();
    return k;
  }
}
