import { CONFIG } from '../config.js';

// Lógica pura da serra (sem 3D).
// Ciclo: ALIMENTANDO (tora vai pela esteira) → CORTANDO → SAÍDA (tábuas) → PARADA.
// Só avança enquanto alguém estiver operando (você agora, um operador contratado depois).
export const SawState = { IDLE: 0, FEED: 1, CUT: 2, OUT: 3 };

const PHASES = [0, 0.4, 0.4, 0.2]; // fração do ciclo em cada fase (FEED, CUT, OUT)

export class Sawmill {
  constructor(yard, storage) {
    const C = CONFIG.sawmill;
    this.yard = yard;
    this.storage = storage;
    this.level = C.level;
    this.cycleSeconds = C.cycleSeconds;
    this.planksPerLog = C.planksPerLog;
    this.state = SawState.IDLE;
    this.t = 0;                 // progresso 0..1 dentro da fase atual
    this.running = false;       // está avançando neste frame?
    this.logsProcessed = 0;
    this.blocked = '';          // motivo de estar parada
    this.debarker = null;       // descascador (quando construído) entrega toras sem casca
    this.curDebarked = false;   // a tora atual veio descascada?
  }

  // Duração efetiva do ciclo (tora descascada corta mais rápido)
  get effectiveCycle() { return this.cycleSeconds * (this.curDebarked ? CONFIG.debarker.sawBonus : 1); }

  get phaseProgress() { return this.t; }

  // Aplica um nível de melhoria (ver CONFIG.sawLevels)
  applyLevel(L) {
    this.level = L.level;
    this.planksPerLog = L.planksPerLog;
    this.cycleSeconds = L.cycleSeconds;
  }

  update(dt, operated) {
    this.running = false;
    this.blocked = '';

    if (this.state === SawState.IDLE) {
      if (!operated) { this.blocked = 'Sem operador'; return; }
      const db = this.debarker && this.debarker.built ? this.debarker : null;
      const ready = db && db.outBelt.frontReady;
      if (!ready && this.yard.stock <= 0 && !(db && db.inTransit)) { this.blocked = 'Sem toras no pátio'; return; }
      if (this.storage.space < this.planksPerLog) { this.blocked = 'Depósito de tábuas cheio'; return; }
      if (ready) { db.takeReady(); this.curDebarked = true; }
      else if (db) { this.blocked = 'Esperando o descascador'; return; }   // com descascador, tudo passa por ele
      else { this.yard.take(1); this.curDebarked = false; }
      this.state = SawState.FEED;
      this.t = 0;
    }

    if (!operated) { this.blocked = 'Pausada: sem operador'; return; }
    this.running = true;
    const dur = this.effectiveCycle * PHASES[this.state];
    this.t += dt / dur;
    if (this.t < 1) return;
    this.t = 0;
    if (this.state === SawState.FEED) this.state = SawState.CUT;
    else if (this.state === SawState.CUT) this.state = SawState.OUT;
    else if (this.state === SawState.OUT) {
      this.storage.add(this.planksPerLog);
      if (this.onSawn) this.onSawn();   // serragem
      this.logsProcessed++;
      this.state = SawState.IDLE;
    }
  }
}
