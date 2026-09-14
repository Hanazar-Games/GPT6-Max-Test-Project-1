import { version } from '../package.json';
import './release.css';

export function mountReleases() {
  document.querySelector('.footer-note').remove();
  document.querySelector('.menu-footer').insertAdjacentHTML('beforeend', `<button id="open-releases" class="release-link" aria-haspopup="dialog">v${version} · 更新公告</button>`);
  document.querySelector('#app').insertAdjacentHTML('beforeend', `
    <dialog id="releases" aria-labelledby="release-title">
      <span class="eyebrow">FLIGHT BULLETIN / 当前公告</span>
      <h2 id="release-title">v${version} · 航行体验更新</h2>
      <p>这一次，让每段航程更清晰、更有节奏。</p>
      <ul class="release-list">
        <li><strong>听见月面</strong>新增原创合成背景音乐，音乐与音效可独立调节。暂停或离开页面时停止播放，继续飞行后恢复。</li>
        <li><strong>陨石判定修正</strong>警戒圈贴合弯道和坡面；完整越过冲击波后才结算技巧奖励。预警检查进入到离开的高度，优先提示实际碰撞危险。</li>
        <li><strong>飞行边界修正</strong>修复艇体归零后同帧回血、任务超时后继续位移和收集的问题。</li>
        <li><strong>操作更顺手</strong>修复小屏仪表重叠；暂停及结算界面可进入声音设置，补全指南名称、键盘操作与多指触屏释放处理。</li>
      </ul>
      <details class="release-history"><summary>历史公告 <span>1 个版本</span></summary>
        <article><h3>v1.0.0 · 开发基线</h3><p>原版本没有独立公告，以下按已有功能补录，不代表曾公开发布。</p><ul>
          <li>三条月面航线、三款飞船；加速、冲刺、跃升、核心收集与导航门。</li>
          <li>自由速递与个人幽灵、三站月环大奖赛、委托和改装组成的远征补给。</li>
          <li>陨石落点、低重力航段、技巧奖励与任务奖章。</li>
          <li>程序生成的三维场景和音效、触屏驾驶、两档画质。</li>
        </ul></article>
      </details>
      <button id="close-releases" class="primary-button">收到，返回基地 →</button>
    </dialog>`);
  document.querySelector('#open-releases').addEventListener('click', () => document.querySelector('#releases').showModal());
  document.querySelector('#close-releases').addEventListener('click', () => document.querySelector('#releases').close());
}
