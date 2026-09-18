import { version } from '../package.json';
import './release.css';

export function mountReleases() {
  document.querySelector('.footer-note').remove();
  document.querySelector('.menu-footer').insertAdjacentHTML('beforeend', `<button id="open-releases" class="release-link" aria-haspopup="dialog">v${version} · 更新公告</button>`);
  document.querySelector('#app').insertAdjacentHTML('beforeend', `
    <dialog id="releases" aria-labelledby="release-title">
      <span class="eyebrow">FLIGHT BULLETIN / 当前公告</span>
      <h2 id="release-title">v${version} · 高速预警优化</h2>
      <p>速度很快，重要提示也要看得及时。</p>
      <ul class="release-list">
        <li><strong>危险还有多久抵达</strong>岩石与巡逻机预警增加按当前速度估算的接近时间；临近碰撞时直接提示立即横移，帮助判断操作时机。</li>
        <li><strong>奖励不会挤掉警告</strong>碰撞与漏门提示优先显示，陨石预警也不会被连续收集或委托奖励覆盖；警告结束后恢复普通消息。</li>
        <li><strong>擦边与制动说明更准确</strong>无障碍地图擦边时会提示远离航道边缘；低重力区制动时仍显示制动状态。</li>
        <li><strong>长航程里程更易读</strong>一公里以上的导航距离显示为公里，接近导航门或终点后自动切回米数。</li>
      </ul>
      <details class="release-history"><summary>历史公告 <span>16 个版本</span></summary>
      <article><h3>v1.7.1 · 航线体验修复</h3>
      <p>看清当前航线的规则，让下一次出发更从容。</p>
      <ul class="release-list">
        <li><strong>每条航线都有合适的建议</strong>末日图超时后不再建议寻找加速带；无障碍地图会提示避开航道边缘、沿中央收集核心。普通航线、大奖赛和远征均按当前地图提供建议。</li>
        <li><strong>指南和结算对应实际地图</strong>三张特殊地图增加专属驾驶说明；只显示当前地图具备的陨石、低重力和避障项目，避免不存在的技巧项目造成困惑。</li>
        <li><strong>加速与制动提示更准确</strong>超频星按所选飞船的持续冲刺速度估算用时，新星约 3.3 分钟；制动时不再误显示「免费超频中」。</li>
        <li><strong>小屏区段标题更清楚</strong>任务名称与区段编号分行显示，减少窄屏下的断字，保留清晰的任务信息。</li>
      </ul>
      </article>
      <article><h3>v1.7.0 · 三境试航</h3>
      <p>无限加速、末日求生，还有绿意盎然的地球。</p>
      <ul class="release-list">
        <li><strong>超频星 · 无限加速环</strong>96 公里无障碍航线，400 条全路宽加速带连续接力，无需消耗冲刺能量；按住油门即可进入极速，S 仍可随时制动。</li>
        <li><strong>末日星 · 余烬生还线</strong>99 公里废土遍布交替岩障与陨石，破损楼群和熔岩映照归途；沿核心指引穿过安全缺口，导航门前保留调整空间。</li>
        <li><strong>地球 · 绿野归航</strong>102 公里无障碍观光路，蓝天白云、树林草坡和野花替代异星荒原，配以明亮的大调音乐；没有岩石、无人机或陨石威胁。</li>
        <li><strong>更顺畅的特殊航程</strong>机库可搜索「特殊」「无障碍」「加速」或「末日」；加速带和岩障采用批量绘制，连续加速不再反复提示。远征委托按地图配置调整，38 站共 1652.3 公里、114 项委托。</li>
      </ul>
      </article>
      <article><h3>v1.6.0 · 洲际长航</h3>
      <p>二十款飞船，三十五颗星球，向大陆另一端飞行。</p>
      <ul class="release-list">
        <li><strong>再添 10 款独立飞船</strong>雪鸮、三叉戟、蜻蜓、鹦鹉螺、霜刃、远鲸、圣盾、幽影、金乌与新星加入机库；羽翼、四叶翼、螺环、长舱与太阳翼各有轮廓，新星基础冲刺达到 1728 km/h。</li>
        <li><strong>10 张真正的长途地图</strong>新增青篁、蜂巢、绯果、回声、书卷、蓝核、龙骨、蓝宝、梯田与远航星，单程 96–123 公里；最快满级飞船持续冲刺也至少需要 3 分钟，不含倒计时和暂停。</li>
        <li><strong>一路都有新的目标</strong>洲际连峰与环陆群湾穿过竹塔、巢柱、果林、天线、石页、反应堆、巨骸、宝冠、梯台和帆架；核心、障碍、加速带与环境航段沿途分布，长途核心目标为 30–36 枚。</li>
        <li><strong>长航程完整支持</strong>机库可搜索「长途」并查看预计用时；幽灵记录覆盖完整长航，地形与道路提高采样精度。大奖赛和远征扩展至 35 站，共 1355.3 公里、105 项委托与 34 次补给。</li>
      </ul>
      </article>
      <article><h3>v1.5.0 · 舰队与新星域</h3>
      <p>十款飞船集结，再向五颗新星球出发。</p>
      <ul class="release-list">
        <li><strong>10 款飞船全部开放</strong>新增赤隼、雨燕、云鳐、夜莺、玄甲、流萤与彗星；分叉前翼、三角翼、重装侧盾和储能环带来不同轮廓，极速、机动、装甲与充能各有取舍。</li>
        <li><strong>25 颗星球，260.3 公里山路</strong>新增莲雾、日冕、蒸汽、长风与时序星；花瓣回湾、锯齿群峰加入星图，沿途可见巨莲、聚光镜、热泉、风塔和天文台。</li>
        <li><strong>彗星冲刺达到 1620 km/h</strong>延续随实际速度扩大的视野与动态配乐，全部新艇支持幽灵挑战、大奖赛与远征改装。</li>
        <li><strong>机库与长途赛事同步扩充</strong>独立飞船缩略图、巡航与充能信息、保留位置的滚动列表；大奖赛扩展至 25 站，远征包含 75 项委托和 24 次补给。</li>
      </ul>
        </article>
      <article><h3>v1.4.2 · 屏幕适配修复</h3>
      <p>换个屏幕方向，也能看清航路、顺手操作。</p>
      <ul class="release-list">
        <li><strong>横屏布局衔接更稳</strong>修复调整窗口或旋转屏幕后，开始按钮、倒计时、导航提示和能量仪表相互遮挡的问题。</li>
        <li><strong>短竖屏也能顺利启航</strong>补齐小屏首页与驾驶布局，让大赛长标题、机库入口、远征委托和跃升提示各就其位。</li>
        <li><strong>警告不再盖住驾驶按钮</strong>调整横屏长提示的宽度与按钮间距，转向、跃升、制动、冲刺和加速操作保持清晰可见。</li>
      </ul>
        </article>
        <article><h3>v1.4.1 · 视听与小屏修复</h3>
      <p>完整看见飞船，顺手驾驶，随操作听见星海。</p>
      <ul class="release-list">
        <li><strong>首次操作就有配乐</strong>修复打开机库、指南等菜单时背景音乐没有启用的问题；已选择静音时，切换地图或操作菜单不会自动解除静音。</li>
        <li><strong>飞船完整入镜</strong>修复竖屏和平板下菜单飞船被裁切的问题；镜头随屏幕比例调整，切换横竖屏后立即重新取景，适配全部星球与三款飞船。</li>
        <li><strong>小屏横屏更好驾驶</strong>重新安排首页和飞行仪表，修复任务标题、导航提示与触控区重叠；扩大窄屏驾驶按钮，避免底部按钮覆盖速度和能量仪表。</li>
      </ul>
        </article>
        <article><h3>v1.4.0 · 星境精工</h3>
      <p>二十种星球景观，近看也有新的细节。</p>
      <ul class="release-list">
        <li><strong>20 星专属地标</strong>补齐山脊层岩、六棱晶簇、风蚀石柱、冰刃、玄武岩、砂岩拱、潮汐灯塔、风暴线圈与暗夜尖塔；菌伞、珊瑚、古迹和星门同步细化。</li>
        <li><strong>飞船精细建模</strong>曲面机身、分层翼甲、座舱骨架、进气涡轮和双层喷口；三种艇型保留独立装备，尾焰从喷口连续延伸。</li>
        <li><strong>从路面到星港</strong>连续地形明暗、岩层色带、地表与沥青纹理、反光路肩和桥墩；起降基地新增停机标线、拱顶机库、塔台和雷达。</li>
        <li><strong>细节与性能一起改善</strong>增加金属与座舱环境反射，合并重复部件；修正地表高度偏差导致的悬空物件，检查道路净空与换图资源释放。</li>
        <li><strong>机库入口不再被遮挡</strong>修复较矮桌面窗口中星球信息卡与飞行配置卡重叠的问题。</li>
      </ul>
        </article>
        <article><h3>v1.3.0 · 星图超速</h3>
      <p>二十颗星球，一张更辽阔的极速星图。</p>
      <ul class="release-list">
        <li><strong>20 张地图，五种山路</strong>连环山脊、环形天坑、双峰回旋、海岸长弯与高原阶梯；单程延长至 7.0–14.4 公里，全部开放。</li>
        <li><strong>十颗新星球，新的风景</strong>极光幕、沙丘石拱、荧光菌林、珊瑚树、白盐阶柱、古迹巨环、磁悬岩、铜色工区、虹晶与星门。</li>
        <li><strong>冲刺突破 1,500 km/h</strong>三款基础飞船冲刺达到 1,188–1,512 km/h，强化加速和制动；视野随实际速度继续扩大，镜头与配乐同步适配。</li>
        <li><strong>星图搜索与完整远征</strong>机库可搜索星球、航线和路线类型；大奖赛与远征扩展为 20 站，共 194.1 公里、60 项远征委托。</li>
        <li><strong>高速飞行更可靠</strong>验证高速穿越判定，修复电脑领航员避让门后障碍时反复漏门的问题。</li>
      </ul>
        </article>
        <article><h3>v1.2.0 · 十星山路</h3>
      <p>把速度交给引擎，把星海留在身后。</p>
      <ul class="release-list">
        <li><strong>十颗星球，十条盘山公路</strong>冰峰、晶谷、赤岭、熔岩与海崖全部开放；连续爬升、回头弯与下坡贯穿 5.0–7.2 公里的独立航线。</li>
        <li><strong>飞船升级，极速出发</strong>重制装甲机身、玻璃座舱、双涡轮、翼面和艇型细节；基础冲刺极速提升至 666–864 km/h。</li>
        <li><strong>越快，视野越宽</strong>镜头随实际速度平滑扩大视野，减速时逐渐收回；速度线、尾焰和山路跟随镜头增强疾驰感。</li>
        <li><strong>星球专属动态配乐</strong>新的和声、低音、琶音与飞行鼓组；不同星球切换调性，高速时增加音乐层次。</li>
        <li><strong>十站完整征途</strong>大奖赛与远征同步扩展到十站，新增航线雷达适配；修复高速横移时核心和加速带漏判的问题。</li>
      </ul>
        </article>
        <article><h3>v1.1.5 · 网页访问适配</h3>
      <p>从项目页面进入，也能顺利启航。</p>
      <ul class="release-list">
        <li><strong>修复页面加载</strong>解决从 GitHub Pages 项目页面打开时，游戏画面、界面和图标无法加载的问题。</li>
      </ul>
        </article>
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
