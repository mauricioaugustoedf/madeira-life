import { CharacterModel } from '../player/CharacterModel.js';

// Operador da serra: fica na área de operação e mantém a máquina rodando.
export class Operator {
  constructor(scene, zone, faceX, faceZ) {
    this.model = new CharacterModel(
      { skin: 0x8d5a3b, hair: 0x2a1a10, shirt: 0x2f5d9e, pants: 0x3a3a3a, shoes: 0x2b2b2b, cap: 0xf5d020 },
      { headwear: 'helmet' }
    );
    this.object = this.model.group;
    this.position = this.object.position;
    this.position.set(zone.x, 0, zone.z);
    this.object.rotation.y = Math.atan2(faceX - zone.x, faceZ - zone.z);
    scene.add(this.object);
    this.working = false;
  }

  update(dt, time) {
    // Quando a serra está rodando, empurra a tora (balanço dos braços)
    this.model.animate(dt, 0, time);
    if (this.working) {
      const a = -0.9 + Math.sin(time * 5) * 0.25;
      this.model.armL.rotation.x = a;
      this.model.armR.rotation.x = a;
    }
  }
}
