// 功能目的:
// 根据可见地图前后状态推断敌方刚发生的相邻移动，并保留一个小回合用于覆盖层高亮。
//
// 作用范围:
// 只记录可见范围内能从地图变化确认的敌方移动，不猜测迷雾外路径。
import { 敌方移动高亮持续turn数 } from '../配置.js'
import { 地图可读, 是我方或队友, 读取地图地块 } from '../游戏.js'
import { 功能已启用 } from '../功能状态.js'
import { 状态 } from '../状态.js'

export const 功能定义 = {
  id: '敌方移动高亮',
  名称: '敌方移动高亮',
  分类: '地图覆盖',
  描述: '按可见地图变化高亮敌方刚走过的路径',
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭() {
    状态.敌方移动高亮列表 = []
    清理敌方移动高亮()
  },
  关闭后需要清空覆盖层: true,
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置() {
    状态.敌方移动高亮列表 = []
  },
}

export const 地图更新功能 = {
  id: 功能定义.id,
  地图更新({ 旧地图数组, 新地图数组, 数据包 }) {
    更新敌方移动高亮(旧地图数组, 新地图数组, 数据包)
  },
}

export const 覆盖层功能 = {
  id: 功能定义.id,
  渲染前: 清理敌方移动高亮,
  需要绘制() {
    return 状态.敌方移动高亮列表.length > 0
  },
  需要连续动画() {
    return 状态.敌方移动高亮列表.length > 0
  },
  绘制: 画敌方移动高亮,
}

export function 更新敌方移动高亮(旧地图数组, 新地图数组, 数据包) {
  if (!功能已启用('敌方移动高亮')) {
    状态.敌方移动高亮列表 = []
    return
  }
  清理敌方移动高亮()
  if (!地图可读(旧地图数组) || !地图可读(新地图数组)) return

  const 格子数 = 状态.宽度 * 状态.高度

  const 当前回合 = Number.isInteger(数据包?.turn) ? 数据包.turn : 状态.当前回合
  const 新移动列表 = 取得敌方移动列表()
  if (!新移动列表.length) return

  const 已有移动集合 = new Set(
    状态.敌方移动高亮列表.map((移动) => {
      return `${移动.起点}:${移动.终点}:${移动.回合}`
    }),
  )
  for (const 移动 of 新移动列表) {
    const 键 = `${移动.起点}:${移动.终点}:${移动.回合}`
    if (已有移动集合.has(键)) continue
    状态.敌方移动高亮列表.push(移动)
    已有移动集合.add(键)
  }
  if (状态.敌方移动高亮列表.length > 80) {
    状态.敌方移动高亮列表 = 状态.敌方移动高亮列表.slice(-80)
  }

  function 取得敌方移动列表() {
    const 来源列表 = []
    const 目的列表 = []

    for (let idx = 0; idx < 格子数; idx += 1) {
      const 旧地块 = 读取地图地块(旧地图数组, idx)
      const 新地块 = 读取地图地块(新地图数组, idx)
      const 旧兵力 = 旧地块?.兵力
      const 新兵力 = 新地块?.兵力
      const 旧归属 = 旧地块?.归属
      const 新归属 = 新地块?.归属
      const 旧是敌方 = 是敌方格(旧归属)
      const 新是敌方 = 是敌方格(新归属)

      if (
        旧是敌方 &&
        新是敌方 &&
        Number.isInteger(旧兵力) &&
        Number.isInteger(新兵力) &&
        旧兵力 > 1 &&
        旧兵力 > 新兵力
      ) {
        来源列表.push({
          索引: idx,
          兵力减少: 旧兵力 - 新兵力,
        })
      }

      if (
        ((新是敌方 && (新兵力 > 旧兵力 || !旧是敌方)) ||
          (!新是敌方 &&
            !旧是敌方 &&
            Number.isInteger(旧兵力) &&
            旧兵力 > 新兵力)) &&
        Number.isInteger(新兵力) &&
        Number.isInteger(旧兵力)
      ) {
        目的列表.push({
          索引: idx,
          兵力变化: Math.abs(新兵力 - 旧兵力),
          旧是敌方,
        })
      }
    }

    const 已用来源集合 = new Set()
    const 移动列表 = []
    for (const 目的 of 目的列表) {
      const 来源 = 取得最佳来源(目的)
      if (!来源) continue
      已用来源集合.add(来源.索引)
      移动列表.push({
        起点: 来源.索引,
        终点: 目的.索引,
        回合: 当前回合,
        记录时间: performance.now(),
      })
    }
    return 移动列表

    function 取得最佳来源(目的) {
      let 最佳来源 = null
      let 最佳差距 = Infinity
      for (const 来源 of 来源列表) {
        if (已用来源集合.has(来源.索引)) continue
        if (!是相邻格(来源.索引, 目的.索引)) continue

        const 兵力变化 = 目的.旧是敌方
          ? Math.max(1, 目的.兵力变化)
          : Math.max(1, 目的.兵力变化, 来源.兵力减少)
        const 差距 = Math.abs(来源.兵力减少 - 兵力变化)
        if (差距 < 最佳差距) {
          最佳来源 = 来源
          最佳差距 = 差距
        }
      }
      return 最佳来源
    }
  }

  function 是敌方格(归属) {
    return Number.isInteger(归属) && 归属 >= 0 && !是我方或队友(归属)
  }

  function 是相邻格(左索引, 右索引) {
    const 左行 = Math.floor(左索引 / 状态.宽度)
    const 右行 = Math.floor(右索引 / 状态.宽度)
    const 左列 = 左索引 % 状态.宽度
    const 右列 = 右索引 % 状态.宽度
    return Math.abs(左行 - 右行) + Math.abs(左列 - 右列) === 1
  }
}

function 画敌方移动高亮({ ctx, 格宽, 格高, 大小, 当前动画时间 }) {
  if (!状态.敌方移动高亮列表.length) return

  const 格子数 = 状态.宽度 * 状态.高度
  const 可绘制移动 = 状态.敌方移动高亮列表.filter((移动) => {
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

  const 动画相位 = (当前动画时间 % 900) / 900
  const 脉冲 = 0.5 - Math.cos(动画相位 * Math.PI * 2) / 2
  const 线宽 = Math.max(2, Math.min(5, 大小 * (0.08 + 脉冲 * 0.05)))

  ctx.save()
  可绘制移动.forEach((移动) => {
    const 起点 = 取得格子中心(移动.起点, 格宽, 格高)
    const 终点 = 取得格子中心(移动.终点, 格宽, 格高)
    画敌方移动箭头(ctx, 起点, 终点, 线宽, 脉冲)
    画敌方移动终点(ctx, 移动.终点, 格宽, 格高, 大小, 脉冲)
  })
  ctx.restore()
}

function 取得格子中心(格子索引, 格宽, 格高) {
  const 行 = Math.floor(格子索引 / 状态.宽度)
  const 列 = 格子索引 % 状态.宽度
  return {
    x: 列 * 格宽 + 格宽 / 2,
    y: 行 * 格高 + 格高 / 2,
  }
}

function 画敌方移动箭头(ctx, 起点, 终点, 线宽, 脉冲) {
  const dx = 终点.x - 起点.x
  const dy = 终点.y - 起点.y
  const 距离 = Math.hypot(dx, dy)
  if (!Number.isFinite(距离) || 距离 < 1) return

  const 缩进 = Math.max(4, 线宽 * 2.1)
  const 起x = 起点.x + (dx / 距离) * 缩进
  const 起y = 起点.y + (dy / 距离) * 缩进
  const 终x = 终点.x - (dx / 距离) * 缩进
  const 终y = 终点.y - (dy / 距离) * 缩进
  const 角度 = Math.atan2(终y - 起y, 终x - 起x)
  const 箭头长 = Math.max(7, Math.min(14, 线宽 * 3.2))
  const 箭头角 = Math.PI / 6

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.globalAlpha = 0.68 + 脉冲 * 0.22
  ctx.lineWidth = 线宽 + Math.max(2, 线宽 * 0.85)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.82)'
  ctx.beginPath()
  ctx.moveTo(起x, 起y)
  ctx.lineTo(终x, 终y)
  ctx.stroke()

  ctx.globalAlpha = 0.86
  ctx.lineWidth = 线宽
  ctx.strokeStyle = '#ff0000'
  ctx.beginPath()
  ctx.moveTo(起x, 起y)
  ctx.lineTo(终x, 终y)
  ctx.stroke()

  ctx.globalAlpha = 0.82
  ctx.lineWidth = Math.max(1.5, 线宽 * 0.45)
  ctx.strokeStyle = '#fff0f0'
  ctx.beginPath()
  ctx.moveTo(起x, 起y)
  ctx.lineTo(终x, 终y)
  ctx.stroke()

  ctx.globalAlpha = 0.78
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.82)'
  ctx.lineWidth = 线宽 + Math.max(2, 线宽 * 0.7)
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
  ctx.strokeStyle = '#ff3838'
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
  ctx.restore()
}

function 画敌方移动终点(ctx, 格子索引, 格宽, 格高, 大小, 脉冲) {
  const 行 = Math.floor(格子索引 / 状态.宽度)
  const 列 = 格子索引 % 状态.宽度
  const x = 列 * 格宽
  const y = 行 * 格高
  const 外线宽 = Math.max(2, 大小 * (0.08 + 脉冲 * 0.06))
  const 内缩 = Math.max(3, 大小 * (0.12 - 脉冲 * 0.03))

  ctx.save()
  ctx.lineJoin = 'round'
  ctx.globalAlpha = 0.36 + 脉冲 * 0.18
  ctx.fillStyle = 'rgba(255, 0, 0, 0.32)'
  ctx.fillRect(x + 1, y + 1, Math.max(1, 格宽 - 2), Math.max(1, 格高 - 2))

  ctx.globalAlpha = 0.9
  ctx.lineWidth = 外线宽
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'
  ctx.strokeRect(
    x + 内缩,
    y + 内缩,
    Math.max(1, 格宽 - 内缩 * 2),
    Math.max(1, 格高 - 内缩 * 2),
  )

  ctx.lineWidth = Math.max(1.5, 外线宽 * 0.5)
  ctx.strokeStyle = '#ff3838'
  ctx.strokeRect(
    x + 内缩,
    y + 内缩,
    Math.max(1, 格宽 - 内缩 * 2),
    Math.max(1, 格高 - 内缩 * 2),
  )
  ctx.restore()
}

export function 清理敌方移动高亮() {
  if (!功能已启用('敌方移动高亮')) {
    状态.敌方移动高亮列表 = []
    return
  }
  const 当前回合 = 状态.当前回合
  if (!Number.isInteger(当前回合)) return
  const 原长度 = 状态.敌方移动高亮列表.length
  if (!原长度) return

  状态.敌方移动高亮列表 = 状态.敌方移动高亮列表.filter((移动) => {
    if (!Number.isInteger(移动.回合)) return true
    return 当前回合 - 移动.回合 < 敌方移动高亮持续turn数
  })
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 功能恢复, socket功能, 覆盖层功能, 地图更新功能 })
