import './aviation.css';
import { AIRCRAFT, AIR_GATES, AIRCRAFT_PHYSICS_DEFAULTS, AIRCRAFT_PHYSICS_LIMITS, AIRCRAFT_PRESETS, setAircraftPhysics, createAircraftFlight, updateAircraftFlight, toggleAircraftGear, toggleAircraftPause, aircraftEnvelope, setAircraftFlaps, toggleAircraftSpeedBrake } from './aircraft-flight.js';
import { AviationWorld, AVIATION_CAMERAS, AVIATION_VIEW_DEFAULTS } from './aviation-world.js';
import { AviationRenderClock } from './aviation-render-clock.js';
import { AIRCRAFT_CONTROL_DEFAULTS, aircraftInput, aircraftKeyBinding, aircraftControlHelp, aircraftThrottleShortcut } from './aircraft-controls.js';
import { RUNWAY } from './airport.js';
import { SYSTEM_DEFAULTS, SYSTEM_LIMITS, setSystemSettings, setAircraftTrim, setAutopilot, setAutopilotTarget, toggleEngine, toggleParkingBrake } from './aircraft-systems.js';

const cameraNames = AVIATION_CAMERAS;
const viewFields = [
  ['cockpitFov', '驾驶舱视场角', 50, 100, 1, 1, '°'],
  ['exteriorFov', '外部视场角', 40, 100, 1, 1, '°'],
  ['chaseDistance', '外部镜头距离', 50, 300, 5, 100, '%'],
  ['chaseHeight', '外部镜头高度', 50, 200, 5, 100, '%'],
  ['orbitAngle', '外部环绕角度', -180, 180, 5, 1, '°'],
  ['followResponse', '跟随响应', 1, 15, 1, 1, '/秒'],
  ['lookAngle', '舱内左右观察幅度', 30, 120, 5, 1, '°'],
  ['lookResponse', '舱内转头响应', 2, 20, 1, 1, '/秒'],
  ['speedFovAmount', '速度扩角幅度', 0, 30, 1, 1, '°'],
];
const flapNames = ['收起', '起飞', '着陆'];
const maneuverFields = [['pitchRate', '俯仰速率'], ['rollRate', '滚转速率'], ['yawRate', '方向舵速率'], ['response', '操纵响应'], ['stability', '松手回正辅助'], ['flightPath', '航迹跟随响应'], ['pitchLimit', '辅助俯仰幅度'], ['bankLimit', '辅助滚转幅度'], ['gravity', '重力强度']];
const powerFields = [['thrust', '发动机推力'], ['engineResponse', '发动机响应'], ['mass', '机体质量'], ['drag', '气动阻力'], ['lift', '升力系数'], ['maxSpeed', '速度上限'], ['airBrake', '空中减速强度'], ['wheelBrake', '轮刹强度']];
const physicsFields = [...maneuverFields, ...powerFields];
const controlFields = [
  ['pitchSensitivity', '俯仰灵敏度', 20, 200, 5, 100, '%'],
  ['rollSensitivity', '滚转灵敏度', 20, 200, 5, 100, '%'],
  ['yawSensitivity', '方向舵灵敏度', 20, 200, 5, 100, '%'],
  ['deadzone', '摇杆中心死区', 0, 25, 1, 100, '%'],
  ['curve', '摇杆响应曲线', 1, 3, .1, 1, '×'],
  ['throttleRate', '键盘油门变化', 5, 100, 5, 100, '%/秒'],
];
const physicsControls = (fields, note) => fields.map(([key, label]) => {
  const [low, high] = AIRCRAFT_PHYSICS_LIMITS[key].map(value => Math.round(value * 100));
  return `<div class="av-parameter"><label for="av-physics-${key}">${label}<small>${low}–${high}%</small></label><span class="av-parameter-number"><input data-physics-number="${key}" type="number" min="${low}" max="${high}" step="1" value="100" inputmode="numeric" aria-label="${label}百分比" aria-describedby="${note}"><span aria-hidden="true">%</span></span><input id="av-physics-${key}" data-physics="${key}" type="range" min="${low}" max="${high}" step="1" value="100" aria-label="${label}" aria-describedby="${note}"></div>`;
}).join('');
const flightMusic = { a380: { music: { root: 50, bpm: 100 } }, su30: { music: { root: 45, bpm: 136 } }, t6: { music: { root: 55, bpm: 96 } }, b62: { music: { root: 52, bpm: 112 } }, c24: { music: { root: 48, bpm: 104 } }, d9: { music: { root: 43, bpm: 144 } } };
const audioStates = { running: 'running', ready: 'menu', paused: 'paused', crashed: 'lost', completed: 'won' };
const systemFields = [
  ['trimAuthority', '配平最大作用量', 100, '%'], ['trimRate', '键盘配平速度', 100, '%/秒'], ['apResponse', '自动驾驶响应', 100, '%'],
  ['bankLimit', '自动驾驶最大坡度', 1, '°'], ['climbRate', '目标升降率上限', 1, 'm/s'], ['overrideThreshold', '手动接管阈值', 100, '%'], ['displayBrightness', '驾驶舱仪表亮度', 100, '%'],
];
const systemControls = () => `<p class="av-system-summary" data-system-value="summary"></p><div class="av-system-buttons" role="group" aria-label="飞机系统开关">
  <button data-system-action="engine" aria-pressed="true">发动机 · K</button><button data-system-action="parking" aria-pressed="false">驻车制动 · N</button>
  <button data-system-action="ap-level" aria-pressed="false">机翼调平 · J</button><button data-system-action="ap-hold" aria-pressed="false">航向 / 高度保持 · H</button>
  <button data-system-action="ap-off">断开自动驾驶</button><button data-system-action="trim-reset">配平归零 · T</button></div>
  <div class="av-ap-targets"><label>目标航向 °<input data-ap-target="heading" type="number" min="0" max="359" step="1" inputmode="numeric" aria-label="自动驾驶目标航向"></label><label>目标高度 m<input data-ap-target="altitude" type="number" min="0" step="1" inputmode="numeric" aria-label="自动驾驶目标高度"></label></div>
  ${[['pitch', '俯仰 · 低头 / 抬头'], ['roll', '滚转 · 左 / 右'], ['yaw', '方向舵 · 左 / 右']].map(([key, label]) => `<label>${label}<output data-trim-value="${key}">0%</output><input data-trim="${key}" type="range" min="-100" max="100" step="1" value="0" aria-label="${label}配平"></label>`).join('')}
  <p>自动驾驶需在稳定模式、足够空速与正常姿态下接通，并捕获当前航向 / 高度；接通后可改目标。油门仍手动控制，达到接管阈值即退出；不会自动避开地形。[ / ] 持续低头 / 抬头配平，T 归零。驻车制动仅在地面低于 3.6 km/h 接通。</p>`;

export function mountAviation({ audio, unlockAudio, onToggleAudio, onExit }) {
  const root = document.createElement('main');
  root.id = 'aviation'; root.tabIndex = -1;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', '海岛飞行计划');
  root.innerHTML = `
    <div class="av-viewport"></div><div class="av-vignette" aria-hidden="true"></div>
    <header class="av-header"><div class="av-brand"><span>✈</span><div>海岛飞行计划<small>ISLAND FLIGHT / 01</small></div></div><nav aria-label="飞机操作"><button data-action="sound" aria-pressed="false">声音</button><button data-action="systems" aria-expanded="false" aria-controls="av-systems-panel" aria-label="座舱系统面板，快捷键 I">系统 · I</button><button data-action="camera" aria-expanded="false" aria-controls="av-camera-panel">追随机位 ▾</button><button data-action="pause">暂停</button><button data-action="exit">返回基地 ↗</button></nav></header>
    <section id="av-systems-panel" class="av-systems-panel av-help" aria-label="实时座舱系统" hidden><div class="av-camera-heading"><strong tabindex="-1">座舱系统 · 飞行继续运行</strong><button data-action="systems-close" aria-label="关闭座舱系统">×</button></div>${systemControls()}</section>
    <section id="av-camera-panel" class="av-camera-panel" aria-label="飞行镜头" hidden><div class="av-camera-heading"><strong>选择飞行镜头</strong><button data-action="camera-close" aria-label="关闭镜头面板">×</button></div><div class="av-camera-presets" role="group" aria-label="镜头机位">${cameraNames.map((name, mode) => `<button data-camera="${mode}" aria-pressed="${mode === 0}">${name}</button>`).join('')}</div><div class="av-camera-actions"><button data-action="camera-lock" aria-pressed="false">锁定方位 · L</button><button data-action="camera-center">镜头回正 · R</button></div><p data-value="camera-note">固定观察方位，位置仍跟随飞机。C 循环镜头，V 进出驾驶舱。</p></section>
    <div class="av-instruments" aria-label="飞行仪表"><div><small>空速 <span>KM/H</span></small><strong data-value="speed">0</strong></div><div><small>高度 <span>M</span></small><strong data-value="altitude">0</strong></div><div><small>升降率 <span>M/S</span></small><strong data-value="vertical">0</strong></div><div><small>航向 <span>DEG</span></small><strong data-value="heading">000</strong></div></div>
    <div class="av-navigation"><small data-value="phase">飞机机库</small><strong data-value="guide">准备前往天空</strong><span data-value="target">海岸跑道 · 自由飞行与六环训练</span><div class="av-attitude" aria-label="姿态仪"><div class="av-horizon"><i></i></div><b aria-hidden="true">— ⌄ —</b></div><span data-value="bank">机翼水平 · 机头水平</span></div>
    <div class="av-flight-tools"><label>油门 <output data-value="throttle">0%</output><input data-control="throttle" type="range" min="0" max="100" value="0" aria-label="飞机油门"><small class="av-engine-readout">实际推力 <output data-value="engine">0%</output></small></label><div class="av-throttle-presets" role="group" aria-label="快捷油门"><button data-throttle="0" aria-label="油门怠速，快捷键 1">怠速</button><button data-throttle="0.65" aria-label="油门 65%，快捷键 2">65%</button><button data-throttle="1" aria-label="油门全开，快捷键 3">全开</button></div><div class="av-systems"><button data-action="gear" aria-pressed="true">轮：放下</button><button data-action="flaps">襟翼：收起</button><button data-action="speed-brake" aria-pressed="false">减速板：收起</button></div><button data-action="navigation" data-value="progress" aria-pressed="false">训练 0/6 · 返航 ↗</button><div class="av-look" role="group" aria-label="驾驶舱观察方向" hidden><button data-action="look-left" aria-label="驾驶舱向左看">左看</button><button data-action="look-center" aria-label="驾驶舱视线回正">正前</button><button data-action="look-right" aria-label="驾驶舱向右看">右看</button></div></div>
    <div class="av-joystick" aria-label="触屏飞机操纵" role="group"><span>前推降 · 后拉升</span><div class="av-stick-pad"><i class="av-stick-cross"></i><b class="av-stick-knob"></b><small>左 / 右滚转</small></div><div class="av-rudder" role="group" aria-label="按住操作方向舵"><button data-hold="yaw-left" aria-label="按住左方向舵" aria-pressed="false">◀ 左舵</button><button data-hold="yaw-right" aria-label="按住右方向舵" aria-pressed="false">右舵 ▶</button></div></div>
    <button class="av-brake" data-hold="brake" aria-pressed="false">按住制动</button>
    <aside class="av-panel" aria-labelledby="av-panel-title" aria-describedby="av-panel-copy">
      <span class="av-eyebrow">FLIGHT DECK / 全新空中载具</span><h1 id="av-panel-title" tabindex="-1">这次，真的飞起来。</h1><p id="av-panel-copy">从海岸跑道起飞，掠过云层、群山与城市。自由探索，或依次穿过六座导航环，再返回跑道。</p>
      <div class="av-aircraft-list" role="group" aria-label="选择飞机">${AIRCRAFT.map(aircraft => `<button data-aircraft="${aircraft.id}" aria-pressed="${aircraft.id === 'a380'}"><span class="av-plane-icon" aria-hidden="true">${aircraft.cockpit === 'fighter' ? '➤' : '✈'}</span><span><strong>${aircraft.name}</strong><small>${aircraft.role} · ${aircraft.configuration}</small></span></button>`).join('')}</div>
      <p class="av-specs" data-value="specs"></p><p class="av-load-status" role="status" aria-live="polite">正在载入飞机模型…</p>
      <label class="av-runway-choice">起飞方向 <select data-setting="runway"><option value="36">跑道 36 · 向北</option><option value="18">跑道 18 · 向南</option></select><small>${RUNWAY.length.toLocaleString('en-US')} × ${RUNWAY.width} m · 两侧各 ${RUNWAY.shoulder} m 道肩</small></label>
      <div class="av-panel-actions"><button data-action="resume" hidden>继续飞行</button><button data-action="runway" disabled>跑道起飞 <span>↗</span></button><button data-action="airborne" disabled>直接空中试飞</button><button data-action="retry" hidden>重试模型加载</button><button data-action="hangar" hidden>返回飞机机库</button></div>
      <details class="av-help av-system-settings"><summary>座舱系统、配平与自动驾驶</summary>${systemControls()}
      ${systemFields.map(([key, label, scale, unit]) => { const [min, max] = SYSTEM_LIMITS[key].map(value => Math.round(value * scale));return `<label>${label}<output data-system-setting-value="${key}"></output><input data-system-setting="${key}" type="range" min="${min}" max="${max}" step="1" value="${SYSTEM_DEFAULTS[key] * scale}" aria-label="${label}"></label>`; }).join('')}
      <button data-action="systems-reset">恢复系统参数</button><p>跑道起飞沿用预飞的发动机、驻车与配平状态；返回机库重置，直接空中试飞使用已启动状态。系统参数对六机型共用，仅保留在本次飞机模式。驾驶舱可点按 ENG / PARK / AP LVL / AP HOLD / GEAR / FLAP / BRK / TRIM 0。关闭发动机后逐渐失去推力，重新开启仍按发动机响应恢复。</p></details>
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
      <p><b>A / D</b> 或 <b>← / →</b> 滚转 · <b>Q / E</b> 方向舵<br><b>1 / 2 / 3</b> 油门怠速 / 65% / 全开（支持数字小键盘）<br><b>G</b> 起落架 · <b>F</b> 切换三档襟翼 · <b>B</b> 减速板<br><b>空格</b> 按住制动 · <b>C</b> 循环六种镜头<br><b>V</b> 驾驶舱 / 上次外部机位 · <b>Z / X</b> 按住左右观察<br><b>L</b> 锁定 / 释放外部方位 · <b>R</b> 镜头回正<br><b>Esc / P</b> 暂停并打开设置</p>
      <p><b>I</b> 实时座舱系统 · <b>K</b> 发动机 · <b>N</b> 驻车制动<br><b>J</b> 机翼调平 · <b>H</b> 航向 / 高度保持<br><b>[ / ]</b> 按住低头 / 抬头配平 · <b>T</b> 三轴配平归零<br>完整系统参数位于「座舱系统、配平与自动驾驶」。</p>
      <label>键位预设<select data-setting="keys"><option value="flight">经典飞行</option><option value="wasd">WASD 升降</option></select></label><label>升降方向<select data-setting="pitch"><option value="normal">标准</option><option value="inverted">反向</option></select></label>
      ${controlFields.map(([key, label, min, max, step, scale]) => `<label>${label}<output data-value="${key}"></output><input data-control-setting="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${AIRCRAFT_CONTROL_DEFAULTS[key] * scale}" aria-label="飞机${label}" aria-describedby="av-controls-note"></label>`).join('')}
      <p id="av-controls-note">三轴灵敏度 20%–200%，同时作用于键盘和触屏，满输入以 100% 封顶；更高值让摇杆提早打满。死区过滤中心误触并平滑衔接到满杆；曲线 1× 为线性，越高越适合小幅修正，仅作用于触屏。油门变化为每秒 5%–100%，快捷油门只改变目标，实际推力仍逐步跟随。</p><button data-action="controls-reset">恢复默认操作设置</button>
      <p>手机用左下操纵杆升降与滚转，下方按住左右舵，可同时推杆与用舵；两侧同时按住会抵消。右侧调节油门、襟翼和减速板。起飞前可用起飞襟翼，达到提示速度后拉升，关闭减速板；降落前放轮、放着陆襟翼，降低下降率，接地后油门归零并按住制动。襟翼降低失速速度并增加阻力，超速会自动收起；减速板不代替地面刹车。操作设置对各机型共用，仅保留在本次飞机模式。</p><p data-value="flap-limit"></p></details>
      <details class="av-help av-view-settings"><summary>镜头与视野 · 机位与细调</summary><label>飞行机位<select data-setting="camera-mode">${cameraNames.map((name, mode) => `<option value="${mode}">${name}</option>`).join('')}</select></label>
      ${viewFields.map(([key, label, min, max, step, scale]) => `<label>${label}<output data-view-value="${key}"></output><input data-view="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${AVIATION_VIEW_DEFAULTS[key] * scale}" aria-label="飞机${label}" aria-describedby="av-view-note"></label>`).join('')}
      <label>速度扩角<select data-setting="speed-fov"><option value="on">开启</option><option value="off">关闭</option></select></label><button data-action="view-reset">恢复默认镜头参数</button><p id="av-view-note">响应越高，跟随或转头越快。高度、距离和环绕角度作用于外部机位，始终保留机身与地面净空；驾驶舱视场角同步作用于舱内与远景。L 锁定外部观察方位与地平线，位置仍跟随飞机；切换机位、调整镜头参数、回正或重新起飞解除锁定。驾驶舱不使用外部方位锁。</p></details>
      <details class="av-help av-audio-settings"><summary>画面与声音</summary><label>渲染比例上限<select data-setting="quality"><option value="0.5">0.5× · 极省电</option><option value="0.75">0.75× · 省电</option><option value="1">1× · 原生</option><option value="1.25">1.25× · 标准</option><option value="1.75">1.75× · 精细</option><option value="2">2× · 高精细</option></select></label><label>画面帧率上限<select data-setting="frame-limit"><option value="30">30 FPS · 省电</option><option value="45">45 FPS</option><option value="60" selected>60 FPS · 标准</option><option value="90">90 FPS</option><option value="120">120 FPS</option><option value="0">跟随屏幕刷新率</option></select></label><label>舱内仪表刷新<select data-setting="display-hz"><option value="5">5 Hz · 省电</option><option value="10" selected>10 Hz · 标准</option><option value="20">20 Hz · 精细</option></select></label><p>渲染比例不超过设备像素比。降低画面帧率或舱内仪表刷新可减少绘制负担，飞行物理与输入继续独立更新。</p><label>背景音乐 <output data-volume-value="music"></output><input data-volume="music" type="range" min="0" max="100" aria-label="飞机背景音乐音量"></label><label>引擎与音效 <output data-volume-value="sfx"></output><input data-volume="sfx" type="range" min="0" max="100" aria-label="飞机引擎与音效音量"></label><p data-value="audio-status" role="status" aria-live="polite"></p><button data-action="audio-retry" hidden>重新启用声音</button><small>暂停与离开页面时停止声音；失速警报会暂时降低音乐音量。声音设置与基地共用，仅保留在当前页面；画面和飞行设置仅保留在本次飞机模式。机场尺寸与飞行参数为游戏设计，驾驶舱为原创简化内饰。</small></details>
      <details class="av-credits"><summary>模型署名</summary><p>Airbus A380：<a href="https://sketchfab.com/3d-models/singapore-airlines-a380-fd047ccf175c4db5b7e3e400c67c47a0" target="_blank" rel="noopener noreferrer">Singapore Airlines A380</a>，作者 zairiq-zairiq-123-pixar-cars-bfdi，用户提供，<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>。游戏中调整了大小、朝向和起落架显示。</p><p>Su-30：本项目原创简化模型（CC0），依据双发、双垂尾与前翼轮廓制作。</p><p>星雀 T-6、云帆 B-62、山海 C-24、岚影 D-9：本项目原创架空机型与简化 GLB，采用 CC0。</p></details>
    </aside>
    <div class="av-notice" role="status" aria-live="polite"></div><footer class="av-footer"><span data-value="aircraft">Airbus A380</span><span data-value="keyhint"></span><span data-value="time">00:00</span></footer>`;
  document.body.append(root);
  const $ = selector => root.querySelector(selector);
  const actions = Object.fromEntries([...root.querySelectorAll('[data-action]')].map(element => [element.dataset.action, element]));
  const action = name => actions[name];
  const values = Object.fromEntries([...root.querySelectorAll('[data-value]')].map(element => [element.dataset.value, element]));
  const panel = $('.av-panel'), loadStatus = $('.av-load-status'), stick = $('.av-stick-pad'), knob = $('.av-stick-knob'), systemPanel = $('.av-systems-panel');
  const systemSettings = { ...SYSTEM_DEFAULTS };
  const systemButtons = [...root.querySelectorAll('[data-system-action]')], trimControls = [...root.querySelectorAll('[data-trim]')], apTargets = [...root.querySelectorAll('[data-ap-target]')];
  const systemSummaries = [...root.querySelectorAll('[data-system-value="summary"]')];
  const trimOutputs = [...root.querySelectorAll('[data-trim-value]')];
  const systemFieldsUI = systemFields.map(([key, , scale, unit]) => ({ key, scale, unit, slider: $(`[data-system-setting="${key}"]`), output: $(`[data-system-setting-value="${key}"]`) }));
  const cameraPanel = $('.av-camera-panel'), renderClock = new AviationRenderClock();
  const viewControls = viewFields.map(([key, , , , , scale, unit]) => ({ key, scale, unit, slider: $(`[data-view="${key}"]`), output: $(`[data-view-value="${key}"]`) }));
  const listeners = new AbortController(), held = new Set();
  const controlSettings = { ...AIRCRAFT_CONTROL_DEFAULTS };
  const holdControls = Object.fromEntries([...root.querySelectorAll('[data-hold]')].map(button => [button.dataset.hold, { button, pointer: null, keys: new Set(), active: false }]));
  const aircraftSettings = Object.fromEntries(AIRCRAFT.map(aircraft => [aircraft.id, { ...AIRCRAFT_PHYSICS_DEFAULTS }]));
  let physicsSettings = aircraftSettings.a380;
  const touchInput = { pitch: 0, roll: 0, yaw: 0, brake: false }, input = {};
  const audioFrame = { status: 'menu', speed: 0, mission: flightMusic.a380, aircraft: AIRCRAFT[0], maxSpeed: AIRCRAFT[0].maxSpeed, engineOutput: 0, stalling: false };
  let world;
  try { world = new AviationWorld($('.av-viewport')); }
  catch (error) { root.remove(); throw error; }
  let flight = createAircraftFlight(), loaded = false, disposed = false, graphicsLost = false, returning = false, loadVersion = 0, raf = 0;
  let previousTime = performance.now(), accumulator = 0, uiTime = 0, dirty = true, stickPointer = null, stickPitch = 0, stickRoll = 0, noticeTimer;
  let frameLimit = 60, lastExterior = 0;
  const listen = (target, event, callback, options = {}) => target.addEventListener(event, callback, { ...options, signal: listeners.signal });
  const text = (element, value) => { if (element.textContent !== String(value)) element.textContent = value; };
  let lastAudioStatus;

  function syncAudioStatus() {
    const state = audio.enabled ? audio.context?.state ?? 'locked' : 'muted';
    const music = Math.round(audio.volumes.music * 100), sfx = Math.round(audio.volumes.sfx * 100);
    const status = `${state}/${music}/${sfx}`;
    if (status === lastAudioStatus) return;
    lastAudioStatus = status;
    const retry = action('audio-retry'), focused = document.activeElement === retry;
    retry.hidden = state === 'running' || state === 'muted';
    text(values['audio-status'], state === 'muted' ? '全部声音已静音，点击顶部“已静音”恢复。' : state === 'running' ? `音乐 ${music}% · 引擎 / 音效 ${sfx}%。${music || sfx ? '暂停与离开页面时停止播放。' : '当前音量均为 0%，请调高滑杆。'}` : '浏览器尚未启用声音，请点击“重新启用声音”重试。');
    if (focused && retry.hidden) action('sound').focus({ preventScroll: true });
  }

  function releaseStick() {
    const pointer = stickPointer; stickPointer = null; stickPitch = 0; stickRoll = 0;
    if (pointer !== null && stick.hasPointerCapture(pointer)) stick.releasePointerCapture(pointer);
    knob.style.transform = 'translate(-50%, -50%)';
  }

  function syncHold(control) {
    control.active = control.pointer !== null || control.keys.size > 0;
    control.button.classList.toggle('is-held', control.active);
    control.button.setAttribute('aria-pressed', String(control.active));
  }

  function releaseHold(control, clearKeys = true) {
    const pointer = control.pointer; control.pointer = null;
    if (clearKeys) control.keys.clear();
    if (pointer !== null && control.button.hasPointerCapture(pointer)) control.button.releasePointerCapture(pointer);
    syncHold(control);
  }

  function clearInput() {
    held.clear(); releaseStick();
    for (const control of Object.values(holdControls)) releaseHold(control);
    touchInput.pitch = 0; touchInput.roll = 0; touchInput.yaw = 0; touchInput.brake = false;
    aircraftInput(held, touchInput, controlSettings, input);
    input.trimPitch = 0;
    world.lookTarget = 0;
  }

  function syncControlHelp() {
    const help = aircraftControlHelp(controlSettings);
    text(values.keys, `${help.throttle} 增减油门 · ${help.pitch} 拉升 / 俯冲`);
    text(values.keyhint, `${help.throttle} 油门 · ${help.pitch.split(' / ')[0]} 拉升 · V 驾驶舱 · Esc 设置`);
    $('[data-setting="keys"]').value = controlSettings.preset;
    $('[data-setting="pitch"]').value = controlSettings.invertPitch ? 'inverted' : 'normal';
    for (const [key, , , , , scale, unit] of controlFields) {
      const value = Math.round(controlSettings[key] * scale * 10) / 10;
      $(`[data-control-setting="${key}"]`).value = value;
      text(values[key], `${value}${unit}`);
    }
    text($('.av-joystick>span'), controlSettings.invertPitch ? '前推升 · 后拉降' : '前推降 · 后拉升');
  }

  function syncSystems() {
    const { engineOn, parkingBrake, trim, autopilot } = flight.systems;
    const editable = !graphicsLost && ['ready', 'running', 'paused'].includes(flight.status);
    for (const button of systemButtons) {
      const name = button.dataset.systemAction;
      const selected = name === 'engine' ? engineOn : name === 'parking' ? parkingBrake : name === 'ap-level' ? autopilot.mode === 'level' : name === 'ap-hold' ? autopilot.mode === 'hold' : false;
      if (['engine', 'parking', 'ap-level', 'ap-hold'].includes(name)) button.setAttribute('aria-pressed', String(selected));
      button.disabled = !editable || (name === 'parking' && (!flight.onGround || (!parkingBrake && flight.speed >= 1))) || (name.startsWith('ap-') && name !== 'ap-off' && (flight.onGround || physicsSettings.mode !== 'assisted' || !engineOn)) || (name === 'ap-off' && autopilot.mode === 'off');
    }
    const mode = autopilot.mode === 'hold' ? '航向 / 高度保持' : autopilot.mode === 'level' ? '机翼调平' : '手动飞行';
    for (const element of systemSummaries) text(element, `${engineOn ? '发动机开启' : '发动机关闭'} · ${parkingBrake ? '驻车锁定' : '驻车释放'} · ${mode}`);
    for (const slider of trimControls) {
      slider.disabled = !editable;
      if (document.activeElement !== slider) slider.value = Math.round(trim[slider.dataset.trim] * 100);
    }
    for (const output of trimOutputs) text(output, `${Math.round(trim[output.dataset.trimValue] * 100)}%`);
    for (const field of apTargets) {
      field.disabled = !editable;
      if (document.activeElement !== field) field.value = field.dataset.apTarget === 'heading' ? (Math.round(autopilot.heading * 180 / Math.PI) % 360 + 360) % 360 : Math.round(autopilot.altitude);
    }
    for (const { key, scale, unit, slider, output } of systemFieldsUI) {
      const value = Math.round(systemSettings[key] * scale);if (slider.value !== String(value)) slider.value = value;
      text(output, `${value}${unit}`);
    }
  }

  function setSystemPanel(open) {
    if (open && (graphicsLost || flight.status !== 'running')) return;
    const focused = systemPanel.contains(document.activeElement);systemPanel.hidden = !open;
    action('systems').setAttribute('aria-expanded', String(open));
    if (open) { setCameraPanel(false);clearInput();syncSystems();$('.av-systems-panel strong').focus({ preventScroll: true }); }
    else if (focused) action('systems').focus({ preventScroll: true });
  }

  function systemAction(name) {
    if (graphicsLost) return;
    let changed = false;
    if (name === 'gear') { gear();return; }
    if (name === 'flaps') { flaps();return; }
    if (name === 'speed-brake') { speedBrake();return; }
    if (name === 'engine') changed = toggleEngine(flight);
    if (name === 'parking') changed = toggleParkingBrake(flight);
    if (name === 'trim-reset') for (const axis of ['pitch', 'roll', 'yaw']) changed = setAircraftTrim(flight, axis, 0) || changed;
    if (name.startsWith('ap-')) {
      const mode = name.slice(3);changed = setAutopilot(flight, flight.systems.autopilot.mode === mode ? 'off' : mode);
      if (!changed) notify('自动驾驶暂不可用：请保持稳定模式、发动机开启、足够空速与平稳姿态。');
    }
    if (changed) { audio.event('cockpit-switch');syncSystems();dirty = true; }
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
    if (physicsSettings.mode === 'maneuver' && flight.systems.autopilot.mode !== 'off') setAutopilot(flight, 'off');
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

  function setCameraPanel(open) {
    if (open) setSystemPanel(false);
    const focused = cameraPanel.contains(document.activeElement);
    cameraPanel.hidden = !open;
    action('camera').setAttribute('aria-expanded', String(open));
    if (open) cameraPanel.querySelector(`[data-camera="${world.cameraMode}"]`).focus({ preventScroll: true });
    else if (focused) action('camera').focus({ preventScroll: true });
  }

  function syncCameraUI() {
    text(action('camera'), flight.status === 'ready' ? '预览机位' : `${cameraNames[world.cameraMode]}${world.cameraLocked ? ' · 锁' : ''} ▾`);
    for (const button of cameraPanel.querySelectorAll('[data-camera]')) button.setAttribute('aria-pressed', String(Number(button.dataset.camera) === world.cameraMode));
    action('camera-lock').disabled = world.cameraMode === 2;
    action('camera-lock').setAttribute('aria-pressed', String(world.cameraLocked));
    text(action('camera-lock'), world.cameraLocked ? '释放方位 · L' : '锁定方位 · L');
    text(values['camera-note'], world.cameraMode === 2 ? '驾驶舱随飞机姿态旋转，使用 Z / X 或左右观察按钮。V 返回上次外部机位。' : world.cameraLocked ? '方位已锁定，地平线保持水平。镜头位置仍跟随飞机；L 释放，R 回正。' : '固定观察方位，位置仍跟随飞机。C 循环镜头，V 进出驾驶舱。');
    $('[data-setting="camera-mode"]').value = world.cameraMode;
  }

  function chooseCamera(mode) {
    world.setCameraMode(mode);
    if (world.cameraMode !== 2) lastExterior = world.cameraMode;
    syncCameraUI(); updateUI(); dirty = true;
  }

  function centerCamera() {
    world.viewSettings.orbitAngle = 0;
    world.setCameraMode(world.cameraMode);
    held.delete('KeyZ'); held.delete('KeyX');
    syncViewSettings(); dirty = true;
  }

  function syncViewSettings() {
    for (const { key, scale, unit, slider, output } of viewControls) {
      slider.value = Math.round(world.viewSettings[key] * scale);
      text(output, `${slider.value}${unit}`);
    }
    $('[data-setting="speed-fov"]').value = world.viewSettings.speedFov ? 'on' : 'off';
    syncCameraUI();
  }

  function showPanel() {
    const ready = flight.status === 'ready' && !graphicsLost, paused = flight.status === 'paused' && !graphicsLost;
    panel.hidden = flight.status === 'running';
    if (!panel.hidden) syncPerformance();
    if (!panel.hidden) { clearTimeout(noticeTimer); $('.av-notice').classList.remove('visible'); }
    $('.av-aircraft-list').hidden = !ready; $('.av-runway-choice').hidden = !ready; values.specs.hidden = !ready; loadStatus.hidden = !ready;
    action('resume').hidden = !paused;
    action('runway').hidden = !ready; action('airborne').hidden = !ready;
    action('hangar').hidden = ready || graphicsLost;
    action('retry').hidden = loaded || !ready || loadStatus.dataset.state !== 'error';
    text($('#av-panel-title'), graphicsLost ? '图形连接已中断。' : ready ? '这次，真的飞起来。' : paused ? '云端，稍作停留。' : flight.status === 'completed' ? '平稳返航，欢迎回来。' : '飞行结束，再试一次。');
    text($('#av-panel-copy'), graphicsLost ? '飞行与声音已停止。请点击右上角“返回基地”，再重新进入飞机模式以恢复画面。' : ready ? '从海岸跑道起飞，掠过云层、群山与城市。自由探索，或依次穿过六座导航环，再返回跑道。' : paused ? '飞行已暂停，声音已停止。准备好后继续，或返回机库更换飞机。' : flight.status === 'completed' ? `已飞行 ${(flight.distance / 1000).toFixed(1)} 公里，通过 ${flight.gates} / 6 座训练环。` : flight.reason);
    text(action('pause'), paused ? '继续' : '设置');
    setCameraPanel(false);setSystemPanel(false);syncCameraUI();syncSystems();renderClock.reset();
    action('camera').disabled = flight.status !== 'running';
    action('systems').disabled = graphicsLost || flight.status !== 'running';
    action('pause').disabled = graphicsLost || !['running', 'paused'].includes(flight.status);
    root.classList.toggle('av-flying', flight.status === 'running');
    for (const element of [$('.av-instruments'), $('.av-navigation'), $('.av-flight-tools'), $('.av-joystick'), $('.av-brake')]) element.inert = !panel.hidden;
    clearInput(); dirty = true;
    if (!panel.hidden) (graphicsLost ? action('exit') : paused ? action('resume') : $('#av-panel-title')).focus({ preventScroll: true });
    else root.focus({ preventScroll: true });
  }

  async function selectAircraft(id) {
    if (graphicsLost) return;
    const version = ++loadVersion;
    physicsSettings = aircraftSettings[id];
    flight = createAircraftFlight(id, false, { runwayDirection: $('[data-setting="runway"]').value, physics: physicsSettings, systems: systemSettings }); loaded = false; returning = false;
    syncPhysics();
    text(loadStatus, '正在载入飞机模型…'); loadStatus.dataset.state = 'loading';
    action('runway').disabled = true; action('airborne').disabled = true;
    for (const button of root.querySelectorAll('[data-aircraft]')) button.setAttribute('aria-pressed', String(button.dataset.aircraft === id));
    text(values.aircraft, flight.aircraft.name);
    text(values['flap-limit'], `本机襟翼展开上限 ${Math.round(flight.aircraft.flapLimit * 3.6)} km/h；超过上限 18 km/h 自动收起。`);
    world.setCameraMode(0); lastExterior = 0;
    showPanel();
    try {
      const installed = await world.setAircraft(flight.aircraft);
      if (disposed || graphicsLost || version !== loadVersion || !installed) return;
      loaded = true; text(loadStatus, '飞机就绪 · 选择跑道起飞或直接空中试飞'); loadStatus.dataset.state = 'ready';
      action('runway').disabled = false; action('airborne').disabled = false; action('retry').hidden = true; dirty = true;
    } catch (error) {
      if (disposed || graphicsLost || version !== loadVersion || error.name === 'AbortError') return;
      console.error('Unable to load aircraft:', error);
      text(loadStatus, '模型载入失败，请重试或选择另一架飞机。'); loadStatus.dataset.state = 'error';
      action('retry').hidden = false; dirty = true;
    }
  }

  function start(airborne) {
    if (!loaded || graphicsLost) return;
    const preflight = flight.systems;
    flight = createAircraftFlight(flight.aircraft.id, airborne, { runwayDirection: $('[data-setting="runway"]').value, physics: physicsSettings, systems: systemSettings }); flight.status = 'running'; returning = false;
    if (!airborne) { flight.systems.engineOn = preflight.engineOn;flight.systems.parkingBrake = preflight.parkingBrake;Object.assign(flight.systems.trim, preflight.trim); }
    accumulator = 0; previousTime = performance.now(); world.setCameraMode(world.cameraMode);
    unlockAudio(); showPanel();
    const help = aircraftControlHelp(controlSettings);
    notify(airborne ? `已进入空中 · ${help.pitch} 升降 · V 进入驾驶舱` : `油门推满，达到 ${Math.round(aircraftEnvelope(flight).takeoff * 3.6)} km/h 后按 ${help.pitch.split(' / ')[0]} 拉升`);
  }

  function pause(onlyPause = false) {
    if (graphicsLost) return;
    if (onlyPause && flight.status !== 'running') return;
    toggleAircraftPause(flight); accumulator = 0;
    audio.setState(flight.status === 'running' ? 'running' : 'paused'); showPanel();
  }

  function gear() {
    if (!toggleAircraftGear(flight)) { notify('地面上保持起落架放下，起飞后再收轮。'); return; }
    audio.event('cockpit-switch');notify(flight.gearDown ? '起落架已放下 · 减速、对正跑道后降落' : '起落架已收起 · 空气阻力降低'); dirty = true;
  }

  function flaps() {
    if (!setAircraftFlaps(flight, (flight.flaps + 1) % 3)) { notify(`速度过高，请减至 ${Math.round(flight.aircraft.flapLimit * 3.6)} km/h 以下再放襟翼。`); return; }
    audio.event('cockpit-switch');notify(`襟翼：${flapNames[flight.flaps]} · 当前起飞参考 ${Math.round(aircraftEnvelope(flight).takeoff * 3.6)} km/h`); dirty = true;
  }

  function speedBrake() {
    if (!toggleAircraftSpeedBrake(flight)) return;
    audio.event('cockpit-switch');notify(flight.speedBrake ? '减速板展开 · 起飞前请收起，地面停车仍需按住制动' : '减速板收起'); dirty = true;
  }

  function updateUI() {
    syncSystems();
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
      text(values.guide, flight.systems.parkingBrake ? '驻车制动锁定 · 按 N 释放' : !flight.systems.engineOn ? '发动机关闭 · 按 K 启动' : flight.hasFlown ? '油门归零，按住制动停车' : flight.speedBrake ? '按 B 收起减速板后再起飞' : flight.speed < envelope.takeoff ? '推满油门，沿中线加速' : '拉升机头，离开跑道');
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

  function setThrottle(value) {
    if (flight.status !== 'running') return;
    flight.throttle = value; dirty = true; unlockAudio();
  }

  listen(root, 'click', event => {
    if (event.target === world.renderer.domElement && flight.status === 'running' && !graphicsLost) {
      const control = world.pickCockpitControl(event.clientX, event.clientY);if (control) systemAction(control);return;
    }
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.systemAction) { systemAction(button.dataset.systemAction);return; }
    if (button.dataset.throttle !== undefined) { setThrottle(Number(button.dataset.throttle)); return; }
    if (button.dataset.camera !== undefined) { chooseCamera(Number(button.dataset.camera)); setCameraPanel(false); root.focus({ preventScroll: true }); return; }
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
      case 'hangar': flight = createAircraftFlight(flight.aircraft.id, false, { runwayDirection: $('[data-setting="runway"]').value, physics: physicsSettings, systems: systemSettings }); audio.setState('menu'); world.setCameraMode(0); lastExterior = 0; showPanel(); break;
      case 'systems': setSystemPanel(systemPanel.hidden);break;
      case 'systems-close': setSystemPanel(false);break;
      case 'systems-reset': Object.assign(systemSettings, SYSTEM_DEFAULTS);setSystemSettings(flight, systemSettings);syncSystems();dirty = true;break;
      case 'camera': setCameraPanel(cameraPanel.hidden); break;
      case 'camera-close': setCameraPanel(false); break;
      case 'camera-lock': world.toggleCameraLock(); syncCameraUI(); dirty = true; break;
      case 'camera-center': centerCamera(); break;
      case 'view-reset': Object.assign(world.viewSettings, AVIATION_VIEW_DEFAULTS); world.setCameraMode(world.cameraMode); syncViewSettings(); dirty = true; break;
      case 'look-left': world.lookTarget = world.viewSettings.lookAngle * Math.PI / 180; dirty = true; break;
      case 'look-center': world.lookTarget = 0; dirty = true; break;
      case 'look-right': world.lookTarget = -world.viewSettings.lookAngle * Math.PI / 180; dirty = true; break;
      case 'sound': onToggleAudio(); updateUI(); break;
      case 'audio-retry': unlockAudio(); break;
      case 'controls-reset': Object.assign(controlSettings, AIRCRAFT_CONTROL_DEFAULTS); clearInput(); syncControlHelp(); dirty = true; break;
    }
  });
  listen(root, 'pointerdown', event => {
    if (!cameraPanel.hidden && !cameraPanel.contains(event.target) && !event.target.closest('[data-action="camera"]')) setCameraPanel(false);
    if (!systemPanel.hidden && !systemPanel.contains(event.target) && !event.target.closest('[data-action="systems"]')) setSystemPanel(false);
  });
  for (const slider of trimControls) listen(slider, 'input', () => { if (!graphicsLost) setAircraftTrim(flight, slider.dataset.trim, Number(slider.value) / 100);syncSystems();dirty = true; });
  for (const field of apTargets) listen(field, 'change', () => {
    if (!graphicsLost) setAutopilotTarget(flight, field.dataset.apTarget, field.valueAsNumber);
    const key = field.dataset.apTarget;field.value = key === 'heading' ? (Math.round(flight.systems.autopilot.heading * 180 / Math.PI) % 360 + 360) % 360 : Math.round(flight.systems.autopilot.altitude);dirty = true;
  });
  for (const { key, scale, slider } of systemFieldsUI) listen(slider, 'input', () => {
    systemSettings[key] = Number(slider.value) / scale;setSystemSettings(flight, systemSettings);syncSystems();dirty = true;
  });
  listen($('[data-control="throttle"]'), 'input', event => {
    setThrottle(Number(event.target.value) / 100);
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
  listen($('[data-setting="frame-limit"]'), 'change', event => { frameLimit = Number(event.target.value); renderClock.reset(); dirty = true; });
  listen($('[data-setting="display-hz"]'), 'change', event => { world.displayHz = Number(event.target.value); world.displayTime = 1; dirty = true; });
  listen($('[data-setting="runway"]'), 'change', event => {
    if (flight.status !== 'ready') return;
    const systems = flight.systems;
    flight = createAircraftFlight(flight.aircraft.id, false, { runwayDirection: event.target.value, physics: physicsSettings, systems: systemSettings });
    flight.systems.engineOn = systems.engineOn;flight.systems.parkingBrake = systems.parkingBrake;Object.assign(flight.systems.trim, systems.trim);world.resetCamera = true;dirty = true;
  });
  for (const { key, scale, unit, slider, output } of viewControls) listen(slider, 'input', () => {
    world.viewSettings[key] = Number(slider.value) / scale; text(output, `${slider.value}${unit}`);
    world.setCameraMode(world.cameraMode); syncCameraUI(); dirty = true;
  });
  listen($('[data-setting="camera-mode"]'), 'change', event => chooseCamera(Number(event.target.value)));
  listen($('[data-setting="speed-fov"]'), 'change', event => {
    world.viewSettings.speedFov = event.target.value === 'on';
    world.setCameraMode(world.cameraMode); syncCameraUI(); dirty = true;
  });
  for (const name of ['keys', 'pitch']) listen($(`[data-setting="${name}"]`), 'change', event => {
    if (name === 'keys') controlSettings.preset = event.target.value;
    if (name === 'pitch') controlSettings.invertPitch = event.target.value === 'inverted';
    clearInput(); syncControlHelp(); dirty = true;
  });
  for (const [key, , , , , scale] of controlFields) listen($(`[data-control-setting="${key}"]`), 'input', event => {
    controlSettings[key] = Number(event.target.value) / scale;
    clearInput(); syncControlHelp(); dirty = true;
  });
  listen(window, 'keydown', event => {
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === 'Escape' && !systemPanel.hidden && !event.repeat) { event.preventDefault();setSystemPanel(false);return; }
    if (event.code === 'Escape' && !cameraPanel.hidden && !event.repeat) { event.preventDefault(); setCameraPanel(false); return; }
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
    const throttle = aircraftThrottleShortcut(event.code);
    if (aircraftKeyBinding(event.code, controlSettings.preset) || ['KeyZ', 'KeyX', 'BracketLeft', 'BracketRight'].includes(event.code)) { event.preventDefault(); held.add(event.code); }
    else if (!event.repeat && throttle !== undefined) { event.preventDefault(); setThrottle(throttle); }
    else if (!event.repeat && event.code === 'KeyG') { event.preventDefault(); gear(); }
    else if (!event.repeat && event.code === 'KeyF') { event.preventDefault(); flaps(); }
    else if (!event.repeat && event.code === 'KeyB') { event.preventDefault(); speedBrake(); }
    else if (!event.repeat && event.code === 'KeyC') { event.preventDefault(); chooseCamera((world.cameraMode + 1) % cameraNames.length); }
    else if (!event.repeat && event.code === 'KeyV') { event.preventDefault(); chooseCamera(world.cameraMode === 2 ? lastExterior : 2); }
    else if (!event.repeat && event.code === 'KeyL') { event.preventDefault(); world.toggleCameraLock(); syncCameraUI(); dirty = true; }
    else if (!event.repeat && event.code === 'KeyR') { event.preventDefault(); centerCamera(); }
    else if (!event.repeat && event.code === 'KeyI') { event.preventDefault();setSystemPanel(systemPanel.hidden); }
    else if (!event.repeat && ['KeyH', 'KeyJ', 'KeyK', 'KeyN', 'KeyT'].includes(event.code)) {
      event.preventDefault();systemAction({ KeyH: 'ap-hold', KeyJ: 'ap-level', KeyK: 'engine', KeyN: 'parking', KeyT: 'trim-reset' }[event.code]);
    }
  });
  listen(window, 'keyup', event => {
    held.delete(event.code);
    for (const control of Object.values(holdControls)) if (control.keys.delete(event.code)) syncHold(control);
  });
  const moveStick = event => {
    const bounds = stick.getBoundingClientRect(), radius = bounds.width * .36;
    let x = (event.clientX - bounds.left - bounds.width / 2) / radius, y = (event.clientY - bounds.top - bounds.height / 2) / radius;
    const magnitude = Math.max(1, Math.hypot(x, y)); x /= magnitude; y /= magnitude;
    stickRoll = x; stickPitch = y;
    knob.style.transform = `translate(calc(-50% + ${x * radius}px), calc(-50% + ${y * radius}px))`;
  };
  listen(stick, 'pointerdown', event => {
    if (flight.status !== 'running' || stickPointer !== null || event.button > 0) return;
    event.preventDefault(); stickPointer = event.pointerId; stick.setPointerCapture(event.pointerId); moveStick(event); unlockAudio();
  });
  listen(stick, 'pointermove', event => { if (event.pointerId === stickPointer) { event.preventDefault(); moveStick(event); } });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(stick, name, event => { if (event.pointerId === stickPointer) releaseStick(); });
  for (const control of Object.values(holdControls)) {
    const button = control.button;
    listen(button, 'pointerdown', event => {
      if (flight.status !== 'running' || control.pointer !== null || event.button > 0) return;
      event.preventDefault(); control.pointer = event.pointerId; button.setPointerCapture(event.pointerId); syncHold(control); unlockAudio();
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(button, name, event => { if (event.pointerId === control.pointer) releaseHold(control, false); });
    listen(button, 'keydown', event => {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || !['Space', 'Enter'].includes(event.code) || flight.status !== 'running') return;
      event.preventDefault(); event.stopPropagation(); control.keys.add(event.code); syncHold(control); unlockAudio();
    });
    listen(button, 'blur', () => releaseHold(control));
  }
  listen(window, 'blur', () => pause(true));
  listen(window, 'pagehide', () => pause(true));
  listen(document, 'visibilitychange', () => { if (document.hidden) pause(true); previousTime = performance.now(); accumulator = 0; });
  listen(window, 'resize', () => { world.resize(); dirty = true; clearInput(); });
  listen(window, 'orientationchange', () => pause(true));
  listen(world.renderer.domElement, 'webglcontextlost', event => {
    event.preventDefault(); graphicsLost = true; loaded = false; world.loadController?.abort();
    if (flight.status === 'running') toggleAircraftPause(flight);
    accumulator = 0; audio.setState('paused'); showPanel();
    action('resume').disabled = true; action('runway').disabled = true; action('airborne').disabled = true;
  });

  function frame(now) {
    if (disposed) return;
    const dt = Math.max(0, Math.min((now - previousTime) / 1000, .1)); previousTime = now;
    if (!document.hidden) {
      if (flight.status === 'running') {
        touchInput.pitch = stickPitch; touchInput.roll = stickRoll;
        touchInput.yaw = Number(holdControls['yaw-right'].active) - Number(holdControls['yaw-left'].active);
        touchInput.brake = holdControls.brake.active;
        aircraftInput(held, touchInput, controlSettings, input);
        input.trimPitch = Number(held.has('BracketRight')) - Number(held.has('BracketLeft'));
        accumulator += dt;
        while (accumulator >= 1 / 60 && flight.status === 'running') {
          updateAircraftFlight(flight, input, 1 / 60); accumulator -= 1 / 60;
          for (const event of flight.events) {
            if (event === 'gate') { audio.event('gate'); notify(`通过导航环 ${flight.gates} / 6`); }
            if (event === 'takeoff') { audio.event('glide'); notify('已离地 · 按 G 收起起落架'); }
            if (event === 'flaps-limit') notify('襟翼超过安全速度，已自动收起。');
            if (event === 'touchdown') { audio.event('land'); notify('成功接地 · 油门归零，按住制动'); }
            if (event === 'ap-disconnect') { audio.event('ap-disconnect');notify(`自动驾驶已退出 · ${{ manual: '已手动接管', stall: '空速不足', ground: '已接地', mode: '切换自由机动', engine: '发动机关闭', attitude: '姿态超出范围' }[flight.systems.autopilot.reason]}`); }
            if (event === 'crash' || event === 'completed') { audio.setState(event === 'crash' ? 'lost' : 'won'); audio.event(event === 'crash' ? 'lost' : 'won'); showPanel(); }
          }
        }
      } else accumulator = 0;
      uiTime += dt;
      if (dirty || (flight.status === 'running' && uiTime > .08)) { updateUI(); uiTime = 0; }
      audioFrame.status = graphicsLost ? 'paused' : audioStates[flight.status]; audioFrame.speed = flight.speed; audioFrame.mission = flightMusic[flight.aircraft.id];
      audioFrame.aircraft = flight.aircraft; audioFrame.maxSpeed = flight.performance.maxSpeed;
      audioFrame.engineOutput = flight.engineOutput * physicsSettings.thrust; audioFrame.stalling = flight.stalling;
      audio.update(audioFrame);
      syncAudioStatus();
      const look = held.has('KeyZ') || held.has('KeyX') ? (Number(held.has('KeyZ')) - Number(held.has('KeyX'))) * world.viewSettings.lookAngle * Math.PI / 180 : null;
      if (!graphicsLost && (dirty || flight.status === 'running')) {
        const renderDt = renderClock.tick(dt, frameLimit, dirty);
        if (renderDt !== null) world.render(flight, renderDt, input, look);
      }
      dirty = false;
    }
    raf = requestAnimationFrame(frame);
  }
  syncControlHelp(); syncViewSettings(); selectAircraft('a380'); raf = requestAnimationFrame(frame);
  return { dispose };
}
