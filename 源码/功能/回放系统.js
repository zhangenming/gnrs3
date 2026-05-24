// 功能目的:
// 游戏结束后用 A/D 按帧复盘整局，并尽量还原每一帧处理完成后的内部状态和地图画面。
//
// 实现原理:
// 每次 game_start/game_update 处理完后，保存一份状态快照和当前地图 canvas 图片。
// 复盘时恢复快照，让既有覆盖层渲染逻辑直接读取历史状态；地图底图使用当帧图片兜住原画面保真。
import { 样式编号, 我方蓝色, 敌方红色 } from '../配置.js'
import { 是我方或队友 } from '../游戏.js'
import { 状态 } from '../状态.js'

const 元素类名 = 'gio-replay-frame'
const 面板类名 = 'gio-replay-panel'
const 样式元素编号 = `${样式编号}-replay-system`
const 底图层级 = 2147482999
const 面板层级 = 2147483200

const 快照字段列表 = [
  '宽度',
  '高度',
  '塔列表',
  '已知塔集合',
  '已知塔类型',
  '中立塔兵力表',
  '中立塔开塔成本表',
  '我方开塔增长表',
  '已知基地集合',
  '已知敌方基地集合',
  '基地兵力表',
  '我方基地索引',
  '基地被敌发现',
  '基地被敌发现回合',
  '基地危险背景豁免',
  '已到达视野集合',
  '已知障碍物集合',
  '地图数组',
  '原始兵力文本',
  '兵力分布着色列表',
  '兵力分布调试',
  '敌方移动高亮列表',
  '敌方基地接触列表',
  '敌方基地候选列表',
  '敌方基地推测调试',
  '抢塔提示列表',
  '敌方开塔提示',
  '敌方开塔战场快照',
  '敌方开塔调试',
  '移动队列',
  '自动吃基地接管',
  '自动吃基地攻击序号',
  '我方行动类型表',
  '游戏数据进展列表',
  '游戏数据进展上次统计回合',
  '战场数据已冻结',
  '战场数据快照',
  '战场塔信息快照',
  '当前回合',
  '上次大回合倒计时文本',
  '我方索引',
  '玩家名列表',
  '队伍',
]

export function 记录回放帧(事件名, 数据包) {
  if (状态.回放已结束) return
  if (!Array.isArray(状态.地图数组) || !状态.宽度 || !状态.高度) return

  const 帧 = {
    序号: 状态.回放帧列表.length,
    事件名,
    回合: Number.isInteger(数据包?.turn) ? 数据包.turn : 状态.当前回合,
    图片: 取得地图图片(),
    动画时间: performance.now(),
    状态快照: 取得状态快照(),
  }
  状态.回放帧列表.push(帧)
}

export function 结束回放(_事件名, _数据包, 请求渲染) {
  if (状态.回放已结束) return
  if (!状态.回放帧列表.length) return

  状态.回放已结束 = true
  状态.回放正在显示 = true
  状态.回放当前帧索引 = 状态.回放帧列表.length - 1
  状态.战场数据已冻结 = true
  应用当前回放帧(请求渲染)
}

export function 重置回放() {
  状态.回放帧列表 = []
  状态.回放当前帧索引 = null
  状态.回放已结束 = false
  状态.回放正在显示 = false
  状态.回放动画时间 = null
  移除回放元素()
  移除回放面板()
}

export function 安装回放快捷键(请求渲染) {
  if (状态.回放已安装) return
  状态.回放已安装 = true
  window.addEventListener(
    'keydown',
    (事件) => {
      if (事件.defaultPrevented || 是输入中(事件.target)) return
      if (!状态.回放已结束 || !状态.回放帧列表.length) return

      if (事件.key === 'a' || 事件.key === 'A') {
        事件.preventDefault()
        移动回放帧(-1, 请求渲染)
      } else if (事件.key === 'd' || 事件.key === 'D') {
        事件.preventDefault()
        移动回放帧(1, 请求渲染)
      }
    },
    { capture: true },
  )
}

export function 同步回放元素() {
  同步回放面板()
  if (!状态.回放正在显示) {
    移除回放元素()
    return
  }

  const 帧 = 取得当前回放帧()
  const 画布 = 取地图画布()
  const 元素 = 确保回放元素(画布)
  if (!帧 || !画布 || !元素) return

  const 画布矩形 = 画布.getBoundingClientRect()
  const 宿主 = 元素.parentElement
  const 宿主矩形 = 宿主.getBoundingClientRect()

  元素.style.left = `${画布矩形.left - 宿主矩形.left}px`
  元素.style.top = `${画布矩形.top - 宿主矩形.top}px`
  元素.style.width = `${画布矩形.width}px`
  元素.style.height = `${画布矩形.height}px`
  同步回放底图(元素, 帧, 画布矩形.width, 画布矩形.height)
}

function 移动回放帧(步数, 请求渲染) {
  const 最大索引 = 状态.回放帧列表.length - 1
  if (最大索引 < 0) return

  const 当前索引 = Number.isInteger(状态.回放当前帧索引)
    ? 状态.回放当前帧索引
    : 最大索引
  const 目标索引 = Math.min(Math.max(当前索引 + 步数, 0), 最大索引)
  if (目标索引 === 状态.回放当前帧索引 && 状态.回放正在显示) return

  状态.回放当前帧索引 = 目标索引
  状态.回放正在显示 = true
  应用当前回放帧(请求渲染)
}

function 应用当前回放帧(请求渲染) {
  const 帧 = 取得当前回放帧()
  if (!帧?.状态快照) return

  const 回放状态 = 取得回放状态()
  恢复状态快照(帧.状态快照)
  恢复回放状态(回放状态)
  状态.回放动画时间 = 帧.动画时间
  状态.战场数据已冻结 = true
  同步回放元素()
  if (typeof 请求渲染 === 'function') 请求渲染()
}

function 取得回放状态() {
  return {
    帧列表: 状态.回放帧列表,
    当前帧索引: 状态.回放当前帧索引,
    已结束: 状态.回放已结束,
    正在显示: 状态.回放正在显示,
    已安装: 状态.回放已安装,
    元素: 状态.回放元素,
    面板: 状态.回放面板,
  }
}

function 恢复回放状态(回放状态) {
  状态.回放帧列表 = 回放状态.帧列表
  状态.回放当前帧索引 = 回放状态.当前帧索引
  状态.回放已结束 = 回放状态.已结束
  状态.回放正在显示 = 回放状态.正在显示
  状态.回放已安装 = 回放状态.已安装
  状态.回放元素 = 回放状态.元素
  状态.回放面板 = 回放状态.面板
}

function 取得当前回放帧() {
  if (!状态.回放帧列表.length) return null
  const 索引 = Number.isInteger(状态.回放当前帧索引)
    ? 状态.回放当前帧索引
    : 状态.回放帧列表.length - 1
  return 状态.回放帧列表[索引] ?? null
}

function 取得状态快照() {
  const 快照 = {}
  for (const 字段 of 快照字段列表) {
    if (字段 === '原始兵力文本') {
      快照[字段] = 复制原始兵力文本()
    } else {
      快照[字段] = 复制值(状态[字段])
    }
  }
  return 快照
}

function 恢复状态快照(快照) {
  for (const 字段 of 快照字段列表) {
    if (字段 === '原始兵力文本') {
      状态[字段] = 复制原始兵力文本(快照[字段])
    } else {
      状态[字段] = 复制值(快照[字段])
    }
  }
}

function 复制原始兵力文本(来源 = 状态.原始兵力文本) {
  const 目标 = new Map()
  if (!(来源 instanceof Map)) return 目标

  来源.forEach((记录, 索引) => {
    if (!Number.isInteger(索引) || !记录) return
    目标.set(索引, {
      兵力: 记录.兵力,
      文本: 记录.文本,
      画布宽: 记录.画布宽,
      画布高: 记录.画布高,
      时间: 记录.时间,
    })
  })
  return 目标
}

function 复制值(值) {
  if (Array.isArray(值)) return 值.map((项) => 复制值(项))
  if (值 instanceof Set) {
    return new Set(
      Array.from(值, (项) => {
        return 复制值(项)
      }),
    )
  }
  if (值 instanceof Map) {
    return new Map(
      Array.from(值, ([键, 项]) => {
        return [复制值(键), 复制值(项)]
      }),
    )
  }
  if (!值 || typeof 值 !== 'object') return 值
  if (Number.isInteger(值.nodeType)) return null

  const 原型 = Object.getPrototypeOf(值)
  if (原型 !== Object.prototype && 原型 !== null) return 值

  const 复制 = {}
  for (const [键, 项] of Object.entries(值)) {
    复制[键] = 复制值(项)
  }
  return 复制
}

function 确保回放元素(画布) {
  安装回放样式()
  if (!画布) return null

  const 宿主 = 取宿主(画布)
  if (!宿主) return null

  宿主.classList.add('gio-tower-memory-host')
  let 元素 = 状态.回放元素
  if (!元素 || !宿主.contains(元素)) {
    元素 = 宿主.querySelector(`.${元素类名}`)
  }
  if (元素?.tagName?.toLowerCase() !== 'div') {
    元素?.remove()
    元素 = document.createElement('div')
    元素.className = 元素类名
    元素.innerHTML = '<img alt=""><canvas></canvas>'
    宿主.appendChild(元素)
  }

  状态.回放元素 = 元素
  return 元素
}

function 同步回放底图(元素, 帧, css宽, css高) {
  const 图片 = 元素.querySelector('img')
  const 备用画布 = 元素.querySelector('canvas')
  if (!图片 || !备用画布) return

  if (帧.图片) {
    if (图片.src !== 帧.图片) 图片.src = 帧.图片
    图片.style.display = 'block'
    备用画布.style.display = 'none'
    return
  }

  图片.removeAttribute('src')
  图片.style.display = 'none'
  备用画布.style.display = 'block'
  绘制备用地图(备用画布, css宽, css高)
}

function 绘制备用地图(画布, css宽, css高) {
  const 地图数组 = 状态.地图数组
  if (!Array.isArray(地图数组) || !状态.宽度 || !状态.高度) return

  const dpr = window.devicePixelRatio ?? 1
  const 像素宽 = Math.max(1, Math.round(css宽 * dpr))
  const 像素高 = Math.max(1, Math.round(css高 * dpr))
  if (画布.width !== 像素宽) 画布.width = 像素宽
  if (画布.height !== 像素高) 画布.height = 像素高

  const ctx = 画布.getContext('2d')
  if (!ctx) return

  const 格子数 = 状态.宽度 * 状态.高度
  if (地图数组.length < 2 + 格子数 * 2) return

  const 格宽 = css宽 / 状态.宽度
  const 格高 = css高 / 状态.高度
  const 大小 = Math.min(格宽, 格高)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, css宽, css高)

  for (let idx = 0; idx < 格子数; idx += 1) {
    const 行 = Math.floor(idx / 状态.宽度)
    const 列 = idx % 状态.宽度
    const x = 列 * 格宽
    const y = 行 * 格高
    const 兵力 = 地图数组[2 + idx]
    const 地形 = 地图数组[2 + 格子数 + idx]
    ctx.fillStyle = 取得地块颜色(地形)
    ctx.fillRect(x, y, 格宽 + 0.5, 格高 + 0.5)
    if (Number.isInteger(兵力) && 兵力 > 0 && 地形 !== -3) {
      绘制兵力(x, y, 兵力)
    }
  }

  function 取得地块颜色(地形) {
    if (地形 === -4 || 地形 === -2) return '#000000'
    if (地形 === -3) return '#333333'
    if (地形 === -1) return '#a7adb7'
    if (Number.isInteger(地形) && 地形 >= 0) {
      return 是我方或队友(地形) ? 我方蓝色 : 敌方红色
    }
    return '#242832'
  }

  function 绘制兵力(x, y, 兵力) {
    const 文本 = String(兵力)
    const 字号比例 = 文本.length >= 3 ? 0.42 : 文本.length >= 2 ? 0.5 : 0.6
    const 字号 = Math.max(10, Math.min(24, 大小 * 字号比例))
    const 中心x = x + 格宽 / 2
    const 中心y = y + 格高 / 2

    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.font = `900 ${字号}px Arial, sans-serif`
    ctx.lineWidth = Math.max(2, 大小 * 0.11)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.88)'
    ctx.fillStyle = '#ffffff'
    ctx.strokeText(文本, 中心x, 中心y)
    ctx.fillText(文本, 中心x, 中心y)
    ctx.restore()
  }
}

function 同步回放面板() {
  if (!状态.回放已结束 || !状态.回放帧列表.length) {
    移除回放面板()
    return
  }

  const 面板 = 确保回放面板()
  const 帧 = 取得当前回放帧()
  if (!面板 || !帧) return

  const 索引 = 状态.回放帧列表.indexOf(帧)
  const 签名 = `${索引}:${状态.回放帧列表.length}:${帧.回合}`
  if (面板.dataset.gioReplaySignature === 签名) return
  面板.dataset.gioReplaySignature = 签名

  面板.querySelector('.gio-replay-index').textContent =
    `${索引 + 1}/${状态.回放帧列表.length}`
  面板.querySelector('.gio-replay-turn').textContent = Number.isInteger(帧.回合)
    ? `turn ${帧.回合}`
    : 'turn ?'
}

function 确保回放面板() {
  安装回放样式()

  let 面板 = 状态.回放面板
  if (!面板 || !document.documentElement.contains(面板)) {
    面板 = document.querySelector(`.${面板类名}`)
  }
  if (!面板) {
    面板 = document.createElement('div')
    面板.className = 面板类名
    面板.innerHTML =
      '<span class="gio-replay-name">回放</span>' +
      '<span class="gio-replay-index"></span>' +
      '<span class="gio-replay-turn"></span>'
  }
  if (面板.parentElement !== document.body) document.body.appendChild(面板)

  状态.回放面板 = 面板
  return 面板
}

function 移除回放元素() {
  document.querySelectorAll(`.${元素类名}`).forEach((元素) => 元素.remove())
  状态.回放元素 = null
}

function 移除回放面板() {
  document.querySelectorAll(`.${面板类名}`).forEach((元素) => 元素.remove())
  状态.回放面板 = null
}

function 安装回放样式() {
  if (!document.documentElement || document.getElementById(样式元素编号)) return

  const 样式 = document.createElement('style')
  样式.id = 样式元素编号
  样式.textContent = `
.${元素类名} {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
    z-index: ${底图层级};
}
.${元素类名} img,
.${元素类名} canvas {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
}
.gio-tower-memory-host {
    position: relative !important;
}
.${面板类名} {
    position: fixed;
    right: 12px;
    top: 12px;
    z-index: ${面板层级};
    display: flex;
    align-items: center;
    gap: 7px;
    box-sizing: border-box;
    max-width: min(280px, calc(100vw - 24px));
    min-height: 28px;
    padding: 5px 8px;
    border: 1px solid rgba(255, 255, 255, 0.42);
    border-radius: 6px;
    background: rgba(8, 12, 18, 0.9);
    color: #ffffff;
    font: 900 12px/1 Arial, sans-serif;
    letter-spacing: 0;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.92);
    pointer-events: none;
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.28);
}
.${面板类名} span {
    min-width: 0;
    white-space: nowrap;
}
.gio-replay-name {
    color: #f5d66b;
}
.gio-replay-index {
    color: #ffffff;
}
.gio-replay-turn {
    color: #b9d8ff;
}
`.trim()
  document.documentElement.appendChild(样式)
}

function 取得地图图片() {
  const 画布 = 取地图画布()
  if (!画布 || !画布.width || !画布.height) return ''

  try {
    return 画布.toDataURL('image/png')
  } catch {
    return ''
  }
}

function 取地图画布() {
  return (
    document.querySelector('#game-page #gameMap .game-map-canvas') ??
    document.querySelector('.game-map-canvas')
  )
}

function 取宿主(画布) {
  if (!画布) return null
  const 候选宿主 =
    画布.parentElement ||
    画布.closest('.relative') ||
    画布.closest('.game-page')
  return 候选宿主 ?? document.body
}

function 是输入中(元素) {
  const 标签名 = 元素?.tagName?.toLowerCase()
  return (
    标签名 === 'input' ||
    标签名 === 'textarea' ||
    标签名 === 'select' ||
    元素?.isContentEditable === true
  )
}
