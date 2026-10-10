import * as THREE from 'three';

// Anel no chão que mostra para onde o personagem está indo.
export class TapMarker {
  constructor(scene) {
    const geo = new THREE.RingGeometry(0.35, 0.55, 24);
    geo.rotateX(-Math.PI / 2);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xf2b134, transparent: true, opacity: 0.9, depthWrite: false });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.visible = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    this.t = 0;
    this.fading = false;
  }

  show(x, z) {
    this.mesh.position.set(x, 0.05, z);
    this.mesh.visible = true;
    this.mat.opacity = 0.9;
    this.t = 0;
    this.fading = false;
  }

  hide() { if (this.mesh.visible) this.fading = true; }

  update(dt) {
    if (!this.mesh.visible) return;
    this.t += dt;
    if (this.fading) {
      this.mat.opacity -= dt * 3;
      if (this.mat.opacity <= 0) this.mesh.visible = false;
      return;
    }
    const s = 1 + Math.sin(this.t * 6) * 0.12;
    this.mesh.scale.set(s, 1, s);
  }
}
