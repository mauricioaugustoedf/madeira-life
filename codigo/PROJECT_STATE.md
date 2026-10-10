# PROJECT_STATE — Cerne Madeireira

Jogo 3D tycoon de madeireira, single-player, para iPhone 16 (Safari / Tela de Início). Sem monetização.

## Stack
- **Three.js 0.169** (3D, WebGL) — leve, ótimo suporte no Safari.
- **JavaScript ES modules** em `src/`, sem TypeScript (evita etapa de compilação para quem não programa).
- **esbuild** empacota tudo em **um único `dist/index.html`** (sem dependências externas).
- **Hospedagem atual:** Claude Artifact (link privado, abre no Safari, pode ir à Tela de Início).
- **Hospedagem futura (PWA completo, offline):** GitHub Pages — planejado para depois do MVP.

## Arquitetura
- `core/Engine` — renderer, cena, luzes, loop, FPS e ajuste automático de resolução.
- `core/Input` — joystick dinâmico em qualquer ponto da tela (arrastar = joystick, toque rápido = andar até o ponto), toque rápido = andar até o ponto, pinça = zoom, teclado WASD/roda para teste no PC.
- `world/World` — terreno, cerca, galpão, escritório, toras, árvores instanciadas com balanço na GPU, pedras.
- `world/Colliders` — colisões 2D (círculos/caixas) em grade espacial; `isFree()` para consultas.
- `world/NavGrid` — grade de navegação 0,5 m + A* com suavização de caminho. Reaproveitável pelos NPCs. Chamar `rebuild()` quando surgir construção nova.
- `ui/TapMarker` — anel no chão mostrando o destino do toque.
- `sim/Forest` — lógica pura da floresta (estágios GROWING/MATURE/FALLING/STUMP, reserva de árvore, tick a cada 0,25 s). `growthMultiplier` pronto para upgrades.
- `world/ForestView` — árvores instanciadas que crescem/tremem/caem; transparência pontilhada (atributo `aFade`) para árvores entre câmera e foco.
- `world/TreeAssets` — geometrias e materiais de árvore e tora compartilhados.
- `world/LogPiles` — toras no chão (InstancedMesh com vagas reaproveitáveis, máx. 150). Guarda `piles` [{x,z,ids}] para o transporte recolher na Etapa 3.
- `world/Particles` — pool de partículas (lascas).
- `sim/Woodcutting` — regras de machadada/queda compartilhadas entre jogador e NPCs.
- `world/LogYard` — pátio de toras: área de descarga + pilha visível (60 toras visíveis), `stock`, `take(n)` para a serra.
- `sim/Sawmill` — lógica da serra (IDLE→FEED→CUT→OUT), só avança com operador; `level`, `cycleSeconds`, `planksPerLog` prontos para upgrades.
- `world/SawmillView` — máquina (roletes, volante, lâmina, lâmpada de status), tora/tábuas percorrendo a linha, serragem.
- `world/PlankStack` — depósito de tábuas: `stock`, `capacity`, `space`, `take(n)`.
- `world/ZoneMarker` — área marcada no chão reutilizável (borda pulsa quando ativa).
- `sim/Economy` — dinheiro (única moeda): `earn`, `spend`, `canAfford`, `onChange`.
- `sim/Orders` — pedido atual {customer, product, qty, delivered, reward}; `next()`, `deliverOne()`; clientes fictícios.
- `vehicles/Truck` — caminhão low-poly com carga visível (`setCargo`).
- `world/DeliveryDock` — ciclo do caminhão AWAY→ARRIVING→WAITING→LEAVING pela estrada (z=23,2); área de entrega; `onPaid`.
- `build/Shop` + `BuyCard` — itens de compra {zone, signAt, offer(), buy()}; cartão com botão (pointerdown); placa 3D mostra o preço.
- `build/Construction` — efeito de obra (andaime sobe, poeira, revela a construção).
- Shop: oferta pode ter `planks` (tábuas depositadas pelo jogador na obra: `item.deposited`, `shop.plankNeed()`, `work.giveTo()`) e `{hidden:true}` (bloqueada, some do mapa até liberar).
- `sim/Kiln` + `world/KilnView` — estufa (lógica / canteiro, prédio, fila na porta, fumaça, janela acesa, estoque de secas = PlankStack com cor própria).
- `npc/KilnFeeder` — abastecedor da estufa. `npc/Deliverer` agora trabalha por produto (`stocks.plank` / `stocks.dry`).
- Pedidos têm `product: 'plank' | 'dry'`; `dock.accepts(product)`, `dock.wantedProduct`.
- `sim/Wardrobe` (catálogo + look/owned, `apply(model)`) e `ui/Customizer` (menu com WebGLRenderer próprio só enquanto aberto). `CharacterModel.setHair/setHeadwear/setAccessory`.
- `world/Sign` — placa de madeira com texto em CanvasTexture.
- `npc/Operator` — operador fixo na serra (versão automática da serra).
- `World.expand(rect)` + `NavGrid.resize()` + `Forest.addGrove()` — base da expansão contínua do mapa (lotes em `CONFIG.lands`).
- `save/SaveManager` — localStorage + exportar/importar texto; `snapshot()`/`restore()` ficam em main.js (conhecem todos os sistemas).
- `sim/OfflineSim` — taxas: lenhadores (limitados pelas árvores em pé + replantio dos plantadores e pelo espaço no chão), plantadores e operador (limitado pelas toras do pátio e espaço do depósito). Sem dinheiro offline até existir entrega automática.
- `ui/Menu` — menu e painel de boas-vindas.
- `npc/Deliverer` — entregador: THINK→TO_STOCK→LOAD→TO_DOCK→UNLOAD; usa `dock.canReceive/receive()`. Se o jogador e o entregador completam o mesmo pedido, a tábua "em voo" do jogador volta ao depósito.
- `npc/Hauler` — carregador: THINK→TO_PILE→PICK→TO_YARD→DROP; usa `LogPiles.nearestPile/takeFrom` com reserva de pilha.
- `player/PlayerWork` — trabalho manual: corte automático ao ficar parado perto de árvore adulta, coleta automática de toras, descarga no pátio, dicas no painel, toras voando.
- `npc/Lumberjack` — máquina de estados THINK→WALK→CHOP→WAIT_FALL→REST, usa NavGrid; `multiplier` pronto para upgrade de velocidade.
- `player/Player` + `player/CharacterModel` — personagem low-poly por partes com cores trocáveis (base da personalização).
- `camera/FollowCamera` — terceira pessoa, ângulo fixo, suavização exponencial.
- `ui/Hud` — caixa (dinheiro), etapa, FPS.
- `config.js` — todos os números ajustáveis.

## Estrutura planejada (futuro)
```
src/sim/      Economy, Production, Orders, OfflineSim (lógica pura, sem 3D)
src/npc/      Planter, Hauler, Operator (mesmo padrão do Lumberjack)
src/vehicles/ rotas predefinidas
src/build/    BuildSlots (pontos fixos de compra/construção) + InteractionPrompt
src/save/     SaveManager (localStorage + exportar/importar texto)
src/ui/       Prompt de compra, menu de personalização, painel "Enquanto você estava fora"
```

## Etapas do MVP
1. ✅ Cenário, personagem, joystick, câmera, colisões (v0.1.0)
   - ✅ 1.1: zoom da câmera (pinça, botões +/−, roda do mouse; salvo no aparelho) e tocar no chão para andar com pathfinding A* (v0.1.1)
2. ✅ Floresta viva (30 árvores: muda → adulta → corte → queda → toco → replantio automático), lenhador NPC com machado, toras no chão, lascas de madeira, árvores na frente da câmera ficam transparentes (v0.2.0)
   - ✅ 2.1: **o dono faz todo o trabalho no início** — corta parado ao lado de árvore adulta, recolhe toras do chão nas costas (6), descarrega no pátio (faixa amarela) → estoque "Toras no pátio". Lenhador vira contratação (`hiredAtStart: false`, `hireLumberjack()`) (v0.2.1)
3. ✅ Serra no pátio: toras do pátio → esteira → lâmina → tábuas → depósito de tábuas (cap. 200). Operada manualmente: fique na área amarela com engrenagem ao lado da entrada. Sai do lugar = serra pausa (v0.3.0). 3.1: 1 tora = 1 tábua no início; joystick em qualquer lugar da tela (v0.3.1)
4. ✅ Pedidos + dinheiro: caminhão do cliente chega pela estrada ao sul, você pega tábuas no depósito (área com ícone de tábuas, até 10) e entrega na área com seta junto à cerca; pedido completo → caminhão sai, +$ na tela. Pedidos crescem aos poucos; preço inicial $15/tábua (v0.4.0). 4.1: contador "Nas costas" no painel (v0.4.1)
5. ✅ Loja no mapa (áreas marrons com placa + cartão [COMPRAR] na parte de baixo): contratar lenhador ($150 / $500 / $1.200), contratar operador da serra ($250, serra roda sozinha), melhorar serra (nv2 $300: 2 tábuas/tora; nv3 $900: mais rápida; nv4 $2.500: 3 tábuas/tora — muda a cor da máquina), desbloquear Terreno Leste ($2.000: cerca refeita, área dobra, bosque novo de 36 mudas) (v0.5.0)
6. ✅ Save automático (a cada 10 s + ao sair/trocar de aba) em localStorage `cerne.save.v1`: dinheiro, estoques, toras no chão, estado de cada árvore, terrenos, lenhadores, operador, nível da serra, pedido atual, posição e carga do jogador, aparência, horário. Progressão offline matemática (máx. 8 h) com painel "Enquanto você estava fora". Menu (botão ☰): salvar agora, copiar backup (texto CERNE1:…), restaurar backup, novo jogo (v0.6.0)

**MVP completo.**

## Expansões pós-MVP
7. ✅ Carregador (área "Carregador" ao lado do caminho do escritório; $200 / $600 / $1.400): recolhe toras do chão (reserva a pilha, junta pilhas próximas até 6) e descarrega no pátio. Com lenhador + carregador + operador a cadeia até as tábuas é 100% automática. Offline: taxa de 6 toras a cada 16 s por carregador; estado final do chão recalculado (v0.7.0)
8. ✅ Entregador (área "Entregador" em frente ao depósito de tábuas; $400 / $1.200): pega até 10 tábuas, leva à área de entrega e coloca no caminhão (espera o próximo cliente se preciso). Ciclo completo automático → dinheiro entra sozinho, inclusive offline (passa pelos pedidos reais, 1 caminhão a cada ~13 s). Pedidos limitados a 36 tábuas (carroceria). Ritmo medido: 1 lenhador ≈ 5,8 s/árvore; cadeia 1+1+operador+1 ≈ $26 mil/h no nível 1 da serra (v0.8.0)
9. ✅ Expansão/progressão: vagas extras (até 6 lenhadores, 6 carregadores, 4 entregadores, preços até $17 mil); Treinamento da equipe (em frente ao escritório, 5 níveis $3 mil → $120 mil, até 2× velocidade, vale também offline); Depósito como construção com dinheiro + tábuas (galpão coberto $5 mil + 100 táb. → 500; armazém $25 mil + 300 táb. → 1.500) com animação de obra; terrenos em sequência: Leste $2 mil → Norte $15 mil (72 árvores) → Oeste $50 mil (160 árvores). Próximo terreno só aparece depois de comprar o anterior (v0.9.0)
10. ✅ Estufa de secagem (canteiro à direita do pátio; $12 mil + 150 tábuas, com obra animada): tábuas comuns → tábuas secas ($45 cada, comum $15). Lotes de até 10 tábuas, 20 s; fecha a porta com lote cheio ou 3 s sem tábua nova. Manual: leve tábuas comuns à área com seta na porta e pegue as secas na área ao lado do estrado escuro. Automático: Abastecedor da estufa ($3 mil, deixa 20 tábuas de reserva). Metade dos pedidos passa a ser de tábuas secas; entregador pega o produto do pedido e devolve se o cliente seguinte quiser outro. Offline em fatias de 30 s (serra → estufa → entregas por produto). Medido: equipe 2+2+op+2+abastecedor ≈ $60 mil/h (v0.10.0)
    - 10.1: obras (depósito e estufa) recebem as tábuas que o jogador leva nas costas até a área amarela; o progresso fica salvo (`siteDeposits`) e o botão CONSTRUIR libera com tábuas completas + dinheiro. As obras não puxam mais tábuas do depósito (v0.10.1)
    - 10.2: Mochila (ao lado do treinamento, em frente ao escritório): 4 níveis $300 / $1.500 / $6.000 / $20.000 → 9/15, 12/20, 16/28, 20/36 (toras/tábuas). Salvo como `bagLevel`; `work.setBag()` (v0.10.2)
11. ✅ Personalização (botão de camiseta acima do menu): prévia 3D girando (arraste para girar), 9 abas — cabelo (6 estilos), cor do cabelo, pele, camisa, calça, sapatos, chapéu (boné/capacete/gorro/palha/nenhum), cor do chapéu, acessório (bigode/barba/óculos/óculos escuros). Itens pagos com dinheiro do jogo, ficam liberados para sempre; tocar num item bloqueado mostra a prévia antes de comprar. Salvo em `wardrobe` (look + owned) (v0.11.0)
12. ✅ Plantador: tocos não rebrotam mais sozinhos. Você planta parado ao lado de um toco (1,1 s, animação abaixado com muda na mão) ou toca no toco para ir até ele. Plantador NPC (placa "Plantador" em (-5.4,-1.0), até 6) planta sozinho. Offline: sem plantador os lenhadores só cortam o que está em pé e ficam tocos; com plantador replanta ~1 árvore/3,6 s por plantador. `npc/Planter.js`, `Forest.findStump/plant/count`, salvo em `planters` (v0.12.0)
13. ✅ Veículos internos (v0.13.0):
   - Caminhão de toras (placa em (7.4,4.4), aparece depois do 1º terreno; $6.000 + 2 melhorias 36/48 toras). Cada terreno novo ganha um "ponto de carga" na beira do bosque (leste (31.5,-1.2), norte (0,-24.6), oeste (-19.4,-2.6), 60 toras). Você e os carregadores deixam toras no ponto mais perto (pátio ou ponto de carga); o caminhão busca o ponto mais cheio (≥8 toras ou após 12 s) e descarrega no pátio, estacionado na garagem (2.4,4.3). Anda numa grade de navegação própria (`vnav`, folga 1,25 m, evita placas e áreas marcadas); empurra o jogador para fora da carroceria.
   - Empilhadeira (placa em (11.8,3.8), aparece depois do 1º entregador; $8.000 + melhorias 36/48): entregador que leva 24+ tábuas no garfo (subclasse de `Deliverer`).
   - Offline: caminhão = carregadores ×1,6; empilhadeira soma capacidade/22 s às entregas. Save: `logTruck {level,cargo}`, `loadPoints {id:n}`, `forklift` (nível).
   - Arquivos: `world/LoadPoint.js`, `vehicles/LogTruck.js`, `npc/Forklift.js`.
14. ✅ Descascador + esteiras (v0.14.0): obra em (-1.2,-6.6) (aparece depois de contratar o operador; $8.000 + 120 tábuas). Máquina em (2,-6.8); esteira de entrada puxa toras do pátio (até 4 na esteira), descasca em 0,9 s, esteira de saída leva toras claras (sem casca) até a entrada da serra. Com o descascador, toda tora passa por ele e a serra corta em 60% do tempo. Toras nas esteiras voltam ao pátio no save. Offline usa o ciclo reduzido. `sim/Debarker.js` (Belt genérica: polilinha com fila), `world/DebarkerView.js`.
15. ✅ Pedreira + pedra (v0.15.0):
   - Terreno "Pedreira" (x 44..68, z -44..20, exige Norte, $30.000; placa em (42.2,-1)) com 16 rochas (25 pedras cada, voltam a crescer 90 s depois de esgotar).
   - Você quebra pedra parado ao lado da rocha (picareta, 1 pedra por golpe direto nas costas, mesma capacidade das toras) ou toca na rocha para ir até ela. Leve ao estoque de pedras em (18,8.8) (área em (18,10.6), 400 pedras).
   - Mineiro NPC (placa em (47.5,7.5), até 4) faz o mesmo sozinho. "Comprar 20 pedras" ($1.200) em (15.4,8.6).
   - O estoque e o chip "Pedras" aparecem com o galpão coberto, o terreno Norte ou a primeira pedra.
   - Obras podem exigir pedras (`offer.stone`): saem do estoque ao construir. O armazém grande (depósito nível 2) agora pede 60 pedras.
   - Offline: mineiros × 10 pedras / 34 s.
   - Arquivos: `sim/Quarry.js`, `world/QuarryView.js`, `world/StoneStack.js`, `npc/Miner.js`. Save: `stone`, `miners`, `rocks [[pedra,timer]]`.
16. ✅ Novos produtos (v0.16.0): sistema genérico de máquinas (`CONFIG.machines`, `CONFIG.products`).
   - Fila ao sul do pátio (z 10.5): Serra de vigas (x 2.5; 1 tora → 1 viga $70; $15k + 150 táb. + 40 pedras), Montadora de pallets (x 8; 4 tábuas → 1 pallet $90; $25k + 200 + 60), Prensa de compensado (x 13.5; 3 secas → 1 compensado $220; $40k + 300 + 100; exige estufa).
   - As obras aparecem junto com o estoque de pedras.
   - Cada máquina tem: área de entrada (seta, insumo empilhado na porta), estoque do produto e área para pegar; depois de pronta, a mesma placa vira "Contratar abastecedor" (`npc/MachineFeeder.js`, genérico: tira do pátio/depósito/secas deixando reserva).
   - Clientes passam a pedir os produtos liberados (peso em `products.*.weight`, quantidade × `qtyMul`). Entregador e empilhadeira levam qualquer produto (via `stocks`). Você carrega metade da capacidade de tábuas em produtos grandes.
   - Chip único "Vigas · Pallets · Comp." no HUD; chips de recursos agora sempre em coluna.
   - Offline: termina o insumo que estava na máquina; com abastecedor produz em fatias consumindo o estoque de origem; caminhões levam os produtos.
   - Save: `machines {id:{built,input,out,feeder}}`.
   - Arquivos: `sim/Machine.js`, `world/MachineView.js`. `PlankStack` aceita `size/perLayer/layers`. `Orders.enabled` (Set) substitui `dryEnabled` (getter/setter mantidos). Pedra decorativa (3,15) mudou para (-2.5,16.5).
17. ✅ Ajustes pedidos depois do teste (v0.17.0):
   - Pedras viram material de obra como as tábuas: pegue no estoque (área nova ao norte, (18,7)) e leve nas costas até o quadrado da obra (`item.stoneDep`). Save: `siteStone`.
   - HUD com letras e números menores; cartão de pedidos lista todas as vagas.
   - Botão "Equipe" (ícone de pessoas, acima da camiseta): lista lenhadores, plantadores, carregadores, entregadores e mineiros; troca a função de graça (`ui/TeamPanel.js`, `dismissWorker` devolve o que carregava).
   - Vagas de carga: até 3 clientes ao mesmo tempo (vaga 1 grátis em x 13; vaga 2 $800 em x 5; vaga 3 $3.000 em x -3). Caminhões andam numa faixa (z 24.6) e encostam na vaga (z 22.2); pedido pequeno vem de caminhonete. `OrderSlot` por vaga, `Orders.make()`; save `orders.slots`, `orders.enabled`, `docksOpen`.
   - Tipos de comprador por produto (`CONFIG.buyers`, nome + cor do caminhão). Produtos novos: serragem (1 saco por tora serrada, monte ao norte da serra (6.2,-5), clientes pedem depois de 10 sacos), lenha (Rachador de lenha em (15.5,-14): 1 tora → 3 feixes $8, aparece com o operador), mourões (Torno em (-1,-14): 1 tora → 2 mourões $22). Máquinas aceitam `outPer` e `z` próprios.
   - Entregadores dividem os pedidos entre si (`Deliverer.all`, `_need`): cada um pega só o que falta e escolhe o pedido com estoque.
   - Modo editar (lápis à esquerda): tocar seleciona; arrastar move; Girar; Excluir (2 toques); Adicionar (muda $50, rocha da pedreira $300, escritório, casa, galpãozinho, banco, flores, arbusto, poste, cerca, pedra). Não deixa colocar em áreas de trabalho, placas, prédios ou fora do terreno. `ui/Editor.js`, `world/Decor.js` (escritório e pedras decorativas saíram do World). Save: `trees` agora tem posição de cada árvore, `rocks` com posição, `decor` (lista). Saves antigos continuam carregando.
   - `Colliders.remove(c)`; `Forest.addTree/moveTree/removeTree/toRows/loadRows` (Stage.REMOVED); `Quarry.addRock/moveRock/removeRock/toRows/loadRows/openUp`. `Input.onDragStart/onDrag/onDragEnd`.
18. ✅ Segunda rodada de ajustes (v0.18.0):
   - Painéis rolam no iPhone (o bloqueio de `touchmove` libera dentro de `.panel`). Equipe abre na parte de baixo, com botão grande "Fechar".
   - Equipe: botão "Descansar" / "Voltar ao trabalho" — o funcionário larga o que carrega, anda até a porta do escritório (ou casa) e some lá dentro; não conta na produção offline. Save: `resting` (lista de funções).
   - Mochila mista: `work.items` (ordem de entrada), capacidade única em itens (base 10; níveis 15/25/40/60/80/100). Carrega toras, tábuas, secas, pedras e produtos juntos; cada área pega/entrega só o tipo certo. Pilha nas costas mostra até 30 itens e achata se ficar alta. Save: `player.items`.
   - Caçamba de descarte (verde) em (-3.6,6.9), área em (-3.6,8.4): esvazia as costas.
   - Estoque de pedras visível desde o início. Depósito de pedras (obra em (15.4,5.7)): coberto 1.000 pedras ($2.500 + 60 táb.), grande 3.000 ($12.000 + 150 táb. + 100 pedras). Save: `stoneDepot`.
   - Modo editar com "Grupo" (ligado por padrão): tocar numa árvore pega o bosque todo (árvores a até 3,8 m umas das outras), numa rocha pega o grupo de rochas; mover, girar (45° em volta do centro) e excluir em grupo. Novo item "Bosque (12 mudas)" $500.
19. ✅ Pedidos só do que você já faz (v0.18.1): `orders.available()` (main) = tábuas sempre; secas com a estufa; produto de máquina depois de construir; serragem com ≥ 8 sacos. Produto sem estoque pesa 30% no sorteio (tábua nunca é penalizada). Pedidos salvos de produtos ainda não liberados (sem nada entregue) são trocados na hora (`DeliveryDock.checkOrder`). `orders.enabled` salvo não é mais usado para decidir.
20. ✅ Dispensar cliente (v0.18.3): toque duas vezes (em até 0,45 s) no caminhão parado ou chegando → ele vai embora sem pagar e vem outro (`DeliveryDock.hit/giveUp`, toque duplo tratado em `input.onTap`). Não há mais limite de tempo de espera.
21. ✅ Modo teste no Menu (v0.18.4): "Dinheiro infinito" (`economy.setInfinite`: compras não descontam, caixa mostra ∞) e "Obras sem tábuas e pedras" (`shop.freeMaterials`). Guardado em `cerne.settings` (testMoney/testFree), não no save.
22. ✅ Ninguém esbarra em você (v0.18.5): funcionário andando que tem você logo à frente (`blocksWay`, 1,15 m; empilhadeira 1,9 m) para e espera; depois de 2,5 s passa por você sem empurrar. Caminhão de toras para se você estiver até 5 m à frente (segue depois de 4 s). Só quem está parado bloqueia o seu caminho.
23. ✅ Desempenho (v0.19.0): chamadas de desenho num cenário cheio (33 funcionários, todas as máquinas) caíram de ~1.020 para ~615.
   - `CharacterModel`: cada parte que se mexe (tronco, pernas, braços, cabeça) é UMA malha com cores nos vértices; todos os personagens dividem o mesmo material (17 → 6 malhas por personagem). `setColor/setHair/setHeadwear/setAccessory` remontam só o necessário. Ferramenta (machado/picareta) continua separada.
   - `ZoneMarker`: borda + ícones numa malha só. `Sign`: poste + tábua numa malha e a face de texto num plano (de 7 para 2 chamadas).
   - Menu → "Gráficos leves (sem sombras)": desliga sombras e baixa a resolução para 1,25x (`engine.setLowQuality`, salvo em `cerne.settings.lowGfx`).
   - CPU: atualização de tudo ~0,1–0,2 ms por quadro no cenário cheio (não é gargalo). Pedido de serragem nunca pede mais que o estoque. Dica na vaga diz onde pegar o produto pedido.

## Regra de design (definida pelo Maurício)
O jogo é uma evolução: no começo não há dinheiro para funcionários, então **o jogador consegue fazer todos os trabalhos manualmente** (cortar, carregar, transportar, operar). Funcionários e veículos contratados depois automatizam essas mesmas tarefas. Todo sistema novo precisa ter a versão manual e a versão automática.

## Decisões técnicas
- Câmera de ângulo fixo (sem girar) com zoom 0,6×–2,8× (padrão 1,6×). Névoa e área de sombra acompanham o zoom.
- Toque = deslocamento curto (<12 px) e rápido (<350 ms); arrastar em qualquer lugar = joystick; joystick cancela o destino do toque.
- Materiais compartilhados por cor, InstancedMesh para árvores/cerca/pedras/toras.
- Sombra só num raio de 16 m ao redor do jogador; resolução cai sozinha se FPS < 45.
- Loop pausa quando o app vai para segundo plano.

## Como gerar o arquivo
`npm install` e `node build.mjs` → `dist/index.html`.

## Próxima etapa
Próximas ideias: melhorias da estufa (lote maior / mais rápida), terceira máquina (vigas ou pallets), PWA no GitHub Pages, personalização do personagem, plantador.

## Notas da Etapa 2
- Tocos ficam no chão até alguém plantar (você parado ao lado, ou o plantador).
- Toras no chão (máx. 150) são recolhidas pelo jogador; no futuro também por carregadores/veículos.
- Jogador não atravessa o lenhador (empurrão simples em main.js).

## Notas da Etapa 6
- O mapa é gerado com sementes fixas (rng 11 floresta, rng 23 pedidos); terrenos liberados são reaplicados na mesma ordem no load, então os índices das árvores batem.
- Save do artifact fica no Safari do aparelho (por endereço). Limpar dados do Safari apaga o save → por isso o backup em texto.

## Notas da Etapa 4
- Jogador carrega um tipo por vez (toras OU tábuas). Capacidades: 6 toras, 10 tábuas.
- Versão automática da entrega (funcionário de logística/empilhadeira) fica para depois.

## 24. Arte final (v0.20.0-arte)
- Estilo "Aconchegante colorido": paleta nova em config.js (céu, grama, telhados).
- core/DayNight.js: ciclo dia/noite (dayLength 600 s = 10 min reais), cúpula de céu com gradiente, 42 nuvens instanciadas, sol/hemisfério interpolados, neblina acompanha o horizonte. Relógio ☀/☾ HH:MM no chip de FPS.
- À noite: janelas (mat 0x9fd3e6) ficam amarelas; postes acendem (GLOW_MAT esfera + POOL_MAT círculo no chão, aditivos e suaves).
- Árvores: copa em 4 camadas de cone com gradiente por vértice.
- Personagens: partes arredondadas (RoundedBox) mescladas por grupo, nariz e bochechas, material único.
- Grama: 2200 tufos + até 500 flores instanciados; Decor com poste, banco, flores, arbusto, cerca, casa, galpão.
- Moedas douradas saltam ao receber pagamento (world/Coins.js).

## 25. Visual "massinha" (v0.21.0-massinha) — pedido com imagens de referência (avatares 3D lisos, sem rosto)
- core/Clay.js: patch global no MeshLambertMaterial (brilho suave nas bordas, CLAY_RIM) + softBox() (RoundedBoxGeometry) substitui todos os BoxGeometry; flatShading desligado no jogo todo; ícosaedros/dodecaedros com mais detalhe.
- Personagem refeito: cabeça esfera sem rosto + orelhas, tronco "feijão" (Capsule), braços/pernas cápsula, sapatos esfera achatada. Cabelos (touca + nuca + topete), chapéus (boné, capacete, chapéu de aba com faixa, gorro), óculos em anel, barba contornando o queixo. Partes com escala/rotação (_add aceita sc, ry, rz).
- Árvores: camadas em LatheGeometry ("cone fofo" com borda arredondada), 11 segmentos.
- Luz: PCFSoftShadowMap, hemisfério mais forte e sol mais fraco (menos contraste).
- HUD claro: cartões creme, texto cacau (--cream agora é a cor do texto, --bark o fundo), sombras macias (--soft), placas com cartão creme arredondado.
- ~600k triângulos com zoom máximo (inclui sombra).

## 26. Sempre dia, guarda-roupa grande e Parque de diversões (v0.22.0-parque)
- DayNight.alwaysDay = true (hora fixa 0.46); o relógio some do chip (só FPS). O ciclo continua no código se quiser voltar.
- CharacterModel: setTop (camiseta, manga, regata, moletom, jaqueta), setLegwear (calca, bermuda, short), setFootwear (sapato, tenis, bota, chinelo). Cabelos novos: topete, chanel, cacheado, coque, marias, blackpower. Chapéus novos: palha, pescador, boina, cartola ('hat' = vaqueiro). Acessórios novos: cavanhaque, fone, colar (no corpo), brinco. Cores fixas: fleece, gold, sole, white.
- Wardrobe: slots novos top/legwear/footwear + muitas cores; abas quebram linha.
- Parque: CONFIG.park; world/FunPark.js (tenda listrada + roda-gigante girando, colisores); shop item 'park' ($300 + 10 tábuas) e depois vira "JOGAR" (oferta com action/costText/sign; Shop/BuyCard suportam). ui/FunPanel.js: apostas $10–$5.000, jogos Machado no alvo (4x/2x/1x), Copinhos (2,5x), Cronômetro 5,00 s (5x/2x/1x). Save: parkBuilt, park.net.
