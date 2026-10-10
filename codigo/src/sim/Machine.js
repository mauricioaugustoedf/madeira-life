// Máquina genérica de produto (sem 3D): recebe insumo, fabrica 1 produto a cada `seconds`
// usando `inputPer` unidades, e guarda no estoque de saída (PlankStack criado ao construir).
export class Machine {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.built = false;
    this.input = 0;
    this.busy = false;
    this.t = 0;
    this.out = null;
    this.produced = 0;
    this.feeder = null;
  }

  get space() { return this.built ? this.def.inputCap - this.input : 0; }
  get running() { return this.busy; }

  addInput(n = 1) {
    const k = Math.min(n, this.space);
    this.input += k;
    return k;
  }

  update(dt) {
    if (!this.built || !this.out) return;
    const D = this.def;
    if (!this.busy) {
      if (this.input >= D.inputPer && this.out.space >= (D.outPer || 1)) { this.input -= D.inputPer; this.busy = true; this.t = 0; }
      else return;
    }
    this.t += dt / D.seconds;
    if (this.t >= 1) { this.out.add(D.outPer || 1); this.produced += D.outPer || 1; this.busy = false; this.t = 0; }
  }

  // Jogo fechado: termina o que está dentro com o insumo que já tinha
  finishOffline(extraInput = 0, maxUnits = Infinity) {
    if (!this.built || !this.out) return 0;
    const D = this.def;
    const avail = this.input + (this.busy ? D.inputPer : 0) + extraInput;
    const per = D.outPer || 1;
    const n = Math.max(0, Math.min(Math.floor(avail / D.inputPer), Math.floor(this.out.space / per), maxUnits));
    this.out.add(n * per);
    this.produced += n * per;
    this.input = Math.min(D.inputCap, avail - n * D.inputPer);
    this.busy = false; this.t = 0;
    return n * per;
  }
}
