// 功能目的:
// 第二版敌方开塔监测：不判断敌方是否已经成功占塔，只在敌方投入大量偷塔兵力时尽早提示。
//
// 实现逻辑:
// 1. 实时对局只读取 game_update scores，避免 DOM 滞后一回合造成误判；回放模式不用 v2 推断。
// 2. 只比较相邻 turn。若中间跳 turn，本段聚合变化会混入多次行动，直接跳过判断。
// 3. 核心信号使用兵力差 = 我方 total - 敌方 total。
//    敌我交战、抢地、抢塔会让双方 total 同量减少，兵力差理论上不变；
//    敌方打中立塔只扣敌方 total，会让兵力差变大。
// 4. 自然兵力差变化 = 大回合增长次数 × 上次地差 + 二回合增长次数 × 上次塔差。
//    敌方塔数使用当前已确认/已推断数量，一开始可以假设为 0。
// 5. 修正后兵力差变化 = 兵力差变化 - 自然兵力差变化 + 我方开塔耗兵。
//    正数表示敌方投入偷塔兵力；当投入 > 25 时提示，并同步到底部行动面板。
// 6. 负数表示敌方实际自然增长比假设更多；在偶数增长 turn 按额外增长校准敌方开塔数。
//
// 作用范围:
// 只新增 v2 提示和调试状态；不修改旧版 敌方开塔提示.js 的判断逻辑。
import { 敌方红色, 样式编号 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import { 地图可读, 是我方或队友, 读取地图地块 } from '../游戏.js'
import { 状态 } from '../状态.js'
import { 读取分数玩家数据 } from '../战场工具.js'
import { 取得周期增长次数, 读取当前回合 } from '../游戏工具.js'
import { 统计塔数, 同步塔数统计 } from './塔数统计.js'
import { 注册功能 } from '../注册中心.js'

const 提示元素编号 = 'gio-enemy-open-tower-v2-alert'
const 样式元素编号 = `${样式编号}-enemy-open-tower-v2`
const 提示持续毫秒 = 5000
const 偷塔兵力提示阈值 = 25
const 日志最大数量 = 80
const 判断版本 = '兵力差投入-v1'

export const 功能定义 = {
  id: '敌方开塔监测v2',
  名称: '敌方开塔监测v2',
  分类: '战场面板',
  描述: '敌方投入大量偷塔兵力时立即提示，并用塔增长校准敌方开塔数',
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭: 清除敌方开塔监测v2,
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置() {
    重置敌方开塔监测v2()
  },
  game_update({ 数据包 }) {
    更新敌方开塔监测v2(数据包 ?? {})
  },
}

export const 地图更新功能 = {
  id: 功能定义.id,
  地图更新({ 旧地图数组, 新地图数组, 数据包, 已处理我方移动列表 }) {
    记录我方开塔耗兵v2(旧地图数组, 新地图数组, 数据包, 已处理我方移动列表)
  },
}

export function 更新敌方开塔监测v2(数据包) {
  if (!功能已启用('敌方开塔监测v2')) {
    清除敌方开塔监测v2()
    return
  }
  if (是网页回放中()) {
    清除敌方开塔监测v2()
    return
  }

  确保敌方开塔监测v2版本()
  同步提示元素()

  const 当前快照 = 读取监测快照(数据包)
  if (!当前快照) return

  const 上次快照 = 状态.敌方开塔监测v2快照
  状态.敌方开塔监测v2快照 = 当前快照
  if (!上次快照 || 当前快照.回合 <= 上次快照.回合) return
  if (当前快照.回合 !== 上次快照.回合 + 1) {
    状态.敌方开塔监测v2调试 = {
      回合: 当前快照.回合,
      上次回合: 上次快照.回合,
      跳过原因: '非相邻turn',
    }
    return
  }

  const 判断 = 取得敌方开塔v2判断(上次快照, 当前快照)
  const 新增校准塔数 = 校准敌方开塔数(判断)
  当前快照.敌方.塔数 = 取得假设敌方开塔数()
  const 是投入偷塔兵力 = 判断.敌方投入偷塔兵力 > 偷塔兵力提示阈值

  状态.敌方开塔监测v2调试 = {
    回合: 当前快照.回合,
    上次回合: 上次快照.回合,
    假设敌方开塔数: 判断.假设敌方开塔数,
    新增校准塔数,
    敌方投入偷塔兵力: 判断.敌方投入偷塔兵力,
    敌方未解释耗兵: 判断.敌方投入偷塔兵力,
    敌方额外增长: 判断.敌方额外增长,
    是投入偷塔兵力,
    判断,
  }
  记录日志(当前快照, 判断, 新增校准塔数, 是投入偷塔兵力)

  if (!是投入偷塔兵力) return

  同步敌方投入到行动监控(上次快照, 当前快照, 判断)
  显示提示(判断.敌方投入偷塔兵力)
}

export function 重置敌方开塔监测v2() {
  状态.敌方开塔监测v2快照 = null
  状态.敌方开塔监测v2调试 = null
  状态.敌方开塔监测v2日志列表 = []
  状态.敌方开塔监测v2我方耗兵记录列表 = []
  状态.敌方开塔监测v2已提示回合集合 = new Set()
  状态.敌方开塔推断数 = 0
  同步塔数统计()
  document.getElementById(提示元素编号)?.remove()
}

export function 清除敌方开塔监测v2() {
  状态.敌方开塔监测v2快照 = null
  状态.敌方开塔监测v2调试 = null
  状态.敌方开塔监测v2日志列表 = []
  状态.敌方开塔监测v2我方耗兵记录列表 = []
  document.getElementById(提示元素编号)?.remove()
}

function 读取监测快照(数据包) {
  const 回合 = 读取当前回合(数据包)
  if (!Number.isInteger(回合)) return null

  const 玩家数据 = 读取分数玩家数据(数据包)
  if (!玩家数据) return null
  const 塔数 = 统计塔数()

  return {
    回合,
    我方: {
      ...玩家数据.我方,
      塔数: 塔数.我方塔数,
    },
    敌方: {
      ...玩家数据.敌方,
      塔数: 取得假设敌方开塔数(),
    },
  }
}

function 取得敌方开塔v2判断(上次快照, 当前快照) {
  const 假设敌方开塔数 = Number.isInteger(上次快照.敌方.塔数)
    ? 上次快照.敌方.塔数
    : 取得假设敌方开塔数()
  const 二回合增长次数 = 取得周期增长次数(上次快照.回合, 当前快照.回合, 2)
  const 大回合增长次数 = 取得周期增长次数(上次快照.回合, 当前快照.回合, 50)
  const 上次兵力差 = 上次快照.我方.兵力 - 上次快照.敌方.兵力
  const 当前兵力差 = 当前快照.我方.兵力 - 当前快照.敌方.兵力
  const 兵力差变化 = 当前兵力差 - 上次兵力差
  const 上次地差 = 上次快照.我方.陆地 - 上次快照.敌方.陆地
  const 上次塔差 = 上次快照.我方.塔数 - 假设敌方开塔数
  const 大回合兵力差变化 = 大回合增长次数 * 上次地差
  const 二回合塔差变化 = 二回合增长次数 * 上次塔差
  const 自然兵力差变化 = 大回合兵力差变化 + 二回合塔差变化
  const 我方开塔耗兵 = 取得我方开塔耗兵(上次快照.回合, 当前快照.回合)
  const 修正后兵力差变化 = 兵力差变化 - 自然兵力差变化 + 我方开塔耗兵
  const 敌方投入偷塔兵力 = Math.max(0, 修正后兵力差变化)
  const 敌方额外增长 = Math.max(0, -修正后兵力差变化)

  return {
    上次快照,
    当前快照,
    假设敌方开塔数,
    二回合增长次数,
    大回合增长次数,
    上次兵力差,
    当前兵力差,
    兵力差变化,
    上次地差,
    上次塔差,
    大回合兵力差变化,
    二回合塔差变化,
    自然兵力差变化,
    我方开塔耗兵,
    修正后兵力差变化,
    敌方投入偷塔兵力,
    敌方未解释耗兵: 敌方投入偷塔兵力,
    敌方额外增长,
  }
}

function 记录我方开塔耗兵v2(
  旧地图数组,
  新地图数组,
  数据包,
  已处理我方移动列表,
) {
  if (!功能已启用('敌方开塔监测v2') || 是网页回放中()) return

  const 当前回合 = Number.isInteger(数据包?.turn) ? 数据包.turn : 状态.当前回合
  const 行动回合 = 当前回合 - 1
  if (!Number.isInteger(行动回合)) return
  if (!地图可读(旧地图数组) || !地图可读(新地图数组)) return
  if (!Array.isArray(已处理我方移动列表) || !已处理我方移动列表.length) return

  const 新记录列表 = []
  for (const 移动 of 已处理我方移动列表) {
    const 终点 = 移动?.终点
    if (!Number.isInteger(终点) || !是已知中立塔(终点)) continue

    const 旧地块 = 读取地图地块(旧地图数组, 终点)
    const 新地块 = 读取地图地块(新地图数组, 终点)
    const 旧兵力 = 读取旧中立塔兵力(终点, 旧地块)
    if (!Number.isInteger(旧兵力) || 旧兵力 < 0) continue
    if (!Number.isInteger(新地块?.兵力)) continue

    const 开塔耗兵 = 是我方或队友(新地块.归属)
      ? 旧兵力
      : Math.max(0, 旧兵力 - 新地块.兵力)
    if (开塔耗兵 <= 0) continue

    新记录列表.push({
      回合: 行动回合,
      塔索引: 终点,
      开塔耗兵,
    })
  }
  if (!新记录列表.length) return

  const 保留起始回合 = 行动回合 - 20
  const 旧记录列表 = Array.isArray(状态.敌方开塔监测v2我方耗兵记录列表)
    ? 状态.敌方开塔监测v2我方耗兵记录列表
    : []
  状态.敌方开塔监测v2我方耗兵记录列表 = [
    ...旧记录列表.filter((记录) => {
      return Number.isInteger(记录?.回合) && 记录.回合 >= 保留起始回合
    }),
    ...新记录列表,
  ]

  function 是已知中立塔(塔索引) {
    if (!状态.已知塔集合.has(塔索引) && !状态.已知塔类型.has(塔索引)) {
      return false
    }
    const 类型 = 状态.已知塔类型.get(塔索引)
    return !类型 || 类型 === '中立塔'
  }

  function 读取旧中立塔兵力(塔索引, 旧地块) {
    const 记忆兵力 = 状态.中立塔兵力表.get(塔索引)
    if (Number.isInteger(记忆兵力) && 记忆兵力 >= 0) return 记忆兵力
    if (
      Number.isInteger(旧地块?.归属) &&
      旧地块.归属 < 0 &&
      Number.isInteger(旧地块?.兵力)
    ) {
      return 旧地块.兵力
    }
    return null
  }
}

function 取得我方开塔耗兵(上次回合, 当前回合) {
  if (!Number.isInteger(上次回合) || !Number.isInteger(当前回合)) return 0

  let 总耗兵 = 0
  const 记录列表 = Array.isArray(状态.敌方开塔监测v2我方耗兵记录列表)
    ? 状态.敌方开塔监测v2我方耗兵记录列表
    : []
  for (const 记录 of 记录列表) {
    const 回合 = 记录?.回合
    const 开塔耗兵 = 记录?.开塔耗兵
    if (
      !Number.isInteger(回合) ||
      回合 < 上次回合 ||
      回合 >= 当前回合 ||
      !Number.isInteger(开塔耗兵) ||
      开塔耗兵 <= 0
    ) {
      continue
    }
    总耗兵 += 开塔耗兵
  }
  return 总耗兵
}

function 校准敌方开塔数(判断) {
  if (判断.二回合增长次数 <= 0) return 0
  if (判断.敌方额外增长 <= 0) return 0

  const 新增塔数 = Math.floor(判断.敌方额外增长 / 判断.二回合增长次数)
  if (新增塔数 <= 0) return 0

  const 目标开塔数 = 判断.假设敌方开塔数 + 新增塔数
  状态.敌方开塔推断数 = Math.max(状态.敌方开塔推断数 ?? 0, 目标开塔数)
  同步塔数统计()
  return 新增塔数
}

function 同步敌方投入到行动监控(上次快照, 当前快照, 判断) {
  const 行动回合 = Math.max(上次快照.回合, 当前快照.回合 - 1)
  if (!Number.isInteger(行动回合)) return

  const 开塔耗兵 = 判断.敌方投入偷塔兵力
  if (!Number.isInteger(开塔耗兵) || 开塔耗兵 <= 0) return

  状态.敌方行动类型表.set(行动回合, '开塔')
  const 兵力键 = `敌方:${行动回合}`
  const 旧兵力 = 状态.行动开塔兵力表.get(兵力键)
  状态.行动开塔兵力表.set(
    兵力键,
    Number.isInteger(旧兵力) ? Math.max(旧兵力, 开塔耗兵) : 开塔耗兵,
  )

  try {
    window.dispatchEvent(new CustomEvent('gio敌方开塔推断更新'))
  } catch {}
}

function 显示提示(敌方投入偷塔兵力) {
  const 当前回合 = 状态.敌方开塔监测v2快照?.回合
  const 已提示回合集合 = 取得已提示回合集合()
  if (Number.isInteger(当前回合)) {
    if (已提示回合集合.has(当前回合)) return
    已提示回合集合.add(当前回合)
  }

  安装样式()
  const { 宿主, 参考元素 } = 取得提示位置()
  if (!宿主) return

  let 元素 = document.getElementById(提示元素编号)
  if (!元素) {
    元素 = document.createElement('div')
    元素.id = 提示元素编号
  }
  if (参考元素 && 元素.parentElement !== 宿主) {
    宿主.insertBefore(元素, 参考元素)
  } else if (!参考元素 && 元素.parentElement !== 宿主) {
    宿主.appendChild(元素)
  }

  元素.textContent = `敌方投入偷塔兵力 ${敌方投入偷塔兵力}`
  元素.classList.toggle(
    'gio-enemy-open-tower-v2-alert-floating',
    宿主 === document.body,
  )
  元素.classList.remove('gio-enemy-open-tower-v2-alert-show')
  void 元素.offsetWidth
  元素.classList.add('gio-enemy-open-tower-v2-alert-show')

  window.setTimeout(同步提示元素, 提示持续毫秒 + 40)
}

function 同步提示元素() {
  const 元素 = document.getElementById(提示元素编号)
  if (!元素) return
  if (!功能已启用('敌方开塔监测v2')) {
    元素.remove()
    return
  }
}

function 取得已提示回合集合() {
  if (状态.敌方开塔监测v2已提示回合集合 instanceof Set) {
    return 状态.敌方开塔监测v2已提示回合集合
  }
  状态.敌方开塔监测v2已提示回合集合 = new Set()
  return 状态.敌方开塔监测v2已提示回合集合
}

function 取得假设敌方开塔数() {
  const 推断数 = Number.isInteger(状态.敌方开塔推断数) ? 状态.敌方开塔推断数 : 0
  const 确认数 = 状态.敌方开塔确认集合?.size ?? 0
  return Math.max(推断数, 确认数, 0)
}

function 记录日志(当前快照, 判断, 新增校准塔数, 是投入偷塔兵力) {
  if (!是投入偷塔兵力 && 新增校准塔数 <= 0 && 判断.敌方投入偷塔兵力 <= 0) return

  const 日志列表 = Array.isArray(状态.敌方开塔监测v2日志列表)
    ? 状态.敌方开塔监测v2日志列表
    : []
  日志列表.push({
    回合: 当前快照.回合,
    时间: Math.round(performance.now()),
    是投入偷塔兵力,
    新增校准塔数,
    判断: 复制日志值(判断),
  })
  状态.敌方开塔监测v2日志列表 = 日志列表.slice(-日志最大数量)
}

function 确保敌方开塔监测v2版本() {
  if (状态.敌方开塔监测v2版本 === 判断版本) return

  状态.敌方开塔监测v2快照 = null
  状态.敌方开塔监测v2调试 = null
  状态.敌方开塔监测v2日志列表 = []
  状态.敌方开塔监测v2我方耗兵记录列表 = []
  状态.敌方开塔监测v2已提示回合集合 = new Set()
  状态.敌方开塔监测v2版本 = 判断版本
}

function 是网页回放中() {
  return Boolean(
    globalThis.location?.pathname?.startsWith('/replays/') ||
    document.getElementById('replay-turn-jump-input'),
  )
}

function 复制日志值(值) {
  try {
    return structuredClone(值)
  } catch {
    try {
      return JSON.parse(JSON.stringify(值))
    } catch {
      return 值
    }
  }
}

function 取得提示位置() {
  if (!document.body) return { 宿主: null, 参考元素: null }

  const 参考元素 = document.body.querySelector(
    '#leaderboard, .leaderboard, table',
  )
  return {
    宿主: 参考元素?.parentElement ?? document.body,
    参考元素,
  }
}

function 安装样式() {
  if (!document.documentElement) return
  if (document.getElementById(样式元素编号)) return

  const 样式 = document.createElement('style')
  样式.id = 样式元素编号
  样式.textContent = `
#${提示元素编号} {
    box-sizing: border-box;
    width: 100%;
    margin: 0 0 4px;
    padding: 8px 12px;
    border: 2px solid #ffffff;
    border-radius: 8px;
    background: ${敌方红色};
    color: #ffffff;
    font: 900 18px/1.1 Arial, sans-serif;
    letter-spacing: 0;
    text-align: center;
    text-shadow: 0 2px 3px rgba(0, 0, 0, 0.82);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.34), 0 0 16px rgba(255, 0, 0, 0.66);
    opacity: 0;
    pointer-events: none;
}
#${提示元素编号}.gio-enemy-open-tower-v2-alert-floating {
    position: fixed;
    right: 16px;
    top: 16px;
    z-index: 2147483200;
    width: auto;
    min-width: 180px;
}
#${提示元素编号}.gio-enemy-open-tower-v2-alert-show {
    animation: gio-enemy-open-tower-v2-alert ${提示持续毫秒}ms ease-out forwards;
}
@keyframes gio-enemy-open-tower-v2-alert {
    0% { opacity: 0; transform: translateY(-8px) scale(0.96); }
    12% { opacity: 1; transform: translateY(0) scale(1.05); }
    24% { opacity: 1; transform: translateY(0) scale(1); }
    82% { opacity: 1; transform: translateY(0) scale(1); }
    100% { opacity: 0; transform: translateY(-6px) scale(0.98); }
}
`.trim()
  document.documentElement.appendChild(样式)
}

注册功能({ 功能定义, 功能恢复, socket功能, 地图更新功能 })
