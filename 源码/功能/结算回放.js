// 功能目的:
// 结算画面按 A/D 在结束前一帧和结算后画面之间切换，方便复盘最终吃子前的盘面。
import { 状态 } from '../状态.js'
import { 是战场数据冻结事件 } from './战场数据冻结.js'

const 元素类名 = 'gio-settlement-replay-frame'
const 样式编号 = 'gio-settlement-replay-style'

export function 记录结算回放快照(事件名, 数据包) {
  if (!是战场数据冻结事件(事件名, 数据包)) return
  if (状态.结算回放快照) return

  const 画布 = 取地图画布()
  if (!画布) return

  const 矩形 = 画布.getBoundingClientRect()
  if (矩形.width <= 0 || 矩形.height <= 0) return

  try {
    状态.结算回放快照 = {
      图片: 画布.toDataURL('image/png'),
      宽度: 状态.宽度,
      高度: 状态.高度,
      地图数组: Array.isArray(状态.地图数组) ? 状态.地图数组.slice() : null,
    }
  } catch {
    状态.结算回放快照 = null
  }
}

export function 重置结算回放() {
  状态.结算回放快照 = null
  状态.结算回放显示 = false
  移除结算回放元素()
}

export function 安装结算回放快捷键() {
  if (状态.结算回放已安装) return
  状态.结算回放已安装 = true
  window.addEventListener(
    'keydown',
    (事件) => {
      if (事件.defaultPrevented || 是输入中(事件.target)) return
      if (事件.key === 'a' || 事件.key === 'A') {
        显示结算回放()
      } else if (事件.key === 'd' || 事件.key === 'D') {
        隐藏结算回放()
      }
    },
    { capture: true },
  )
}

export function 同步结算回放元素() {
  if (!状态.结算回放显示) return

  const 画布 = 取地图画布()
  const 元素 = 确保结算回放元素()
  if (!画布 || !元素) return

  const 画布矩形 = 画布.getBoundingClientRect()
  const 宿主 = 元素.parentElement
  const 宿主矩形 = 宿主.getBoundingClientRect()

  元素.style.left = `${画布矩形.left - 宿主矩形.left}px`
  元素.style.top = `${画布矩形.top - 宿主矩形.top}px`
  元素.style.width = `${画布矩形.width}px`
  元素.style.height = `${画布矩形.height}px`
  绘制结算回放兵力(元素, 画布矩形.width, 画布矩形.height)
}

function 显示结算回放() {
  if (!状态.结算回放快照) return
  状态.结算回放显示 = true
  同步结算回放元素()
}

function 隐藏结算回放() {
  状态.结算回放显示 = false
  移除结算回放元素()
}

function 确保结算回放元素() {
  安装结算回放样式()

  const 画布 = 取地图画布()
  if (!画布 || !状态.结算回放快照) return null

  const 宿主 = 取宿主(画布)
  if (!宿主) return null

  宿主.classList.add('gio-tower-memory-host')
  let 元素 = 宿主.querySelector(`.${元素类名}`)
  if (元素?.tagName?.toLowerCase() !== 'div') {
    元素?.remove()
    元素 = document.createElement('div')
    元素.className = 元素类名
    元素.innerHTML = '<img alt=""><canvas></canvas>'
    宿主.appendChild(元素)
  }

  const 图片 = 元素.querySelector('img')
  if (图片 && 图片.src !== 状态.结算回放快照.图片) {
    图片.src = 状态.结算回放快照.图片
  }
  return 元素
}

function 移除结算回放元素() {
  document.querySelectorAll(`.${元素类名}`).forEach((元素) => 元素.remove())
}

function 安装结算回放样式() {
  if (!document.documentElement || document.getElementById(样式编号)) return

  const 样式 = document.createElement('style')
  样式.id = 样式编号
  样式.textContent = `
.${元素类名} {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
    z-index: 2147483001;
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
    isolation: isolate;
}
`.trim()
  document.documentElement.appendChild(样式)
}

function 绘制结算回放兵力(元素, css宽, css高) {
  const 快照 = 状态.结算回放快照
  const 画布 = 元素.querySelector('canvas')
  if (!画布 || !快照) return

  const { 地图数组, 宽度, 高度 } = 快照
  const dpr = window.devicePixelRatio ?? 1
  const 像素宽 = Math.round(css宽 * dpr)
  const 像素高 = Math.round(css高 * dpr)
  if (画布.width !== 像素宽) 画布.width = 像素宽
  if (画布.height !== 像素高) 画布.height = 像素高

  const ctx = 画布.getContext('2d')
  if (!ctx) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, css宽, css高)
  if (!Array.isArray(地图数组) || !宽度 || !高度) return

  const 格子数 = 宽度 * 高度
  if (地图数组.length < 2 + 格子数 * 2) return

  const 格宽 = css宽 / 宽度
  const 格高 = css高 / 高度
  const 格大小 = Math.min(格宽, 格高)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  for (let idx = 0; idx < 格子数; idx += 1) {
    const 兵力 = 地图数组[2 + idx]
    const 地形 = 地图数组[2 + 格子数 + idx]
    if (!Number.isInteger(兵力) || 兵力 <= 0) continue
    if (!Number.isInteger(地形) || 地形 < -1) continue

    const 文本 = String(兵力)
    const 行 = Math.floor(idx / 宽度)
    const 列 = idx % 宽度
    const x = 列 * 格宽 + 格宽 / 2
    const y = 行 * 格高 + 格高 / 2
    const 字号比例 = 文本.length >= 3 ? 0.38 : 文本.length >= 2 ? 0.46 : 0.54
    const 字号 = Math.max(10, Math.min(24, 格大小 * 字号比例))

    ctx.font = `700 ${字号}px Arial, sans-serif`
    ctx.lineWidth = Math.max(2, 字号 * 0.16)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.fillStyle = '#000000'
    ctx.strokeText(文本, x, y)
    ctx.fillText(文本, x, y)
  }
}

function 取地图画布() {
  return document.querySelector('.game-map-canvas')
}

function 取宿主(画布) {
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
