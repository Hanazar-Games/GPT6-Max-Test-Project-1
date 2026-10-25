import { DRIVING_FIELDS, DRIVING_PRESETS, normalizeDrivingSettings, drivingKey } from './flight-motion.js';

export function mountDrivingSettings({ guide, settings, onApply, getStatus }) {
  let applied = normalizeDrivingSettings(settings), draft = applied;
  guide.querySelector('.touch-settings').insertAdjacentHTML('beforebegin', `
    <details id="driving-settings" class="driving-settings">
      <summary>驾驶手感与转弯半径 <span id="driving-summary"></span></summary>
      <div class="driving-content">
        <p>道路航向自动跟随；半径系数调整横向变线弧线，不改变道路弯曲。键盘和触屏共用这些物理参数。</p>
        <label class="driving-preset" for="driving-preset">驾驶预设<select id="driving-preset"><option value="custom" disabled>自定义</option>${Object.entries(DRIVING_PRESETS).map(([id, preset]) => `<option value="${id}">${preset.label}</option>`).join('')}</select></label>
        ${Object.entries(DRIVING_FIELDS).map(([key, field]) => {
          const scale = field.unit === '%' ? 100 : 1;
          return `
          <div class="driving-field">
            <label for="driving-${key}">${field.label}<output id="driving-${key}-value" for="driving-${key} driving-${key}-number"></output></label>
            <input id="driving-${key}" type="range" min="${field.min * scale}" max="${field.max * scale}" step="${field.step * scale}" aria-describedby="driving-${key}-help">
            <input id="driving-${key}-number" type="number" min="${field.min * scale}" max="${field.max * scale}" step="${field.step * scale}" aria-label="${field.label}数值" aria-describedby="driving-${key}-help">
            <small id="driving-${key}-help">${field.help}</small>
          </div>`;
        }).join('')}
        <p class="driving-tip">想更稳：提高松手抓地和高速稳定。想保留漂移：降低松手抓地，配合反打或制动收漂。可拖动滑杆，也可直接输入精确数值。</p>
        <div class="driving-actions"><button id="apply-driving" type="button" class="secondary-button">应用驾驶设置</button><button id="reset-driving" type="button" class="text-button">恢复均衡默认</button></div>
        <p id="driving-status" role="status"></p>
        <small>飞行中应用将在重飞或下一站生效；未应用的修改不生效。当前页面内保留，换艇与换图沿用，刷新恢复默认。不同驾驶配置的纪录与赛事航迹分别计算。</small>
      </div>
    </details>`);
  const root = guide.querySelector('#driving-settings'), $ = id => root.querySelector(`#${id}`);
  const render = (message = '') => {
    const preset = Object.entries(DRIVING_PRESETS).find(([, preset]) => drivingKey(preset.settings) === drivingKey(draft));
    const pending = drivingKey(draft) !== drivingKey(applied);
    $('driving-preset').value = preset?.[0] ?? 'custom';
    $('driving-summary').textContent = `${preset?.[1].label.split(' · ')[0] ?? '自定义'}${pending ? ' · 待应用' : ''}`;
    for (const [key, field] of Object.entries(DRIVING_FIELDS)) {
      const value = draft[key], text = field.unit === '%' ? `${Math.round(value * 100)}%` : `${value.toFixed(2)}${field.unit}`;
      $(`driving-${key}`).value = field.unit === '%' ? Math.round(value * 100) : value;
      $(`driving-${key}-number`).value = field.unit === '%' ? Math.round(value * 100) : value;
      $(`driving-${key}`).setAttribute('aria-valuetext', text);
      $(`driving-${key}-number`).setAttribute('aria-valuetext', text);
      $(`driving-${key}-value`).textContent = text;
    }
    $('driving-status').textContent = message || (pending ? '待应用 · 点击「应用驾驶设置」保存。' : '已保存 · 重飞、换艇与换图沿用。');
  };
  for (const key of Object.keys(DRIVING_FIELDS)) {
    const update = event => {
      const value = event.target.valueAsNumber / (DRIVING_FIELDS[key].unit === '%' ? 100 : 1);
      draft = normalizeDrivingSettings({ ...draft, [key]: Number.isFinite(value) ? value : draft[key] });
      render();
    };
    $(`driving-${key}`).addEventListener('input', update);
    $(`driving-${key}-number`).addEventListener('change', update);
  }
  $('driving-preset').addEventListener('change', event => {
    const preset = DRIVING_PRESETS[event.target.value];
    if (preset) draft = normalizeDrivingSettings(preset.settings);
    render();
  });
  $('reset-driving').addEventListener('click', () => { draft = normalizeDrivingSettings(); render(); });
  $('apply-driving').addEventListener('click', () => {
    if (!onApply(draft)) { render('未能应用驾驶设置，请重试。'); return; }
    applied = draft;
    render(getStatus() === 'menu' ? '已应用 · 下一次出发使用这些设置。' : '已保存 · 重飞或下一站生效，当前航程保持原手感。');
  });
  render();
}
