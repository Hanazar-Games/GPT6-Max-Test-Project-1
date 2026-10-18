import { DEFAULT_TRAFFIC_SETTINGS, TRAFFIC_TYPES, normalizeTrafficSettings, setTrafficShare, trafficAllowed } from './traffic.js';
import './traffic.css';

export function mountTrafficSettings(settings, onApply) {
  let draft = normalizeTrafficSettings(settings), applied = JSON.stringify(draft), mission;
  document.querySelector('#mode-options').insertAdjacentHTML('afterend', `
    <details id="traffic-settings" class="traffic-settings">
      <summary>道路 NPC 交通 <span id="traffic-summary"></span></summary>
      <div class="traffic-content">
        <p>勾选允许出现的车型，拖动比例后，其余已选车型自动分配剩余份额，总计 100%。车辆沿两侧车道行驶，会发生碰撞。</p>
        <label class="traffic-density" for="traffic-density">车流密度 <output id="traffic-density-value" for="traffic-density"></output></label>
        <input id="traffic-density" type="range" min="0" max="12" step="1" aria-describedby="traffic-status">
        <fieldset><legend>车型与生成比例</legend>${Object.entries(TRAFFIC_TYPES).map(([type, { name }]) => `
          <div class="traffic-type">
            <label for="traffic-enable-${type}"><input id="traffic-enable-${type}" type="checkbox" data-traffic-enable="${type}">${name}</label>
            <output id="traffic-share-${type}" for="traffic-range-${type}"></output>
            <input id="traffic-range-${type}" type="range" min="0" max="100" step="1" data-traffic-share="${type}" aria-label="${name}生成比例">
          </div>`).join('')}
        </fieldset>
        <div class="traffic-presets"><button type="button" data-traffic-preset="default">货车为主 · 默认</button><button type="button" data-traffic-preset="balanced">均衡车流</button><button type="button" data-traffic-preset="heavy">仅大货车</button><button type="button" data-traffic-preset="off">关闭交通</button></div>
        <p id="traffic-route-note"></p><p id="traffic-status" role="status"></p>
        <button id="apply-traffic" type="button" class="secondary-button">应用交通设置</button>
        <small>当前页面内保留；重飞、换艇与换图沿用。确认飞行配置时也会应用。</small>
      </div>
    </details>`);
  const root = document.querySelector('#traffic-settings'), $ = id => root.querySelector(`#${id}`);
  const render = () => {
    const count = Object.values(draft.mix).filter(Boolean).length, enabled = draft.density && count;
    $('traffic-density').value = draft.density;
    $('traffic-density').setAttribute('aria-valuetext', `${draft.density} 辆每公里`);
    $('traffic-density-value').textContent = `${draft.density} 辆 / 公里`;
    for (const type of Object.keys(TRAFFIC_TYPES)) {
      const value = draft.mix[type], range = $(`traffic-range-${type}`);
      $(`traffic-enable-${type}`).checked = value > 0;
      range.value = value; range.disabled = !value || count === 1;
      range.setAttribute('aria-valuetext', `${value}%${count === 1 && value ? '，唯一车型' : ''}`);
      $(`traffic-share-${type}`).textContent = `${value}%`;
    }
    const allowed = !mission || trafficAllowed(mission), pending = JSON.stringify(draft) !== applied;
    $('traffic-summary').textContent = !allowed ? '本航线无车' : enabled ? `${draft.density} 辆/km · 大货车 ${draft.mix.truck + draft.mix.semi}%` : '已关闭';
    $('traffic-route-note').textContent = allowed ? '地球与纯加速无障碍航线始终无车；其他航线按此配置生成。' : '当前为无障碍航线，保持无车；此配置将在其他航线使用。';
    $('traffic-status').textContent = `${pending ? '待应用' : '已应用'} · ${enabled ? `车型比例合计 100%${count === 1 ? ' · 单车型自动设为 100%' : ''}` : !count ? '未选择车型，不生成车辆' : '密度为 0，不生成车辆'}`;
    $('apply-traffic').disabled = !pending;
  };
  const apply = () => {
    if (JSON.stringify(draft) === applied) return true;
    if (onApply(normalizeTrafficSettings(draft)) === false) return false;
    applied = JSON.stringify(draft); render(); return true;
  };
  root.addEventListener('input', event => {
    if (event.target.id === 'traffic-density') draft = normalizeTrafficSettings({ ...draft, density: event.target.value });
    else if (event.target.dataset.trafficShare) draft = setTrafficShare(draft, event.target.dataset.trafficShare, event.target.value);
    else return;
    render();
  });
  root.addEventListener('change', event => {
    const type = event.target.dataset.trafficEnable;
    if (type) { draft = setTrafficShare(draft, type, event.target.checked ? 25 : 0); render(); }
  });
  root.addEventListener('click', event => {
    const preset = event.target.closest('[data-traffic-preset]')?.dataset.trafficPreset;
    if (!preset) return;
    draft = normalizeTrafficSettings(preset === 'off' ? { ...draft, density: 0 } : preset === 'balanced' ? { density: draft.density || 8, mix: { car: 25, van: 25, truck: 25, semi: 25 } } : preset === 'heavy' ? { density: draft.density || 8, mix: { truck: 40, semi: 60 } } : DEFAULT_TRAFFIC_SETTINGS);
    render();
  });
  $('apply-traffic').addEventListener('click', apply);
  render();
  return { apply, updateMission(value) { mission = value; render(); } };
}
