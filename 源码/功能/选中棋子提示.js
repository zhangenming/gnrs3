import { 状态 } from '../状态.js'
import { 取得大回合倒计时 } from '../工具.js'

export const 功能定义 = {
  id: '选中棋子提示',
  名称: '选中棋子提示',
  分类: '地图覆盖',
  描述: '给当前选中的棋子补高亮和倒计时角标',
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭后需要清空覆盖层: true,
}

let 选中格子索引 = null
let 已同步移动队列长度 = 0
let 移动队列起点索引 = null
let 已安装选中监听 = false

export const 覆盖层功能 = {
  id: 功能定义.id,
  需要绘制() {
    return Number.isInteger(取得选中棋子索引())
  },
  需要连续动画() {
    return Number.isInteger(取得选中棋子索引())
  },
  绘制: 画选中棋子,
}

export const socket功能 = {
  id: 功能定义.id,
  出站({ 事件名, 请求渲染 }) {
    if (事件名 === 'attack') {
      同步移动队列终点选中()
      请求渲染()
    } else if (事件名 === 'undo_move' || 事件名 === 'clear_moves') {
      同步当前移动队列选中()
      请求渲染()
    }
  },
  game_update前() {
    同步移动队列标记()
  },
  新局重置: 清空选中状态,
}

export function 安装选中棋子监听(请求重绘) {
  if (已安装选中监听) return
  if (!document) return
  已安装选中监听 = true
  document.addEventListener('pointerdown', 记录点击选中格子, {
    capture: true,
    passive: true,
  })
  document.addEventListener('keydown', 记录快捷键选中格子, {
    capture: true,
    passive: true,
  })

  function 记录点击选中格子(事件) {
    if (Number.isInteger(事件.button) && 事件.button !== 0) return
    const 目标 = 事件.target instanceof Element ? 事件.target : null
    const 地图元素 = 目标?.closest?.('#game-page #gameMap')
    if (!地图元素) return

    const 画布 = 地图元素.querySelector('.game-map-canvas')
    if (!画布) return

    const 格子索引 = 取得点击格子索引(事件, 画布)
    if (!Number.isInteger(格子索引)) return

    选中格子索引 = 格子索引
    已同步移动队列长度 = 状态.移动队列.length
    移动队列起点索引 = 取得移动队列起点索引()
    请求重绘()
  }

  function 记录快捷键选中格子(事件) {
    if (事件.key !== 'Shift') return
    if (!Number.isInteger(状态.我方基地索引) || 状态.我方基地索引 < 0) return

    选中格子索引 = 状态.我方基地索引
    已同步移动队列长度 = 状态.移动队列.length
    移动队列起点索引 = 取得移动队列起点索引()
    请求重绘()
  }
}

export function 取得选中棋子索引() {
  const 当前移动队列长度 = 状态.移动队列.length
  if (当前移动队列长度 > 已同步移动队列长度) 同步移动队列终点选中()
  if (当前移动队列长度 < 已同步移动队列长度) 同步移动队列标记()
  return 选中格子索引
}

function 同步移动队列终点选中() {
  if (状态.移动队列.length > 0 && 移动队列起点索引 == null) {
    移动队列起点索引 = 取得移动队列起点索引()
  }

  const 最后移动 = 状态.移动队列.at(-1)
  if (Number.isInteger(最后移动?.终点) && 最后移动.终点 >= 0) {
    选中格子索引 = 最后移动.终点
  }
  已同步移动队列长度 = 状态.移动队列.length
}

function 同步当前移动队列选中() {
  if (状态.移动队列.length > 0) {
    同步移动队列终点选中()
    return
  }

  if (Number.isInteger(移动队列起点索引) && 移动队列起点索引 >= 0) {
    选中格子索引 = 移动队列起点索引
  }
  同步移动队列标记()
}

function 同步移动队列标记() {
  已同步移动队列长度 = 状态.移动队列.length
  移动队列起点索引 = 取得移动队列起点索引()
}

function 清空选中状态() {
  选中格子索引 = null
  已同步移动队列长度 = 0
  移动队列起点索引 = null
}

function 取得移动队列起点索引() {
  const 首次移动 = 状态.移动队列[0]
  return Number.isInteger(首次移动?.起点) && 首次移动.起点 >= 0
    ? 首次移动.起点
    : null
}

function 取得点击格子索引(事件, 画布) {
  if (!状态.宽度 || !状态.高度) return null

  const 矩形 = 画布.getBoundingClientRect()
  if (矩形.width <= 0 || 矩形.height <= 0) return null

  const x = 事件.clientX - 矩形.left
  const y = 事件.clientY - 矩形.top
  if (x < 0 || y < 0 || x >= 矩形.width || y >= 矩形.height) return null

  const 列 = Math.min(状态.宽度 - 1, Math.floor((x / 矩形.width) * 状态.宽度))
  const 行 = Math.min(状态.高度 - 1, Math.floor((y / 矩形.height) * 状态.高度))
  return 行 * 状态.宽度 + 列
}

function 画选中棋子({ ctx, 格宽, 格高, 大小, 当前动画时间 }) {
  const 格子索引 = 取得选中棋子索引()
  const 格子数 = 状态.宽度 * 状态.高度
  if (!Number.isInteger(格子索引)) return
  if (格子索引 < 0 || 格子索引 >= 格子数) {
    选中格子索引 = null
    return
  }

  const 行 = Math.floor(格子索引 / 状态.宽度)
  const 列 = 格子索引 % 状态.宽度
  const 中心x = 列 * 格宽 + 格宽 / 2
  const 中心y = 行 * 格高 + 格高 / 2
  const 动画相位 = (当前动画时间 % 760) / 760
  const 脉冲 = 0.5 - Math.cos(动画相位 * Math.PI * 2) / 2
  const 半径 = Math.max(5, 大小 * (0.42 + 脉冲 * 0.05))
  const 外线宽 = Math.max(3, 大小 * (0.12 + 脉冲 * 0.03))
  const 内线宽 = Math.max(1.5, 外线宽 * 0.35)

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.shadowColor = 'rgba(255, 228, 77, 0.88)'
  ctx.shadowBlur = Math.max(6, 大小 * (0.18 + 脉冲 * 0.1))

  ctx.globalAlpha = 0.96
  ctx.lineWidth = 外线宽 + Math.max(3, 大小 * 0.08)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.98)'
  画圆环(半径)

  ctx.globalAlpha = 1
  ctx.lineWidth = 外线宽
  ctx.strokeStyle = '#ffe44d'
  画圆环(半径)

  ctx.shadowColor = 'transparent'
  ctx.lineWidth = 内线宽
  ctx.strokeStyle = '#ffffff'
  画圆环(Math.max(2, 半径 - 外线宽 * 0.95))

  画选中倒计时()
  ctx.restore()

  function 画圆环(半径) {
    ctx.beginPath()
    ctx.arc(中心x, 中心y, 半径, 0, Math.PI * 2)
    ctx.stroke()
  }

  function 画选中倒计时() {
    const 倒计时 = 取得大回合倒计时(状态.当前回合)
    if (!Number.isInteger(倒计时)) return

    const 文本 = String(倒计时)
    const 徽标高 = Math.max(14, 大小 * 0.34)
    const 字号 = Math.max(10, 徽标高 * 0.68)
    ctx.font = `900 ${字号}px Arial, sans-serif`
    const 徽标宽 = Math.max(徽标高, ctx.measureText(文本).width + 徽标高 * 0.44)
    const x = Math.min(
      中心x + 半径 * 0.45,
      列 * 格宽 + 格宽 - 徽标宽 - Math.max(1, 大小 * 0.04),
    )
    const y = Math.min(
      中心y + 半径 * 0.45,
      行 * 格高 + 格高 - 徽标高 - Math.max(1, 大小 * 0.04),
    )
    const 圆角 = Math.max(3, 徽标高 * 0.22)

    ctx.shadowColor = 'rgba(0, 0, 0, 0.72)'
    ctx.shadowBlur = Math.max(3, 大小 * 0.08)
    ctx.lineWidth = Math.max(1, 大小 * 0.035)
    ctx.fillStyle = 取得倒计时背景色(倒计时)
    ctx.strokeStyle = 取得倒计时边框色(倒计时)
    ctx.beginPath()
    ctx.roundRect(x, y, 徽标宽, 徽标高, 圆角)
    ctx.fill()
    ctx.stroke()

    ctx.shadowColor = 'transparent'
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(文本, x + 徽标宽 / 2, y + 徽标高 / 2 + 徽标高 * 0.03)
  }

  function 取得倒计时背景色(倒计时) {
    if (倒计时 < 5) return 'rgba(206, 23, 23, 0.96)'
    if (倒计时 < 10) return 'rgba(214, 163, 0, 0.94)'
    return 'rgba(16, 18, 22, 0.88)'
  }

  function 取得倒计时边框色(倒计时) {
    if (倒计时 < 5) return 'rgba(255, 182, 182, 0.92)'
    if (倒计时 < 10) return 'rgba(255, 242, 150, 0.9)'
    return 'rgba(255, 255, 255, 0.72)'
  }
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 功能恢复, socket功能, 覆盖层功能 })
