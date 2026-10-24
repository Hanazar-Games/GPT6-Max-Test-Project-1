export function touchSteer(position, sensitivity = 1) {
  if (!Number.isFinite(position) || Math.abs(position) <= .08) return 0;
  const gain = Number.isFinite(sensitivity) ? Math.max(.5, Math.min(1.5, sensitivity)) : 1;
  return Math.sign(position) * Math.min(1, (Math.min(1, Math.abs(position)) - .08) / .92 * gain);
}

export function mountTouchControls({ root, guide, controls, icon, isActive, onChange, onCruise, onActivate }) {
  root.innerHTML = `
    <div class="touch-steering">
      <span id="touch-steer-help" class="touch-caption">左右滑动 · 松手回正</span>
      <div id="touch-steer" class="touch-steer" role="slider" tabindex="0" aria-label="横向转向" aria-describedby="touch-steer-help" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="0" aria-valuetext="居中" aria-orientation="horizontal">
        <span class="steer-arrow" aria-hidden="true">←</span><span class="steer-thumb" aria-hidden="true">↔</span><span class="steer-arrow" aria-hidden="true">→</span>
      </div>
      <div class="touch-arrows" hidden><button data-control="left" aria-label="向左" aria-pressed="false">←</button><button data-control="right" aria-label="向右" aria-pressed="false">→</button></div>
    </div>
    <div class="touch-action-group"><span id="touch-throttle-help" class="touch-caption">点按巡航 · 按住冲刺</span>
      <div class="touch-actions">
        <button id="touch-cruise" class="touch-go" aria-label="开启巡航油门" aria-pressed="false">巡航油门</button>
        <button data-control="accelerate" class="touch-go" aria-label="按住加速" aria-pressed="false" hidden>按住加速</button>
        <button data-control="boost" class="touch-boost" aria-label="按住冲刺" aria-pressed="false">${icon('bolt')}<span>冲刺</span></button>
        <button data-control="jump" class="touch-jump" aria-label="跃升" aria-pressed="false">${icon('jump')}<span>跃升</span></button>
        <button data-control="brake" aria-label="按住制动" aria-pressed="false">制动</button>
      </div>
    </div>`;
  guide.querySelector('.guide-keys').insertAdjacentHTML('beforebegin', `
    <fieldset class="touch-settings"><legend>手机与触屏驾驶</legend>
      <p>左手滑动转向，右手点按巡航后可持续加速，再按住冲刺或点跃升。制动、暂停、碰撞与重飞会解除巡航，继续时需重新开启。</p>
      <label for="touch-steering-mode">转向方式<select id="touch-steering-mode"><option value="slider">滑动转向 · 松手回正</option><option value="buttons">左右按键 · 按住转向</option></select></label>
      <label for="touch-throttle-mode">油门方式<select id="touch-throttle-mode"><option value="cruise">点按巡航 · 制动解除</option><option value="hold">按住加速 · 松手减速</option></select></label>
      <label for="touch-hand">按键布局<select id="touch-hand"><option value="right">左手转向 · 右手操作</option><option value="left">右手转向 · 左手操作</option></select></label>
      <label for="touch-sensitivity">转向灵敏度 <output id="touch-sensitivity-value" for="touch-sensitivity">100%</output><input id="touch-sensitivity" type="range" min="50" max="150" step="10" value="100" aria-valuetext="100%"></label>
      <small>横竖屏均可玩；旋转屏幕时暂停。设置仅保留在当前页面。键盘仍可用 A / D 转向。</small>
    </fieldset>`);
  const pad = root.querySelector('#touch-steer'), cruise = root.querySelector('#touch-cruise');
  const $ = id => guide.querySelector(`#${id}`);
  const heldPointers = new Map();
  let pointer = null, axis = 0, sensitivity = 1;
  const syncPad = () => {
    pad.style.setProperty('--steer', axis);
    pad.setAttribute('aria-valuenow', String(Math.round(axis * 100)));
    pad.setAttribute('aria-valuetext', axis ? `${axis < 0 ? '向左' : '向右'} ${Math.round(Math.abs(axis) * 100)}%` : '居中');
  };
  const reset = () => {
    const captured = pointer; pointer = null;
    if (captured !== null) {
      controls.release(`pointer:${captured}`, true);
      if (pad.hasPointerCapture(captured)) pad.releasePointerCapture(captured);
    }
    controls.release('touch-keyboard', true);
    for (const [id, button] of heldPointers) {
      controls.release(`pointer:${id}`, true);
      if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
    }
    heldPointers.clear(); axis = 0; syncPad();
  };
  const move = event => {
    const bounds = pad.getBoundingClientRect();
    axis = touchSteer((event.clientX - bounds.left - bounds.width / 2) / Math.max(1, (bounds.width - 48) / 2), sensitivity);
    controls.setSteer(`pointer:${event.pointerId}`, axis);
    syncPad();
  };
  pad.addEventListener('pointerdown', event => {
    if (!isActive() || pointer !== null || event.button !== 0) return;
    controls.release('touch-keyboard', true);
    event.preventDefault(); pad.setPointerCapture(event.pointerId); pointer = event.pointerId;
    move(event); onActivate();
  });
  pad.addEventListener('pointermove', event => { if (event.pointerId === pointer) { event.preventDefault(); move(event); } });
  const releasePad = event => {
    if (event.pointerId !== pointer) return;
    controls.release(`pointer:${pointer}`, true); pointer = null; axis = 0; syncPad();
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(type, releasePad);
  pad.addEventListener('keydown', event => {
    if (!isActive() || pointer !== null || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.code)) return;
    event.preventDefault();
    axis = event.code === 'Home' ? 0 : event.code === 'End' ? 1 : Math.max(-1, Math.min(1, axis + (event.code === 'ArrowLeft' ? -.1 : .1)));
    controls.setSteer('touch-keyboard', axis); syncPad(); onChange();
  });
  const releaseKey = () => { controls.release('touch-keyboard'); if (pointer === null) { axis = 0; syncPad(); } onChange(); };
  pad.addEventListener('keyup', event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.code)) releaseKey(); });
  pad.addEventListener('blur', releaseKey);
  root.querySelectorAll('[data-control]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      if (!isActive() || event.button !== 0) return;
      event.preventDefault(); button.setPointerCapture(event.pointerId); heldPointers.set(event.pointerId, button);
      controls.press(`pointer:${event.pointerId}`, button.dataset.control); onChange(); onActivate();
    });
    const release = event => {
      if (!heldPointers.has(event.pointerId)) return;
      controls.release(`pointer:${event.pointerId}`, event.type !== 'pointerup'); heldPointers.delete(event.pointerId); onChange();
    };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, release);
  });
  root.addEventListener('contextmenu', event => event.preventDefault());
  cruise.addEventListener('click', onCruise);
  const apply = () => {
    reset();
    pad.hidden = $('touch-steering-mode').value !== 'slider';
    root.querySelector('.touch-arrows').hidden = !pad.hidden;
    root.querySelector('#touch-steer-help').textContent = pad.hidden ? '按住转向 · 松手回正' : '左右滑动 · 松手回正';
    cruise.hidden = $('touch-throttle-mode').value !== 'cruise';
    root.querySelector('[data-control="accelerate"]').hidden = !cruise.hidden;
    root.querySelector('#touch-throttle-help').textContent = cruise.hidden ? '按住加速 · 松手减速' : '点按巡航 · 按住冲刺';
    root.dataset.hand = $('touch-hand').value;
    sensitivity = Number($('touch-sensitivity').value) / 100;
    $('touch-sensitivity-value').textContent = `${Math.round(sensitivity * 100)}%`;
    $('touch-sensitivity').setAttribute('aria-valuetext', $('touch-sensitivity-value').textContent);
    onChange();
  };
  for (const id of ['touch-steering-mode', 'touch-throttle-mode', 'touch-hand']) $(id).addEventListener('change', apply);
  $('touch-sensitivity').addEventListener('input', apply);
  return {
    clear: reset,
    sync() {
      cruise.setAttribute('aria-pressed', String(controls.cruise));
      cruise.setAttribute('aria-label', controls.cruise ? '关闭巡航油门' : '开启巡航油门');
      cruise.textContent = controls.cruise ? '巡航已开' : '巡航油门';
      cruise.disabled = controls.held('brake');
    },
  };
}
