import { MISSIONS, CRAFTS } from './missions.js';
import { UPGRADES, upgradeCraft } from './upgrades.js';
import { getContracts } from './expedition.js';

const $ = id => document.getElementById(id);
const contractRows = (contracts, settled = false, paid = true) => contracts.map(item => `<li data-done="${item.done}"><span class="contract-check">${item.done ? '✓' : '◇'}</span><span><strong>${item.name}</strong><small>${item.hint}</small></span><b>${Math.min(item.progress, item.target)} / ${item.target}</b><em>${settled && (!paid || !item.done) ? '—' : '+2'}</em></li>`).join('');

export function mountExpeditionUI() {
  $('mode-options').insertAdjacentHTML('beforeend', '<button data-mode="expedition" aria-pressed="false"><span>远征补给<small>沿途委托 · 改装成长 · 十站远征</small></span><b>◎</b></button>');
  $('cup-brief').insertAdjacentHTML('afterend', '<div id="expedition-brief" class="expedition-brief" hidden><strong>把沿途的收获，变成下一程的底气。</strong><p>依次穿越十颗星球的山路。每站交付获 2 补给点；额外核心、精准过门与勘探委托每项再获 2 点。委托可自由取舍，交付成功才结算。</p><div><span>01 / 完成委托</span><span>02 / 补给改装</span><span>03 / 穿越星海</span></div><small>九次中途补给，可升级引擎、充能、装甲或吸附范围，每项最多两级。失败可重试；返回基地或刷新结束远征。远征不计入个人幽灵纪录。</small></div>');
  $('hud').insertAdjacentHTML('beforeend', '<aside id="expedition-hud" class="expedition-hud" aria-label="远征委托" hidden><div class="expedition-heading"><span id="expedition-stage">远征 / 01</span><b id="expedition-wallet">0 补给</b></div><ul id="flight-contracts" class="contract-list"></ul><small id="expedition-build"></small></aside>');
  $('result-details').insertAdjacentHTML('beforebegin', '<section id="expedition-result" class="expedition-result" aria-label="远征补给站" hidden><div id="expedition-route" class="cup-stage-strip"></div><div class="supply-heading"><span><small id="supply-caption">本次交付</small><strong id="supply-earned"></strong></span><span><small>可用补给</small><strong id="supply-balance"></strong></span></div><ul id="settled-contracts" class="contract-list"></ul><div id="supply-shop"><h3>下一程，由你改装。</h3><p>升级立即装配，下一站生效。也可保留补给，直接出发。</p><div id="upgrade-options" class="upgrade-options"></div></div><div id="expedition-summary"></div><p id="supply-build" class="supply-build" aria-live="polite"></p></section>');
  $('retry').insertAdjacentHTML('beforebegin', '<button id="continue-expedition" class="primary-button" hidden><span>继续远征</span><b>→</b></button>');
}

export function renderExpeditionHUD(run, game) {
  $('expedition-stage').textContent = `远征 / ${run.stage + 1} OF ${MISSIONS.length}`;
  $('expedition-wallet').textContent = `${run.supply} 补给`;
  $('flight-contracts').innerHTML = contractRows(getContracts(game));
  const equipped = UPGRADES.filter(item => run.upgrades[item.id]).map(item => `${item.name} ${run.upgrades[item.id]}`);
  $('expedition-build').textContent = equipped.length ? equipped.join(' · ') : '交付 +2 · 每项委托 +2 · 成功后领取';
}

export function renderSupply(run) {
  $('supply-balance').textContent = `${run.supply} 点`;
  $('supply-shop').hidden = run.status !== 'resupply';
  $('upgrade-options').innerHTML = UPGRADES.map(item => {
    const level = run.upgrades[item.id] ?? 0;
    const maxed = level === item.max;
    return `<button data-upgrade="${item.id}" ${maxed || run.supply < item.cost ? 'disabled' : ''}><span class="upgrade-symbol">${item.symbol}</span><span><strong>${item.name}<i>${level} / ${item.max}</i></strong><small>${item.description}</small><b>${maxed ? '已达满级' : `${item.cost} 补给 · ${run.supply < item.cost ? '补给不足' : `升至 ${level + 1} 级`}`}</b></span></button>`;
  }).join('');
  const craft = upgradeCraft(CRAFTS.find(item => item.id === run.craftId), run.upgrades);
  $('supply-build').textContent = `当前装配 · 巡航 ${Math.round(craft.speed * 3.6)} / 冲刺 ${Math.round(craft.boostSpeed * 3.6)} km/h · 装甲 ${craft.hull} · 充能 ${craft.recharge}/s · 吸附 ${craft.pickupRange.toFixed(1)}m`;
}

export function renderExpeditionResult(run, game) {
  const won = game.status === 'won';
  const complete = run.status === 'complete';
  const leg = won ? run.legs.at(-1) : null;
  $('expedition-route').innerHTML = MISSIONS.map((mission, index) => `<span data-state="${index < run.legs.length ? 'done' : index === run.stage ? 'current' : 'pending'}"><b>${index < run.legs.length ? '✓' : mission.number}</b>${mission.name}</span>`).join('');
  $('supply-caption').textContent = won ? '本次交付与委托' : '本次未结算';
  $('supply-earned').textContent = `+${leg?.earned ?? 0} 补给`;
  $('settled-contracts').innerHTML = contractRows(leg?.contracts ?? getContracts(game), true, won);
  $('result-eyebrow').textContent = complete ? 'EXPEDITION COMPLETE / 全程归航' : `LUNAR EXPEDITION / 第 ${run.stage + 1} 站`;
  if (won) {
    $('result-symbol').textContent = complete ? '✦' : '◎';
    $('result-symbol').style.color = '#94ebc6';
    $('result-title').textContent = complete ? '十星走过，满载归来。' : '补给已到，整装再出发。';
    $('result-copy').textContent = complete ? `${game.craft.name}已完成 ${(MISSIONS.reduce((sum, item) => sum + item.length, 0) / 1000).toFixed(1)} 公里远征，十座基地的能量全部送达。` : `${game.mission.name}交付完成。下一站 ${MISSIONS[run.stage + 1].name}；启航时补满装甲与能量。`;
  } else $('result-copy').textContent += ` 本站委托未发奖；已购升级与 ${run.supply} 点补给保留，重试可继续远征。`;
  $('expedition-summary').hidden = !complete;
  if (complete) {
    const earned = run.legs.reduce((sum, item) => sum + item.earned, 0);
    const contracts = run.legs.flatMap(item => item.contracts).filter(item => item.done).length;
    const time = run.legs.reduce((sum, item) => sum + item.time, 0);
    $('expedition-summary').innerHTML = `<strong>${contracts} / ${MISSIONS.length * 3} 委托完成 · ${earned} 补给赚取</strong><p>成功航程 ${time.toFixed(2)}s · 改装花费 ${earned - run.supply} 点 · 结余 ${run.supply} 点</p>`;
  }
  $('continue-expedition').querySelector('span').textContent = complete ? '开启新的远征' : `前往第 ${run.stage + 2} 站`;
  renderSupply(run);
}
