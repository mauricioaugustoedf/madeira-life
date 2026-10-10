// Menu do jogo (salvar, backup, novo jogo) e painel "Enquanto você estava fora".
export class Menu {
  constructor(saver, config) {
    this.saver = saver;
    this.config = config;

    this.btn = document.getElementById('menu-btn');
    this.overlay = document.getElementById('menu');
    this.savedEl = document.getElementById('menu-saved');
    this.exportBox = document.getElementById('export-box');
    this.importBox = document.getElementById('import-box');
    this.msgEl = document.getElementById('menu-msg');
    this.confirmEl = document.getElementById('reset-confirm');

    const on = (id, fn) => document.getElementById(id).addEventListener('click', fn);
    this.btn.addEventListener('click', () => this.open());
    on('menu-close', () => this.close());
    on('menu-close2', () => this.close());
    on('save-now', () => { const ok = saver.save(); this._msg(ok ? 'Jogo salvo.' : 'Não foi possível salvar neste aparelho.'); this._refreshSaved(); });
    on('export-btn', () => this._export());
    on('import-btn', () => this._import());
    on('reset-btn', () => { this.confirmEl.hidden = false; });
    on('reset-cancel', () => { this.confirmEl.hidden = true; });
    on('reset-yes', () => { saver.clear(); this._msg('Progresso apagado. Recarregando…'); this._reload(); });
    this.overlay.addEventListener('pointerdown', (e) => { if (e.target === this.overlay) this.close(); });

    this.away = document.getElementById('away');
    on('away-ok', () => { this.away.hidden = true; });

    setInterval(() => { if (!this.overlay.hidden) this._refreshSaved(); }, 1000);
  }

  open() {
    this.saver.save();
    this.overlay.hidden = false;
    this.exportBox.hidden = true;
    this.confirmEl.hidden = true;
    this.importBox.value = '';
    this._msg('');
    this._refreshSaved();
  }

  close() { this.overlay.hidden = true; }

  _refreshSaved() {
    const t = this.saver.lastSavedAt;
    if (!t) { this.savedEl.textContent = 'Ainda não salvo'; return; }
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    this.savedEl.textContent = s < 5 ? 'Salvo agora mesmo' : `Salvo há ${s < 60 ? s + 's' : Math.floor(s / 60) + 'min'}`;
  }

  _msg(text) { this.msgEl.textContent = text; }

  async _export() {
    const text = this.saver.exportText();
    this.exportBox.hidden = false;
    this.exportBox.value = text;
    try {
      await navigator.clipboard.writeText(text);
      this._msg('Backup copiado. Cole num lugar seguro (Notas, WhatsApp para você mesmo…).');
    } catch (_) {
      this.exportBox.focus();
      this.exportBox.select();
      this._msg('Selecione o texto acima e copie (toque e segure → Copiar).');
    }
  }

  _import() {
    const err = this.saver.importText(this.importBox.value);
    if (err) { this._msg(err); return; }
    this._msg('Backup carregado. Recarregando o jogo…');
    this._reload();
  }

  _reload() {
    setTimeout(() => {
      try { location.reload(); } catch (_) { this._msg('Feche e abra o jogo de novo para concluir.'); }
    }, 600);
  }

  // Painel de boas-vindas com o que a empresa produziu enquanto o jogo estava fechado
  showAway(r, fmt, team) {
    const list = document.getElementById('away-list');
    const rows = [['Tempo ausente', fmt(r.seconds)]];
    if (r.treesCut) rows.push(['Árvores derrubadas', r.treesCut.toLocaleString('pt-BR')], ['Toras cortadas', r.logsCut.toLocaleString('pt-BR')]);
    if (r.planted) rows.push(['Mudas plantadas', r.planted.toLocaleString('pt-BR')]);
    if (r.stoneMined) rows.push(['Pedras mineradas', r.stoneMined.toLocaleString('pt-BR')]);
    if (r.hauled) rows.push(['Toras levadas ao pátio', r.hauled.toLocaleString('pt-BR')]);
    if (r.logsSawn) rows.push(['Toras serradas', r.logsSawn.toLocaleString('pt-BR')], ['Tábuas produzidas', r.planksMade.toLocaleString('pt-BR')]);
    if (r.dryMade) rows.push(['Tábuas secas produzidas', r.dryMade.toLocaleString('pt-BR')]);
    if (r.delivered) rows.push(['Tábuas entregues', r.delivered.toLocaleString('pt-BR')]);
    if (r.deliveredDry) rows.push(['Tábuas secas entregues', r.deliveredDry.toLocaleString('pt-BR')]);
    for (const [k, n] of Object.entries(r.products || {})) if (n) rows.push([`Produção de ${((this.config.products[k] || {}).label || k).toLowerCase()}`, n.toLocaleString('pt-BR')]);
    if (r.deliveredOther) rows.push(['Outros produtos entregues', r.deliveredOther.toLocaleString('pt-BR')]);
    if (r.orders) rows.push(['Pedidos concluídos', r.orders.toLocaleString('pt-BR')]);
    if (r.money) rows.push(['Dinheiro recebido', '$' + r.money.toLocaleString('pt-BR')]);
    list.innerHTML = '';
    for (const [k, v] of rows) {
      const li = document.createElement('li');
      const a = document.createElement('span'); a.textContent = k;
      const b = document.createElement('strong'); b.textContent = v;
      li.append(a, b); list.appendChild(li);
    }
    const note = document.getElementById('away-note');
    const notes = [];
    if (!team.lumberjacks && !team.operator && !team.haulers && !team.deliverers) notes.push('Sua equipe ainda é só você. Contrate lenhadores e um operador para a empresa produzir enquanto você está fora.');
    else if (team.operator && !r.logsSawn) notes.push('O operador ficou parado porque não havia toras no pátio.');
    if (r.planksMade && !team.deliverers) notes.push('As tábuas ficaram no depósito. Um entregador leva ao caminhão e o dinheiro entra sozinho.');
    if (team.lumberjacks && !team.haulers && r.logsCut) notes.push('As toras cortadas ficaram no chão. Um carregador leva tudo ao pátio sozinho.');
    if (team.lumberjacks && !team.planters && r.stumpsFinal > 0) notes.push('Os lenhadores deixaram tocos. Plante mudas ou contrate um plantador para a floresta não acabar.');
    if (r.capped) notes.push(`Contamos no máximo ${this.config.offline.maxHours}h de produção.`);
    note.textContent = notes.join(' ');
    note.hidden = !notes.length;
    this.away.hidden = false;
  }
}
