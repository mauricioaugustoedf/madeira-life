import { CONFIG } from '../config.js';

const PREFIX = 'CERNE1:';

// Salvamento no próprio aparelho (localStorage) + exportar/importar como texto.
// snapshot() e restore() são fornecidos pelo jogo (main.js), que conhece todos os sistemas.
export class SaveManager {
  constructor(snapshotFn) {
    this.key = CONFIG.save.key;
    this.snapshotFn = snapshotFn;
    this.lastSavedAt = 0;
    this._t = 0;
    this.enabled = true;
  }

  save() {
    if (!this.enabled) return false;
    try {
      const data = this.snapshotFn();
      localStorage.setItem(this.key, JSON.stringify(data));
      this.lastSavedAt = data.savedAt;
      return true;
    } catch (_) {
      return false;
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  clear() {
    this.enabled = false; // impede que o autosave regrave o jogo antigo
    try { localStorage.removeItem(this.key); } catch (_) {}
  }

  // Salva a cada N segundos de jogo
  update(dt) {
    this._t += dt;
    if (this._t >= CONFIG.save.autosaveSeconds) { this._t = 0; this.save(); }
  }

  exportText() {
    const json = JSON.stringify(this.snapshotFn());
    return PREFIX + btoa(unescape(encodeURIComponent(json)));
  }

  // Valida o texto colado e grava como save atual. Devolve mensagem de erro ou ''.
  importText(text) {
    const t = (text || '').trim();
    if (!t.startsWith(PREFIX)) return 'Esse texto não é um backup do jogo. Ele deve começar com CERNE1:';
    let data;
    try { data = JSON.parse(decodeURIComponent(escape(atob(t.slice(PREFIX.length))))); }
    catch (_) { return 'O backup está incompleto ou foi alterado. Copie o texto inteiro de novo.'; }
    if (!data || data.v !== 1 || typeof data.money !== 'number') return 'O backup não tem o formato esperado.';
    try {
      this.enabled = false;
      localStorage.setItem(this.key, JSON.stringify(data));
    } catch (_) { this.enabled = true; return 'Não foi possível gravar o backup neste aparelho.'; }
    return '';
  }
}
