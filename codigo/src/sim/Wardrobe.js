// Catálogo de cosméticos e o que o jogador já comprou / está usando.
// Cosméticos são só visuais (não dão vantagem) e, depois de comprados, ficam para sempre.
const C = (id, name, hex, price) => ({ id, name, hex, price });

export const CATALOG = {
  hairStyle: { label: 'Cabelo', kind: 'shape', items: [
    { id: 'curto', name: 'Curto', price: 0 },
    { id: 'careca', name: 'Careca', price: 0 },
    { id: 'franja', name: 'Franja', price: 100 },
    { id: 'topete', name: 'Topete', price: 150 },
    { id: 'chanel', name: 'Chanel', price: 150 },
    { id: 'cacheado', name: 'Cacheado', price: 200 },
    { id: 'coque', name: 'Coque', price: 200 },
    { id: 'longo', name: 'Longo', price: 250 },
    { id: 'rabo', name: 'Rabo de cavalo', price: 250 },
    { id: 'marias', name: 'Maria-chiquinha', price: 300 },
    { id: 'blackpower', name: 'Black power', price: 350 },
    { id: 'moicano', name: 'Moicano', price: 400 },
  ] },
  hairColor: { label: 'Cor do cabelo', kind: 'color', items: [
    C('castanho', 'Castanho', 0x3a2618, 0), C('preto', 'Preto', 0x141010, 0), C('chocolate', 'Chocolate', 0x5c3a24, 0),
    C('loiro', 'Loiro', 0xe0b450, 100), C('ruivo', 'Ruivo', 0xb4532a, 100), C('mel', 'Mel', 0xa8743a, 100),
    C('grisalho', 'Grisalho', 0xb9b9b9, 150), C('branco', 'Branco', 0xeeeae2, 200),
    C('azul', 'Azul', 0x2f6fd0, 300), C('rosa', 'Rosa', 0xe36aa8, 300), C('verde', 'Verde', 0x3aa86a, 300), C('roxo', 'Roxo', 0x7a4fc0, 300),
  ] },
  skin: { label: 'Pele', kind: 'color', items: [
    C('s1', 'Clara', 0xf3cfa8, 0), C('s2', 'Média clara', 0xe0ac7e, 0), C('s3', 'Média', 0xc68a5e, 0),
    C('s4', 'Morena', 0xa86c43, 0), C('s5', 'Escura', 0x7d4b2c, 0), C('s6', 'Bem escura', 0x553220, 0),
  ] },
  top: { label: 'Roupa', kind: 'shape', items: [
    { id: 'camiseta', name: 'Camiseta', price: 0 },
    { id: 'manga', name: 'Manga longa', price: 0 },
    { id: 'regata', name: 'Regata', price: 100 },
    { id: 'moletom', name: 'Moletom com capuz', price: 300 },
    { id: 'jaqueta', name: 'Jaqueta com gola', price: 450 },
  ] },
  shirt: { label: 'Cor da roupa', kind: 'color', items: [
    C('verde', 'Verde-água', 0x2a8f86, 0), C('branca', 'Branca', 0xeeeeee, 0), C('terracota', 'Terracota', 0xd2593a, 0),
    C('xadrez', 'Vermelha', 0xb83a2f, 100), C('azul', 'Azul', 0x2f5d9e, 100), C('celeste', 'Azul-claro', 0x6fa0d8, 100),
    C('amarela', 'Amarela', 0xe8b931, 150), C('bege', 'Bege', 0xd8b483, 150), C('cinza', 'Cinza', 0x8a8a8e, 150),
    C('preta', 'Preta', 0x2a2a2e, 200), C('laranja', 'Laranja', 0xe07b24, 200), C('roxa', 'Roxa', 0x6c4fa3, 250),
    C('rosa', 'Rosa', 0xe891b4, 250), C('oliva', 'Verde-oliva', 0x6b7a3a, 250),
  ] },
  legwear: { label: 'Pernas', kind: 'shape', items: [
    { id: 'calca', name: 'Calça', price: 0 },
    { id: 'bermuda', name: 'Bermuda', price: 0 },
    { id: 'short', name: 'Short', price: 100 },
  ] },
  pants: { label: 'Cor da calça', kind: 'color', items: [
    C('jeans', 'Jeans', 0x3d4a5c, 0), C('caqui', 'Cáqui', 0xb59a6a, 0), C('claro', 'Jeans claro', 0x6f8bb0, 0),
    C('preta', 'Preta', 0x1f1f1f, 100), C('marrom', 'Marrom', 0x5a3a22, 100), C('verde', 'Verde militar', 0x4b5a35, 150),
    C('branca', 'Branca', 0xe5e1d8, 150), C('cinza', 'Cinza', 0x77777c, 150), C('vermelha', 'Vermelha', 0xa83a32, 200),
  ] },
  footwear: { label: 'Calçado', kind: 'shape', items: [
    { id: 'sapato', name: 'Sapato', price: 0 },
    { id: 'tenis', name: 'Tênis', price: 0 },
    { id: 'bota', name: 'Bota', price: 150 },
    { id: 'chinelo', name: 'Chinelo', price: 80 },
  ] },
  shoes: { label: 'Cor do calçado', kind: 'color', items: [
    C('preto', 'Preto', 0x2b2b2b, 0), C('marrom', 'Marrom', 0x5a3a22, 0), C('branco', 'Branco', 0xf0f0f0, 0),
    C('amarelo', 'Amarelo', 0xd9a520, 100), C('vermelho', 'Vermelho', 0xc0392b, 100), C('azul', 'Azul', 0x2f6fb3, 100),
    C('verde', 'Verde', 0x3a8a4a, 150), C('rosa', 'Rosa', 0xe36aa8, 150),
  ] },
  headwear: { label: 'Chapéu', kind: 'shape', items: [
    { id: 'none', name: 'Sem chapéu', price: 0 }, { id: 'cap', name: 'Boné', price: 0 },
    { id: 'helmet', name: 'Capacete', price: 200 }, { id: 'beanie', name: 'Gorro', price: 200 },
    { id: 'boina', name: 'Boina', price: 250 }, { id: 'pescador', name: 'Chapéu pescador', price: 300 },
    { id: 'palha', name: 'Chapéu de palha', price: 350 }, { id: 'hat', name: 'Chapéu de vaqueiro', price: 450 },
    { id: 'cartola', name: 'Cartola', price: 800 },
  ] },
  headColor: { label: 'Cor do chapéu', kind: 'color', items: [
    C('amarelo', 'Amarelo', 0xf2b134, 0), C('vermelho', 'Vermelho', 0xc0392b, 0), C('marrom', 'Marrom', 0x7a4a2a, 0),
    C('azul', 'Azul', 0x2f6fb3, 100), C('verde', 'Verde', 0x2e8b57, 100), C('preto', 'Preto', 0x222222, 150),
    C('branco', 'Branco', 0xf2f2f2, 150), C('palha', 'Palha', 0xd8b56a, 150), C('bege', 'Bege', 0xcfb08a, 150),
    C('rosa', 'Rosa', 0xe36aa8, 250), C('roxo', 'Roxo', 0x6c4fa3, 250),
  ] },
  accessory: { label: 'Acessório', kind: 'shape', items: [
    { id: 'none', name: 'Nenhum', price: 0 }, { id: 'bigode', name: 'Bigode', price: 100 },
    { id: 'cavanhaque', name: 'Cavanhaque', price: 150 }, { id: 'barba', name: 'Barba', price: 250 },
    { id: 'oculos', name: 'Óculos', price: 200 }, { id: 'escuros', name: 'Óculos escuros', price: 350 },
    { id: 'fone', name: 'Fone de ouvido', price: 300 }, { id: 'colar', name: 'Colar dourado', price: 400 },
    { id: 'brinco', name: 'Brincos', price: 250 },
  ] },
};

export const SLOTS = Object.keys(CATALOG);

const DEFAULT_LOOK = {
  hairStyle: 'curto', hairColor: 'castanho', skin: 's2', top: 'manga', shirt: 'verde', legwear: 'calca', pants: 'jeans',
  footwear: 'sapato', shoes: 'preto', headwear: 'cap', headColor: 'amarelo', accessory: 'none',
};

export class Wardrobe {
  constructor() {
    this.look = { ...DEFAULT_LOOK };
    this.owned = new Set();
    for (const s of SLOTS) for (const it of CATALOG[s].items) if (!it.price) this.owned.add(`${s}:${it.id}`);
  }

  item(slot, id) { return CATALOG[slot].items.find((i) => i.id === id); }
  has(slot, id) { return this.owned.has(`${slot}:${id}`); }

  buy(slot, id, economy) {
    const it = this.item(slot, id);
    if (!it || this.has(slot, id) || !economy.spend(it.price)) return false;
    this.owned.add(`${slot}:${id}`);
    return true;
  }

  wear(slot, id) {
    if (!this.has(slot, id)) return false;
    this.look[slot] = id;
    return true;
  }

  // Aplica o visual num CharacterModel
  apply(model) {
    const L = this.look, hex = (slot) => (this.item(slot, L[slot]) || CATALOG[slot].items[0]).hex;
    model.setColor('hair', hex('hairColor'));
    model.setColor('skin', hex('skin'));
    model.setColor('shirt', hex('shirt'));
    model.setColor('pants', hex('pants'));
    model.setColor('shoes', hex('shoes'));
    model.setColor('cap', hex('headColor'));
    if (model.top !== L.top) model.setTop(L.top);
    if (model.legwear !== L.legwear) model.setLegwear(L.legwear);
    if (model.footwear !== L.footwear) model.setFootwear(L.footwear);
    if (model.hairStyle !== L.hairStyle) model.setHair(L.hairStyle);
    if (model.headwear !== L.headwear) model.setHeadwear(L.headwear);
    if (model.accessory !== L.accessory) model.setAccessory(L.accessory);
  }

  toJSON() { return { look: this.look, owned: [...this.owned] }; }

  load(d) {
    if (!d) return;
    for (const s of SLOTS) if (d.look && d.look[s] && this.item(s, d.look[s])) this.look[s] = d.look[s];
    for (const k of d.owned || []) this.owned.add(k);
  }
}
