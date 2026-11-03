import { DRIVING_FIELDS, DRIVING_PRESETS, normalizeDrivingSettings, drivingKey } from './flight-motion.js';

export function mountDrivingSettings({ guide, settings, onApply, getStatus }) {
  let applied = normalizeDrivingSettings(settings), draft = applied, invalidField = null;
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
            <input id="driving-${key}-number" type="number" inputmode="${scale === 100 ? 'numeric' : 'decimal'}" min="${field.min * scale}" max="${field.max * scale}" step="${field.step * scale}" aria-label="${field.label}数值" aria-describedby="driving-${key}-help">
            <small id="driving-${key}-help">${field.help}<span class="driving-range">范围 ${field.min * scale}–${field.max * scale}${field.unit} · 步进 ${field.step * scale}${field.unit}</span></small>
          </div>`;
        }).join('')}
        <p class="driving-tip">想更稳：提高松手抓地和高速稳定。想保留漂移：降低松手抓地，配合反打或制动收漂。可拖动滑杆，也可输入数值；离开输入框时自动按范围和步进校准。</p>
        <p id="driving-status" role="status" tabindex="-1"></p>
        <div class="driving-actions"><button id="apply-driving" type="button" class="secondary-button">应用驾驶设置</button><button id="discard-driving" type="button" class="text-button" hidden>撤销未应用更改</button><button id="reset-driving" type="button" class="text-button">恢复均衡默认</button></div>
        <small>飞行中应用将在重飞或下一站生效；未应用的修改不生效。当前页面内保留，换艇与换图沿用，刷新恢复默认。不同驾驶配置的纪录与赛事航迹分别计算。</small>
      </div>
    </details>`);
  const root = guide.querySelector('#driving-settings'), $ = id => root.querySelector(`#${id}`);
  const render = (message = '', editing = null) => {
    const focused = root.ownerDocument.activeElement;
    const preset = Object.entries(DRIVING_PRESETS).find(([, preset]) => drivingKey(preset.settings) === drivingKey(draft));
    const changed = Object.keys(DRIVING_FIELDS).filter(key => draft[key] !== applied[key]).length;
    const pending = changed > 0;
    $('driving-preset').value = preset?.[0] ?? 'custom';
    $('driving-summary').textContent = `${preset?.[1].label.split(' · ')[0] ?? '自定义'}${invalidField ? ' · 待完成输入' : pending ? ` · ${changed} 项待应用` : ''}`;
    for (const [key, field] of Object.entries(DRIVING_FIELDS)) {
      const value = draft[key], text = field.unit === '%' ? `${Math.round(value * 100)}%` : `${value.toFixed(2)}${field.unit}`;
      $(`driving-${key}`).value = field.unit === '%' ? Math.round(value * 100) : value;
      if ($(`driving-${key}-number`) !== editing) $(`driving-${key}-number`).value = field.unit === '%' ? Math.round(value * 100) : value;
      $(`driving-${key}`).setAttribute('aria-valuetext', text);
      $(`driving-${key}-number`).setAttribute('aria-valuetext', text);
      $(`driving-${key}-number`).setAttribute('aria-invalid', String(invalidField === key));
      $(`driving-${key}-value`).textContent = text;
    }
    $('driving-status').textContent = invalidField ? `请完成「${DRIVING_FIELDS[invalidField].label}」的有效数值；离开输入框将恢复最近有效值。` : message || (pending ? `待应用 · 已修改 ${changed} 项，点击「应用驾驶设置」确认。` : '已保存 · 重飞、换艇与换图沿用。');
    $('apply-driving').disabled = !pending || !!invalidField;
    $('discard-driving').hidden = !pending && !invalidField;
    $('reset-driving').disabled = !invalidField && drivingKey(draft) === drivingKey(DRIVING_PRESETS.balanced.settings);
    if ([$('apply-driving'), $('discard-driving'), $('reset-driving')].includes(focused) && (focused.disabled || focused.hidden)) $('driving-status').focus();
  };
  for (const key of Object.keys(DRIVING_FIELDS)) {
    const update = (event, editing = false) => {
      const value = event.target.valueAsNumber / (DRIVING_FIELDS[key].unit === '%' ? 100 : 1);
      invalidField = editing && !Number.isFinite(value) ? key : null;
      draft = normalizeDrivingSettings({ ...draft, [key]: Number.isFinite(value) ? value : draft[key] });
      render('', editing ? event.target : null);
    };
    $(`driving-${key}`).addEventListener('input', event => update(event));
    $(`driving-${key}-number`).addEventListener('input', event => update(event, true));
    $(`driving-${key}-number`).addEventListener('change', event => update(event));
  }
  $('driving-preset').addEventListener('change', event => {
    const preset = DRIVING_PRESETS[event.target.value];
    if (preset) draft = normalizeDrivingSettings(preset.settings);
    invalidField = null;
    render();
  });
  $('reset-driving').addEventListener('click', () => { draft = normalizeDrivingSettings(); invalidField = null; render(); });
  $('discard-driving').addEventListener('click', () => { draft = applied; invalidField = null; render('已撤销未应用更改 · 保留上次应用的驾驶设置。'); });
  $('apply-driving').addEventListener('click', () => {
    if ($('apply-driving').disabled) return;
    if (!onApply(draft)) { render('未能应用驾驶设置，请重试。'); return; }
    applied = draft;
    render(getStatus() === 'menu' ? '已应用 · 下一次出发使用这些设置。' : '已保存 · 重飞或下一站生效，当前航程保持原手感。');
  });
  render();
}
