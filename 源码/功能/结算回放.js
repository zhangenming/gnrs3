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
  if (!元素) {
    元素 = document.createElement('img')
    元素.className = 元素类名
    元素.alt = ''
    宿主.appendChild(元素)
  }

  if (元素.src !== 状态.结算回放快照.图片) {
    元素.src = 状态.结算回放快照.图片
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
    object-fit: fill;
    pointer-events: none;
    z-index: 3;
}
.gio-tower-memory-host {
    position: relative !important;
}
`.trim()
  document.documentElement.appendChild(样式)
}

function 取地图画布() {
  return document.querySelector('.game-map-canvas')
}

function 取宿主(画布) {
  const 候选宿主 =
    画布.parentElement ||
    画布.closest('.relative') ||
    画布.closest('.game-page')
  if (!候选宿主) return null
  const 样式 = window.getComputedStyle(候选宿主)
  if (样式?.position === 'static') return document.body ?? 候选宿主
  return 候选宿主
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
