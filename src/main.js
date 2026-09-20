import './style.css';
import './expedition.css';
import './challenge.css';
import './cup.css';
import './supply.css';
import './environment.css';
import './compact.css';
import './delivery.css';
import './cruise.css';
import './rewards.css';
import { createGame, startGame, updateGame, togglePause, getDebrief, getDeliveryStatus, getFlightCue, getJumpRingCue, isJumpReady, PHYSICS } from './game.js';
import { MISSIONS, CRAFTS } from './missions.js';
import { MISSION_CATEGORIES, filterMissions, filterCrafts, minimumDriveLabel } from './catalogue.js';
import { POWERUPS } from './route-rewards.js';
import { BRIDGE_NAMES, bridgeAt } from './bridges.js';
import { craftIcon } from './craft-icons.js';
import { FlightRecorder, sampleGhost, compareSplit, saveRecord } from './ghost.js';
import { RACERS, buildField } from './pilots.js';
import { createCup, completeStage, advanceStage, getStandings, getTrophy, getRaceView } from './cup.js';
import { createExpedition, settleExpedition, buyUpgrade, advanceExpedition, getContracts } from './expedition.js';
import { mountExpeditionUI, renderExpeditionHUD, renderExpeditionResult, renderSupply } from './expedition-ui.js';
import { World } from './world.js';
import { createRoute } from './route.js';
import { AudioEngine } from './audio.js';
import { ENVIRONMENT, gravityAt, meteorState } from './environment.js';
import { mountReleases } from './releases.js';
import { FlightInput, KEY_ACTIONS } from './input.js';
import { getDriveStatus } from './drive-status.js';

const routePreviews = new Map(MISSIONS.map(mission => [mission.id, createRoute(mission).getSpacedPoints(90)]));

const icons = {
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  sound: '<path d="m11 5-6 4H2v6h3l6 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 5-6 4H2v6h3l6 4V5Zm5 4 6 6m0-6-6 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2l-1.5 1v2m0 3v.1"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  close: '<path d="m6 6 12 12m-12 0 12-12"/>',
  core: '<path d="m12 2 8 10-8 10-8-10 8-10Zm-8 10h16M12 2v20"/>',
  flag: '<path d="M5 21V3m0 0c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
  bolt: '<path d="m14 2-9 12h7l-2 8 9-12h-7l2-8Z"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/>',
  jump: '<path d="M5 19h14M12 16V4m-5 5 5-5 5 5"/>',
  trophy: '<path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm0 2H4v2a4 4 0 0 0 5 4m7-6h4v2a4 4 0 0 1-5 4m-3 2v5m-5 3h10m-8-3h6v3H9v-3Z"/>',
};
const icon = (name, className = '') => `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;

document.querySelector('#app').innerHTML = `
  <div id="viewport"></div>
  <div class="shade"></div><div class="screen-edge"></div>
  <header class="header">
    <a class="brand" href="#" aria-label="月面速递首页"><span class="brand-mark"><svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="m20 4 15 28-15-6-15 6L20 4Z" stroke="currentColor" stroke-width="1.6"/><path d="m20 15 4 8-4-2-4 2 4-8Z" fill="currentColor"/></svg></span><span>月面速递<small>LUNAR COURIER</small></span></a>
    <div class="header-center"><span class="status-dot"></span> 星际运输局 <span class="slash">/</span> 独立飞行计划</div>
    <div class="header-actions"><span class="live-label">系统在线 <span class="status-dot"></span></span><button id="sound" class="icon-button" aria-label="关闭声音" title="声音">${icon('sound')}</button><button id="help" class="icon-button" aria-label="操作指南" title="操作指南">${icon('help')}</button><button id="pause-button" class="icon-button" aria-label="暂停游戏" title="暂停 · Esc" hidden>${icon('pause')}</button></div>
  </header>

  <main id="menu" class="menu">
    <div class="hero">
      <div class="eyebrow"><span class="orange-line"></span> <span id="mission-caption">一场远离地球的极速任务</span> <span id="mission-number" class="mission-number">001</span></div>
      <h1>奔向星海的<br>另<span class="outlined">一面。</span></h1>
      <p class="hero-copy">这片寂静，等你打破。<br>驾驶超高速悬浮艇，穿越 ${MISSIONS.length} 颗星球的盘山公路。</p>
      <div class="mission-specs"><div><strong><b id="spec-time">${MISSIONS[0].duration}</b><span id="spec-time-unit">秒</span></strong><small>任务时限</small></div><div><strong>6<span>座</span></strong><small>导航检查点</small></div><div><strong><b id="spec-length">${(MISSIONS[0].length / 1000).toFixed(1)}</b><span>公里</span></strong><small>星球山路</small></div></div>
      <button id="start" class="primary-button" disabled><span>正在建立月面连接…<small>PREPARING YOUR FLIGHT</small></span>${icon('arrow')}</button>
      <div class="start-note"><span class="status-dot"></span> 无需下载 · 即刻出发 <span class="enter-note">按 <kbd>Enter</kbd> 开始</span></div>
    </div>
    <aside class="flight-loadout"><div class="loadout-label"><span class="status-dot"></span> 当前飞行配置 <span>${MISSIONS.length} 星 / ${CRAFTS.length} 艇</span></div><strong id="loadout-mission">${MISSIONS[0].name}</strong><p id="loadout-craft">LC–07 游隼 · 均衡型</p><div id="session-best" class="session-best">新的航程，等你留下纪录。</div><button id="open-hangar" class="hangar-button"><span>任务机库<small>选择航线与悬浮艇</small></span>${icon('arrow')}</button></aside>
    <div class="scene-label"><span class="crosshair">+</span><div><span id="scene-craft">LC–07 · 游隼</span><small>为连环山弯而生。为极限速度而来。</small></div></div>
    <div class="coordinates"><span id="region-label">${MISSIONS[0].region}</span><small id="planet-profile">MOUNTAIN RUN / 01</small><div class="coordinate-line"></div><small>OPEN WORLDS <b>${MISSIONS.length} / ${MISSIONS.length}</b></small></div>
    <footer class="menu-footer"><div class="key-guide"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 驾驶</span><span><kbd>SPACE</kbd> 冲刺</span><span><kbd>F</kbd> 跃升</span><span><kbd>ESC</kbd> 暂停</span></div><span class="footer-note">${MISSIONS.length} 颗星球。${MISSIONS.length} 条山路。一次极限远征。<span>✦</span></span></footer>
  </main>

  <section id="hud" class="hud" aria-label="飞行仪表" hidden>
    <div class="hud-top"><div class="mission-heading"><span class="eyebrow">OPERATION / 001</span><strong id="sector">离开基地</strong><span id="objective">收集 6 枚能量核心，穿过全部导航门</span></div><div class="timer-box"><span>任务剩余</span><strong id="timer">01:30<small>.00</small></strong><div class="timer-line"><i id="timer-fill"></i></div></div><div class="cargo-box"><div>${icon('core')}<strong id="cargo">0 <small>/ 6</small></strong><span>能量核心</span></div><div>${icon('flag')}<strong id="gates">0 <small>/ 6</small></strong><span>导航门</span></div></div></div>
    <div class="flight-direction"><span id="next-distance">270 M</span><span class="direction-symbol">⌄</span><small id="next-label">下一座导航门</small><div id="flight-cue" class="flight-cue"><strong id="cue-action">◎ 中央对准</strong><small id="cue-detail">保持航向</small></div></div>
    <div id="combo-panel" class="combo-panel"><span>连续收集</span><strong id="combo-value">0</strong><small id="combo-multiplier">×1.0</small></div>
    <div id="rival-panel" class="rival-panel"><div class="rival-heading"><span class="ghost-dot"></span><span id="rival-title">个人幽灵 / 首航记录</span></div><strong id="rival-delta">建立纪录</strong><span id="rival-split">成功返航后解锁追逐</span><div id="rival-live" class="rival-live">每一次出发，都有进步。</div><div id="split-flash" class="split-flash" role="status" aria-live="polite"></div></div>
    <div class="hud-bottom"><div class="speed-panel"><div class="eyebrow">GROUND SPEED</div><div><strong id="speed">000</strong><span>KM/H</span></div><div class="speed-ticks">${'<i></i>'.repeat(24)}</div><span id="throttle-hint">按住 W / ↑ 加速</span></div><div class="resource-panel"><div class="resource-label">${icon('bolt')}<span>冲刺能量</span><strong id="energy-value">100%</strong><kbd>SPACE</kbd></div><div class="resource-track"><i id="energy-fill"></i></div><div class="hull-row">${icon('shield')}<span>艇体状态</span><div class="hull-track"><i id="hull-fill"></i></div><strong id="hull-value">100%</strong></div><div class="flight-help"><span>A / D 左右避障</span><span>S 制动</span><span>Esc 暂停</span></div></div><div class="map-panel"><div class="map-heading"><span>航线雷达</span><span id="progress">0%</span></div><canvas id="minimap" width="360" height="200" aria-label="航线进度雷达"></canvas><div class="map-footer"><span class="status-dot"></span><span>${MISSIONS[0].name}</span><strong id="score">00000</strong></div></div></div>
    <div class="jump-indicator"><kbd>F</kbd>${icon('jump')}<span id="jump-status">跃升就绪</span><small>18 能量</small></div>
    <div id="touch-controls" class="touch-controls"><div><button data-control="left" aria-label="向左">←</button><button data-control="right" aria-label="向右">→</button><button data-control="jump" class="touch-jump" aria-label="跃升">${icon('jump')}</button></div><div><button data-control="brake" aria-label="制动">制动</button><button data-control="boost" class="touch-boost" aria-label="冲刺">${icon('bolt')}</button><button data-control="accelerate" class="touch-go" aria-label="加速">加速 ↑</button></div></div>
  </section>

  <div id="countdown" class="countdown" hidden><span>准备离港</span><strong id="countdown-number">3</strong><small>按住 W 或 ↑ 加速 · 航向自动跟随环线</small></div>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <div id="impact-flash" class="impact-flash"></div>
  <section id="pause" class="overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title" hidden><div class="modal-card"><span class="eyebrow">FLIGHT ON HOLD</span><h2 id="pause-title">星海可以等一会。</h2><p>任务已暂停。准备好后，继续你的航程。</p><button id="resume" class="primary-button"><span>继续飞行</span>${icon('arrow')}</button><button id="restart-pause" class="secondary-button">重新挑战</button><button id="back-pause" class="text-button">返回基地</button></div></section>
  <section id="result" class="overlay" role="dialog" aria-modal="true" aria-labelledby="result-title" hidden><div class="modal-card result-card"><span id="result-eyebrow" class="eyebrow">MISSION COMPLETE</span><div id="result-symbol" class="result-symbol">✦</div><h2 id="result-title">能量送达，欢迎回家。</h2><p id="result-copy"></p><div class="result-stats"><div><strong id="result-score">0</strong><span>任务得分</span></div><div><strong id="result-time">0</strong><span>飞行用时</span></div><div><strong id="result-cargo">0</strong><span>收集核心</span></div></div><div id="result-details" class="result-details"></div><div id="result-medals" class="result-medals"></div><div id="result-rating" class="result-rating"></div><button id="retry" class="primary-button"><span>再飞一次</span>${icon('arrow')}</button><button id="next-mission" class="secondary-button" hidden>下一条航线 →</button><button id="back-result" class="text-button">返回基地</button></div></section>
  <dialog id="guide"><button id="close-guide" class="icon-button dialog-close" aria-label="关闭操作指南">${icon('close')}</button><span class="eyebrow">PILOT BRIEFING</span><h2>你的第一次星际飞行。</h2><p>在 ${MISSIONS[0].duration} 秒内完成山路，穿过 6 座橙色导航门，<br>带回至少 6 枚蓝色能量核心。</p><div class="guide-keys"><div><span><kbd>W</kbd> / <kbd>↑</kbd></span><span>按住加速，松开减速</span></div><div><span><kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd></span><span>左右移动，躲避岩石</span></div><div><span><kbd>S</kbd> / <kbd>↓</kbd></span><span>快速制动</span></div><div><span><kbd>SPACE</kbd></span><span>能量冲刺，松开自动充能</span></div><div><span><kbd>ESC</kbd> / <kbd>P</kbd></span><span>暂停 / 继续</span></div></div><div class="guide-tip">航向会自动跟随环线，你负责加速与左右避障。蓝色核心可修复艇体并补充冲刺能量；漏过导航门会返回门前并扣除 4 秒。触屏设备使用屏幕下方按钮。</div><div class="quality-setting"><span>画面质量<small>切换到流畅模式可降低设备负担</small></span><button id="quality" class="setting-button" aria-label="切换画面质量">精致 <span>↔</span></button></div><button id="guide-ready" class="primary-button"><span>收到，准备出发</span>${icon('arrow')}</button></dialog>
  <div id="error" class="overlay" hidden><div class="modal-card"><span class="eyebrow">CONNECTION INTERRUPTED</span><h2>月面连接未能建立。</h2><p id="error-copy">请启用浏览器硬件加速，或换用支持 WebGL 2 的现代浏览器。</p><button id="reload" class="primary-button"><span>重新连接</span>${icon('arrow')}</button></div></div>
  <dialog id="hangar" aria-labelledby="hangar-title"><button id="close-hangar" class="icon-button dialog-close" aria-label="关闭任务机库">${icon('close')}</button><span class="eyebrow">FLIGHT DECK / 自由选择，立即出发</span><h2 id="hangar-title">每一次出发，都有新选择。</h2><div class="hangar-columns"><section><div class="hangar-section-title"><span>01</span> 选择航线</div><div id="mission-options" class="selection-list"></div></section><section><div class="hangar-section-title"><span>02</span> 选择悬浮艇</div><div id="craft-options" class="selection-list"></div></section></div><div id="hangar-summary" class="hangar-summary"></div><button id="confirm-hangar" class="primary-button"><span>确认飞行配置</span>${icon('arrow')}</button></dialog>
`;

const $ = (id) => document.getElementById(id);
document.querySelector('.resource-panel').insertAdjacentHTML('afterbegin', '<div id="route-tools" class="route-tools" hidden><span id="power-status"></span><span id="challenge-status"></span></div>');
mountReleases();
$('guide').setAttribute('aria-labelledby', 'guide-title');
$('guide').querySelector('h2').id = 'guide-title';
$('guide-ready').insertAdjacentHTML('beforebegin', '<fieldset class="audio-settings"><legend>声音设置</legend><label for="music-volume">背景音乐 <output id="music-level" for="music-volume">45%</output><input id="music-volume" type="range" min="0" max="100" value="45"></label><label for="sfx-volume">引擎与音效 <output id="sfx-level" for="sfx-volume">80%</output><input id="sfx-volume" type="range" min="0" max="100" value="80"></label><button id="audio-toggle" class="setting-button" aria-pressed="false">静音全部声音</button><small id="audio-status" role="status">首次操作后启用声音。暂停时停止播放，音量设置在刷新后恢复默认。</small></fieldset>');
$('restart-pause').insertAdjacentHTML('afterend', '<button id="pause-settings" class="secondary-button">声音设置与操作指南</button>');
$('resume').insertAdjacentHTML('afterend', '<dl id="pause-progress" class="pause-progress" aria-label="当前航程"></dl><p id="pause-cargo-note"></p>');
$('back-result').insertAdjacentHTML('beforebegin', '<button id="result-settings" class="text-button">声音设置与操作指南</button>');
$('sound').setAttribute('aria-pressed', 'false');
$('pause-button').insertAdjacentHTML('beforebegin', '<button id="cruise-button" type="button" aria-pressed="false" aria-label="开启巡航油门" aria-keyshortcuts="C" title="巡航油门 · C 切换，制动或暂停后解除" hidden><span>巡航油门</span><kbd>C</kbd></button>');
$('countdown').querySelector('small').textContent = '按住 W / ↑ 加速，或按 C 开启巡航油门';
$('error').setAttribute('role', 'alertdialog');
$('error').setAttribute('aria-modal', 'true');
$('error').setAttribute('aria-labelledby', 'error-title');
$('error').setAttribute('aria-describedby', 'error-copy');
$('error').querySelector('h2').id = 'error-title';
const ghostSetting = suffix => `<div class="quality-setting ghost-setting"><span>航迹投影<small>显示个人幽灵与赛事对手 · 关闭仍保留成绩对比</small></span><button id="ghost-toggle${suffix}" class="setting-button" aria-label="航迹投影" aria-pressed="true">开启 <span>◈</span></button></div>`;
$('hangar-summary').insertAdjacentHTML('afterend', `${ghostSetting('')}<p id="ghost-availability" class="ghost-availability"></p>`);
$('guide-ready').insertAdjacentHTML('beforebegin', ghostSetting('-guide'));
$('result-rating').insertAdjacentHTML('beforebegin', '<div id="result-challenge" class="result-challenge"></div><details id="split-review" class="split-review"><summary>分段飞行报告 <span>展开查看 ↓</span></summary><table><thead><tr><th scope="col">航标</th><th scope="col">累计用时</th><th scope="col">累计差距</th><th scope="col">本段差距</th></tr></thead><tbody id="result-splits"></tbody></table><p>对比本次起飞前的个人最快航程；负值表示更快。</p></details>');
$('hangar-title').insertAdjacentHTML('afterend', `<div id="mode-options" class="mode-options" aria-label="飞行模式"><button data-mode="delivery" aria-pressed="true"><span>自由速递<small>自由选择航线 · 挑战个人幽灵</small></span><b>↗</b></button><button data-mode="cup" aria-pressed="false"><span>月环大奖赛<small>${MISSIONS.length} 站连赛 · 四艇竞速 · 争夺月环杯</small></span>${icon('trophy')}</button></div><div id="cup-brief" class="cup-brief" hidden><strong>一款飞船，${MISSIONS.length} 站征途。</strong><p>从${MISSIONS[0].planet}到${MISSIONS.at(-1).planet}，依次挑战 ${MISSIONS.length} 颗星球。每站须完成交付，四艇按用时排名，依次获得 12 / 9 / 6 / 3 积分。失败可重试本站，晋级后恢复装甲与能量。</p><div class="cup-entrants">${RACERS.map(racer => `<span style="--racer:${racer.color}"><i></i>${racer.name}<small>${racer.style}</small></span>`).join('')}</div><small>电脑对手使用相同飞船与规则；投影互不碰撞。中途返回基地或刷新会结束赛事。</small></div>`);
$('result-details').insertAdjacentHTML('beforebegin', '<section id="cup-result" class="cup-result" aria-label="赛事积分榜" hidden><details id="cup-route-review" class="route-review"><summary id="cup-route-summary"></summary><div id="cup-stage-strip" class="cup-stage-strip"></div></details><div class="cup-table-title"><strong id="cup-board-title">赛事总积分</strong><span>四艇计时赛</span></div><table><thead><tr><th scope="col">名次</th><th scope="col">领航员</th><th scope="col">积分</th><th scope="col">累计用时</th></tr></thead><tbody id="cup-standings"></tbody></table><p id="cup-standing-note"></p></section>');
$('retry').insertAdjacentHTML('beforebegin', `<button id="continue-cup" class="primary-button" hidden><span>前往下一站</span>${icon('arrow')}</button>`);
mountExpeditionUI();
$('mission-options').insertAdjacentHTML('beforebegin', `
  <label class="catalogue-field">探索星图<input id="mission-search" type="search" placeholder="星球、航线、里程 · 如 20km" autocomplete="off" maxlength="60" aria-controls="mission-options" aria-describedby="mission-count"></label>
  <div id="mission-categories" class="catalogue-filters" role="group" aria-label="航线分类">${MISSION_CATEGORIES.map(category => `<button type="button" data-category="${category.id}" aria-pressed="${category.id === 'all'}">${category.label}<span>${filterMissions('', category.id).length}</span></button>`).join('')}</div>
  <div class="catalogue-meta"><p id="mission-count" class="catalogue-count" role="status"></p><button id="reset-missions" class="catalogue-reset" hidden>重置筛选</button></div>
  <p id="mission-empty" class="catalogue-empty" hidden>没有匹配的航线。<br>试试其他关键词或重置筛选。</p>
`);
$('craft-options').insertAdjacentHTML('beforebegin', `
  <label class="catalogue-field">查找飞船<input id="craft-search" type="search" placeholder="名称、型号、定位 · 如 LC-60" autocomplete="off" maxlength="60" aria-controls="craft-options" aria-describedby="craft-count"></label>
  <label class="catalogue-field craft-sort">性能排序<select id="craft-sort" aria-controls="craft-options"><option value="catalogue">图鉴顺序</option><option value="boostSpeed">冲刺极速 · 高到低</option><option value="handling">机动能力 · 高到低</option><option value="hull">艇体装甲 · 高到低</option><option value="recharge">能量充能 · 高到低</option></select></label>
  <div class="catalogue-meta"><p id="craft-count" class="catalogue-count" role="status"></p><button id="reset-crafts" class="catalogue-reset" hidden>重置列表</button></div>
  <p id="craft-empty" class="catalogue-empty" hidden>没有匹配的飞船。<br>试试名称、型号或重置列表。</p>
`);
$('result-details').insertAdjacentHTML('beforebegin', '<div id="environment-result" class="environment-result"></div>');
const game = createGame();
const records = new Map();
const fields = new Map();
let mode = 'delivery';
let missionCategory = 'all';
let cup = null;
let expedition = null;
let completedContracts = new Set();
let raceField = [];
let raceView = null;
let projections = [];
let recorder;
let rival = null;
let ghostPose = null;
let ghostEnabled = true;
let splitFlashUntil = 0;
const audio = new AudioEngine();
const controls = new FlightInput();
const panels = ['menu', 'hud', 'countdown', 'pause', 'result'].map($);
const refs = Object.fromEntries(['sector', 'objective', 'timer', 'timer-fill', 'cargo', 'gates', 'speed', 'energy-value', 'energy-fill', 'hull-value', 'hull-fill', 'next-distance', 'next-label', 'progress', 'score', 'throttle-hint', 'countdown-number'].map((id) => [id, $(id)]));
const map = $('minimap').getContext('2d');
let world;
let lastStatus = '';
let lastCountdown = 4;
let toastTimeout;
let toastPriority = 0;
let guidePaused = false;
let frameTime = performance.now();
let accumulator = 0;
let uiTime = 0;
let autoQuality = true;
let performanceFrames = 0;
let performanceTime = 0;

function updateLoadout() {
  const { mission, craft } = game;
  const scrollPositions = ['mission-options', 'craft-options'].map(id => $(id).scrollTop);
  document.body.dataset.mode = mode;
  document.body.dataset.biome = mission.biome;
  document.documentElement.style.setProperty('--mission', mission.color);
  $('mission-caption').textContent = mode === 'cup' ? '月环大奖赛 · 向冠军出发' : mission.special ? `${mission.name} · ${mission.label}` : mission.name;
  $('mission-number').textContent = mission.number;
  $('spec-time').textContent = mission.endurance ? `${Math.floor(mission.duration / 60)}:${String(mission.duration % 60).padStart(2, '0')}` : mission.duration;
  $('spec-time-unit').textContent = mission.endurance ? '分:秒' : '秒';
  $('spec-length').textContent = (mission.length / 1000).toFixed(1);
  $('loadout-mission').textContent = mode === 'cup' ? `月环大奖赛 · ${MISSIONS.length} 站征途` : mission.name;
  $('loadout-craft').textContent = `${craft.model} ${craft.name} · ${craft.role}`;
  $('scene-craft').textContent = `${craft.model} · ${craft.name}`;
  $('region-label').textContent = mission.region;
  $('planet-profile').textContent = `${mission.planet} / ${(mission.length / 1000).toFixed(1)} KM 山路`;
  const best = records.get(`${mission.id}/${craft.id}`);
  $('session-best').textContent = best ? `会话最佳 ${best.score} 分 · 最快 ${best.time.toFixed(1)}s` : '新的航程，等你留下纪录。';
  $('ghost-availability').textContent = best ? `幽灵已就绪 · ${best.time.toFixed(2)}s · 再次出发，挑战自己的最快航程。` : '此配置尚无幽灵。成功返航一次即可建立；纪录随页面刷新清空。';
  if (mode === 'cup') {
    $('session-best').textContent = `${MISSIONS.length} 站积分决胜 · 每站交付后晋级`;
    $('ghost-availability').textContent = `同级竞速 · 迎光、钴蓝、余烬均驾驶${craft.name}。计时不含倒计时与暂停。`;
  }
  if (mode === 'expedition') {
    $('mission-caption').textContent = '远征补给 · 让每一程都有收获';
    $('loadout-mission').textContent = `远征补给 · ${MISSIONS.length} 站改装之旅`;
    $('session-best').textContent = '沿途接委托 · 补给换升级 · 穿越星海';
    $('ghost-availability').textContent = '远征独立计分，升级不影响普通航线纪录。进度仅保留到本次远征结束。';
  }
  $('cup-brief').hidden = mode !== 'cup';
  $('expedition-brief').hidden = mode !== 'expedition';
  $('mode-options').querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  document.querySelector('.hangar-columns .hangar-section-title').innerHTML = `<span>01</span> ${mode !== 'delivery' ? `${MISSIONS.length} 站航程 / 依次挑战` : '选择航线'}`;
  document.querySelector('#open-hangar small').textContent = '选择模式、航线与悬浮艇';
  if (world) $('start').innerHTML = `<span>${mode === 'cup' ? '出战月环大奖赛' : '开始飞行'}<small>${mode === 'cup' ? 'MANY WORLDS. ONE CHAMPION.' : 'LET’S MAKE A DELIVERY'}</small></span>${icon('arrow')}`;
  if (world && mode === 'expedition') $('start').innerHTML = `<span>开启远征补给<small>DELIVER. UPGRADE. EXPLORE.</small></span>${icon('arrow')}`;
  $('guide').querySelector('p').textContent = `在 ${mission.duration} 秒内完成 ${mission.name}，穿过 6 座导航门，带回至少 ${mission.cargo} 枚蓝色能量核心。`;
  $('route-guide').textContent = {
    boost: '本航线无障碍与陨石。全路宽加速带连续提供免费超频，保持低空接力；S 可制动。核心与导航门在中央，航道边缘仍会损伤艇体。',
    hazard: '本航线没有加速带，密集岩障之间留有交替缺口，跟随蓝色核心横移避让；F 可跃过障碍，注意陨石红圈并为跃升保留能量。',
    garden: '本航线无障碍与陨石。沿中央收集核心、通过导航门，绿色加速带提供短时免费冲刺；航道边缘仍会损伤艇体。',
  }[mission.special] ?? '绿色加速带提供免费超频，F 可跃过障碍；留意岩石、巡逻机和陨石预警。';
  if (mission.bridges.length) $('route-guide').textContent += ` 本航线长 ${mission.length / 1000} 公里，沿途有 ${mission.bridges.length} 座斜拉桥、悬索桥与峡谷高架桥；上下山与桥面均需主动驾驶，桥上保留障碍与导航门。`;
  if (mission.tour) $('route-guide').textContent += ' 本线道具自动拾取：蓝色护盾 12 秒内挡一次撞击；紫色磁吸持续 8 秒；绿色维修恢复 35 装甲、30 能量。金色极速环需低空达到巡航速度的 90%，紫色跃升环需在 F 跃升后以 2.8–6.2 米高度穿过；左右容差 3.5 米。挑战环只奖分与能量，连续命中加分，漏环或受撞中断连锁，不影响交付晋级。';
  const meteors = game.course.meteors.length > 0, gravity = game.course.gravityZones.length > 0;
  $('guide').querySelector('.environment-guide').hidden = !meteors && !gravity;
  $('meteor-help').hidden = !meteors;
  $('gravity-help').hidden = !gravity;
  $('mission-options').innerHTML = MISSIONS.map(option => {
    const preview = routePreviews.get(option.id);
    const xs = preview.map(point => point.x), zs = preview.map(point => point.z);
    const minX = Math.min(...xs), minZ = Math.min(...zs);
    const scale = Math.min(85 / (Math.max(...xs) - minX), 45 / (Math.max(...zs) - minZ));
    const points = preview.map(({ x, z }) => `${5 + (x - minX) * scale},${5 + (z - minZ) * scale}`).join(' ');
    return `<button class="mission-option" data-mission="${option.id}" aria-pressed="${option.id === mission.id}" style="--choice:${option.color}"><span class="option-index">${option.number}</span><div><span class="option-label">${option.planet} / ${option.layout} · ${option.endurance ? '长途 / ' : ''}${option.label}</span><strong>${option.name}</strong><p>${option.description}</p><small>${option.duration} 秒 <i>·</i> ${(option.length / 1000).toFixed(1)} 公里 <i>·</i> ${option.cargo} 枚核心${option.endurance ? ` <i>·</i> ${minimumDriveLabel(option)}` : ''}${option.bridges.length ? ` <i>·</i> ${option.bridges.length} 座桥` : ''}</small></div><svg viewBox="0 0 95 55" aria-hidden="true"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5"/></svg><span class="selection-check">✓</span></button>`;
  }).join('');
  document.querySelectorAll('[data-mission]').forEach(button => { button.disabled = mode !== 'delivery'; });
  $('craft-options').innerHTML = CRAFTS.map(option => `<button class="craft-option" data-craft="${option.id}" aria-pressed="${option.id === craft.id}" style="--choice:${option.color}">${craftIcon(option.id)}<div class="craft-option-copy"><span class="option-label">${option.model} / ${option.role}</span><strong>${option.name}</strong><p>${option.description}</p><small class="craft-energy">巡航 ${Math.round(option.speed * 3.6)} km/h · 充能 ${option.recharge}/s</small><div class="craft-stats"><span>极速 <b>${Math.round(option.boostSpeed * 3.6)}</b><i style="--stat:${option.boostSpeed / Math.max(...CRAFTS.map(craft => craft.boostSpeed)) * 100}%"></i></span><span>装甲 <b>${option.hull}</b><i style="--stat:${option.hull / Math.max(...CRAFTS.map(craft => craft.hull)) * 100}%"></i></span><span>机动 <b>${option.handling}</b><i style="--stat:${option.handling / Math.max(...CRAFTS.map(craft => craft.handling)) * 100}%"></i></span></div></div><span class="selection-check">✓</span></button>`).join('');
  const estimate = mission.special === 'boost' ? `持续加速约 ${(mission.length / craft.boostSpeed / 60).toFixed(1)} 分钟` : mission.endurance ? `用时参考 ${(mission.length / craft.boostSpeed / 60).toFixed(1)}–${Math.ceil(mission.length / craft.speed / 60)} 分钟` : `建议用时 ${mission.par}s`;
  $('hangar-summary').innerHTML = `<span>${mission.name} <b>×</b> ${craft.name}</span><small>穿过 6 座导航门 · 收集 ${mission.cargo} 枚核心 · ${estimate}</small>`;
  if (mode === 'cup') $('hangar-summary').innerHTML = `<span>月环大奖赛 <b>×</b> ${craft.name}</span><small>${(MISSIONS.reduce((sum, item) => sum + item.length, 0) / 1000).toFixed(1)} 公里 · ${MISSIONS.length * 6} 座导航门 · 同款飞船完成 ${MISSIONS.length} 站</small>`;
  if (mode === 'expedition') $('hangar-summary').innerHTML = `<span>远征补给 <b>×</b> ${craft.name}</span><small>${MISSIONS.length * 3} 项沿途委托 · ${MISSIONS.length - 1} 次中途改装 · 每项升级最多两级</small>`;
  updateMissionCatalogue();
  updateCraftCatalogue();
  ['mission-options', 'craft-options'].forEach((id, index) => { $(id).scrollTop = scrollPositions[index]; });
}

function updateMissionCatalogue() {
  const search = $('mission-search');
  search.disabled = mode !== 'delivery';
  const category = search.disabled ? 'all' : missionCategory;
  for (const button of $('mission-categories').children) {
    button.disabled = search.disabled;
    button.setAttribute('aria-pressed', String(button.dataset.category === category));
  }
  const visible = new Set(filterMissions(search.disabled ? '' : search.value, category).map(mission => mission.id));
  for (const button of $('mission-options').children) button.hidden = !visible.has(button.dataset.mission);
  $('mission-count').textContent = search.disabled ? `${MISSIONS.length} 条航线 · 按顺序挑战，航线筛选暂不可用` : `${visible.size} / ${MISSIONS.length} 条航线 · 已选${game.mission.planet}${visible.has(game.mission.id) ? '' : '（筛选外）'}`;
  $('mission-empty').hidden = visible.size > 0;
  $('reset-missions').hidden = search.disabled || (category === 'all' && !search.value.trim());
}

function updateCraftCatalogue() {
  const crafts = filterCrafts($('craft-search').value, $('craft-sort').value);
  const visible = new Set(crafts.map(craft => craft.id));
  const buttons = new Map([...$('craft-options').children].map(button => [button.dataset.craft, button]));
  for (const [id, button] of buttons) button.hidden = !visible.has(id);
  for (const craft of crafts) $('craft-options').append(buttons.get(craft.id));
  $('craft-count').textContent = `${crafts.length} / ${CRAFTS.length} 款飞船 · 已选${game.craft.name}${visible.has(game.craft.id) ? '' : '（筛选外）'}`;
  $('craft-empty').hidden = crafts.length > 0;
  $('reset-crafts').hidden = !$('craft-search').value.trim() && $('craft-sort').value === 'catalogue';
}

function showError(message) {
  guidePaused = false;
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  if (['running', 'countdown'].includes(game.status)) pause();
  audio.setBackground(true);
  clearInput();
  if (message) $('error-copy').textContent = message;
  $('error').hidden = false;
  for (const element of $('app').children) element.inert = element !== $('error');
  $('reload').focus({ preventScroll: true });
}

function configure(missionId, craftId, upgrades = {}) {
  if (game.status !== 'menu' || !world) return false;
  const changedMission = game.mission.id !== missionId;
  Object.assign(game, createGame(missionId, craftId, upgrades));
  try {
    if (changedMission) world.loadMission(game);
    else world.setCraft(game.craft);
    performanceFrames = 0;
    performanceTime = 0;
    frameTime = performance.now();
    accumulator = 0;
    updateLoadout();
    return true;
  } catch (error) {
    console.error('Unable to switch mission:', error);
    showError();
    return false;
  }
}

function toast(message, tone = '', priority = tone === 'warning' ? 2 : 0) {
  if ($('toast').classList.contains('visible') && priority < toastPriority) return;
  clearTimeout(toastTimeout);
  toastPriority = priority;
  $('toast').textContent = message;
  $('toast').className = `toast visible ${tone}`;
  toastTimeout = setTimeout(() => $('toast').classList.remove('visible'), 2500);
}

function clearInput() {
  controls.clear();
  game.jumpHeld = false;
  game.boostLocked = false;
  syncControls();
}

function syncControls() {
  document.querySelectorAll('[data-control]').forEach(button => button.classList.toggle('pressed', controls.held(button.dataset.control)));
  $('cruise-button').setAttribute('aria-pressed', String(controls.cruise));
  $('cruise-button').setAttribute('aria-label', controls.cruise ? '关闭巡航油门' : '开启巡航油门');
  $('cruise-button').querySelector('span').textContent = controls.cruise ? '巡航已开' : '巡航油门';
  $('cruise-button').disabled = controls.held('brake');
}

function toggleCruise() {
  if (!['running', 'countdown'].includes(game.status) || controls.held('brake')) return;
  controls.toggleCruise();
  syncControls();
  toast(controls.cruise ? '巡航油门已开启 · 手动转向，S 或制动解除' : '巡航油门已关闭 · 可手动加速或制动', 'cyan');
}

function launch() {
  if (!world) return;
  if (mode === 'expedition') {
    if (!expedition || expedition.status === 'complete') {
      expedition = createExpedition(game.craft.id);
      game.status = 'menu';
      if (!configure(MISSIONS[0].id, expedition.craftId)) { expedition = null; return; }
    }
    if (expedition.status !== 'flying') return;
  }
  if (mode === 'cup') {
    if (!cup || cup.status === 'complete') {
      cup = createCup(game.craft.id);
      game.status = 'menu';
      if (!configure(MISSIONS[0].id, cup.craftId)) { cup = null; return; }
    }
    if (cup.status !== 'racing') return;
    const key = `${game.mission.id}/${game.craft.id}`;
    if (!fields.has(key)) fields.set(key, buildField(game.mission.id, game.craft.id));
    raceField = fields.get(key);
  }
  clearInput();
  unlockAudio();
  startGame(game);
  recorder = expedition ? null : new FlightRecorder(game);
  rival = expedition ? null : records.get(`${game.mission.id}/${game.craft.id}`)?.ghost ?? null;
  completedContracts = new Set();
  ghostPose = null;
  projections = [];
  raceView = null;
  splitFlashUntil = 0;
  $('split-flash').textContent = '';
  $('split-review').open = false;
  world.sparks = [];
  world.shake = 0;
  world.cameraReady = false;
  lastCountdown = 4;
  accumulator = 0;
  frameTime = performance.now();
  $('toast').classList.remove('visible');
  document.activeElement?.blur();
  syncPanels();
}

function home() {
  clearInput();
  cup = null;
  expedition = null;
  raceField = [];
  raceView = null;
  projections = [];
  game.status = 'menu';
  configure(mode !== 'delivery' ? MISSIONS[0].id : game.mission.id, game.craft.id);
  recorder = null;
  rival = null;
  ghostPose = null;
  document.body.classList.remove('boosting', 'low-gravity');
  world.cameraReady = false;
  world.sparks = [];
  $('toast').classList.remove('visible');
  updateLoadout();
  syncPanels();
}

function continueCup() {
  if (!cup || game.status !== 'won') return;
  if (cup.status === 'complete') { launch(); return; }
  if (!advanceStage(cup)) return;
  game.status = 'menu';
  if (configure(MISSIONS[cup.stage].id, cup.craftId)) launch();
}

function continueExpedition() {
  if (!expedition || game.status !== 'won') return;
  if (expedition.status === 'complete') { launch(); return; }
  if (!advanceExpedition(expedition)) return;
  game.status = 'menu';
  if (configure(MISSIONS[expedition.stage].id, expedition.craftId, expedition.upgrades)) launch();
}

function pause() {
  clearInput();
  accumulator = 0;
  frameTime = performance.now();
  togglePause(game);
  if (game.status !== 'paused') unlockAudio();
  syncPanels();
}

function failureAdvice() {
  const { course, mission, reason } = game;
  if (reason === 'time') {
    if (mission.special === 'boost') return '保持低空，让全路宽加速带连续接力；避免长时间制动，提前对准中央导航门。';
    return course.pads.length ? '绿色加速带提供免费加速，收集蓝色核心可补充冲刺能量；减少碰撞和漏门，保持前进。' : '交替使用巡航与冲刺，为跃升保留能量；跟随核心穿过安全缺口，减少碰撞和漏门造成的时间损失。';
  }
  if (reason === 'hull') return course.obstacles.length || course.meteors.length ? '横移避让或按 F 跃过障碍，留意陨石红圈；蓝色核心可以修复艇体。' : '远离航道边缘，提前松开转向并用 S 制动；沿中央收集蓝色核心可以修复艇体。';
  if (reason === 'cargo') return `需要至少 ${mission.cargo} 枚蓝色核心才能完成交付，${mission.special && mission.special !== 'hazard' ? '保持低空，沿航道中央收集' : '保持低空，留意航道两侧'}。`;
  return '请依次穿过全部 6 座导航门，按航向提示提前对准门中央。';
}

function syncPanels() {
  const status = game.status;
  if (lastStatus === status) return;
  lastStatus = status;
  audio.setState(status);
  document.body.dataset.state = status;
  document.querySelector('.header').inert = ['paused', 'won', 'lost'].includes(status);
  $('hud').inert = status === 'paused';
  panels.forEach((panel) => { panel.hidden = true; });
  $('menu').hidden = status !== 'menu';
  $('hud').hidden = !['running', 'countdown', 'paused'].includes(status);
  $('countdown').hidden = status !== 'countdown';
  $('pause').hidden = status !== 'paused';
  $('pause-button').hidden = !['running', 'countdown', 'paused'].includes(status);
  $('cruise-button').hidden = !['running', 'countdown', 'paused'].includes(status);
  $('expedition-hud').hidden = !expedition;
  $('rival-panel').hidden = !!expedition;
  $('restart-pause').textContent = cup ? '重飞本站' : '重新挑战';
  $('back-pause').textContent = cup ? '结束赛事，返回基地' : '返回基地';
  $('pause').querySelector('p').textContent = cup ? `第 ${cup.stage + 1} / ${MISSIONS.length} 站已暂停，已完成的 ${cup.legs.length} 站积分保留。重飞仅重置本站；返回基地会结束本场赛事。` : '任务已暂停。准备好后，继续你的航程。';
  if (expedition) {
    $('restart-pause').textContent = '重飞本站';
    $('back-pause').textContent = '结束远征，返回基地';
    $('pause').querySelector('p').textContent = `第 ${expedition.stage + 1} / ${MISSIONS.length} 站已暂停。重飞保留已购升级与 ${expedition.supply} 点补给，本站委托重新开始；返回基地会结束远征。`;
  }
  if (status === 'paused') {
    const delivery = getDeliveryStatus(game);
    $('pause-progress').innerHTML = `<div><dt>航程进度</dt><dd>${Math.floor(game.distance / game.mission.length * 100)}%</dd></div><div><dt>剩余航程</dt><dd>${formatDistance(game.mission.length - game.distance)}</dd></div><div><dt>蓝色核心</dt><dd>${game.collected.size} / ${game.mission.cargo}</dd></div><div><dt>导航门</dt><dd>${game.gates} / ${game.course.gates.length}</dd></div>`;
    $('pause-cargo-note').textContent = delivery.needed ? `还需 ${delivery.needed} 枚核心 · 前方剩余 ${delivery.remaining} 枚${delivery.shortfall ? '。前方余量不足，可重飞本站。' : '。保持低空收集。'}` : game.gates < game.course.gates.length ? '核心已齐，继续穿过剩余导航门。' : '核心与导航门已齐备，沿航线返回基地。';
    $('pause-cargo-note').dataset.warning = String(delivery.shortfall > 0);
    $('pause').querySelector('.modal-card').scrollTop = 0;
    $('resume').focus({ preventScroll: true });
  }
  if (status === 'won' || status === 'lost') {
    clearInput();
    $('result').hidden = false;
    const won = status === 'won';
    const debrief = getDebrief(game);
    const record = expedition ? { newScore: false, newBest: false, previousTime: null } : saveRecord(records, game, recorder);
    if (cup && won) completeStage(cup, game, raceField);
    if (expedition && won) settleExpedition(expedition, game);
    audio.event(status);
    $('result-eyebrow').textContent = won ? 'DELIVERY COMPLETE / 任务完成' : 'SIGNAL LOST / 任务中止';
    $('result-symbol').textContent = won ? '✦' : '↺';
    $('result-symbol').style.color = '';
    $('result-title').textContent = won ? '能量送达，欢迎回家。' : { time: '时间到了，下一次更快。', hull: '艇体受损，救援已出发。', cargo: '带回的能量还不够。', gates: '还有未点亮的航标。' }[game.reason];
    $('result-copy').textContent = won ? `${game.mission.name} · ${game.craft.model} ${game.craft.name}，交付完成。` : failureAdvice();
    $('result-score').textContent = String(game.score).padStart(5, '0');
    $('result-time').textContent = `${game.elapsed.toFixed(1)}s`;
    $('result-cargo').textContent = `${game.collected.size} / ${game.course.pickups.length}`;
    $('environment-result').innerHTML = `${game.course.meteors.length ? `<span>☄ 跃过冲击波 <b>${game.meteorDodges}</b></span>` : ''}${game.course.gravityZones.length ? `<span>⌁ 低重力滑翔 <b>${game.glides}</b></span>` : ''}`;
    $('environment-result').hidden = !game.course.meteors.length && !game.course.gravityZones.length;
    document.querySelectorAll('.result-stats > div > span').forEach((label, index) => { label.textContent = (cup || expedition ? ['本站得分', '本站用时', '本站核心'] : ['任务得分', '飞行用时', '收集核心'])[index]; });
    $('result-details').innerHTML = `<span>最高连收 <b>${game.maxCombo}</b></span><span>精准过门 <b>${game.perfectGates} / 6</b></span>${game.course.obstacles.length ? `<span>空中避障 <b>${game.airDodges}</b></span>` : ''}`;
    $('result-medals').innerHTML = debrief.medals.map(medal => `<span><b>${medal.symbol}</b>${medal.name}</span>`).join('');
    if (game.mission.tour) $('result-details').insertAdjacentHTML('beforeend', `<span>道具 <b>${game.powerupsTaken.size}</b></span><span>挑战命中 <b>${game.challengeHits}/${game.course.challenges.length}</b></span><span>最长连锁 <b>${game.maxChallengeChain}</b></span><span>护盾抵挡 <b>${game.shieldBlocks}</b></span>`);
    $('result-rating').textContent = won ? `${debrief.rank}  /  ${{ S: '星际传奇', A: '王牌速递员', B: '可靠领航员' }[debrief.rank]}${record.newScore ? ' · 本次会话得分新纪录' : ''}` : `已完成 ${Math.floor(game.distance / game.mission.length * 100)}% 航程 · 每一次出发都更接近终点`;
    $('result-challenge').textContent = !won ? (rival ? '个人幽灵已保留 · 下次继续追逐' : '成功返航后建立你的第一道幽灵') : record.previousTime === null ? '首航纪录已建立 · 再飞一次，与自己的幽灵同场' : record.newBest ? `刷新最快航程！快了 ${(record.previousTime - game.elapsed).toFixed(2)} 秒` : `距个人最快 ${deltaText(game.elapsed - record.previousTime)} · 再找一条更快的路线`;
    $('result-challenge').dataset.tone = record.newBest ? 'ahead' : 'neutral';
    $('result-splits').innerHTML = Array.from({ length: game.course.gates.length + 1 }, (_, index) => {
      const time = recorder?.splits[index];
      const delta = compareSplit(recorder?.splits, rival?.splits, index);
      return `<tr><th scope="row">${index < 6 ? `导航门 0${index + 1}` : '返航基地'}</th><td>${time === undefined ? '—' : `${time.toFixed(2)}s`}</td><td data-tone="${deltaTone(delta?.total)}">${delta ? deltaText(delta.total) : '—'}</td><td data-tone="${deltaTone(delta?.sector)}">${delta ? deltaText(delta.sector) : '—'}</td></tr>`;
    }).join('');
    $('next-mission').hidden = !won || game.mission.id === MISSIONS.at(-1).id;
    $('cup-result').hidden = !cup;
    $('expedition-result').hidden = !expedition;
    $('result-details').hidden = !!expedition && !game.mission.tour;
    for (const id of ['result-medals', 'result-rating', 'split-review']) $(id).hidden = !!expedition;
    $('result-challenge').hidden = !!cup || !!expedition;
    $('continue-cup').hidden = !cup || !won;
    $('continue-expedition').hidden = !expedition || !won;
    $('retry').hidden = !!(cup || expedition) && won;
    $('retry').querySelector('span').textContent = cup || expedition ? '重试本站' : '再飞一次';
    $('back-result').textContent = cup && cup.status !== 'complete' ? '结束赛事，返回基地' : '返回基地';
    if (cup) renderCupResult(won);
    if (expedition) {
      $('next-mission').hidden = true;
      $('back-result').textContent = expedition.status === 'complete' ? '返回基地' : '结束远征，返回基地';
      renderExpeditionResult(expedition, game);
    }
    document.querySelector('.result-card').scrollTop = 0;
    $(won && expedition ? 'continue-expedition' : cup && won ? 'continue-cup' : 'retry').focus({ preventScroll: true });
  }
}

function renderCupResult(won) {
  const standings = getStandings(cup);
  const player = standings.find(row => row.id === 'player');
  const trophy = getTrophy(cup);
  $('next-mission').hidden = true;
  $('result-eyebrow').textContent = trophy ? 'LUNAR GRAND PRIX / 全程完赛' : `LUNAR GRAND PRIX / 第 ${cup.stage + 1} 站`;
  if (trophy) {
    $('result-symbol').innerHTML = icon('trophy', 'cup-trophy');
    $('result-symbol').style.color = trophy.color;
    $('result-title').textContent = `${trophy.name}，欢迎归航。`;
    $('result-copy').textContent = `${game.craft.name}完成 ${MISSIONS.length} 站征途，累计 ${player.points} 积分，总榜第 ${player.place} 名。`;
  } else if (won) {
    $('result-title').textContent = '一站告捷，征途继续。';
    $('result-copy').textContent = `${game.mission.name}交付完成。下一站：${MISSIONS[cup.stage + 1].name}，装甲与能量已准备补满。`;
  } else $('result-copy').textContent += ` 已完成的 ${cup.legs.length} 站积分保留，重试本站后继续争冠。`;
  $('cup-board-title').textContent = trophy ? '月环大奖赛 · 最终总榜' : cup.legs.length ? '月环大奖赛 · 当前总榜' : '月环大奖赛 · 等待首站成绩';
  $('cup-route-review').open = false;
  $('cup-route-summary').textContent = `完整航程 · 已完成 ${cup.legs.length} / ${MISSIONS.length} 站`;
  $('cup-stage-strip').innerHTML = MISSIONS.map((mission, index) => `<span data-state="${index < cup.legs.length ? 'done' : index === cup.stage ? 'current' : 'pending'}"><b>${index < cup.legs.length ? '✓' : mission.number}</b>${mission.name}</span>`).join('');
  $('cup-standings').innerHTML = standings.map(row => `<tr class="${row.id === 'player' ? 'player-row' : ''}"><td>${cup.legs.length ? String(row.place).padStart(2, '0') : '—'}</td><th scope="row"><i style="--racer:${row.color}"></i>${row.name}<small>${row.id === 'player' ? '领航员' : '电脑'}</small></th><td><strong>${row.points}</strong></td><td>${cup.legs.length ? `${row.time.toFixed(2)}s` : '—'}</td></tr>`).join('');
  $('cup-standing-note').textContent = '积分相同时，按完赛站数、累计用时排序。每站 12 / 9 / 6 / 3 分；任务得分单独统计。';
  const leg = won ? cup.legs.at(-1)?.results.find(row => row.id === 'player') : null;
  $('result-rating').textContent = leg ? `本站第 ${leg.place} / 4 名 · +${leg.points} 赛事积分${trophy ? ` · ${trophy.name}` : ''}` : '本次未计入赛事积分 · 可重试本站';
  if (won) $('continue-cup').querySelector('span').textContent = trophy ? '再战月环大奖赛' : `前往第 ${cup.stage + 2} 站 · ${MISSIONS[cup.stage + 1].name}`;
}

function deltaTone(delta) { return delta === undefined || Math.abs(delta) < 0.005 ? 'neutral' : delta < 0 ? 'ahead' : 'behind'; }
function deltaText(delta) { return Math.abs(delta) < 0.005 ? '±0.00s' : `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(2)}s`; }

function updateRival() {
  if (expedition) { renderExpeditionHUD(expedition, game); return; }
  $('rival-panel').dataset.cup = String(!!cup);
  if (cup && raceView) {
    $('rival-title').textContent = `月环大奖赛 / 第 ${cup.stage + 1} 站`;
    $('rival-delta').textContent = game.status === 'countdown' ? '准备发车' : `${raceView.place} / 4`;
    $('rival-panel').dataset.tone = raceView.place === 1 ? 'ahead' : 'neutral';
    $('rival-split').textContent = `实时名次 · 已获 ${getStandings(cup).find(row => row.id === 'player').points} 积分`;
    $('rival-live').innerHTML = raceView.rows.filter(row => row.id !== 'player').map(row => `<span class="racer-line"><i style="--racer:${row.color}"></i>${row.name}<b>${row.finished ? '已返航' : `${Math.round(row.distance / game.mission.length * 100)}%`}</b></span>`).join('');
    $('split-flash').hidden = true;
    return;
  }
  const index = Math.min(game.gates - 1, 5);
  const delta = compareSplit(recorder?.splits, rival?.splits, index);
  $('rival-title').textContent = rival ? '个人幽灵 / 最快航程' : '个人幽灵 / 首航记录';
  $('rival-delta').textContent = delta ? deltaText(delta.total) : rival ? '等待分段' : '建立纪录';
  $('rival-panel').dataset.tone = deltaTone(delta?.total);
  $('rival-split').textContent = delta ? `导航门 0${index + 1} · ${delta.total < -0.005 ? '累计领先' : delta.total > 0.005 ? '累计落后' : '累计持平'}` : rival ? `目标 ${rival.splits.at(-1).toFixed(2)}s` : '成功返航后解锁追逐';
  if (rival) {
    const distance = ghostPose ? game.distance - ghostPose.distance : null;
    $('rival-live').textContent = distance === null ? '幽灵已返航 · 继续完成交付' : Math.abs(distance) < 1 ? '当前与幽灵并行' : `当前${distance > 0 ? '领先' : '落后'} ${Math.round(Math.abs(distance))}m`;
  } else $('rival-live').textContent = game.gates ? `已记录 ${game.gates} / 6 个航标` : '首局也会记录每一段表现';
  $('split-flash').hidden = game.elapsed >= splitFlashUntil;
}

function drawMap() {
  map.clearRect(0, 0, 360, 200);
  const project = (distance) => {
    const { point } = world.frame(distance);
    const { min, max } = world.routeBounds;
    const scale = Math.min(320 / (max.x - min.x), 165 / (max.z - min.z));
    return [180 + (point.x - (min.x + max.x) / 2) * scale, 99 + (point.z - (min.z + max.z) / 2) * scale];
  };
  map.strokeStyle = '#ffffff0b'; map.lineWidth = 1;
  for (let x = 0; x < 360; x += 30) { map.beginPath(); map.moveTo(x, 0); map.lineTo(x, 200); map.stroke(); }
  for (let y = 10; y < 200; y += 30) { map.beginPath(); map.moveTo(0, y); map.lineTo(360, y); map.stroke(); }
  map.beginPath();
  for (let i = 0; i <= 100; i++) { const [x, y] = project(i / 100 * game.mission.length); i ? map.lineTo(x, y) : map.moveTo(x, y); }
  map.strokeStyle = '#63808d'; map.lineWidth = 2; map.stroke();
  for (const zone of game.course.gravityZones) {
    map.beginPath();
    for (let i = 0; i <= 20; i++) { const [x, y] = project(zone.start + (zone.end - zone.start) * i / 20); i ? map.lineTo(x, y) : map.moveTo(x, y); }
    map.strokeStyle = '#bda6ff'; map.lineWidth = 4; map.stroke();
  }
  map.beginPath();
  for (let i = 0; i <= 100; i++) { const [x, y] = project(i / 100 * game.distance); i ? map.lineTo(x, y) : map.moveTo(x, y); }
  map.strokeStyle = '#ff945f'; map.lineWidth = 3; map.stroke();
  game.course.gates.forEach((gate, i) => { const [x, y] = project(gate.distance); map.fillStyle = i < game.gates ? '#8cf0ce' : '#ffac7d'; map.fillRect(x - 3, y - 3, 6, 6); });
  for (const meteor of game.course.meteors) {
    const [x, y] = project(meteor.distance);
    const active = ['warning', 'impact'].includes(meteorState(meteor, game.elapsed).phase);
    map.beginPath(); map.arc(x, y, active ? 6 : 3, 0, Math.PI * 2);
    map.strokeStyle = active ? '#ff7759' : '#a36d59'; map.lineWidth = 2; map.stroke();
  }
  for (const projection of ghostEnabled ? projections : []) {
    const [gx, gy] = project(projection.pose.distance);
    map.beginPath(); map.moveTo(gx, gy - 7); map.lineTo(gx + 7, gy); map.lineTo(gx, gy + 7); map.lineTo(gx - 7, gy); map.closePath();
    map.strokeStyle = projection.color; map.lineWidth = 2; map.stroke();
  }
  const [x, y] = project(game.distance);
  map.beginPath(); map.arc(x, y, 6, 0, Math.PI * 2); map.fillStyle = '#fff'; map.fill();
  map.beginPath(); map.arc(x, y, 11, 0, Math.PI * 2); map.strokeStyle = '#ffffff55'; map.lineWidth = 1; map.stroke();
}

function formatDistance(distance) {
  const meters = Math.max(0, Math.ceil(distance));
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} KM` : `${meters} M`;
}

function updateHUD() {
  const delivery = getDeliveryStatus(game);
  const seconds = Math.floor(game.time);
  const minutes = Math.floor(seconds / 60);
  refs.timer.innerHTML = `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}<small>.${String(Math.floor(game.time % 1 * 100)).padStart(2, '0')}</small>`;
  refs.timer.classList.toggle('urgent', game.time < 20);
  refs['timer-fill'].style.width = `${game.time / game.mission.duration * 100}%`;
  refs.cargo.innerHTML = `${game.collected.size} <small>/ ${game.mission.cargo}</small>`;
  refs.cargo.classList.toggle('complete', game.collected.size >= game.mission.cargo);
  refs.cargo.classList.toggle('shortfall', delivery.shortfall > 0);
  refs.cargo.setAttribute('aria-label', `已收集 ${game.collected.size} 枚，目标 ${game.mission.cargo} 枚，前方剩余 ${delivery.remaining} 枚`);
  refs.gates.innerHTML = `${game.gates} <small>/ 6</small>`;
  refs.speed.textContent = String(Math.round(game.speed * 3.6)).padStart(3, '0');
  refs['energy-value'].textContent = `${Math.ceil(game.energy)}%`;
  refs['energy-fill'].style.width = `${game.energy}%`;
  const hullPercent = Math.ceil(game.hull / game.craft.hull * 100);
  refs['hull-value'].textContent = `${hullPercent}%`;
  refs['hull-fill'].style.width = `${hullPercent}%`;
  refs['hull-fill'].classList.toggle('danger', hullPercent < 35);
  refs.progress.textContent = `${Math.floor(game.distance / game.mission.length * 100)}%`;
  refs.score.textContent = String(game.score).padStart(5, '0');
  document.querySelector('.mission-heading .eyebrow').textContent = cup ? `CUP / ${cup.stage + 1} OF ${MISSIONS.length} · ${game.craft.model}` : `OPERATION / ${game.mission.number} · ${game.craft.model}`;
  if (expedition) document.querySelector('.mission-heading .eyebrow').textContent = `EXPEDITION / ${expedition.stage + 1} OF ${MISSIONS.length} · ${game.craft.model}`;
  document.querySelector('.map-footer span:nth-child(2)').textContent = game.mission.name;
  const bridge = bridgeAt(game.mission, game.distance);
  const sectorName = bridge ? `${BRIDGE_NAMES[bridge.kind]} ${String(bridge.id + 1).padStart(2, '0')}` : game.gates === 6 ? '最后一程' : game.mission.name;
  refs.sector.innerHTML = `${sectorName}<span class="sector-stage">${game.gates === 6 ? '返回基地' : `第 ${String(game.gates + 1).padStart(2, '0')} 区段`}</span>`;
  refs.objective.textContent = delivery.needed ? `还需 ${delivery.needed} 枚核心 · 前方剩余 ${delivery.remaining} 枚` : game.gates < 6 ? `核心已装载 · 还需 ${6 - game.gates} 座导航门` : '能量已装载 · 沿航线返回基地';
  refs['next-distance'].textContent = formatDistance((game.course.gates[game.gates]?.distance ?? game.mission.length) - game.distance);
  refs['next-label'].textContent = `${game.gates < 6 ? '下一座导航门' : '返航基地'}${delivery.shortfall ? ' · 前方核心不足' : ''}`;
  refs['next-label'].dataset.warning = String(delivery.shortfall > 0);
  const cue = getFlightCue(game);
  const lowGravity = gravityAt(game.course, game.distance) === ENVIRONMENT.lowGravity;
  document.body.classList.toggle('low-gravity', lowGravity);
  $('flight-cue').dataset.kind = cue.kind;
  $('flight-cue').dataset.danger = String(cue.danger ?? cue.drifting ?? false);
  if (cue.kind === 'meteor') {
    $('cue-action').textContent = `☄ ${cue.phase === 'impact' ? '冲击波' : '陨石落点'} ${cue.distance}m`;
    $('cue-detail').textContent = cue.phase === 'impact' ? '横移避让 · 腾空越过冲击波' : `${cue.remaining.toFixed(1)}s 后撞击 · ${cue.danger ? '避开红圈或准备跃升' : '留意红圈与落地时机'}`;
  } else if (cue.kind === 'cargo') {
    $('cue-action').textContent = { left: '← 左侧核心', right: '右侧核心 →', center: '◇ 核心对准' }[cue.direction];
    $('cue-detail').textContent = `${formatDistance(cue.distance)} · ${game.height >= 2.3 ? '落回低空后收集' : `还需 ${delivery.needed} 枚`}`;
  } else if (cue.kind === 'powerup' || cue.kind === 'challenge') {
    const title = cue.kind === 'powerup' ? POWERUPS[cue.reward].name : cue.reward === 'jump' ? '跃升环' : '极速环';
    $('cue-action').textContent = `${cue.direction === 'left' ? '← ' : ''}${title}${cue.direction === 'right' ? ' →' : ''} · ${formatDistance(cue.distance)}`;
    $('cue-detail').textContent = cue.kind === 'powerup' ? '可选补给 · 低空接近自动拾取' : cue.reward === 'speed' ? `可选挑战 · 低空 ≥${Math.ceil(game.craft.speed * .9 * 3.6)} km/h` : `${getJumpRingCue(game, cue.distance).text} · 环内 2.8–6.2m`;
  } else if (cue.kind === 'gate') {
    $('cue-action').textContent = (cue.projected ? { left: '← 向左修正', right: '向右修正 →', center: '◎ 松开转向' } : { left: '← 向左对准', right: '向右对准 →', center: '◎ 中央对准' })[cue.direction];
    $('cue-detail').textContent = cue.drifting ? '惯性可能漏门 · 反向修正' : cue.aligned ? (cue.projected ? cue.direction === 'center' ? '预计对准中央 · 保持速度' : '预计可通过 · 可微调居中' : '当前航向有效 · 中央高速有奖励') : `${cue.projected ? '预计' : '当前'}偏离门中心 ${Math.abs(cue.offset).toFixed(1)}m`;
  } else {
    $('cue-action').textContent = cue.kind === 'hazard' ? `⚠ ${cue.hazard === 'drone' ? '巡逻机' : '岩石'} ${cue.distance}m` : '◇ 返回基地';
    $('cue-detail').textContent = cue.kind === 'hazard' ? (cue.timeToImpact <= 0.25 ? '立即横移 · 注意航道边缘' : `约 ${cue.timeToImpact.toFixed(1)}s · ${isJumpReady(game) ? '跃升或横移' : '横移或制动'}`) : !delivery.needed ? '能量就位，全速返航' : delivery.remaining ? `还需 ${delivery.needed} 枚 · 前方剩余 ${delivery.remaining} 枚` : '前方已无核心 · 暂停可重飞';
  }
  const drive = getDriveStatus(game, { brake: controls.held('brake'), cruise: controls.cruise, lowGravity });
  refs['throttle-hint'].textContent = drive.text;
  refs['throttle-hint'].dataset.kind = drive.kind;
  document.body.classList.toggle('boosting', game.boosting);
  $('combo-value').textContent = game.combo;
  $('combo-multiplier').textContent = `×${Math.min(3, 1 + Math.floor(Math.max(0, game.combo - 1) / 3) * 0.5).toFixed(1)}`;
  $('combo-panel').classList.toggle('active', game.combo >= 3);
  $('route-tools').hidden = !game.mission.tour;
  $('power-status').textContent = [game.shieldTime > 0 ? `护盾 ${Math.ceil(game.shieldTime)}s` : '', game.magnetTime > 0 ? `磁吸 ${Math.ceil(game.magnetTime)}s` : ''].filter(Boolean).join(' · ') || '道具待拾取';
  $('challenge-status').textContent = `挑战 ${game.challengeHits}/${game.course.challenges.length} · 连锁 ${game.challengeChain}`;
  $('jump-status').textContent = game.height > 0 ? `低空跃升 ${game.height.toFixed(1)}m` : game.jumpCooldown > 0 ? `冷却 ${game.jumpCooldown.toFixed(1)}s` : game.energy < PHYSICS.jumpCost ? '能量不足' : '跃升就绪';
  if (lowGravity && game.height > 0) $('jump-status').textContent = `低重力滑翔 ${game.height.toFixed(1)}m`;
  document.querySelector('[data-control="jump"]').setAttribute('aria-disabled', String(!isJumpReady(game)));
  document.querySelectorAll('.speed-ticks i').forEach((tick, i) => tick.classList.toggle('active', i < game.speed / game.craft.boostSpeed * 24));
  updateRival();
  drawMap();
}

function processEvents() {
  for (const event of game.events) {
    if (controls.cruise && ['impact', 'miss'].includes(event.type)) { controls.cruise = false; syncControls(); }
    if (!event.chained) audio.event(event.type, event.kind);
    world.event(event, game);
    if (event.type === 'launch') toast(controls.cruise ? '巡航油门已开启 · 手动转向，S 或制动解除' : '出发！按住 W / ↑ 加速，或按 C 开启巡航油门');
    if (event.type === 'powerup') toast(`${POWERUPS[event.kind].name} · ${POWERUPS[event.kind].description}`, 'cyan');
    if (event.type === 'shield-block') toast('护盾抵挡撞击 · 护盾已消耗', 'cyan');
    if (event.type === 'challenge') toast(`${event.kind === 'jump' ? '跃升环' : '极速环'}命中 · ${game.challengeChain} 连锁 · +${event.points}`, 'cyan');
    if (event.type === 'pickup') toast(`能量核心 +1  /  ${game.collected.size >= game.mission.cargo ? '核心目标已达成' : `${game.collected.size} / ${game.mission.cargo}`}  ·  +${event.points}${game.combo >= 3 ? `  ·  ${game.combo} 连收` : ''}`, 'cyan');
    if (event.type === 'gate') toast(event.perfect ? `精准过门！导航门 0${event.number}  ·  +500` : `导航门 0${event.number} 已点亮  ·  +300`, 'cyan');
    if (event.type === 'gate') {
      const delta = compareSplit(recorder?.splits, rival?.splits, event.number - 1);
      $('split-flash').textContent = delta ? `本区段 ${deltaText(delta.sector)}` : `航标用时 ${game.elapsed.toFixed(2)}s`;
      $('split-flash').dataset.tone = deltaTone(delta?.sector);
      splitFlashUntil = game.elapsed + 4;
    }
    if (event.type === 'pad' && !event.chained) toast(game.mission.special === 'boost' ? '连续加速航线 · 免费超频接力，S 可制动' : '绿色加速带 · 免费超频 1.8 秒', 'cyan');
    if (event.type === 'dodge') toast('空中避障！  ·  +120', 'cyan');
    if (event.type === 'meteor-warning') toast('陨石正在接近 · 注意红色落点与撞击倒计时', 'warning', 1);
    if (event.type === 'low-gravity') toast('进入低重力区 · F 延长跃升，腾空出区可获奖励', 'cyan');
    if (event.type === 'meteor-dodge') toast('踏星而行！跃过冲击波 · +180', 'cyan');
    if (event.type === 'glide') toast('引力旅人！腾空离开低重力区 · +200', 'cyan');
    if (event.type === 'miss') toast('未穿过导航门 · 已返回门前，时间 −4 秒', 'warning');
    if (event.type === 'impact') {
      toast(event.source === 'meteor' ? '受到陨石冲击 · 避开红圈，核心可修复艇体' : event.source === 'boundary' ? '擦碰航道边缘 · 松开转向并制动' : '发生碰撞 · 避开岩石，收集核心修复艇体', 'warning');
      $('impact-flash').classList.remove('flash');
      void $('impact-flash').offsetWidth;
      $('impact-flash').classList.add('flash');
    }
  }
  if (expedition) for (const contract of getContracts(game)) {
    if (contract.done && !completedContracts.has(contract.id)) {
      completedContracts.add(contract.id);
      toast(`委托达成 · ${contract.name} · 成功交付后 +${contract.reward} 补给`, 'cyan');
      audio.event('gate');
    }
  }
}

function frame(now) {
  if (!$('error').hidden) return;
  const dt = Math.max(0, Math.min((now - frameTime) / 1000, 0.1));
  frameTime = now;
  if (document.hidden) { requestAnimationFrame(frame); return; }
  accumulator += dt;
  while (accumulator >= 1 / 60) { updateGame(game, controls.read(), 1 / 60); recorder?.capture(game); processEvents(); accumulator -= 1 / 60; }
  ghostPose = sampleGhost(rival, game.elapsed);
  raceView = cup ? getRaceView(game, raceField) : null;
  projections = cup ? raceView.ghosts : ghostPose ? [{ id: 'personal', color: '#b9a3ff', pose: ghostPose }] : [];
  if (game.status === 'countdown') {
    const count = Math.ceil(game.countdown);
    if (count !== lastCountdown) { refs['countdown-number'].textContent = count; audio.tone(330, 0.1); lastCountdown = count; }
  }
  syncPanels();
  uiTime += dt;
  if (uiTime > 0.08 && game.status !== 'menu') { updateHUD(); uiTime = 0; }
  audio.update(game);
  world.render(game, dt, ghostEnabled ? projections : []);
  if (autoQuality && world.quality === 'high' && ['menu', 'running'].includes(game.status)) {
    performanceFrames++;
    performanceTime += dt;
    if (performanceFrames >= 60) {
      if (performanceTime / performanceFrames > 0.045) {
        world.setQuality('low');
        $('quality').innerHTML = '流畅 <span>↔</span>';
        toast('已为当前设备启用流畅画质 · 可在操作指南中调整');
      }
      performanceFrames = 0;
      performanceTime = 0;
    }
  }
  requestAnimationFrame(frame);
}

$('start').addEventListener('click', launch);
$('retry').addEventListener('click', launch);
$('continue-cup').addEventListener('click', continueCup);
$('continue-expedition').addEventListener('click', continueExpedition);
$('upgrade-options').addEventListener('click', event => {
  const button = event.target.closest('[data-upgrade]');
  if (!button || !expedition || !buyUpgrade(expedition, button.dataset.upgrade)) return;
  const id = button.dataset.upgrade;
  renderSupply(expedition);
  toast('改装已装配 · 下一站生效', 'cyan');
  audio.event('pickup');
  const next = document.querySelector(`[data-upgrade="${id}"]:enabled`) ?? $('upgrade-options').querySelector('button:enabled') ?? $('continue-expedition');
  next.focus({ preventScroll: true });
});
$('restart-pause').addEventListener('click', launch);
$('resume').addEventListener('click', pause);
$('pause-button').addEventListener('click', pause);
$('cruise-button').addEventListener('click', event => {
  toggleCruise();
  if (event.detail > 0) event.currentTarget.blur();
});
$('back-pause').addEventListener('click', home);
$('back-result').addEventListener('click', home);
$('open-hangar').addEventListener('click', () => { updateLoadout(); $('hangar').showModal(); });
$('close-hangar').addEventListener('click', () => $('hangar').close());
$('confirm-hangar').addEventListener('click', () => $('hangar').close());
$('mission-search').addEventListener('input', () => { updateMissionCatalogue(); $('mission-options').scrollTop = 0; });
$('mission-categories').addEventListener('click', event => {
  const button = event.target.closest('[data-category]');
  if (!button || mode !== 'delivery') return;
  missionCategory = button.dataset.category;
  updateMissionCatalogue();
  $('mission-options').scrollTop = 0;
});
$('reset-missions').addEventListener('click', () => {
  missionCategory = 'all';
  $('mission-search').value = '';
  updateMissionCatalogue();
  $('mission-options').scrollTop = 0;
  $('mission-search').focus();
});
for (const [id, event] of [['craft-search', 'input'], ['craft-sort', 'change']]) $(id).addEventListener(event, () => { updateCraftCatalogue(); $('craft-options').scrollTop = 0; });
$('reset-crafts').addEventListener('click', () => {
  $('craft-search').value = '';
  $('craft-sort').value = 'catalogue';
  updateCraftCatalogue();
  $('craft-options').scrollTop = 0;
  $('craft-search').focus();
});
$('mode-options').addEventListener('click', event => {
  const button = event.target.closest('[data-mode]');
  if (!button || game.status !== 'menu') return;
  mode = button.dataset.mode;
  configure(mode !== 'delivery' ? MISSIONS[0].id : game.mission.id, game.craft.id);
});
for (const button of [$('ghost-toggle'), $('ghost-toggle-guide')]) button.addEventListener('click', () => {
  ghostEnabled = !ghostEnabled;
  for (const toggle of [$('ghost-toggle'), $('ghost-toggle-guide')]) {
    toggle.setAttribute('aria-pressed', String(ghostEnabled));
    toggle.innerHTML = `${ghostEnabled ? '开启' : '关闭'} <span>◈</span>`;
  }
});
$('mission-options').addEventListener('click', event => {
  const option = event.target.closest('[data-mission]');
  if (option && mode === 'delivery') { configure(option.dataset.mission, game.craft.id); document.querySelector(`[data-mission="${game.mission.id}"]`).focus({ preventScroll: true }); }
});
$('craft-options').addEventListener('click', event => {
  const option = event.target.closest('[data-craft]');
  if (option) { configure(game.mission.id, option.dataset.craft); document.querySelector(`[data-craft="${game.craft.id}"]`).focus({ preventScroll: true }); }
});
$('next-mission').addEventListener('click', () => {
  const next = MISSIONS[MISSIONS.findIndex(mission => mission.id === game.mission.id) + 1];
  if (!next) return;
  home();
  configure(next.id, game.craft.id);
  launch();
});
$('guide').querySelector('.guide-keys').insertAdjacentHTML('beforeend', '<div><span><kbd>F</kbd></span><span>跃升避障 · 消耗 18 能量</span></div>');
$('guide').querySelector('.guide-keys').insertAdjacentHTML('beforeend', '<div><span><kbd>C</kbd> / 顶部巡航按钮</span><span>巡航油门 · 制动解除</span></div>');
$('guide').querySelector('.guide-tip').textContent = '山路航向自动跟随，负责加速与横向驾驶；速度越快，镜头视野越宽。跃升高空会错过核心。连续收集提升倍率，门中央高速通过有精准奖励。临近导航门时，提示按当前速度和松开转向后的惯性预判；继续转向或变速后需重新判断。紫色幽灵重现同配置的最快成功航程，不会碰撞或抢走核心。分段比较实际飞行用时，暂停不计时；漏门会退回门前，另外扣除剩余时限 4 秒。所有纪录刷新后清空。';
$('guide').querySelector('.guide-tip').insertAdjacentHTML('afterend', `<p class="cup-guide-note">在任务机库选择「月环大奖赛」，与三名电脑领航员连赛 ${MISSIONS.length} 站。须收集核心并穿过全部导航门才能晋级；每站重新计时并补满艇体，失败可重试。对手投影互不碰撞，结束赛事或刷新会清空赛事积分。</p>`);
$('guide').querySelector('.cup-guide-note').insertAdjacentHTML('afterend', `<p class="cup-guide-note">「远征补给」沿 ${MISSIONS.length} 站完成可选委托，成功交付获 2 补给，每项委托再获 2 点。${MISSIONS.length - 1} 次中途补给可改装飞船，每项最多两级；失败重试保留升级，返回基地结束远征。牵引磁场扩大低空核心吸附范围，飞船下方的绿色圆环显示范围。</p>`);
$('guide').querySelector('.guide-tip').insertAdjacentHTML('beforebegin', '<p id="route-guide" class="cup-guide-note"></p>');
$('guide').querySelector('.guide-tip').insertAdjacentHTML('afterend', '<p class="cup-guide-note">巡航油门等同于持续按住加速，仍需手动转向、避障、收集和过门；冲刺需另行按住。按 C 或顶部巡航按钮切换，制动、暂停、切出页面、碰撞、漏门、结算与重飞都会解除，继续飞行后需主动重新开启。</p>');
$('guide').querySelector('.guide-tip').insertAdjacentHTML('afterend', '<div class="environment-guide"><div id="meteor-help"><strong>☄ 陨石预警</strong><p>红圈提前 2.6 秒预警，撞击后 1 秒内低空艇体会受到 22 点伤害；横向避开红圈，或按 F 腾空越过冲击波可获 180 分。灰色落点和退去的余辉没有伤害。</p></div><div id="gravity-help"><strong>⌁ 低重力航段</strong><p>紫色边线标出低重力区，跃升滞空更久；腾空离开区域可获 200 分，高空仍会错过核心。</p></div><small>每处技巧奖励只计一次。环境按飞行用时循环，暂停时冻结；重飞从头开始，雷达同步标出环境航段。</small></div>');
document.querySelector('.flight-help').innerHTML = '<span>A / D 避障</span><span>F 跃升</span><span>S 制动</span><span>Esc 暂停</span>';
document.querySelector('.brand').addEventListener('click', (event) => { event.preventDefault(); if (game.status === 'menu') return; if (['running', 'countdown'].includes(game.status)) pause(); else home(); });
async function unlockAudio() {
  const ready = await audio.unlock();
  $('audio-status').textContent = ready ? '原创合成配乐 · 暂停或离开页面时停止播放。音量仅保留在当前页面。' : '浏览器尚未启用声音，可再次点击声音按钮尝试开启。';
}
const activateAudio = event => {
  if (event.isTrusted && audio.enabled && !audio.background && audio.context?.state !== 'running' && !event.target.closest?.('#sound, #audio-toggle')) unlockAudio();
};
window.addEventListener('pointerdown', activateAudio, { passive: true });
window.addEventListener('keydown', event => {
  if (!event.repeat && (event.key.length === 1 || event.code === 'Enter')) activateAudio(event);
});
const toggleAudio = () => {
  unlockAudio();
  const enabled = audio.toggle();
  $('sound').innerHTML = icon(enabled ? 'sound' : 'mute');
  $('sound').setAttribute('aria-label', enabled ? '关闭声音' : '开启声音');
  $('sound').setAttribute('aria-pressed', String(!enabled));
  $('audio-toggle').textContent = enabled ? '静音全部声音' : '恢复全部声音';
  $('audio-toggle').setAttribute('aria-pressed', String(!enabled));
};
$('sound').addEventListener('click', event => {
  toggleAudio();
  if (event.detail > 0) event.currentTarget.blur();
});
$('audio-toggle').addEventListener('click', toggleAudio);
for (const bus of ['music', 'sfx']) $(`${bus}-volume`).addEventListener('input', event => {
  audio.setVolume(bus, Number(event.target.value) / 100);
  $(`${bus}-level`).textContent = `${event.target.value}%`;
  unlockAudio();
});
const openGuide = () => {
  guidePaused = ['running', 'countdown'].includes(game.status);
  if (guidePaused) pause();
  $('guide').showModal();
};
for (const id of ['help', 'pause-settings', 'result-settings']) $(id).addEventListener('click', openGuide);
const closeGuide = () => $('guide').close();
$('close-guide').addEventListener('click', closeGuide);
$('guide-ready').addEventListener('click', closeGuide);
$('guide').addEventListener('close', () => { if (guidePaused && game.status === 'paused') pause(); guidePaused = false; clearInput(); });
$('quality').addEventListener('click', () => {
  if (!world) return;
  autoQuality = false;
  const quality = world.quality === 'high' ? 'low' : 'high';
  world.setQuality(quality);
  $('quality').innerHTML = `${quality === 'high' ? '精致' : '流畅'} <span>↔</span>`;
});
$('reload').addEventListener('click', () => location.reload());

window.addEventListener('keydown', (event) => {
  if (event.repeat && ['Space', 'Enter'].includes(event.code) && event.target.closest('button, a, summary')) { event.preventDefault(); return; }
  if (!$('error').hidden) return;
  if (document.querySelector('dialog[open]')) return;
  if (event.code === 'KeyC' && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (!event.repeat && !event.isComposing) toggleCruise();
    return;
  }
  if (event.code === 'Tab' && ['paused', 'won', 'lost'].includes(game.status)) {
    const panel = game.status === 'paused' ? $('pause') : $('result');
    const buttons = [...panel.querySelectorAll('button, summary')].filter(button => !button.disabled && button.getClientRects().length);
    if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
  }
  if (event.code === 'Enter' && !event.repeat && ['menu', 'won', 'lost'].includes(game.status) && !event.target.closest('button, a, summary')) {
    event.preventDefault();
    if (expedition && game.status === 'won') continueExpedition();
    else if (cup && game.status === 'won') continueCup();
    else launch();
  }
  if ((event.code === 'Escape' || event.code === 'KeyP') && !event.repeat) { event.preventDefault(); pause(); }
  const control = event.target.closest('[data-control]');
  const action = control && ['Space', 'Enter'].includes(event.code) ? control.dataset.control : KEY_ACTIONS[event.code];
  if (action && ['running', 'countdown'].includes(game.status)) {
    if (event.code === 'Space' && event.target.closest('button, a') && !control) return;
    event.preventDefault(); controls.press(event.code, action); syncControls();
  }
});
window.addEventListener('keyup', event => { controls.release(event.code); syncControls(); });
const pauseOnLeave = () => { audio.setBackground(true); clearInput(); if (['running', 'countdown'].includes(game.status)) pause(); };
window.addEventListener('blur', pauseOnLeave);
window.addEventListener('focus', () => audio.setBackground(document.hidden));
window.addEventListener('pagehide', pauseOnLeave);
window.addEventListener('pageshow', () => audio.setBackground(document.hidden));
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseOnLeave(); else audio.setBackground(!document.hasFocus()); frameTime = performance.now(); accumulator = 0; });
window.addEventListener('resize', () => world?.resize());
document.querySelectorAll('[data-control]').forEach((button) => {
  button.addEventListener('pointerdown', event => {
    if (!['running', 'countdown'].includes(game.status)) return;
    event.preventDefault(); button.setPointerCapture(event.pointerId);
    controls.press(`pointer:${event.pointerId}`, button.dataset.control); syncControls(); unlockAudio();
  });
  const release = event => {
    controls.release(`pointer:${event.pointerId}`, event.type === 'pointercancel'); syncControls();
  };
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
  button.addEventListener('contextmenu', (event) => event.preventDefault());
});

syncPanels();
updateLoadout();
requestAnimationFrame(() => {
  try {
    world = new World($('viewport'), game);
    world.renderer.domElement.addEventListener('webglcontextlost', (event) => { event.preventDefault(); showError('图形连接已中断。请重新连接以恢复游戏。'); });
    $('start').disabled = false;
    $('start').innerHTML = `<span>开始飞行<small>LET’S MAKE A DELIVERY</small></span>${icon('arrow')}`;
    frameTime = performance.now();
    requestAnimationFrame(frame);
  } catch (error) {
    console.error('Unable to initialize lunar scene:', error);
    showError();
  }
});
