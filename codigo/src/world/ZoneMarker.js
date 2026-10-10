import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat } from './World.js';

// Retângulo marcado no chão (área de interação): fundo + borda amarela.
// O brilho da borda pulsa quando a área está ativa.
export class ZoneMarker {
  constructor(scene, { x, z, w, d }, baseColor = 0x9a7448) {
    this.zone = { x, z, w, d };
    this.group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(baseColor, false));
    base.rotation.x = -Math.PI / 2; base.receiveShadow = true;
    this.group.add(base);
    this.stripeMat = new THREE.MeshBasicMaterial({ color: 0xf2b134 });
    // borda + ícones numa malha só (menos chamadas de desenho)
    const t = 0.12;
    this._stripeGeos = [];
    for (const [sw, sd, sx, sz] of [
      [w, t, 0, -d / 2 + t / 2], [w, t, 0, d / 2 - t / 2],
      [t, d, -w / 2 + t / 2, 0], [t, d, w / 2 - t / 2, 0],
    ]) {
      const g = new THREE.PlaneGeometry(sw, sd);
      g.rotateX(-Math.PI / 2); g.translate(sx, 0.005, sz);
      this._stripeGeos.push(g);
    }
    this._stripes = null;
    this._mergeStripes();
    this.group.position.set(x, 0.03, z);
    scene.add(this.group);
    this._base = new THREE.Color(0xf2b134);
    this._hot = new THREE.Color(0xfff3b0);
  }

  contains(px, pz) {
    const Z = this.zone;
    return Math.abs(px - Z.x) <= Z.w / 2 && Math.abs(pz - Z.z) <= Z.d / 2;
  }

  // Adiciona um ícone simples (forma 2D) no centro
  addIcon(shape, rotZ = 0) {
    const g = new THREE.ShapeGeometry(shape);
    g.rotateZ(rotZ); g.rotateX(-Math.PI / 2); g.translate(0, 0.006, 0);
    this._stripeGeos.push(g);
    this._mergeStripes();
  }

  _mergeStripes() {
    if (this._stripes) { this.group.remove(this._stripes); this._stripes.geometry.dispose(); }
    const geos = this._stripeGeos.map((g) => { const c = g.index ? g.toNonIndexed() : g.clone(); c.deleteAttribute('uv'); if (c.attributes.normal) c.deleteAttribute('normal'); return c; });
    this._stripes = new THREE.Mesh(mergeGeometries(geos, false), this.stripeMat);
    for (const g of geos) g.dispose();
    this.group.add(this._stripes);
  }

  setActive(active, time) {
    const k = active ? 0.5 + 0.5 * Math.sin(time * 6) : 0;
    this.stripeMat.color.copy(this._base).lerp(this._hot, k);
  }
}
