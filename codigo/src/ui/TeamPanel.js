// Painel da equipe: lista os funcionários e deixa trocar a função de cada um.
// roles = [{ id, label }], api = { list(): [{ worker, role, status }], change(worker, roleId), available(roleId) }
export class TeamPanel {
  constructor(roles, api) {
    this.roles = roles; this.api = api;
    this.el = document.getElementById('team');
    this.listEl = document.getElementById('team-list');
    this.sumEl = document.getElementById('team-sum');
    document.getElementById('team-btn').addEventListener('click', () => this.open());
    document.getElementById('team-close').addEventListener('click', () => this.close());
    document.getElementById('team-close2').addEventListener('click', () => this.close());
    this._t = 0;
  }

  open() { this.el.hidden = false; this.render(); }
  close() { this.el.hidden = true; }

  render() {
    const items = this.api.list();
    this.listEl.innerHTML = '';
    if (!items.length) {
      this.sumEl.textContent = 'Você ainda não contratou ninguém. Contrate nas placas do mapa.';
      return;
    }
    const counts = {};
    for (const it of items) counts[it.role] = (counts[it.role] || 0) + 1;
    const resting = items.filter((it) => it.worker.resting).length;
    this.sumEl.textContent = this.roles.filter((r) => counts[r.id]).map((r) => `${r.label}: ${counts[r.id]}`).join(' · ')
      + (resting ? ` · Descansando: ${resting}` : '') + '. Troque a função ou mande descansar em casa (sem custo).';
    const seen = {};
    for (const it of items) {
      seen[it.role] = (seen[it.role] || 0) + 1;
      const role = this.roles.find((r) => r.id === it.role);
      const row = document.createElement('div'); row.className = 'team-row' + (it.worker.resting ? ' resting' : '');
      const who = document.createElement('div'); who.className = 'who';
      const b = document.createElement('b'); b.textContent = `${role.label} ${seen[it.role]}`;
      const st = document.createElement('span'); st.textContent = this.api.status(it.worker); st.dataset.status = '1';
      who.append(b, st);
      row.appendChild(who);
      const sel = document.createElement('select');
      sel.setAttribute('aria-label', 'Função');
      for (const r of this.roles) {
        if (r.id !== it.role && !this.api.available(r.id)) continue;
        const o = document.createElement('option'); o.value = r.id; o.textContent = r.label; o.selected = r.id === it.role;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => { this.api.change(it.worker, sel.value); this.render(); });
      const acts = document.createElement('div'); acts.className = 'acts';
      const rest = document.createElement('button'); rest.type = 'button'; rest.className = 'rest';
      rest.textContent = it.worker.resting ? 'Voltar ao trabalho' : 'Descansar';
      rest.addEventListener('click', () => { this.api.rest(it.worker, !it.worker.resting); this.render(); });
      acts.append(sel, rest);
      row.appendChild(acts);
      it.statusEl = st;
      this.listEl.appendChild(row);
    }
    this._items = items;
  }

  // Atualiza só os textos de status enquanto o painel está aberto
  update(dt) {
    if (this.el.hidden || !this._items) return;
    this._t -= dt;
    if (this._t > 0) return;
    this._t = 0.5;
    for (const it of this._items) if (it.statusEl) it.statusEl.textContent = this.api.status(it.worker);
  }
}
