// 功能目的:
// 游戏结束后，在结算界面显示本局敌我 1v1 星星变化。
import { 功能已启用 } from '../功能状态.js'
import { 是我方或队友 } from '../游戏.js'
import { 是游戏结束事件 } from '../游戏工具.js'
import { 注册功能 } from '../注册中心.js'
import { 状态 } from '../状态.js'
import { 取得单元格列表 } from '../战场DOM工具.js'
import { 取得战场数据表格 } from './战场表格.js'

const 面板编号 = 'gio-settlement-star-change'
const 样式编号 = `${面板编号}-style`
const 隐藏结算弹窗类名 = 'gio-settlement-popup-hidden'
const 可拖动结算弹窗类名 = 'gio-settlement-popup-draggable'
const 鼠标按住隐藏延迟 = 500
const 一对一星星键 = 'duel'
const 赛前星星读取延迟列表 = [80, 400, 1000]
const 赛后星星读取延迟列表 = [800, 2500, 6000]
const 星星变化容差 = 0.005
const 星星来源优先级 = {
  对局包: 20,
  排行榜: 30,
  本地缓存: 60,
  账号接口: 90,
  账号推送: 100,
}

let 本局星星数据 = null
let 本局读取序号 = 0
let 鼠标按住中 = false
let 鼠标按住隐藏计时器 = null
let 已安装鼠标按住隐藏 = false
const 已安装拖动弹窗 = new WeakSet()

export const 功能定义 = {
  id: '结算星星变化',
  名称: '结算星星变化',
  分类: '战场面板',
  描述: '游戏结束后显示本局敌我星星变化',
}

export const 主程序功能 = {
  id: 功能定义.id,
  页面同步: 更新结算星星变化,
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭() {
    移除结算星星变化()
  },
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置({ 数据包 }) {
    本局读取序号 += 1
    本局星星数据 = {
      读取序号: 本局读取序号,
      我方索引: Number.isInteger(数据包?.playerIndex)
        ? 数据包.playerIndex
        : 状态.我方索引,
      玩家名列表: Array.isArray(数据包?.usernames)
        ? 数据包.usernames.slice()
        : null,
      赛前星星: [],
      赛前星星来源: [],
      赛前星星优先级: [],
      赛后星星: [],
      赛后星星来源: [],
      赛后星星优先级: [],
      胜利索引列表: null,
      死亡索引列表: null,
      已结束: false,
    }
    写入星星列表('赛前星星', 读取星星数组(数据包?.stars), false, '对局包')
    记录本地缓存赛前星星()
    赛前星星读取延迟列表.forEach((延迟) => {
      setTimeout(记录排行榜赛前星星, 延迟)
    })
    请求玩家星星列表('赛前星星', 120)
  },
  game_update({ 数据包 }) {
    记录赛前星星(数据包)
  },
  入站预处理({ 事件名, 数据包 }) {
    if (事件名 === 'stars') 记录本账号赛后星星(数据包)
    if (事件名 === 'game_update') 记录赛前星星(数据包)
    if (是游戏结束事件(事件名) || 包含死亡分数(数据包)) {
      标记游戏结束(事件名, 数据包)
    }
  },
}

export function 更新结算星星变化() {
  安装鼠标按住隐藏()
  if (!功能已启用(功能定义.id)) {
    移除结算星星变化()
    更新结算弹窗隐藏()
    return
  }
  确保结算弹窗可拖动(取得结算弹窗())
  if (!本局星星数据?.已结束) {
    记录排行榜赛前星星()
    移除结算星星变化()
    return
  }

  const 变化数据 = 计算星星变化()
  if (!变化数据) {
    移除结算星星变化()
    return
  }

  安装样式()
  const 宿主 = 取得结算星星宿主()
  更新结算弹窗隐藏()
  if (!宿主) return

  const 面板 = 确保面板(宿主)
  if (!面板) return
  渲染面板(面板, 变化数据)
}

function 记录赛前星星(数据包) {
  if (!本局星星数据 || 本局星星数据.已结束) return

  const 星星列表 = 读取星星数组(数据包?.stars)
  if (!星星列表) return
  写入星星列表('赛前星星', 星星列表, false, '对局包')
}

function 记录本账号赛后星星(星星数据) {
  if (!本局星星数据?.已结束) return
  const 我方索引 = 读取我方索引()
  if (!Number.isInteger(我方索引)) return

  const 星星 = 读取星星值(星星数据?.[一对一星星键])
  if (!Number.isFinite(星星)) return

  写入单个星星('赛后星星', 我方索引, 星星, true, '账号推送')
}

function 标记游戏结束(事件名, 数据包) {
  if (!本局星星数据 || 本局星星数据.已结束) return

  记录结束结果(事件名, 数据包)
  本局星星数据.已结束 = true
  赛后星星读取延迟列表.forEach((延迟) => {
    请求玩家星星列表('赛后星星', 延迟)
    setTimeout(更新结算星星变化, 延迟 + 80)
  })
  setTimeout(更新结算星星变化, 120)
}

function 记录结束结果(事件名, 数据包) {
  const 死亡索引列表 = 读取死亡索引列表(数据包)
  if (死亡索引列表.length) {
    本局星星数据.死亡索引列表 = 死亡索引列表
    const 玩家名列表 = 读取玩家名列表()
    if (Array.isArray(玩家名列表)) {
      本局星星数据.胜利索引列表 = 玩家名列表
        .map((玩家名, idx) => (玩家名 ? idx : null))
        .filter((idx) => Number.isInteger(idx) && !死亡索引列表.includes(idx))
    }
  }

  if (事件名 === 'game_won') {
    const 我方索引 = 读取我方索引()
    if (Number.isInteger(我方索引)) 本局星星数据.胜利索引列表 = [我方索引]
  }

  if (事件名 === 'game_lost') {
    const 敌方索引 = 读取敌方索引()
    if (Number.isInteger(敌方索引)) 本局星星数据.胜利索引列表 = [敌方索引]
  }
}

function 记录本地缓存赛前星星() {
  const 我方索引 = 读取我方索引()
  if (!本局星星数据 || !Number.isInteger(我方索引)) return

  const 星星 = 读取本地缓存星星()
  if (Number.isFinite(星星)) {
    写入单个星星('赛前星星', 我方索引, 星星, false, '本地缓存')
  }
}

function 记录排行榜赛前星星() {
  if (!本局星星数据 || 本局星星数据.已结束) return

  const 星星列表 = 读取排行榜星星()
  if (星星列表) 写入星星列表('赛前星星', 星星列表, false, '排行榜')
}

function 读取排行榜星星() {
  const 表格 = 取得战场数据表格()
  if (!表格 || !Array.isArray(读取玩家名列表())) return null

  const 星星列表 = []
  const 行列表 = Array.from(表格.querySelectorAll('tr'))
  for (const 行 of 行列表) {
    const 单元格列表 = 取得单元格列表(行)
    const 玩家索引 = 读取行玩家索引(单元格列表)
    if (!Number.isInteger(玩家索引)) continue

    const 星星 = 读取行星星(单元格列表)
    if (Number.isFinite(星星)) 星星列表[玩家索引] = 星星
  }

  return 星星列表.some((星星) => Number.isFinite(星星)) ? 星星列表 : null
}

function 请求玩家星星列表(字段, 延迟) {
  const 读取序号 = 本局星星数据?.读取序号
  if (!Number.isInteger(读取序号)) return

  setTimeout(() => {
    const 当前数据 = 本局星星数据
    if (!当前数据 || 当前数据.读取序号 !== 读取序号) return
    if (字段 === '赛前星星' && 当前数据.已结束) return
    if (!Array.isArray(当前数据.玩家名列表)) return

    Promise.all(当前数据.玩家名列表.map(读取玩家一对一星星))
      .then((星星列表) => {
        if (!本局星星数据 || 本局星星数据.读取序号 !== 读取序号) return
        if (字段 === '赛前星星' && 本局星星数据.已结束) return
        写入星星列表(字段, 星星列表, 字段 === '赛后星星', '账号接口')
      })
      .catch((错误) => {
        console.warn('[结算星星变化] 读取玩家星星失败:', 错误)
      })
  }, 延迟)
}

async function 读取玩家一对一星星(玩家名) {
  if (!玩家名) return null

  const 响应 = await fetch(
    `/api/starsAndRanks?u=${encodeURIComponent(玩家名)}&client=true`,
    { cache: 'no-store' },
  )
  if (!响应.ok) return null

  const 数据 = await 响应.json()
  return 读取星星值(数据?.stars?.[一对一星星键])
}

function 写入星星列表(字段, 星星列表, 需要刷新, 来源) {
  if (!本局星星数据 || !Array.isArray(星星列表)) return

  for (let idx = 0; idx < 星星列表.length; idx += 1) {
    写入单个星星(字段, idx, 星星列表[idx], false, 来源)
  }
  if (需要刷新) 更新结算星星变化()
}

function 写入单个星星(字段, 玩家索引, 星星, 需要刷新, 来源) {
  if (!本局星星数据) return
  if (!Number.isInteger(玩家索引) || 玩家索引 < 0) return
  if (!Number.isFinite(星星)) return

  const 来源优先级 = 星星来源优先级[来源] ?? 0
  const 优先级字段 = `${字段}优先级`
  const 来源字段 = `${字段}来源`
  const 当前优先级 = 本局星星数据[优先级字段]?.[玩家索引] ?? -1
  if (当前优先级 > 来源优先级) return

  if (!Array.isArray(本局星星数据[字段])) 本局星星数据[字段] = []
  if (!Array.isArray(本局星星数据[优先级字段])) 本局星星数据[优先级字段] = []
  if (!Array.isArray(本局星星数据[来源字段])) 本局星星数据[来源字段] = []
  本局星星数据[字段][玩家索引] = 星星
  本局星星数据[优先级字段][玩家索引] = 来源优先级
  本局星星数据[来源字段][玩家索引] = 来源
  if (需要刷新) 更新结算星星变化()
}

function 计算星星变化() {
  const 玩家名列表 = 本局星星数据?.玩家名列表
  if (!Array.isArray(玩家名列表)) return null

  const 我方索引 = 读取我方索引()
  const 敌方索引 = 读取敌方索引()
  if (!Number.isInteger(我方索引) || 敌方索引 < 0) return null

  const 输出 = {
    我方: 读取玩家变化(我方索引, '我方'),
    敌方: 读取玩家变化(敌方索引, '敌方'),
  }
  标记异常变化(输出)
  return 输出

  function 读取玩家变化(玩家索引, 标签) {
    const 赛前 = 读取星星值(本局星星数据.赛前星星?.[玩家索引])
    const 赛后 = 读取星星值(本局星星数据.赛后星星?.[玩家索引])
    const 变化 =
      Number.isFinite(赛前) && Number.isFinite(赛后) ? 赛后 - 赛前 : null
    const 玩家名 = 玩家名列表[玩家索引] ?? 标签
    return {
      标签,
      玩家名,
      玩家索引,
      赛前,
      赛后,
      变化,
      赛前来源: 本局星星数据.赛前星星来源?.[玩家索引] ?? '',
      赛后来源: 本局星星数据.赛后星星来源?.[玩家索引] ?? '',
      变化可信: true,
      异常原因: '',
    }
  }
}

function 标记异常变化(变化数据) {
  const 玩家列表 = [变化数据.我方, 变化数据.敌方]
  const 我方变化 = 变化数据.我方.变化
  const 敌方变化 = 变化数据.敌方.变化
  if (
    Math.abs(我方变化) > 星星变化容差 &&
    Math.abs(敌方变化) > 星星变化容差 &&
    Math.sign(我方变化) === Math.sign(敌方变化)
  ) {
    玩家列表.forEach((玩家) => 标记玩家变化异常(玩家, '敌我变化同向'))
    return
  }

  const 胜利索引列表 = 本局星星数据?.胜利索引列表
  const 死亡索引列表 = 本局星星数据?.死亡索引列表
  玩家列表.forEach((玩家) => {
    if (!Number.isFinite(玩家.变化)) return
    if (胜利索引列表?.includes(玩家.玩家索引) && 玩家.变化 < -星星变化容差) {
      标记玩家变化异常(玩家, '胜方变化为负')
    }
    if (死亡索引列表?.includes(玩家.玩家索引) && 玩家.变化 > 星星变化容差) {
      标记玩家变化异常(玩家, '败方变化为正')
    }
  })
}

function 标记玩家变化异常(玩家, 原因) {
  玩家.变化可信 = false
  玩家.异常原因 = 原因
}

function 取得结算星星宿主() {
  const 结算弹窗 = 取得结算弹窗()
  if (结算弹窗) return 结算弹窗

  const 排行榜容器 = document.querySelector('#game-leaderboard-container')
  return 排行榜容器 ?? document.querySelector('#game-page')
}

function 取得结算弹窗() {
  const 候选列表 = document.body?.querySelectorAll(
    '.popup, .modal, .alert, [role="dialog"]',
  )
  for (const 候选 of 候选列表 ?? []) {
    const 文本 = 候选.textContent ?? ''
    if (文本.includes('Exit') && 文本.includes('Watch Replay')) return 候选
    if (文本.includes('退出') && 文本.includes('观看回放')) return 候选
  }
  return null
}

function 安装鼠标按住隐藏() {
  if (已安装鼠标按住隐藏) return
  已安装鼠标按住隐藏 = true
  安装样式()
  document.addEventListener(
    'pointerdown',
    () => {
      鼠标按住中 = true
      clearTimeout(鼠标按住隐藏计时器)
      鼠标按住隐藏计时器 = setTimeout(() => {
        鼠标按住隐藏计时器 = null
        更新结算弹窗隐藏()
      }, 鼠标按住隐藏延迟)
    },
    { passive: true },
  )
  window.addEventListener(
    'pointerup',
    () => {
      结束鼠标按住()
    },
    { passive: true },
  )
  window.addEventListener(
    'pointercancel',
    () => {
      结束鼠标按住()
    },
    { passive: true },
  )
  window.addEventListener(
    'blur',
    () => {
      结束鼠标按住()
    },
    { passive: true },
  )

  function 结束鼠标按住() {
    鼠标按住中 = false
    clearTimeout(鼠标按住隐藏计时器)
    鼠标按住隐藏计时器 = null
    更新结算弹窗隐藏()
  }
}

function 更新结算弹窗隐藏() {
  const 结算弹窗 = 取得结算弹窗()
  if (!结算弹窗) return
  结算弹窗.classList.toggle(
    隐藏结算弹窗类名,
    鼠标按住中 && 功能已启用(功能定义.id),
  )
}

function 确保结算弹窗可拖动(结算弹窗) {
  if (!结算弹窗 || 已安装拖动弹窗.has(结算弹窗)) return
  已安装拖动弹窗.add(结算弹窗)
  结算弹窗.classList.add(可拖动结算弹窗类名)
  结算弹窗.addEventListener('pointerdown', 开始拖动结算弹窗)
}

function 开始拖动结算弹窗(事件) {
  if (事件.button !== 0) return
  const 结算弹窗 = 事件.currentTarget
  if (是弹窗交互元素(事件.target, 结算弹窗)) return

  事件.preventDefault()
  事件.stopPropagation()

  const 起始矩形 = 结算弹窗.getBoundingClientRect()
  const 起始X = 事件.clientX
  const 起始Y = 事件.clientY
  结算弹窗.style.position = 'fixed'
  结算弹窗.style.left = `${起始矩形.left}px`
  结算弹窗.style.top = `${起始矩形.top}px`
  结算弹窗.style.right = 'auto'
  结算弹窗.style.bottom = 'auto'
  结算弹窗.style.margin = '0'
  结算弹窗.style.transform = 'none'
  结算弹窗.setPointerCapture?.(事件.pointerId)

  结算弹窗.addEventListener('pointermove', 拖动结算弹窗)
  结算弹窗.addEventListener('pointerup', 结束拖动结算弹窗)
  结算弹窗.addEventListener('pointercancel', 结束拖动结算弹窗)

  function 拖动结算弹窗(移动事件) {
    const 左边 = 限制弹窗坐标(
      起始矩形.left + 移动事件.clientX - 起始X,
      起始矩形.width,
      window.innerWidth,
    )
    const 顶部 = 限制弹窗坐标(
      起始矩形.top + 移动事件.clientY - 起始Y,
      起始矩形.height,
      window.innerHeight,
    )
    结算弹窗.style.left = `${左边}px`
    结算弹窗.style.top = `${顶部}px`
  }

  function 结束拖动结算弹窗(结束事件) {
    if (结算弹窗.hasPointerCapture?.(结束事件.pointerId)) {
      结算弹窗.releasePointerCapture(结束事件.pointerId)
    }
    结算弹窗.removeEventListener('pointermove', 拖动结算弹窗)
    结算弹窗.removeEventListener('pointerup', 结束拖动结算弹窗)
    结算弹窗.removeEventListener('pointercancel', 结束拖动结算弹窗)
  }

  function 是弹窗交互元素(元素, 结算弹窗) {
    return Boolean(
      元素?.closest?.(
        'button, input, textarea, select, a, label, [role="button"], .button',
      ) && 结算弹窗.contains(元素),
    )
  }

  function 限制弹窗坐标(坐标, 尺寸, 视口尺寸) {
    return Math.min(Math.max(坐标, 0), Math.max(视口尺寸 - 尺寸, 0))
  }
}

function 确保面板(宿主) {
  let 面板 = document.getElementById(面板编号)
  if (面板 && 面板.parentElement !== 宿主) 面板.remove()
  面板 = document.getElementById(面板编号)
  if (!面板) {
    面板 = document.createElement('div')
    面板.id = 面板编号
    宿主.prepend(面板)
  }
  return 面板
}

function 渲染面板(面板, 变化数据) {
  const 签名 = JSON.stringify(变化数据)
  if (面板.dataset.签名 === 签名) return

  const 列表 = document.createElement('div')
  列表.className = 'gio-settlement-star-change-list'
  列表.replaceChildren(创建玩家行(变化数据.我方), 创建玩家行(变化数据.敌方))

  面板.replaceChildren(列表)
  面板.dataset.签名 = 签名
}

function 创建玩家行(玩家) {
  const 行 = document.createElement('div')
  行.className = 'gio-settlement-star-change-row'
  行.title = 生成玩家星星来源说明(玩家)

  const 名称 = document.createElement('span')
  名称.className = 'gio-settlement-star-change-name'
  名称.textContent = 玩家.玩家名

  const 变化 = document.createElement('span')
  变化.className = 'gio-settlement-star-change-diff'
  变化.textContent = 格式化变化(玩家)
  变化.dataset.state = 读取变化状态(玩家)

  const 总数 = document.createElement('span')
  总数.className = 'gio-settlement-star-change-total'
  总数.textContent = `★ ${格式化总星星(玩家.赛后)}`

  行.replaceChildren(名称, 变化, 总数)
  return 行
}

function 移除结算星星变化() {
  document.getElementById(面板编号)?.remove()
}

function 安装样式() {
  if (document.getElementById(样式编号)) return
  const 样式 = document.createElement('style')
  样式.id = 样式编号
  样式.textContent = `
#${面板编号} {
  margin: 8px 0;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  font-size: 13px;
  line-height: 1.35;
}

.gio-settlement-star-change-list {
  display: grid;
  gap: 4px;
}

.gio-settlement-star-change-row {
  display: grid;
  grid-template-columns: minmax(90px, 1fr) minmax(54px, auto) minmax(58px, auto);
  align-items: center;
  gap: 8px;
}

.gio-settlement-star-change-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gio-settlement-star-change-diff,
.gio-settlement-star-change-total {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.gio-settlement-star-change-diff[data-state='up'] {
  color: #35d06f;
}

.gio-settlement-star-change-diff[data-state='down'] {
  color: #ff5a5f;
}

.gio-settlement-star-change-diff[data-state='same'] {
  color: #d5d5d5;
}

.gio-settlement-star-change-diff[data-state='pending'] {
  color: #ffd84d;
}

.${隐藏结算弹窗类名} {
  opacity: 0 !important;
  pointer-events: none !important;
}

.${可拖动结算弹窗类名} {
  cursor: move;
  touch-action: none;
}

.${可拖动结算弹窗类名} button,
.${可拖动结算弹窗类名} input,
.${可拖动结算弹窗类名} textarea,
.${可拖动结算弹窗类名} select,
.${可拖动结算弹窗类名} a,
.${可拖动结算弹窗类名} label,
.${可拖动结算弹窗类名} [role='button'],
.${可拖动结算弹窗类名} .button {
  cursor: pointer;
}
`.trim()
  document.documentElement.appendChild(样式)
}

function 读取本地缓存星星() {
  try {
    const 数据 = JSON.parse(globalThis.localStorage?.stars ?? '{}')
    return 读取星星值(数据?.[一对一星星键])
  } catch {
    return null
  }
}

function 读取行玩家索引(单元格列表) {
  const 玩家名列表 = 读取玩家名列表()
  if (!Array.isArray(玩家名列表)) return null

  for (const 单元格 of 单元格列表) {
    const 文本 = (单元格.textContent ?? '').trim()
    const idx = 玩家名列表.indexOf(文本)
    if (idx >= 0) return idx
  }
  return null
}

function 读取我方索引() {
  if (Number.isInteger(本局星星数据?.我方索引)) return 本局星星数据.我方索引
  return 状态.我方索引
}

function 读取敌方索引() {
  const 玩家名列表 = 读取玩家名列表()
  if (!Array.isArray(玩家名列表)) return null
  const 我方索引 = 读取我方索引()
  const 敌方索引 = 玩家名列表.findIndex((玩家名, idx) => {
    return 玩家名 && idx !== 我方索引 && !是我方或队友(idx)
  })
  return 敌方索引 >= 0 ? 敌方索引 : null
}

function 读取玩家名列表() {
  if (Array.isArray(本局星星数据?.玩家名列表)) return 本局星星数据.玩家名列表
  return 状态.玩家名列表
}

function 读取行星星(单元格列表) {
  const 星星单元格 = 单元格列表.find((单元格) => {
    return 单元格.classList.contains('lb-star-col')
  })
  return 读取星星文本(星星单元格?.textContent)
}

function 读取星星数组(星星列表) {
  if (!Array.isArray(星星列表)) return null
  const 输出 = 星星列表.map(读取星星值)
  return 输出.some((星星) => Number.isFinite(星星)) ? 输出 : null
}

function 读取星星值(值) {
  const 数字 = Number(值)
  return Number.isFinite(数字) ? 数字 : null
}

function 读取星星文本(文本) {
  const 匹配 = String(文本 ?? '').match(/-?\d+(?:\.\d+)?/)
  if (!匹配) return null
  const 数字 = Number(匹配[0])
  return Number.isFinite(数字) ? 数字 : null
}

function 读取死亡索引列表(数据包) {
  if (!Array.isArray(数据包?.scores)) return []
  return 数据包.scores
    .map((分数, idx) => {
      if (分数?.dead !== true) return null
      return Number.isInteger(分数.i) ? 分数.i : idx
    })
    .filter((idx) => Number.isInteger(idx))
}

function 格式化变化(玩家) {
  if (!Number.isFinite(玩家.赛后)) return '读取中'
  if (!Number.isFinite(玩家.赛前)) return '赛前 ?'
  if (!Number.isFinite(玩家.变化)) return '变化 ?'
  if (!玩家.变化可信) return '待确认'

  const 文本 = 格式化小数(Math.abs(玩家.变化), 2)
  if (玩家.变化 > 0) return `+${文本}`
  if (玩家.变化 < 0) return `-${文本}`
  return '0'
}

function 格式化总星星(星星) {
  if (!Number.isFinite(星星)) return '?'
  return 格式化小数(星星, 1)
}

function 格式化小数(数字, 位数) {
  return Number(数字.toFixed(位数)).toString()
}

function 读取变化状态(玩家) {
  if (!Number.isFinite(玩家.变化) || !玩家.变化可信) return 'pending'
  if (玩家.变化 === 0) return 'same'
  return 玩家.变化 > 0 ? 'up' : 'down'
}

function 生成玩家星星来源说明(玩家) {
  const 列表 = [
    `赛前 ${格式化总星星(玩家.赛前)} 来源 ${玩家.赛前来源 || '?'}`,
    `赛后 ${格式化总星星(玩家.赛后)} 来源 ${玩家.赛后来源 || '?'}`,
  ]
  if (玩家.异常原因) 列表.push(`状态 ${玩家.异常原因}`)
  return 列表.join('\n')
}

function 包含死亡分数(数据包) {
  if (!Array.isArray(数据包?.scores)) return false
  return 数据包.scores.some((分数) => 分数?.dead === true)
}

注册功能({ 功能定义, 主程序功能, 功能恢复, socket功能 })
