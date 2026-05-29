import { 功能已启用 } from '../功能状态.js'
import { 地图标签层级 } from '../配置.js'
import { 状态 } from '../状态.js'

const 地图大小元素编号 = 'gio-tower-memory-style-map-size'
const 地图大小样式编号 = `${地图大小元素编号}-style`

let 当前帧率 = 0
let 平均帧率 = 0
let 最高帧率 = 0
let 最低帧率 = 0
let 帧率样本数 = 0
let 帧率总和 = 0
let 游戏开始时间 = 0
let 游戏时间 = 0
let 游戏回合数 = 0
let 平均每回合时间 = 0
let 采样帧数 = 0
let 采样开始时间 = 0
let 上次帧时间 = 0
let 当前主线程执行时间 = 0
let 当前帧时间 = 0
let 最大帧间隔 = 0
let 最小帧间隔 = 0
let 平均帧间隔 = 0
let 帧间隔样本数 = 0
let 帧间隔总和 = 0
let 帧率计时编号 = 0
let 长任务API观察器 = null
let 当前长任务API耗时 = 0
let 最大长任务API耗时 = 0
let 最小长任务API耗时 = 0
let 平均长任务API耗时 = 0
let 长任务API样本数 = 0
let 长任务API总耗时 = 0
let 当前地图元素 = null

export const 功能定义 = {
  id: '地图大小标签',
  名称: '地图大小标签',
  分类: '系统',
  描述: '在棋盘旁显示地图长宽和总格数',
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭() {
    document.getElementById(地图大小元素编号)?.remove()
    重置帧率统计()
    停止长任务API统计(true)
  },
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置() {
    重置帧率统计(true)
  },
}

export function 同步地图大小标签(地图元素) {
  if (!功能已启用('地图大小标签')) {
    document.getElementById(地图大小元素编号)?.remove()
    重置帧率统计()
    停止长任务API统计(true)
    return
  }
  安装地图大小标签样式()
  const 标签 = 确保地图大小标签()
  if (!标签) return
  当前地图元素 = 地图元素
  if (正在游戏中()) {
    启动帧率统计()
    启动长任务API统计()
  } else {
    停止帧率计算()
    停止长任务API统计()
  }
  更新地图大小标签(标签, 地图元素)
}

function 更新地图大小标签(标签, 地图元素) {
  if (!标签 || !地图元素?.isConnected) return

  if (!状态.宽度 || !状态.高度) {
    标签.style.display = 'none'
    return
  }

  const 长 = 状态.宽度
  const 宽 = 状态.高度
  const 最长长任务时间 = 读取最长长任务时间()
  更新游戏节奏统计()
  const 文本 =
    `游戏时间: ${格式化秒数(游戏时间)} 回合数: ${游戏回合数}` +
    ` 平均每回合: ${格式化秒数(平均每回合时间)}` +
    ` | ` +
    `最低: ${最低帧率} FPS: ${当前帧率} 平均: ${平均帧率} 最大: ${最高帧率}` +
    ` | 地图大小: ${长} * ${宽} = ${长 * 宽}` +
    ` | 长任务: ${最长长任务时间}ms 主线程: ${当前主线程执行时间}ms` +
    ` | 最大间隔: ${最大帧间隔}ms 实时值: ${当前帧时间}ms` +
    ` 最小值: ${最小帧间隔}ms 平均值: ${平均帧间隔}ms 个数: ${帧间隔样本数}` +
    ` | API最大间隔: ${最大长任务API耗时}ms API实时值: ${当前长任务API耗时}ms` +
    ` API最小值: ${最小长任务API耗时}ms API平均值: ${平均长任务API耗时}ms API个数: ${长任务API样本数}`
  if (标签.dataset.文本 !== 文本) {
    const 第一排 = document.createElement('span')
    第一排.className = 'gio-map-size-row gio-map-size-summary-row'
    const 第二排 = document.createElement('span')
    第二排.className =
      'gio-map-size-row gio-map-size-diagnostics-row gio-map-size-wrap-row'
    const 第三排 = document.createElement('span')
    第三排.className =
      'gio-map-size-row gio-map-size-long-task-api-row gio-map-size-wrap-row'
    const 长任务元素 = document.createElement('span')
    长任务元素.className = 'gio-map-size-long-task'
    长任务元素.textContent = `长任务:${最长长任务时间}ms`
    const 主线程元素 = document.createElement('span')
    主线程元素.className = 'gio-map-size-main-thread'
    主线程元素.textContent = `主线程:${当前主线程执行时间}ms`
    const 最大间隔元素 = document.createElement('span')
    最大间隔元素.className = 'gio-map-size-frame-time'
    最大间隔元素.textContent = `最大:${最大帧间隔}ms`
    const 实时值元素 = document.createElement('span')
    实时值元素.className = 'gio-map-size-frame-time'
    实时值元素.textContent = `实时:${当前帧时间}ms`
    const 最小值元素 = document.createElement('span')
    最小值元素.className = 'gio-map-size-frame-time'
    最小值元素.textContent = `最小:${最小帧间隔}ms`
    const 平均值元素 = document.createElement('span')
    平均值元素.className = 'gio-map-size-frame-time'
    平均值元素.textContent = `平均:${平均帧间隔}ms`
    const 统计个数元素 = document.createElement('span')
    统计个数元素.className = 'gio-map-size-frame-time'
    统计个数元素.textContent = `个数:${帧间隔样本数}`
    const API最大间隔元素 = document.createElement('span')
    API最大间隔元素.className = 'gio-map-size-long-task-api'
    API最大间隔元素.textContent = `最大:${最大长任务API耗时}ms`
    const API实时值元素 = document.createElement('span')
    API实时值元素.className = 'gio-map-size-long-task-api'
    API实时值元素.textContent = `实时:${当前长任务API耗时}ms`
    const API最小值元素 = document.createElement('span')
    API最小值元素.className = 'gio-map-size-long-task-api'
    API最小值元素.textContent = `最小:${最小长任务API耗时}ms`
    const API平均值元素 = document.createElement('span')
    API平均值元素.className = 'gio-map-size-long-task-api'
    API平均值元素.textContent = `平均:${平均长任务API耗时}ms`
    const API统计个数元素 = document.createElement('span')
    API统计个数元素.className = 'gio-map-size-long-task-api'
    API统计个数元素.textContent = `个数:${长任务API样本数}`
    const 游戏时间元素 = document.createElement('span')
    游戏时间元素.className = 'gio-map-size-game-time'
    游戏时间元素.textContent = `游戏:${格式化秒数(游戏时间)}`
    const 游戏回合数元素 = document.createElement('span')
    游戏回合数元素.className = 'gio-map-size-game-time'
    游戏回合数元素.textContent = `回合:${游戏回合数}`
    const 平均每回合元素 = document.createElement('span')
    平均每回合元素.className = 'gio-map-size-game-time'
    平均每回合元素.textContent = `均:${格式化秒数(平均每回合时间)}`
    const 最低帧率元素 = document.createElement('span')
    最低帧率元素.className = 'gio-map-size-min-fps'
    最低帧率元素.textContent = `低:${最低帧率}`
    第一排.replaceChildren(
      游戏时间元素,
      游戏回合数元素,
      平均每回合元素,
      最低帧率元素,
      document.createTextNode(
        `FPS:${当前帧率} 均:${平均帧率} 高:${最高帧率} | 地图:${长}*${宽}=${长 * 宽}`,
      ),
    )
    第二排.replaceChildren(
      长任务元素,
      主线程元素,
      最大间隔元素,
      实时值元素,
      最小值元素,
      平均值元素,
      统计个数元素,
    )
    第三排.replaceChildren(
      API最大间隔元素,
      API实时值元素,
      API最小值元素,
      API平均值元素,
      API统计个数元素,
    )
    标签.replaceChildren(第一排, 第二排, 第三排)
    标签.dataset.文本 = 文本
  }
  if (标签.style.display !== 'block') 标签.style.display = 'block'

  const 间距 = 8
  const 地图矩形 = 地图元素.getBoundingClientRect()
  const 标签矩形 = 标签.getBoundingClientRect()
  const 右侧x = 地图矩形.right + 间距
  const 内侧x = 地图矩形.right - 标签矩形.width - 间距
  const x = 右侧x + 标签矩形.width + 间距 <= window.innerWidth ? 右侧x : 内侧x
  const y = 地图矩形.top + 间距

  const left = `${Math.max(间距, x)}px`
  const top = `${Math.max(间距, y)}px`
  if (标签.style.left !== left) 标签.style.left = left
  if (标签.style.top !== top) 标签.style.top = top
}

function 启动帧率统计() {
  if (帧率计时编号) return
  采样开始时间 = performance.now()
  if (!游戏开始时间) 游戏开始时间 = 采样开始时间
  上次帧时间 = 0
  采样帧数 = 0
  帧率计时编号 = requestAnimationFrame(统计帧率)
}

function 统计帧率(时间) {
  if (!功能已启用('地图大小标签')) {
    重置帧率统计()
    return
  }

  if (!正在游戏中()) {
    停止帧率计算()
    更新地图大小标签(document.getElementById(地图大小元素编号), 当前地图元素)
    return
  }

  if (上次帧时间) {
    采样帧数 += 1
    当前帧时间 = Math.round(时间 - 上次帧时间)
    当前主线程执行时间 = 当前帧时间
    记录帧间隔样本(当前帧时间)
  }
  上次帧时间 = 时间
  const 间隔 = 时间 - 采样开始时间
  if (间隔 >= 500) {
    当前帧率 = Math.round((采样帧数 * 1000) / 间隔)
    记录帧率样本(当前帧率)
    采样开始时间 = 时间
    采样帧数 = 0
    更新地图大小标签(document.getElementById(地图大小元素编号), 当前地图元素)
  }

  帧率计时编号 = requestAnimationFrame(统计帧率)
}

function 记录帧率样本(帧率) {
  帧率样本数 += 1
  帧率总和 += 帧率
  平均帧率 = Math.round(帧率总和 / 帧率样本数)
  最高帧率 = 帧率样本数 === 1 ? 帧率 : Math.max(最高帧率, 帧率)
  最低帧率 = 帧率样本数 === 1 ? 帧率 : Math.min(最低帧率, 帧率)
}

function 更新游戏节奏统计() {
  游戏回合数 = Number.isFinite(状态.当前回合) ? Math.max(0, 状态.当前回合) : 0
  if (游戏开始时间 && 帧率计时编号) 游戏时间 = performance.now() - 游戏开始时间
  平均每回合时间 = 游戏回合数 ? 游戏时间 / 游戏回合数 : 0
}

function 记录帧间隔样本(帧间隔) {
  帧间隔样本数 += 1
  帧间隔总和 += 帧间隔
  最大帧间隔 = 帧间隔样本数 === 1 ? 帧间隔 : Math.max(最大帧间隔, 帧间隔)
  最小帧间隔 = 帧间隔样本数 === 1 ? 帧间隔 : Math.min(最小帧间隔, 帧间隔)
  平均帧间隔 = Math.round(帧间隔总和 / 帧间隔样本数)
}

function 启动长任务API统计() {
  if (长任务API观察器) return
  if (!PerformanceObserver.supportedEntryTypes?.includes('longtask')) return

  长任务API观察器 = new PerformanceObserver(function (列表) {
    for (const entry of 列表.getEntries()) {
      记录长任务API样本(entry.duration)
    }
    更新地图大小标签(document.getElementById(地图大小元素编号), 当前地图元素)
  })
  长任务API观察器.observe({
    type: 'longtask',
    buffered: true,
    zem: true,
  })
}

function 停止长任务API统计(清空数据 = false) {
  长任务API观察器?.disconnect()
  长任务API观察器 = null
  if (清空数据) 重置长任务API统计()
}

function 记录长任务API样本(耗时) {
  const 长任务耗时 = Math.round(耗时)
  当前长任务API耗时 = 长任务耗时
  长任务API样本数 += 1
  长任务API总耗时 += 长任务耗时
  最大长任务API耗时 =
    长任务API样本数 === 1 ? 长任务耗时 : Math.max(最大长任务API耗时, 长任务耗时)
  最小长任务API耗时 =
    长任务API样本数 === 1 ? 长任务耗时 : Math.min(最小长任务API耗时, 长任务耗时)
  平均长任务API耗时 = Math.round(长任务API总耗时 / 长任务API样本数)
}

function 重置长任务API统计() {
  当前长任务API耗时 = 0
  最大长任务API耗时 = 0
  最小长任务API耗时 = 0
  平均长任务API耗时 = 0
  长任务API样本数 = 0
  长任务API总耗时 = 0
}

function 停止帧率计算() {
  if (帧率计时编号) cancelAnimationFrame(帧率计时编号)
  帧率计时编号 = 0
  采样帧数 = 0
  采样开始时间 = 0
  上次帧时间 = 0
}

function 清空帧率统计数据() {
  游戏开始时间 = 0
  游戏时间 = 0
  游戏回合数 = 0
  平均每回合时间 = 0
  当前主线程执行时间 = 0
  当前帧时间 = 0
  最大帧间隔 = 0
  最小帧间隔 = 0
  平均帧间隔 = 0
  帧间隔样本数 = 0
  帧间隔总和 = 0
  重置长任务API统计()
}

function 重置帧率统计(保留地图元素 = false) {
  停止帧率计算()
  清空帧率统计数据()
  当前帧率 = 0
  平均帧率 = 0
  最高帧率 = 0
  最低帧率 = 0
  帧率样本数 = 0
  帧率总和 = 0
  if (!保留地图元素) 当前地图元素 = null
}

function 正在游戏中() {
  return Boolean(
    !状态.在主页面 &&
    !状态.战场数据已冻结 &&
    !状态.回放正在显示 &&
    状态.宽度 &&
    状态.高度 &&
    当前地图元素?.isConnected &&
    当前地图元素.closest('#game-page'),
  )
}

function 读取最长长任务时间() {
  return Math.round(状态.性能诊断.长任务?.最长?.耗时 ?? 0)
}

function 格式化秒数(毫秒) {
  return `${Math.round(毫秒 / 100) / 10}s`
}

function 确保地图大小标签() {
  const 已有标签 = document.getElementById(地图大小元素编号)
  if (已有标签) return 已有标签
  if (!document.body) return null

  const 标签 = document.createElement('div')
  标签.id = 地图大小元素编号
  document.body.appendChild(标签)
  return 标签
}

function 安装地图大小标签样式() {
  if (!document.documentElement) return
  if (document.getElementById(地图大小样式编号)) return

  const 样式 = document.createElement('style')
  样式.id = 地图大小样式编号
  样式.textContent = `
#${地图大小元素编号} {
    position: fixed !important;
    pointer-events: none !important;
    z-index: ${地图标签层级} !important;
    display: none;
    padding: 3px 5px !important;
    border-radius: 4px !important;
    background: rgba(0, 0, 0, 0.72) !important;
    color: #ffffff !important;
    font: 800 11px/1 Arial, sans-serif !important;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9) !important;
    white-space: nowrap !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 2px !important;
}

#${地图大小元素编号} .gio-map-size-row {
    display: flex !important;
    align-items: center !important;
    gap: 3px !important;
}

#${地图大小元素编号} .gio-map-size-summary-row {
    min-height: 12px !important;
}

#${地图大小元素编号} .gio-map-size-diagnostics-row {
    min-height: 12px !important;
}

#${地图大小元素编号} .gio-map-size-long-task-api-row {
    min-height: 12px !important;
}

#${地图大小元素编号} .gio-map-size-wrap-row {
    flex-wrap: wrap !important;
    max-width: 330px !important;
    row-gap: 2px !important;
}

#${地图大小元素编号} .gio-map-size-min-fps,
#${地图大小元素编号} .gio-map-size-game-time,
#${地图大小元素编号} .gio-map-size-long-task,
#${地图大小元素编号} .gio-map-size-main-thread,
#${地图大小元素编号} .gio-map-size-frame-time,
#${地图大小元素编号} .gio-map-size-long-task-api {
    display: inline-block !important;
    box-sizing: border-box !important;
    min-width: 48px !important;
    padding: 1px 2px !important;
    border-radius: 2px !important;
    text-shadow: none !important;
}

#${地图大小元素编号} .gio-map-size-long-task,
#${地图大小元素编号} .gio-map-size-main-thread {
    min-width: 62px !important;
}

#${地图大小元素编号} .gio-map-size-game-time {
    background: #d8e7ff !important;
    color: #000000 !important;
}

#${地图大小元素编号} .gio-map-size-min-fps {
    background: #ffffff !important;
    color: #000000 !important;
}

#${地图大小元素编号} .gio-map-size-long-task {
    background: #ffd86b !important;
    color: #000000 !important;
}

#${地图大小元素编号} .gio-map-size-main-thread {
    background: #b8e6ff !important;
    color: #000000 !important;
}

#${地图大小元素编号} .gio-map-size-frame-time {
    background: #c8efb2 !important;
    color: #000000 !important;
}

#${地图大小元素编号} .gio-map-size-long-task-api {
    background: #efc9ff !important;
    color: #000000 !important;
}
`.trim()
  document.documentElement.appendChild(样式)
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 功能恢复, socket功能 })
