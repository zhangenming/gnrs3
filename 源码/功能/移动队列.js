// 功能目的:
// 记录玩家通过 socket 发出的移动、撤销和清空操作，用来在地图覆盖层上显示当前行动路线。
//
// 作用范围:
// 只维护本地移动队列，不拦截或改变真实出兵请求。
// 队列变化后会重算兵力分布着色，避免把已经规划为路径的地块继续标成可调用兵力。
import { 状态 } from '../状态.js'
import { 更新地图缓存和兵力分布 } from '../地图状态.js'
import { 是我方或队友, 读取地图地块 } from '../游戏.js'

export const 功能定义 = {
  id: '移动队列轨迹',
  名称: '移动队列轨迹',
  分类: '地图覆盖',
  描述: '把当前排队中的我方移动轨迹画在地图上',
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭后需要清空覆盖层: true,
}

export const socket功能 = {
  id: 功能定义.id,
  出站({ 事件名, 参数, 请求渲染 }) {
    if (事件名 === 'attack') {
      记录移动操作(参数[0], 参数[1], 参数[2], 参数[3], 请求渲染)
    } else if (事件名 === 'undo_move') {
      撤销移动操作(请求渲染)
    } else if (事件名 === 'clear_moves') {
      清空移动队列('clear_moves', 请求渲染)
    }
  },
  game_update前(上下文) {
    上下文.已处理我方移动列表 = 按攻击序号清理移动队列(
      上下文.数据包?.attackIndex,
      上下文.请求渲染,
    )
  },
  新局重置({ 请求渲染 }) {
    清空移动队列('新局重置', 请求渲染)
  },
}

export const 覆盖层功能 = {
  id: 功能定义.id,
  需要绘制() {
    return 状态.移动队列.length > 0
  },
  绘制: 画操作轨迹,
}

export function 记录移动操作(起点, 终点, 是否半兵, 攻击序号, 请求渲染) {
  if (
    !Number.isInteger(起点) ||
    !Number.isInteger(终点) ||
    起点 < 0 ||
    终点 < 0
  ) {
    return
  }

  const 移动 = {
    起点,
    终点,
    起点兵力: 读取移动起点兵力(),
    是否半兵: Boolean(是否半兵),
    攻击序号: Number.isInteger(攻击序号) ? 攻击序号 : null,
    记录时间: Date.now(),
  }
  状态.移动队列.push(移动)
  if (状态.移动队列.length > 200) 状态.移动队列.shift()
  重算兵力分布着色('记录移动操作')
  请求渲染()

  function 读取移动起点兵力() {
    const 起点地块 = 读取地图地块(状态.地图数组, 起点)
    if (!是我方或队友(起点地块?.归属)) return null
    return Number.isInteger(起点地块.兵力) ? 起点地块.兵力 : null
  }
}

export function 撤销移动操作(请求渲染) {
  状态.移动队列.pop()
  重算兵力分布着色('撤销移动操作')
  请求渲染()
}

export function 按攻击序号清理移动队列(攻击序号, 请求渲染) {
  if (!Number.isInteger(攻击序号)) return []
  const 原长度 = 状态.移动队列.length
  if (!原长度) return []

  const 已处理移动列表 = []
  状态.移动队列 = 状态.移动队列.filter((移动) => {
    const 已处理 = Number.isInteger(移动.攻击序号) && 移动.攻击序号 <= 攻击序号
    if (已处理) 已处理移动列表.push(移动)
    return !已处理
  })

  if (状态.移动队列.length !== 原长度) {
    重算兵力分布着色('按攻击序号清理移动队列')
    请求渲染()
  }
  return 已处理移动列表
}

export function 清空移动队列(来源, 请求渲染) {
  const 原长度 = 状态.移动队列.length
  状态.移动队列 = []
  if (原长度) 重算兵力分布着色(`清空移动队列:${来源 ?? '未知'}`)
  请求渲染()
}

function 重算兵力分布着色(来源事件) {
  if (!Array.isArray(状态.地图数组)) return
  更新地图缓存和兵力分布({ map: 状态.地图数组 }, 来源事件)
}

function 画操作轨迹({ ctx, 格宽, 格高, 大小 }) {
  if (!状态.移动队列.length) return

  const 格子数 = 状态.宽度 * 状态.高度
  const 可绘制移动 = 状态.移动队列.filter((移动) => {
    return (
      Number.isInteger(移动.起点) &&
      Number.isInteger(移动.终点) &&
      移动.起点 >= 0 &&
      移动.终点 >= 0 &&
      移动.起点 < 格子数 &&
      移动.终点 < 格子数
    )
  })
  if (!可绘制移动.length) return

  const 线宽 = Math.max(1.5, Math.min(3, 大小 * 0.07))
  ctx.save()
  ctx.globalAlpha = 0.78
  可绘制移动.forEach((移动, 下标) => {
    const 起点 = 取得格子中心(移动.起点, 格宽, 格高)
    const 终点 = 取得格子中心(移动.终点, 格宽, 格高)
    ctx.globalAlpha = 下标 === 可绘制移动.length - 1 ? 0.9 : 0.45
    画箭头线(ctx, 起点, 终点, 线宽, 移动.是否半兵)
  })
  ctx.restore()

  画当前移动位置(ctx, 可绘制移动[0].起点, 格宽, 格高, 大小)
}

function 取得格子中心(格子索引, 格宽, 格高) {
  const 行 = Math.floor(格子索引 / 状态.宽度)
  const 列 = 格子索引 % 状态.宽度
  return {
    x: 列 * 格宽 + 格宽 / 2,
    y: 行 * 格高 + 格高 / 2,
  }
}

function 画箭头线(ctx, 起点, 终点, 线宽, 半兵) {
  const dx = 终点.x - 起点.x
  const dy = 终点.y - 起点.y
  const 距离 = Math.hypot(dx, dy)
  if (!Number.isFinite(距离) || 距离 < 1) return

  const 缩进 = Math.max(4, 线宽 * 2.2)
  const 起x = 起点.x + (dx / 距离) * 缩进
  const 起y = 起点.y + (dy / 距离) * 缩进
  const 终x = 终点.x - (dx / 距离) * 缩进
  const 终y = 终点.y - (dy / 距离) * 缩进
  const 角度 = Math.atan2(终y - 起y, 终x - 起x)
  const 箭头长 = Math.max(5, Math.min(10, 线宽 * 3.1))
  const 箭头角 = Math.PI / 6

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.globalAlpha = 0.62
  ctx.lineWidth = 线宽 + Math.max(1.5, 线宽 * 0.75)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)'
  ctx.setLineDash(
    半兵 ? [Math.max(4, 线宽 * 2.2), Math.max(3, 线宽 * 1.4)] : [],
  )
  ctx.beginPath()
  ctx.moveTo(起x, 起y)
  ctx.lineTo(终x, 终y)
  ctx.stroke()

  ctx.globalAlpha = 0.78
  ctx.lineWidth = 线宽
  ctx.strokeStyle = 半兵 ? '#d7fbff' : '#25f1ff'
  ctx.beginPath()
  ctx.moveTo(起x, 起y)
  ctx.lineTo(终x, 终y)
  ctx.stroke()

  ctx.setLineDash([])
  ctx.globalAlpha = 0.68
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.76)'
  ctx.lineWidth = 线宽 + Math.max(1.5, 线宽 * 0.6)
  ctx.beginPath()
  ctx.moveTo(终x, 终y)
  ctx.lineTo(
    终x - 箭头长 * Math.cos(角度 - 箭头角),
    终y - 箭头长 * Math.sin(角度 - 箭头角),
  )
  ctx.moveTo(终x, 终y)
  ctx.lineTo(
    终x - 箭头长 * Math.cos(角度 + 箭头角),
    终y - 箭头长 * Math.sin(角度 + 箭头角),
  )
  ctx.stroke()

  ctx.globalAlpha = 0.95
  ctx.strokeStyle = 半兵 ? '#d7fbff' : '#25f1ff'
  ctx.lineWidth = 线宽
  ctx.beginPath()
  ctx.moveTo(终x, 终y)
  ctx.lineTo(
    终x - 箭头长 * Math.cos(角度 - 箭头角),
    终y - 箭头长 * Math.sin(角度 - 箭头角),
  )
  ctx.moveTo(终x, 终y)
  ctx.lineTo(
    终x - 箭头长 * Math.cos(角度 + 箭头角),
    终y - 箭头长 * Math.sin(角度 + 箭头角),
  )
  ctx.stroke()

  if (半兵) {
    ctx.globalAlpha = 0.85
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)'
    ctx.lineWidth = Math.max(1, 线宽 * 0.45)
    ctx.beginPath()
    ctx.arc(
      (起x + 终x) / 2,
      (起y + 终y) / 2,
      Math.max(2, 线宽 * 0.75),
      0,
      Math.PI * 2,
    )
    ctx.stroke()
    ctx.fill()
  }

  ctx.restore()
}

function 画当前移动位置(ctx, 格子索引, 格宽, 格高, 大小) {
  const 行 = Math.floor(格子索引 / 状态.宽度)
  const 列 = 格子索引 % 状态.宽度
  const x = 列 * 格宽
  const y = 行 * 格高
  const 方形边长 = Math.max(4, 大小 * 0.76)
  const 方形x = x + (格宽 - 方形边长) / 2
  const 方形y = y + (格高 - 方形边长) / 2
  const 外线宽 = Math.max(2, 大小 * 0.08)
  const 内线宽 = Math.max(1.2, 大小 * 0.035)

  ctx.save()
  ctx.lineCap = 'square'
  ctx.lineJoin = 'miter'

  ctx.globalAlpha = 0.72
  ctx.lineWidth = 外线宽
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)'
  ctx.strokeRect(方形x, 方形y, 方形边长, 方形边长)

  ctx.globalAlpha = 0.9
  ctx.lineWidth = 内线宽
  ctx.strokeStyle = '#25f1ff'
  ctx.strokeRect(方形x, 方形y, 方形边长, 方形边长)

  ctx.restore()
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 功能恢复, socket功能, 覆盖层功能 })
