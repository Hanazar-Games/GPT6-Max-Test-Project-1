import './aviation.css';
import { AIRCRAFT, AIR_GATES, AIRCRAFT_PHYSICS_DEFAULTS, AIRCRAFT_PHYSICS_LIMITS, AIRCRAFT_PRESETS, setAircraftPhysics, createAircraftFlight, updateAircraftFlight, toggleAircraftGear, toggleAircraftPause, aircraftEnvelope, setAircraftFlaps, toggleAircraftSpeedBrake } from './aircraft-flight.js';
import { AviationWorld } from './aviation-world.js';
import { aircraftInput, aircraftKeyBinding, aircraftControlHelp } from './aircraft-controls.js';
import { RUNWAY } from './airport.js';

const cameraNames = ['追随机位', '近距跟随', '驾驶舱'];
const flapNames = ['收起', '起飞', '着陆'];
const maneuverFields = [['pitchRate', '俯仰速率'], ['rollRate', '滚转速率'], ['yawRate', '方向舵速率'], ['response', '操纵响应'], ['stability', '松手回正辅助'], ['flightPath', '航迹跟随响应'], ['pitchLimit', '辅助俯仰幅度'], ['bankLimit', '辅助滚转幅度'], ['gravity', '重力强度']];
const powerFields = [['thrust', '发动机推力'], ['engineResponse', '发动机响应'], ['mass', '机体质量'], ['drag', '气动阻力'], ['lift', '升力系数'], ['maxSpeed', '速度上限'], ['airBrake', '空中减速强度'], ['wheelBrake', '轮刹强度']];
const physicsFields = [...maneuverFields, ...powerFields];
const physicsControls = (fields, note) => fields.map(([key, label]) => {
  const [low, high] = AIRCRAFT_PHYSICS_LIMITS[key].map(value => Math.round(value * 100));
  return `<div class="av-parameter"><label for="av-physics-${key}">${label}<small>${low}–${high}%</small></label><span class="av-parameter-number"><input data-physics-number="${key}" type="number" min="${low}" max="${high}" step="1" value="100" inputmode="numeric" aria-label="${label}百分比" aria-describedby="${note}"><span aria-hidden="true">%</span></span><input id="av-physics-${key}" data-physics="${key}" type="range" min="${low}" max="${high}" step="1" value="100" aria-label="${label}" aria-describedby="${note}"></div>`;
}).join('');
const flightMusic = { a380: { music: { root: 50, bpm: 100 } }, su30: { music: { root: 45, bpm: 136 } }, t6: { music: { root: 55, bpm: 96 } }, b62: { music: { root: 52, bpm: 112 } }, c24: { music: { root: 48, bpm: 104 } }, d9: { music: { root: 43, bpm: 144 } } };
const audioStates = { running: 'running', ready: 'menu', paused: 'paused', crashed: 'lost', completed: 'won' };

export function mountAviation({ audio, unlockAudio, onToggleAudio, onExit }) {
  const root = document.createElement('main');
  root.id = 'aviation'; root.tabIndex = -1;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', '海岛飞行计划');
  root.innerHTML = `
    <div class="av-viewport"></div><div class="av-vignette" aria-hidden="true"></div>
    <header class="av-header"><div class="av-brand"><span>✈</span><div>海岛飞行计划<small>ISLAND FLIGHT / 01</small></div></div><nav aria-label="飞机操作"><button data-action="sound" aria-pressed="false">声音</button><button data-action="camera">追随机位</button><button data-action="pause">暂停</button><button data-action="exit">返回基地 ↗</button></nav></header>
    <div class="av-instruments" aria-label="飞行仪表"><div><small>空速 <span>KM/H</span></small><strong data-value="speed">0</strong></div><div><small>高度 <span>M</span></small><strong data-value="altitude">0</strong></div><div><small>升降率 <span>M/S</span></small><strong data-value="vertical">0</strong></div><div><small>航向 <span>DEG</span></small><strong data-value="heading">000</strong></div></div>
    <div class="av-navigation"><small data-value="phase">飞机机库</small><strong data-value="guide">准备前往天空</strong><span data-value="target">海岸跑道 · 自由飞行与六环训练</span><div class="av-attitude" aria-label="姿态仪"><div class="av-horizon"><i></i></div><b aria-hidden="true">— ⌄ —</b></div><span data-value="bank">机翼水平 · 机头水平</span></div>
    <div class="av-flight-tools"><label>油门 <output data-value="throttle">0%</output><input data-control="throttle" type="range" min="0" max="100" value="0" aria-label="飞机油门"><small class="av-engine-readout">实际推力 <output data-value="engine">0%</output></small></label><div class="av-systems"><button data-action="gear" aria-pressed="true">轮：放下</button><button data-action="flaps">襟翼：收起</button><button data-action="speed-brake" aria-pressed="false">减速板：收起</button></div><button data-action="navigation" data-value="progress" aria-pressed="false">训练 0/6 · 返航 ↗</button><div class="av-look" role="group" aria-label="驾驶舱观察方向" hidden><button data-action="look-left" aria-label="驾驶舱向左看">左看</button><button data-action="look-center" aria-label="驾驶舱视线回正">正前</button><button data-action="look-right" aria-label="驾驶舱向右看">右看</button></div></div>
    <div class="av-joystick" aria-label="触屏升降与滚转操纵杆" role="group"><span>前推降 · 后拉升</span><div class="av-stick-pad"><i class="av-stick-cross"></i><b class="av-stick-knob"></b><small>左 / 右滚转</small></div></div>
    <button class="av-brake" data-hold="brake">按住制动</button>
    <aside class="av-panel" aria-labelledby="av-panel-title" aria-describedby="av-panel-copy">
      <span class="av-eyebrow">FLIGHT DECK / 全新空中载具</span><h1 id="av-panel-title" tabindex="-1">这次，真的飞起来。</h1><p id="av-panel-copy">从海岸跑道起飞，掠过云层、群山与城市。自由探索，或依次穿过六座导航环，再返回跑道。</p>
      <div class="av-aircraft-list" role="group" aria-label="选择飞机">${AIRCRAFT.map(aircraft => `<button data-aircraft="${aircraft.id}" aria-pressed="${aircraft.id === 'a380'}"><span class="av-plane-icon" aria-hidden="true">${aircraft.cockpit === 'fighter' ? '➤' : '✈'}</span><span><strong>${aircraft.name}</strong><small>${aircraft.role} · ${aircraft.configuration}</small></span></button>`).join('')}</div>
      <p class="av-specs" data-value="specs"></p><p class="av-load-status" role="status" aria-live="polite">正在载入飞机模型…</p>
      <label class="av-runway-choice">起飞方向 <select data-setting="runway"><option value="36">跑道 36 · 向北</option><option value="18">跑道 18 · 向南</option></select><small>${RUNWAY.length.toLocaleString('en-US')} × ${RUNWAY.width} m · 两侧各 ${RUNWAY.shoulder} m 道肩</small></label>
      <div class="av-panel-actions"><button data-action="resume" hidden>继续飞行</button><button data-action="runway" disabled>跑道起飞 <span>↗</span></button><button data-action="airborne" disabled>直接空中试飞</button><button data-action="retry" hidden>重试模型加载</button><button data-action="hangar" hidden>返回飞机机库</button></div>
      <section class="av-tuning" aria-label="本机调校"><p data-value="tuning-name"></p><div class="av-tuning-presets" role="group" aria-label="应用整套飞机调校">${AIRCRAFT_PRESETS.map(preset => `<button data-flight-preset="${preset.id}" aria-pressed="false">${preset.name}</button>`).join('')}</div><small>预设替换本机整套物理参数；手动调整后显示为自定义。每架飞机分别记录，仅保留在本次飞机模式。</small>
      <dl class="av-performance" aria-label="当前飞机性能参考"><div><dt>速度上限</dt><dd data-value="tune-speed"></dd></div><div><dt>满油门加速参考</dt><dd data-value="tune-acceleration"></dd></div><div><dt>起飞参考</dt><dd data-value="tune-takeoff"></dd></div><div><dt>失速参考</dt><dd data-value="tune-stall"></dd></div><div><dt>着陆速度上限</dt><dd data-value="tune-landing"></dd></div><div><dt>辅助俯仰 / 滚转</dt><dd data-value="tune-limits"></dd></div></dl><p data-value="performance-note"></p></section>
      <details class="av-help av-physics" open><summary>动力与气动自定义 · ${powerFields.length} 项</summary>
      ${physicsControls(powerFields, 'av-power-note')}
      <p id="av-power-note">100% 为本机默认值。发动机响应越高，加减推力越快；油门是目标，实际推力逐步跟随，输出以本机标准满推力为 100%。质量改变推重比与惯性；质量、重力、升力共同影响低速门槛，倾斜转弯会提高失速参考并增加阻力。空中减速作用于制动与减速板，轮刹只作用于地面。所有数值为游戏调校。</p></details>
      <details class="av-help av-physics" open><summary>飞行物理与机动</summary>
      <label>飞行模式<select data-setting="flight-mode"><option value="assisted">稳定飞行 · 姿态辅助</option><option value="maneuver">自由机动 · 滚转 / 筋斗</option></select></label>
      <p data-value="physics-help"></p>
      ${physicsControls(maneuverFields, 'av-physics-note')}
      <p id="av-physics-note">速率改变各轴最大旋转速度，响应改变加减旋转的快慢；回正辅助为 0% 时，松手逐步停止主动旋转并保留倾斜。航迹响应越高，升降速度越快跟随机头。辅助幅度仅用于稳定模式，自由机动不限制整周旋转。</p></details>
      <details class="av-help"><summary>操作与键位</summary><p data-value="keys"></p>
      <p><b>A / D</b> 或 <b>← / →</b> 滚转 · <b>Q / E</b> 方向舵<br><b>G</b> 起落架 · <b>F</b> 切换三档襟翼 · <b>B</b> 减速板<br><b>空格</b> 按住制动 · <b>C</b> 切换镜头<br><b>V</b> 进入 / 离开驾驶舱 · <b>Z / X</b> 按住左右观察 · <b>R</b> 视线回正<br><b>Esc / P</b> 暂停并打开设置</p>
      <label>键位预设<select data-setting="keys"><option value="flight">经典飞行</option><option value="wasd">WASD 升降</option></select></label><label>升降方向<select data-setting="pitch"><option value="normal">标准</option><option value="inverted">反向</option></select></label><label>操纵灵敏度 <output data-value="sensitivity">100%</output><input data-setting="sensitivity" type="range" min="40" max="150" step="5" value="100" aria-label="飞机操纵灵敏度"></label>
      <p>手机用左下操纵杆升降与滚转，右侧调节油门、襟翼和减速板。起飞前可用起飞襟翼，达到提示速度后拉升，关闭减速板；降落前放轮、放着陆襟翼，降低下降率，接地后油门归零并按住制动。襟翼降低失速速度并增加阻力，超速会自动收起；减速板不代替地面刹车。</p><p data-value="flap-limit"></p></details>
      <details class="av-help"><summary>镜头与视野</summary><label>驾驶舱视场角 <output data-value="cockpit-fov">68°</output><input data-setting="cockpit-fov" type="range" min="50" max="90" step="1" value="68" aria-label="驾驶舱视场角"></label><label>跟随距离 <output data-value="chase-distance">100%</output><input data-setting="chase-distance" type="range" min="70" max="160" step="5" value="100" aria-label="飞机跟随镜头距离"></label><label>速度扩角<select data-setting="speed-fov"><option value="on">开启</option><option value="off">关闭</option></select></label></details>
      <details class="av-help av-audio-settings"><summary>画面与声音</summary><label>画面质量<select data-setting="quality"><option value="0.75">省电</option><option value="1.25">标准</option><option value="1.75">精细</option></select></label><label>背景音乐 <output data-volume-value="music"></output><input data-volume="music" type="range" min="0" max="100" aria-label="飞机背景音乐音量"></label><label>引擎与音效 <output data-volume-value="sfx"></output><input data-volume="sfx" type="range" min="0" max="100" aria-label="飞机引擎与音效音量"></label><p data-value="audio-status" role="status" aria-live="polite"></p><button data-action="audio-retry" hidden>重新启用声音</button><small>暂停与离开页面时停止声音；失速警报会暂时降低音乐音量。声音设置与基地共用，仅保留在当前页面；画面和飞行设置仅保留在本次飞机模式。机场尺寸与飞行参数为游戏设计，驾驶舱为原创简化内饰。</small></details>
      <details class="av-credits"><summary>模型署名</summary><p>Airbus A380：<a href="https://sketchfab.com/3d-models/singapore-airlines-a380-fd047ccf175c4db5b7e3e400c67c47a0" target="_blank" rel="noopener noreferrer">Singapore Airlines A380</a>，作者 zairiq-zairiq-123-pixar-cars-bfdi，用户提供，<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>。游戏中调整了大小、朝向和起落架显示。</p><p>Su-30：本项目原创简化模型（CC0），依据双发、双垂尾与前翼轮廓制作。</p><p>星雀 T-6、云帆 B-62、山海 C-24、岚影 D-9：本项目原创架空机型与简化 GLB，采用 CC0。</p></details>
    </aside>
    <div class="av-notice" role="status" aria-live="polite"></div><footer class="av-footer"><span data-value="aircraft">Airbus A380</span><span data-value="keyhint"></span><span data-value="time">00:00</span></footer>`;
  document.body.append(root);
  const $ = selector => root.querySelector(selector);
  const action = name => $(`[data-action="${name}"]`);
  const values = Object.fromEntries([...root.querySelectorAll('[data-value]')].map(element => [element.dataset.value, element]));
  const panel = $('.av-panel'), loadStatus = $('.av-load-status'), stick = $('.av-stick-pad'), knob = $('.av-stick-knob');
  const listeners = new AbortController(), held = new Set();
  const controlSettings = { preset: 'flight', sensitivity: 1, invertPitch: false };
  const aircraftSettings = Object.fromEntries(AIRCRAFT.map(aircraft => [aircraft.id, { ...AIRCRAFT_PHYSICS_DEFAULTS }]));
  let physicsSettings = aircraftSettings.a380;
  const touchInput = { pitch: 0, roll: 0, brake: false }, input = {};
  const audioFrame = { status: 'menu', speed: 0, mission: flightMusic.a380, aircraft: AIRCRAFT[0], maxSpeed: AIRCRAFT[0].maxSpeed, engineOutput: 0, stalling: false };
  let world;
  try { world = new AviationWorld($('.av-viewport')); }
  catch (error) { root.remove(); throw error; }
  let flight = createAircraftFlight(), loaded = false, disposed = false, returning = false, loadVersion = 0, raf = 0;
  let previousTime = performance.now(), accumulator = 0, uiTime = 0, dirty = true, stickPointer = null, brakePointer = null, stickPitch = 0, stickRoll = 0, braking = false, noticeTimer;
  const listen = (target, event, callback, options = {}) => target.addEventListener(event, callback, { ...options, signal: listeners.signal });
  const text = (element, value) => { if (element.textContent !== String(value)) element.textContent = value; };
  let lastAudioState;

  function syncAudioStatus() {
    const state = audio.enabled ? audio.context?.state ?? 'locked' : 'muted';
    if (state === lastAudioState) return;
    lastAudioState = state;
    const retry = action('audio-retry'), focused = document.activeElement === retry;
    retry.hidden = state === 'running' || state === 'muted';
    text(values['audio-status'], state === 'muted' ? '全部声音已静音，点击顶部“已静音”恢复。' : state === 'running' ? '声音已启用，音乐与引擎 / 音效可分别调节。' : '浏览器尚未启用声音，请点击“重新启用声音”重试。');
    if (focused && retry.hidden) action('sound').focus({ preventScroll: true });
  }

  function releaseStick() {
    const pointer = stickPointer; stickPointer = null; stickPitch = 0; stickRoll = 0;
    if (pointer !== null && stick.hasPointerCapture(pointer)) stick.releasePointerCapture(pointer);
    knob.style.transform = 'translate(-50%, -50%)';
  }

  function releaseBrake() {
    const pointer = brakePointer; brakePointer = null; braking = false;
    if (pointer !== null && $('.av-brake').hasPointerCapture(pointer)) $('.av-brake').releasePointerCapture(pointer);
    $('.av-brake').classList.remove('is-held');
  }

  function clearInput() {
    held.clear(); releaseStick(); releaseBrake();
    touchInput.pitch = 0; touchInput.roll = 0; touchInput.brake = false;
    aircraftInput(held, touchInput, controlSettings, input);
    world.lookTarget = 0;
  }

  function syncControlHelp() {
    const help = aircraftControlHelp(controlSettings);
    text(values.keys, `${help.throttle} 增减油门 · ${help.pitch} 拉升 / 俯冲`);
    text(values.keyhint, `${help.throttle} 油门 · ${help.pitch.split(' / ')[0]} 拉升 · V 驾驶舱 · Esc 设置`);
    text(values.sensitivity, `${Math.round(controlSettings.sensitivity * 100)}%`);
    text($('.av-joystick>span'), controlSettings.invertPitch ? '前推升 · 后拉降' : '前推降 · 后拉升');
  }

  function syncPerformance() {
    const envelope = aircraftEnvelope(flight), performance = flight.performance, aircraft = flight.aircraft;
    const speedText = value => `${Math.round(value * 3.6)} km/h`;
    text(values['tune-speed'], speedText(envelope.maxSpeed)); text(values['tune-takeoff'], speedText(envelope.takeoff));
    text(values['tune-stall'], speedText(envelope.stall)); text(values['tune-landing'], speedText(envelope.landing));
    text(values['tune-acceleration'], `${performance.acceleration.toFixed(1)} m/s²`);
    text(values['tune-limits'], physicsSettings.mode === 'maneuver' ? '自由机动 · 不限角度' : `${Math.round(performance.pitchLimit * 180 / Math.PI)}° / ${Math.round(performance.bankLimit * 180 / Math.PI)}°`);
    text(values['performance-note'], physicsSettings.thrust === 0 ? '发动机推力为零，可空中试飞练习滑翔；跑道起飞需要增加推力。' : envelope.takeoff > envelope.maxSpeed ? '当前起飞参考超过速度上限，请提高上限或升力，或降低质量 / 重力。' : '失速参考已计入当前襟翼与坡度。加速参考为发动机稳定后的满推力，未扣空气阻力，实际极速取决于推力与阻力。');
    text(values.specs, `${aircraft.subtitle} · 翼展 ${aircraft.span} m · 起飞参考 ≥ ${speedText(envelope.takeoff)} · 速度上限 ${speedText(envelope.maxSpeed)}`);
  }

  function syncPhysics(forceNumbers = false) {
    Object.assign(physicsSettings, setAircraftPhysics(flight, physicsSettings));
    $('[data-setting="flight-mode"]').value = physicsSettings.mode;
    for (const [key] of physicsFields) {
      const slider = $(`[data-physics="${key}"]`), number = $(`[data-physics-number="${key}"]`), percent = Math.round(physicsSettings[key] * 100);
      slider.value = percent;
      if (forceNumbers || document.activeElement !== number) { number.value = percent; number.removeAttribute('aria-invalid'); }
      slider.disabled = number.disabled = physicsSettings.mode === 'maneuver' && ['pitchLimit', 'bankLimit'].includes(key);
    }
    let presetName = '自定义调校';
    for (const preset of AIRCRAFT_PRESETS) {
      const selected = Object.keys(AIRCRAFT_PHYSICS_DEFAULTS).every(key => physicsSettings[key] === preset.physics[key]);
      $(`[data-flight-preset="${preset.id}"]`).setAttribute('aria-pressed', String(selected));
      if (selected) presetName = preset.id === 'standard' ? '标准调校' : preset.name;
    }
    text(values['tuning-name'], `${flight.aircraft.name} · ${presetName}`);
    const maneuver = physicsSettings.mode === 'maneuver';
    text(values['physics-help'], `${maneuver ? '自由机动按机体轴持续旋转，可完成滚转、倒飞与筋斗；先爬升留出足够高度。' : '稳定飞行将操纵量转为目标姿态，适合起降与巡航。'} 当前满杆俯仰约 ${Math.round(flight.aircraft.pitchRate * physicsSettings.pitchRate * 180 / Math.PI)}°/s，滚转约 ${Math.round(flight.aircraft.rollRate * physicsSettings.rollRate * 180 / Math.PI)}°/s；低速会减弱。`);
    syncPerformance();
    dirty = true;
  }

  function notify(message) {
    text($('.av-notice'), message); $('.av-notice').classList.add('visible');
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('.av-notice').classList.remove('visible'), 3500);
  }

  function showPanel() {
    const ready = flight.status === 'ready', paused = flight.status === 'paused';
    panel.hidden = flight.status === 'running';
    if (!panel.hidden) syncPerformance();
    if (!panel.hidden) { clearTimeout(noticeTimer); $('.av-notice').classList.remove('visible'); }
    $('.av-aircraft-list').hidden = !ready; $('.av-runway-choice').hidden = !ready; values.specs.hidden = !ready; loadStatus.hidden = !ready;
    action('resume').hidden = !paused;
    action('runway').hidden = !ready; action('airborne').hidden = !ready;
    action('hangar').hidden = ready;
    action('retry').hidden = loaded || !ready || loadStatus.dataset.state !== 'error';
    text($('#av-panel-title'), ready ? '这次，真的飞起来。' : paused ? '云端，稍作停留。' : flight.status === 'completed' ? '平稳返航，欢迎回来。' : '飞行结束，再试一次。');
    text($('#av-panel-copy'), ready ? '从海岸跑道起飞，掠过云层、群山与城市。自由探索，或依次穿过六座导航环，再返回跑道。' : paused ? '飞行已暂停，声音已停止。准备好后继续，或返回机库更换飞机。' : flight.status === 'completed' ? `已飞行 ${(flight.distance / 1000).toFixed(1)} 公里，通过 ${flight.gates} / 6 座训练环。` : flight.reason);
    text(action('pause'), paused ? '继续' : '设置');
    text(action('camera'), ready ? '预览机位' : cameraNames[world.cameraMode]);
    action('camera').disabled = ready;
    action('pause').disabled = !['running', 'paused'].includes(flight.status);
    root.classList.toggle('av-flying', flight.status === 'running');
    for (const element of [$('.av-instruments'), $('.av-navigation'), $('.av-flight-tools'), $('.av-joystick'), $('.av-brake')]) element.inert = !panel.hidden;
    clearInput(); dirty = true;
    if (!panel.hidden) (paused ? action('resume') : $('#av-panel-title')).focus({ preventScroll: true });
    else root.focus({ preventScroll: true });
  }

  async function selectAircraft(id) {
    const version = ++loadVersion;
    physicsSettings = aircraftSettings[id];
    flight = createAircraftFlight(id, false, { runwayDirection: $('[data-setting="runway"]').value, physics: physicsSettings }); loaded = false; returning = false;
    syncPhysics();
    text(loadStatus, '正在载入飞机模型…'); loadStatus.dataset.state = 'loading';
    action('runway').disabled = true; action('airborne').disabled = true;
    for (const button of root.querySelectorAll('[data-aircraft]')) button.setAttribute('aria-pressed', String(button.dataset.aircraft === id));
    text(values.aircraft, flight.aircraft.name);
    text(values['flap-limit'], `本机襟翼展开上限 ${Math.round(flight.aircraft.flapLimit * 3.6)} km/h；超过上限 18 km/h 自动收起。`);
    world.setCameraMode(0); text(action('camera'), cameraNames[0]);
    showPanel();
    try {
      const installed = await world.setAircraft(flight.aircraft);
      if (disposed || version !== loadVersion || !installed) return;
      loaded = true; text(loadStatus, '飞机就绪 · 选择跑道起飞或直接空中试飞'); loadStatus.dataset.state = 'ready';
      action('runway').disabled = false; action('airborne').disabled = false; action('retry').hidden = true; dirty = true;
    } catch (error) {
      if (disposed || version !== loadVersion || error.name === 'AbortError') return;
      console.error('Unable to load aircraft:', error);
      text(loadStatus, '模型载入失败，请重试或选择另一架飞机。'); loadStatus.dataset.state = 'error';
      action('retry').hidden = false; dirty = true;
    }
  }

  function start(airborne) {
    if (!loaded) return;
    flight = createAircraftFlight(flight.aircraft.id, airborne, { runwayDirection: $('[data-setting="runway"]').value, physics: physicsSettings }); flight.status = 'running'; returning = false;
    accumulator = 0; previousTime = performance.now(); world.resetCamera = true;
    unlockAudio(); showPanel();
    const help = aircraftControlHelp(controlSettings);
    notify(airborne ? `已进入空中 · ${help.pitch} 升降 · V 进入驾驶舱` : `油门推满，达到 ${Math.round(aircraftEnvelope(flight).takeoff * 3.6)} km/h 后按 ${help.pitch.split(' / ')[0]} 拉升`);
  }

  function pause(onlyPause = false) {
    if (onlyPause && flight.status !== 'running') return;
    toggleAircraftPause(flight); accumulator = 0;
    audio.setState(flight.status === 'running' ? 'running' : 'paused'); showPanel();
  }

  function gear() {
    if (!toggleAircraftGear(flight)) { notify('地面上保持起落架放下，起飞后再收轮。'); return; }
    notify(flight.gearDown ? '起落架已放下 · 减速、对正跑道后降落' : '起落架已收起 · 空气阻力降低'); dirty = true;
  }

  function flaps() {
    if (!setAircraftFlaps(flight, (flight.flaps + 1) % 3)) { notify(`速度过高，请减至 ${Math.round(flight.aircraft.flapLimit * 3.6)} km/h 以下再放襟翼。`); return; }
    notify(`襟翼：${flapNames[flight.flaps]} · 当前起飞参考 ${Math.round(aircraftEnvelope(flight).takeoff * 3.6)} km/h`); dirty = true;
  }

  function speedBrake() {
    if (!toggleAircraftSpeedBrake(flight)) return;
    notify(flight.speedBrake ? '减速板展开 · 起飞前请收起，地面停车仍需按住制动' : '减速板收起'); dirty = true;
  }

  function updateUI() {
    root.classList.toggle('av-cockpit', world.cameraMode === 2);
    $('.av-look').hidden = world.cameraMode !== 2;
    const aircraft = flight.aircraft, envelope = aircraftEnvelope(flight), heading = (flight.heading * 180 / Math.PI + 360) % 360;
    text(values.speed, Math.round(flight.speed * 3.6)); text(values.altitude, Math.round(flight.y));
    text(values.vertical, `${flight.verticalSpeed > 0 ? '+' : ''}${flight.verticalSpeed.toFixed(1)}`);
    text(values.heading, String(Math.round(heading) % 360).padStart(3, '0'));
    text(values.throttle, `${Math.round(flight.throttle * 100)}%`);
    text(values.engine, `${Math.round(flight.engineOutput * physicsSettings.thrust * 100)}%`);
    const throttle = $('[data-control="throttle"]');
    if (document.activeElement !== throttle) throttle.value = Math.round(flight.throttle * 100);
    text(action('gear'), `轮：${flight.gearDown ? '放下' : '收起'}`); action('gear').setAttribute('aria-pressed', String(flight.gearDown));
    action('gear').setAttribute('aria-label', `起落架${flight.gearDown ? '已放下' : '已收起'}`);
    action('gear').disabled = flight.onGround || flight.status !== 'running';
    text(action('flaps'), `襟翼：${flapNames[flight.flaps]}`); action('flaps').disabled = flight.status !== 'running';
    text(action('speed-brake'), `减速板：${flight.speedBrake ? '展开' : '收起'}`); action('speed-brake').setAttribute('aria-pressed', String(flight.speedBrake)); action('speed-brake').disabled = flight.status !== 'running';
    const home = returning || flight.gates === AIR_GATES.length;
    text(values.progress, home ? flight.gates === AIR_GATES.length ? '六环完成 · 返航中' : '返航导航 · 切回训练' : `训练 ${flight.gates}/6 · 返航 ↗`);
    action('navigation').setAttribute('aria-pressed', String(home));
    action('navigation').disabled = flight.gates === AIR_GATES.length;
    text(values.time, `${String(Math.floor(flight.elapsed / 60)).padStart(2, '0')}:${String(Math.floor(flight.elapsed % 60)).padStart(2, '0')}`);
    text(values.phase, flight.status !== 'running' ? '海岛机场 / FLIGHT DECK' : flight.onGround ? flight.hasFlown ? '着陆滑跑 / ROLLOUT' : '跑道滑行 / TAKEOFF' : flight.stalling ? '失速警告 / STALL' : physicsSettings.mode === 'maneuver' ? '自由机动 / AEROBATICS' : '稳定飞行 / AIRBORNE');
    $('.av-navigation').classList.toggle('av-warning', flight.stalling);
    const gate = home ? null : AIR_GATES[flight.gates];
    if (flight.onGround) {
      text(values.guide, flight.hasFlown ? '油门归零，按住制动停车' : flight.speedBrake ? '按 B 收起减速板后再起飞' : flight.speed < envelope.takeoff ? '推满油门，沿中线加速' : '拉升机头，离开跑道');
      const remaining = Math.max(0, Math.cos(flight.heading) >= 0 ? flight.z - RUNWAY.end : RUNWAY.start - flight.z);
      text(values.target, flight.hasFlown ? `跑道剩余 ${Math.round(remaining)} m · 关闭油门，按住空格制动` : `起飞 ≥ ${Math.round(envelope.takeoff * 3.6)} km/h · 剩余 ${Math.round(remaining)} m · ${aircraftControlHelp(controlSettings).pitch.split(' / ')[0]} 拉升`);
    } else if (flight.stalling) {
      text(values.guide, '机头放低，收减速板并加油门'); text(values.target, `安全空速 ≥ ${Math.round(envelope.stall * 3.6)} km/h · 襟翼：${flapNames[flight.flaps]}`);
    } else if (gate) {
      const bearing = Math.atan2(gate.x - flight.x, -(gate.z - flight.z));
      const angle = Math.atan2(Math.sin(bearing - flight.heading), Math.cos(bearing - flight.heading)) * 180 / Math.PI;
      text(values.guide, `导航环 ${flight.gates + 1} · ${Math.abs(angle) < 8 ? '保持航向' : `${angle > 0 ? '右转' : '左转'} ${Math.round(Math.abs(angle))}°`}`);
      text(values.target, `距离 ${(Math.hypot(gate.x - flight.x, gate.z - flight.z) / 1000).toFixed(1)} km · 目标高度 ${gate.y} m · 自由探索无需过环`);
    } else {
      const bearing = Math.atan2(-flight.x, flight.z - RUNWAY.center);
      const angle = Math.atan2(Math.sin(bearing - flight.heading), Math.cos(bearing - flight.heading)) * 180 / Math.PI;
      text(values.guide, `返航机场 · ${Math.abs(angle) < 8 ? '保持航向' : `${angle > 0 ? '右转' : '左转'} ${Math.round(Math.abs(angle))}°`}`);
      text(values.target, `机场 ${(Math.hypot(flight.x, flight.z - RUNWAY.center) / 1000).toFixed(1)} km · 跑道 18 / 36 · ${RUNWAY.length / 1000} km · 放轮低速着陆`);
    }
    text(values.bank, `滚转 ${Math.round(flight.roll * 180 / Math.PI)}° · 俯仰 ${Math.round(flight.pitch * 180 / Math.PI)}°`);
    $('.av-horizon').style.transform = `translateY(${flight.pitch * 55}px) rotate(${-flight.roll}rad)`;
    action('sound').setAttribute('aria-pressed', String(!audio.enabled)); text(action('sound'), audio.enabled ? '声音开' : '已静音');
  }

  function dispose() {
    if (disposed) return;
    disposed = true; loadVersion++; cancelAnimationFrame(raf); clearTimeout(noticeTimer);
    clearInput(); listeners.abort(); audio.setState('menu'); world.dispose(); root.remove(); onExit();
  }

  listen(root, 'click', event => {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.aircraft) { if (button.dataset.aircraft !== flight.aircraft.id) selectAircraft(button.dataset.aircraft); return; }
    if (button.dataset.flightPreset) {
      Object.assign(physicsSettings, AIRCRAFT_PRESETS.find(preset => preset.id === button.dataset.flightPreset).physics);
      clearInput(); syncPhysics(true); return;
    }
    switch (button.dataset.action) {
      case 'exit': dispose(); break;
      case 'pause': case 'resume': pause(); break;
      case 'runway': start(false); break;
      case 'airborne': start(true); break;
      case 'gear': gear(); break;
      case 'flaps': flaps(); break;
      case 'speed-brake': speedBrake(); break;
      case 'navigation': returning = !returning; updateUI(); break;
      case 'retry': selectAircraft(flight.aircraft.id); break;
      case 'hangar': flight = createAircraftFlight(flight.aircraft.id, false, { runwayDirection: $('[data-setting="runway"]').value, physics: physicsSettings }); audio.setState('menu'); world.resetCamera = true; showPanel(); break;
      case 'camera': world.setCameraMode((world.cameraMode + 1) % 3); text(button, cameraNames[world.cameraMode]); updateUI(); dirty = true; break;
      case 'look-left': world.lookTarget = .95; dirty = true; break;
      case 'look-center': world.lookTarget = 0; dirty = true; break;
      case 'look-right': world.lookTarget = -.95; dirty = true; break;
      case 'sound': onToggleAudio(); updateUI(); break;
      case 'audio-retry': unlockAudio(); break;
    }
  });
  listen($('[data-control="throttle"]'), 'input', event => {
    if (flight.status !== 'running') return;
    flight.throttle = Number(event.target.value) / 100; dirty = true; unlockAudio();
  });
  listen($('[data-control="throttle"]'), 'pointerup', () => root.focus({ preventScroll: true }));
  for (const bus of ['music', 'sfx']) {
    const slider = $(`[data-volume="${bus}"]`); slider.value = Math.round(audio.volumes[bus] * 100);
    const output = $(`[data-volume-value="${bus}"]`); text(output, `${slider.value}%`);
    listen(slider, 'input', () => { audio.setVolume(bus, Number(slider.value) / 100); text(output, `${slider.value}%`); unlockAudio(); dirty = true; });
  }
  listen($('[data-setting="flight-mode"]'), 'change', event => {
    physicsSettings.mode = event.target.value; physicsSettings.stability = physicsSettings.mode === 'maneuver' ? 0 : 1;
    clearInput(); syncPhysics();
  });
  for (const [key] of physicsFields) {
    listen($(`[data-physics="${key}"]`), 'input', event => {
      physicsSettings[key] = Number(event.target.value) / 100; syncPhysics(true);
    });
    const number = $(`[data-physics-number="${key}"]`);
    listen(number, 'input', () => {
      const value = number.valueAsNumber;
      if (!Number.isInteger(value) || value < Number(number.min) || value > Number(number.max)) { number.setAttribute('aria-invalid', 'true'); return; }
      number.removeAttribute('aria-invalid'); physicsSettings[key] = value / 100; syncPhysics();
    });
    listen(number, 'change', () => {
      if (Number.isFinite(number.valueAsNumber)) physicsSettings[key] = Math.round(number.valueAsNumber) / 100;
      syncPhysics(true);
    });
  }
  const quality = $('[data-setting="quality"]'); quality.value = world.quality < 1 ? '0.75' : '1.25';
  listen(quality, 'change', () => { world.quality = Number(quality.value); world.resize(); dirty = true; });
  listen($('[data-setting="runway"]'), 'change', event => {
    if (flight.status !== 'ready') return;
    flight = createAircraftFlight(flight.aircraft.id, false, { runwayDirection: event.target.value, physics: physicsSettings }); world.resetCamera = true; dirty = true;
  });
  for (const name of ['cockpit-fov', 'chase-distance', 'speed-fov']) listen($(`[data-setting="${name}"]`), name === 'speed-fov' ? 'change' : 'input', event => {
    if (name === 'cockpit-fov') { world.viewSettings.cockpitFov = Number(event.target.value); text(values[name], `${event.target.value}°`); }
    if (name === 'chase-distance') { world.viewSettings.chaseDistance = Number(event.target.value) / 100; text(values[name], `${event.target.value}%`); }
    if (name === 'speed-fov') world.viewSettings.speedFov = event.target.value === 'on';
    world.resetCamera = true; dirty = true;
  });
  for (const name of ['keys', 'pitch', 'sensitivity']) listen($(`[data-setting="${name}"]`), name === 'sensitivity' ? 'input' : 'change', event => {
    if (name === 'keys') controlSettings.preset = event.target.value;
    if (name === 'pitch') controlSettings.invertPitch = event.target.value === 'inverted';
    if (name === 'sensitivity') controlSettings.sensitivity = Number(event.target.value) / 100;
    clearInput(); syncControlHelp(); dirty = true;
  });
  listen(window, 'keydown', event => {
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === 'Tab' && !panel.hidden) {
      const focusable = [...root.querySelectorAll('button, input, select, summary, a[href]')].filter(element => !element.disabled && !element.closest('[inert]') && element.checkVisibility());
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === $('#av-panel-title'))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      return;
    }
    if ((event.code === 'Escape' || event.code === 'KeyP') && !event.repeat && ['running', 'paused'].includes(flight.status)) { event.preventDefault(); pause(); return; }
    if (event.target.closest('input, select, textarea, a, summary, [contenteditable="true"]')) return;
    if (event.target.closest('button') && ['Space', 'Enter'].includes(event.code) && !event.target.closest('[data-hold]')) return;
    if (flight.status !== 'running') return;
    if (aircraftKeyBinding(event.code, controlSettings.preset) || ['KeyZ', 'KeyX'].includes(event.code)) { event.preventDefault(); held.add(event.code); }
    else if (!event.repeat && event.code === 'KeyG') { event.preventDefault(); gear(); }
    else if (!event.repeat && event.code === 'KeyF') { event.preventDefault(); flaps(); }
    else if (!event.repeat && event.code === 'KeyB') { event.preventDefault(); speedBrake(); }
    else if (!event.repeat && event.code === 'KeyC') { event.preventDefault(); action('camera').click(); }
    else if (!event.repeat && event.code === 'KeyV') { event.preventDefault(); world.setCameraMode(world.cameraMode === 2 ? 0 : 2); text(action('camera'), cameraNames[world.cameraMode]); updateUI(); dirty = true; }
    else if (!event.repeat && event.code === 'KeyR') { event.preventDefault(); world.lookTarget = 0; dirty = true; }
  });
  listen(window, 'keyup', event => held.delete(event.code));
  const moveStick = event => {
    const bounds = stick.getBoundingClientRect(), radius = bounds.width * .36;
    let x = (event.clientX - bounds.left - bounds.width / 2) / radius, y = (event.clientY - bounds.top - bounds.height / 2) / radius;
    const magnitude = Math.max(1, Math.hypot(x, y)); x /= magnitude; y /= magnitude;
    stickRoll = Math.abs(x) < .07 ? 0 : x; stickPitch = Math.abs(y) < .07 ? 0 : y;
    knob.style.transform = `translate(calc(-50% + ${x * radius}px), calc(-50% + ${y * radius}px))`;
  };
  listen(stick, 'pointerdown', event => {
    if (flight.status !== 'running' || stickPointer !== null || event.button > 0) return;
    event.preventDefault(); stickPointer = event.pointerId; stick.setPointerCapture(event.pointerId); moveStick(event); unlockAudio();
  });
  listen(stick, 'pointermove', event => { if (event.pointerId === stickPointer) { event.preventDefault(); moveStick(event); } });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(stick, name, event => { if (event.pointerId === stickPointer) releaseStick(); });
  const brake = $('.av-brake');
  listen(brake, 'pointerdown', event => { if (flight.status === 'running' && brakePointer === null && event.button <= 0) { event.preventDefault(); brakePointer = event.pointerId; brake.setPointerCapture(event.pointerId); braking = true; brake.classList.add('is-held'); } });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(brake, name, event => { if (event.pointerId === brakePointer) releaseBrake(); });
  listen(window, 'blur', () => pause(true));
  listen(window, 'pagehide', () => pause(true));
  listen(document, 'visibilitychange', () => { if (document.hidden) pause(true); previousTime = performance.now(); accumulator = 0; });
  listen(window, 'resize', () => { world.resize(); dirty = true; clearInput(); });
  listen(window, 'orientationchange', () => pause(true));
  listen(world.renderer.domElement, 'webglcontextlost', event => {
    event.preventDefault(); pause(true); loaded = false; notify('图形连接中断，请返回基地后重新进入飞机模式。');
    action('resume').disabled = true; action('runway').disabled = true; action('airborne').disabled = true;
  });

  function frame(now) {
    if (disposed) return;
    const dt = Math.max(0, Math.min((now - previousTime) / 1000, .1)); previousTime = now;
    if (!document.hidden) {
      if (flight.status === 'running') {
        touchInput.pitch = stickPitch; touchInput.roll = stickRoll; touchInput.brake = braking;
        aircraftInput(held, touchInput, controlSettings, input);
        accumulator += dt;
        while (accumulator >= 1 / 60 && flight.status === 'running') {
          updateAircraftFlight(flight, input, 1 / 60); accumulator -= 1 / 60;
          for (const event of flight.events) {
            if (event === 'gate') { audio.event('gate'); notify(`通过导航环 ${flight.gates} / 6`); }
            if (event === 'takeoff') { audio.event('glide'); notify('已离地 · 按 G 收起起落架'); }
            if (event === 'flaps-limit') notify('襟翼超过安全速度，已自动收起。');
            if (event === 'touchdown') { audio.event('land'); notify('成功接地 · 油门归零，按住制动'); }
            if (event === 'crash' || event === 'completed') { audio.setState(event === 'crash' ? 'lost' : 'won'); audio.event(event === 'crash' ? 'lost' : 'won'); showPanel(); }
          }
        }
      } else accumulator = 0;
      uiTime += dt;
      if (dirty || (flight.status === 'running' && uiTime > .08)) { updateUI(); uiTime = 0; }
      audioFrame.status = audioStates[flight.status]; audioFrame.speed = flight.speed; audioFrame.mission = flightMusic[flight.aircraft.id];
      audioFrame.aircraft = flight.aircraft; audioFrame.maxSpeed = flight.performance.maxSpeed;
      audioFrame.engineOutput = flight.engineOutput * physicsSettings.thrust; audioFrame.stalling = flight.stalling;
      audio.update(audioFrame);
      syncAudioStatus();
      const look = held.has('KeyZ') || held.has('KeyX') ? (Number(held.has('KeyZ')) - Number(held.has('KeyX'))) * .95 : null;
      if (dirty || flight.status === 'running') world.render(flight, dt, input, look);
      dirty = false;
    }
    raf = requestAnimationFrame(frame);
  }
  syncControlHelp(); selectAircraft('a380'); raf = requestAnimationFrame(frame);
  return { dispose };
}
