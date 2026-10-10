import { CONFIG } from '../config.js';

// Lógica da estufa de secagem (sem 3D).
// Tábuas entram na fila; a estufa seca em lotes (até batchSize) e manda para o estoque de secas.
export class Kiln {
  constructor() {
    const K = CONFIG.kiln;
    this.built = false;
    this.dry = null;              // PlankStack das tábuas secas (criado ao construir)
    this.input = 0;               // tábuas esperando na porta
    this.batch = 0;               // tábuas secando agora
    this.t = 0;                   // progresso do lote (0..1)
    this.batchSize = K.batchSize;
    this.dryingSeconds = K.dryingSeconds;
    this.inputCapacity = K.inputCapacity;
    this.produced = 0;
    this.idle = 0;                // segundos sem chegar tábua nova
  }

  get space() { return this.built ? this.inputCapacity - this.input : 0; }
  get running() { return this.batch > 0; }

  addInput(n = 1) {
    const k = Math.min(n, this.space);
    this.input += k;
    if (k) this.idle = 0;
    return k;
  }

  update(dt) {
    if (!this.built || !this.dry) return;
    if (this.batch === 0) {
      this.idle += dt;
      // Fecha a porta quando junta um lote cheio, ou se ninguém trouxe tábua há 3 s
      const ready = this.input >= this.batchSize || (this.input > 0 && this.idle > 3);
      if (ready && this.dry.space > 0) {
        this.batch = Math.min(this.input, this.batchSize, this.dry.space);
        this.input -= this.batch;
        this.t = 0;
      }
      return;
    }
    this.t += dt / this.dryingSeconds;
    if (this.t >= 1) {
      this.dry.add(this.batch);
      this.produced += this.batch;
      this.batch = 0;
      this.t = 0;
    }
  }

  // Jogo fechado: o que estava na estufa termina de secar
  finishOffline() {
    if (!this.built || !this.dry) return 0;
    const n = Math.min(this.input + this.batch, this.dry.space);
    this.dry.add(n);
    this.produced += n;
    this.input = Math.max(0, this.input + this.batch - n);
    this.batch = 0; this.t = 0;
    return n;
  }
}
