import { version } from '../package.json';
import './release.css';

export function mountReleases() {
  document.querySelector('.footer-note').remove();
  document.querySelector('.menu-footer').insertAdjacentHTML('beforeend', `<button id="open-releases" class="release-link" aria-haspopup="dialog">v${version} · 更新公告</button>`);
  document.querySelector('#app').insertAdjacentHTML('beforeend', `
    <dialog id="releases" aria-labelledby="release-title">
      <span class="eyebrow">FLIGHT BULLETIN / 当前公告</span>
      <h2 id="release-title">v${version} · 网页访问适配</h2>
      <p>从项目页面进入，也能顺利启航。</p>
      <ul class="release-list">
        <li><strong>修复页面加载</strong>解决从 GitHub Pages 项目页面打开时，游戏画面、界面和图标无法加载的问题。</li>
      </ul>
      <details class="release-history"><summary>历史公告 <span>6 个版本</span></summary>
        <article><h3>v1.1.4 · 驾驶操作修复</h3>
      <p>操作有回应，暂停不再被长按打断。</p>
      <ul class="release-list">
        <li><strong>屏幕按钮支持键盘</strong>聚焦驾驶按钮后，空格或 Enter 可执行对应动作；加速、转向、制动和冲刺支持按住，跃升按一次触发。</li>
        <li><strong>长按不会误触弹窗</strong>修复按住冲刺后暂停，重复按键误触“继续飞行”的问题；指南、公告及其他按钮也不会因长按反复激活。</li>
        <li><strong>跃升状态更准确</strong>低重力中尚未落地时，按钮保持不可用；落地、冷却结束且能量充足后恢复可用，辅助阅读工具也能识别该状态。</li>
      </ul>
        </article>
        <article><h3>v1.1.3 · 飞行规则修复</h3>
      <p>免费加速更安心，最后一刻也能送达。</p>
      <ul class="release-list">
        <li><strong>加速带真正免费</strong>驱动期间按住冲刺不再重复耗能，并继续自动充能；跃升正常消耗 18 能量，加速带效果结束后恢复手动冲刺耗能。</li>
        <li><strong>过门判定更准确</strong>按穿越门面那一刻的位置判断是否通过及精准奖励，修复门边横移时误判漏门或错误发奖的问题。</li>
        <li><strong>最后一刻正常交付</strong>修复剩余时间内已抵达终点仍被判超时的问题；核心、导航门与艇体状态仍须满足交付要求。</li>
      </ul>
        </article>
        <article><h3>v1.1.2 · 操作与重飞修复</h3>
      <p>每次跃升有回应，每次重飞稳稳出发。</p>
      <ul class="release-list">
        <li><strong>短按不再丢失</strong>修复低帧率下 F 和触屏跃升短按无响应，以及快速松开再按不能重新跃升的问题；长按仍只跳一次。</li>
        <li><strong>冲刺正确恢复</strong>能量耗尽后，快速松开再按可恢复冲刺；多指与键盘混合操作分别跟踪，暂停和重飞清空待处理动作。</li>
        <li><strong>重飞镜头归位</strong>镜头直接回到起点，清除上一程的残留震动，修复倒计时开始时镜头从远处急速拉回的问题。</li>
      </ul>
        </article>
        <article><h3>v1.1.1 · 避障判定修复</h3>
      <p>跃过障碍，安全离开，奖励再入账。</p>
      <ul class="release-list">
        <li><strong>完整避障才获奖</strong>岩石与巡逻机的空中避障奖励改为通过整个障碍后结算，修复刚拿到奖励就撞上障碍的问题。</li>
        <li><strong>接触判定更准确</strong>检查两帧之间的相对移动与高度，预警使用同一套接触规则；修复离开岩石后才降低高度仍被扣血，以及巡逻机移动中的漏判。</li>
        <li><strong>停车预警与超时处理</strong>停在陨石圈后沿时也会提示即将到来的危险；任务时间已耗尽时不再触发跳跃、收集或加速带。</li>
      </ul>
        </article>
        <article><h3>v1.1.0 · 航行体验更新</h3>
      <p>这一次，让每段航程更清晰、更有节奏。</p>
      <ul class="release-list">
        <li><strong>听见月面</strong>新增原创合成背景音乐，音乐与音效可独立调节。暂停或离开页面时停止播放，继续飞行后恢复。</li>
        <li><strong>陨石判定修正</strong>警戒圈贴合弯道和坡面；完整越过冲击波后才结算技巧奖励。预警检查进入到离开的高度，优先提示实际碰撞危险。</li>
        <li><strong>飞行边界修正</strong>修复艇体归零后同帧回血、任务超时后继续位移和收集的问题。</li>
        <li><strong>操作更顺手</strong>修复小屏仪表重叠；暂停及结算界面可进入声音设置，补全指南名称、键盘操作与多指触屏释放处理。</li>
      </ul>
        </article>
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
