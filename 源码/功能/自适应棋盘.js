import { 功能已启用 } from '../功能状态.js'
import { 状态 } from '../状态.js'
import { 取游戏画布 } from '../游戏工具.js'
import { 同步地图大小标签 } from './地图大小标签.js'
import { 安装选中棋子监听 } from './选中棋子提示.js'

const 自适应样式编号 = 'gio-tower-memory-style-adaptive-ui'
const 战场面板间距 = 10
const 战场面板右侧间距 = 8
const 战场面板预留宽 = 440

let 自适应棋盘尺寸缓存 = null
let 当前自适应棋盘元素 = null
let 当前自适应宿主元素 = null

export const 功能定义 = {
  id: '自适应棋盘',
  名称: '自适应棋盘',
  分类: '系统',
  描述: '根据窗口大小自动缩放并摆放棋盘',
}

export const 主程序功能 = {
  id: 功能定义.id,
  页面同步({ 请求渲染 }) {
    请求同步自适应棋盘(请求渲染)
  },
  窗口尺寸变化({ 请求渲染 }) {
    请求同步自适应棋盘(请求渲染)
  },
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭: 重置自适应棋盘尺寸,
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置: 重置自适应棋盘尺寸,
}

export const 覆盖层功能 = {
  id: 功能定义.id,
  渲染前({ 请求重绘 }) {
    if (!状态.自适应棋盘待同步) return
    同步自适应棋盘(请求重绘)
  },
}

export function 同步自适应棋盘(请求重绘 = function () {}) {
  if (!功能已启用('自适应棋盘')) return
  安装自适应样式()

  const 画布 = 取游戏画布()
  if (!画布) return
  安装选中棋子监听(请求重绘)

  const 地图元素 = 画布.closest('#gameMap')
  if (!地图元素?.closest('#game-page')) return

  const 宿主 = 地图元素.parentElement
  if (!宿主) return

  标记当前棋盘(地图元素, 宿主)

  const 尺寸 = 取得地图原始尺寸(地图元素, 画布)
  if (!尺寸) return

  const 可用宽 = 取得地图可用宽()
  const 可用高 = Math.max(1, window.innerHeight)
  const 目标缩放 = Math.max(0.1, Math.min(可用宽 / 尺寸.宽, 可用高 / 尺寸.高))
  const 缩放 = 取得稳定缩放(地图元素, 目标缩放)

  地图元素.style.setProperty('--gio-adaptive-map-scale', String(缩放))
  地图元素.style.setProperty('--gio-adaptive-map-width', `${尺寸.宽}px`)
  地图元素.style.setProperty('--gio-adaptive-map-height', `${尺寸.高}px`)
  宿主.style.setProperty('--gio-adaptive-map-width', `${尺寸.宽}px`)
  宿主.style.setProperty('--gio-adaptive-map-height', `${尺寸.高}px`)
  宿主.style.setProperty(
    '--gio-adaptive-map-visual-width',
    `${Math.max(1, 尺寸.宽 * 缩放)}px`,
  )
  宿主.style.setProperty(
    '--gio-adaptive-map-visual-height',
    `${Math.max(1, 尺寸.高 * 缩放)}px`,
  )
  记录自适应棋盘尺寸(地图元素, 尺寸, 缩放)
  同步战场面板位置(尺寸, 缩放)
  同步地图大小标签(地图元素)
  状态.自适应棋盘待同步 = false

  function 取得地图可用宽() {
    const 视口宽 = Math.max(1, window.innerWidth)
    const 右侧预留宽 = 战场面板预留宽 + 战场面板间距 + 战场面板右侧间距
    return Math.max(1, 视口宽 - 右侧预留宽)
  }
}

export function 重置自适应棋盘尺寸() {
  自适应棋盘尺寸缓存 = null
  当前自适应棋盘元素 = null
  当前自适应宿主元素 = null
  状态.自适应棋盘待同步 = true
  document
    .querySelectorAll('#game-page #gameMap.gio-adaptive-map')
    .forEach((地图元素) => {
      地图元素.style.removeProperty('--gio-adaptive-map-scale')
      地图元素.style.removeProperty('--gio-adaptive-map-width')
      地图元素.style.removeProperty('--gio-adaptive-map-height')
    })
  document.querySelectorAll('.gio-adaptive-map-host').forEach((宿主) => {
    宿主.style.removeProperty('--gio-adaptive-map-width')
    宿主.style.removeProperty('--gio-adaptive-map-height')
    宿主.style.removeProperty('--gio-adaptive-map-visual-width')
    宿主.style.removeProperty('--gio-adaptive-map-visual-height')
  })
}

function 请求同步自适应棋盘(请求渲染) {
  if (!功能已启用('自适应棋盘')) return
  状态.自适应棋盘待同步 = true
  同步自适应棋盘(请求渲染)
}

function 取得稳定缩放(地图元素, 目标缩放) {
  const 缓存签名 = 取得地图尺寸缓存签名(地图元素)
  const 上次缩放 =
    自适应棋盘尺寸缓存?.签名 === 缓存签名 ? 自适应棋盘尺寸缓存.缩放 : null
  if (状态.战场数据已冻结 && Number.isFinite(上次缩放)) {
    return Math.min(目标缩放, 上次缩放)
  }
  return 目标缩放
}

function 记录自适应棋盘尺寸(地图元素, 尺寸, 缩放) {
  自适应棋盘尺寸缓存 = {
    地图元素,
    签名: 取得地图尺寸缓存签名(地图元素),
    宽: 尺寸.宽,
    高: 尺寸.高,
    缩放,
  }
}

function 安装自适应样式() {
  if (!document.documentElement || document.getElementById(自适应样式编号)) {
    return
  }

  const 样式 = document.createElement('style')
  样式.id = 自适应样式编号
  样式.textContent = `
html:has(#game-page #gameMap.gio-adaptive-map),
body:has(#game-page #gameMap.gio-adaptive-map) {
    width: 100vw !important;
    height: 100vh !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    overflow: hidden !important;
    overscroll-behavior: none !important;
}
body:has(#game-page #gameMap.gio-adaptive-map) #game-page {
    width: 100vw !important;
    height: 100vh !important;
    overflow: hidden !important;
    transform: none !important;
    transition: none !important;
    animation: none !important;
}
#game-page #gameMap.gio-adaptive-map {
    position: fixed !important;
    left: 0 !important;
    top: 0 !important;
    right: auto !important;
    bottom: auto !important;
    width: var(--gio-adaptive-map-width, auto) !important;
    height: var(--gio-adaptive-map-height, auto) !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
    padding: 0 !important;
    z-index: 20 !important;
    transform: scale(var(--gio-adaptive-map-scale, 1)) !important;
    transform-origin: left top !important;
    transition: none !important;
    animation: none !important;
}
#game-page #gameMap.gio-adaptive-map .game-map-canvas {
    max-width: none !important;
    max-height: none !important;
    transition: none !important;
    animation: none !important;
}
#game-page #gameMap.gio-adaptive-map-host,
#game-page .gio-adaptive-map-host {
    position: fixed !important;
    left: 0 !important;
    top: 0 !important;
    right: auto !important;
    bottom: auto !important;
    width: var(--gio-adaptive-map-visual-width, var(--gio-adaptive-map-width, auto)) !important;
    height: var(--gio-adaptive-map-visual-height, var(--gio-adaptive-map-height, auto)) !important;
    transform: none !important;
    margin: 0 !important;
    padding: 0 !important;
    z-index: 20 !important;
    transition: none !important;
    animation: none !important;
}
body:has(#game-page #gameMap.gio-adaptive-map) #game-leaderboard-container {
    left: var(--gio-battle-panel-left, 8px) !important;
    top: var(--gio-battle-panel-top, 64px) !important;
    right: auto !important;
    width: var(--gio-battle-panel-width, 360px) !important;
    max-width: calc(100vw - 16px) !important;
    text-align: left !important;
    z-index: 26 !important;
}
body:has(#game-page #gameMap.gio-adaptive-map) #game-leaderboard {
    width: 100% !important;
    min-width: 0 !important;
}
body:has(#game-page #gameMap.gio-adaptive-map) #game-pass-turn-button {
    width: 100% !important;
    min-width: 0 !important;
}
`.trim()
  document.documentElement.appendChild(样式)
}

function 同步战场面板位置(尺寸, 缩放) {
  const 根元素 = document.documentElement
  if (!根元素) return

  const 地图右侧 = 尺寸.宽 * 缩放
  const 理想左侧 = 地图右侧 + 战场面板间距
  const 面板左侧 = Math.min(
    Math.max(8, 理想左侧),
    window.innerWidth - 战场面板右侧间距,
  )
  const 面板宽 = Math.max(0, window.innerWidth - 面板左侧 - 战场面板右侧间距)
  const 面板上侧 = Math.min(Math.max(48, window.innerHeight * 0.09), 72)

  根元素.style.setProperty('--gio-battle-panel-left', `${面板左侧}px`)
  根元素.style.setProperty('--gio-battle-panel-top', `${面板上侧}px`)
  根元素.style.setProperty('--gio-battle-panel-width', `${面板宽}px`)
}

function 标记当前棋盘(地图元素, 宿主) {
  if (当前自适应棋盘元素 && 当前自适应棋盘元素 !== 地图元素) {
    当前自适应棋盘元素.classList.remove('gio-adaptive-map')
  }
  if (
    当前自适应宿主元素 &&
    当前自适应宿主元素 !== 宿主 &&
    当前自适应宿主元素 !== 地图元素
  ) {
    当前自适应宿主元素.classList.remove('gio-adaptive-map-host')
  }

  地图元素.classList.add('gio-adaptive-map')
  宿主.classList.add('gio-adaptive-map-host')
  当前自适应棋盘元素 = 地图元素
  当前自适应宿主元素 = 宿主
}

function 取得地图原始尺寸(地图元素, 画布) {
  const 缓存签名 = 取得地图尺寸缓存签名(地图元素)
  const 当前尺寸 = 读取当前地图尺寸(地图元素, 画布)
  if (当前尺寸) {
    const 缓存缩放 =
      自适应棋盘尺寸缓存?.签名 === 缓存签名 &&
      自适应棋盘尺寸缓存.宽 === 当前尺寸.宽 &&
      自适应棋盘尺寸缓存.高 === 当前尺寸.高
        ? 自适应棋盘尺寸缓存.缩放
        : null
    记录自适应棋盘尺寸(地图元素, 当前尺寸, 缓存缩放)
    return 当前尺寸
  }

  if (自适应棋盘尺寸缓存?.签名 !== 缓存签名) return null
  return {
    宽: 自适应棋盘尺寸缓存.宽,
    高: 自适应棋盘尺寸缓存.高,
  }
}

function 取得地图尺寸缓存签名(地图元素) {
  return `${状态.宽度}x${状态.高度}|${地图元素.id}`
}

function 读取当前地图尺寸(地图元素, 画布) {
  const 文字表格 = 地图元素.querySelector('.game-cursor-table')
  const 当前缩放 = Math.max(
    0.0001,
    读取数字(地图元素.style.getPropertyValue('--gio-adaptive-map-scale'), 1),
  )
  const 画布矩形 = 画布.getBoundingClientRect()
  const 地图矩形 = 地图元素.getBoundingClientRect()
  const 宽 = 读取像素尺寸(
    地图元素.style.width,
    文字表格?.style.width,
    画布.style.width,
    地图元素.style.getPropertyValue('--gio-adaptive-map-width'),
    画布矩形.width / 当前缩放,
    地图矩形.width / 当前缩放,
    画布.offsetWidth,
    地图元素.offsetWidth,
  )
  const 高 = 读取像素尺寸(
    地图元素.style.height,
    文字表格?.style.height,
    画布.style.height,
    地图元素.style.getPropertyValue('--gio-adaptive-map-height'),
    画布矩形.height / 当前缩放,
    地图矩形.height / 当前缩放,
    画布.offsetHeight,
    地图元素.offsetHeight,
  )

  if (宽 <= 0 || 高 <= 0) return null
  return { 宽, 高 }
}

function 读取像素尺寸(...候选值列表) {
  for (const 候选值 of 候选值列表) {
    const 数值 = 读取数字(候选值, 0)
    if (数值 > 0) return 数值
  }
  return 0
}

function 读取数字(值, 默认值) {
  const 数值 = Number.parseFloat(值)
  return Number.isFinite(数值) ? 数值 : 默认值
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 主程序功能, 功能恢复, socket功能, 覆盖层功能 })
