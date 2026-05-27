// 功能目的:
// 记住已进入视野的塔位置，并持续更新每座塔当前属于中立、我方还是敌方。
//
// 实现原理:
// 优先使用数据包里的 cities/cities_diff 维护塔位置列表，并在每次更新时复用已知塔位置重读可见归属。
// 当塔离开视野时沿用最后一次可见归属，让覆盖层和排行榜塔数统计共享同一份塔归属记忆。
//
// 作用范围:
// 从 game_start/game_update 数据包中读取 cities/towers 信息，写入全局塔集合和塔类型表。
// 覆盖层会根据这些记忆继续标出离开视野后的塔，帮助 1v1 中判断据点和威胁位置。
import {
  读取地图兵力,
  读取可见地块归属,
  读取可见地块兵力,
  读取玩家信息,
  取得本次塔列表,
  尝试从地图读取尺寸,
  是我方或队友,
} from '../游戏.js'
import { 取得周期增长次数, 读取当前回合 } from '../游戏工具.js'
import { 中立黄色, 旋转框动画毫秒 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import { 状态 } from '../状态.js'
import { 画兵力文本, 画旋转框 } from '../覆盖层工具.js'

export const 功能定义 = {
  id: '塔记忆标记',
  名称: '塔记忆标记',
  分类: '地图覆盖',
  描述: '持续标记中立塔、我方塔和敌方塔',
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭后需要清空覆盖层: true,
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置() {
    状态.塔列表 = null
    状态.已知塔集合.clear()
    状态.已知塔类型.clear()
    状态.中立塔兵力表.clear()
    状态.中立塔开塔成本表.clear()
    状态.我方开塔增长表.clear()
  },
  game_start({ 数据包, 请求渲染 }) {
    处理塔位置(数据包 ?? {}, 请求渲染)
  },
  game_update({ 数据包, 请求渲染 }) {
    处理塔位置(数据包 ?? {}, 请求渲染)
  },
}

export const 覆盖层功能 = {
  id: 功能定义.id,
  需要绘制() {
    return 状态.已知塔集合.size > 0
  },
  需要连续动画() {
    for (const 塔索引 of 状态.已知塔集合) {
      const 类型 = 状态.已知塔类型.get(塔索引)
      if (类型 === '敌方塔' || 类型 === '我方塔') return true
    }
    return false
  },
  绘制: 画塔记忆,
}

export function 处理塔位置(数据包, 请求渲染) {
  if (!功能已启用('塔记忆标记')) {
    请求渲染()
    return
  }
  读取玩家信息(数据包)
  尝试从地图读取尺寸(数据包)

  const 塔信息 = 取得本次塔列表(数据包)
  const 本次塔列表 = Array.isArray(塔信息?.塔列表)
    ? 塔信息.塔列表
    : Array.isArray(状态.塔列表)
      ? 状态.塔列表
      : null

  if (!Array.isArray(本次塔列表)) {
    请求渲染()
    return
  }

  状态.塔列表 = 本次塔列表.slice()

  for (const 塔索引 of 状态.塔列表) {
    if (!Number.isInteger(塔索引) || 塔索引 < 0) continue
    状态.已知障碍物集合.delete(塔索引)
    if (!状态.已知塔集合.has(塔索引)) {
      状态.已知塔集合.add(塔索引)
      状态.已知塔类型.set(塔索引, '中立塔')
    }
    更新塔类型(数据包, 塔索引)
  }

  请求渲染()
}

function 画塔记忆({ ctx, 格宽, 格高, 大小, 当前动画时间 }) {
  状态.已知塔集合.forEach((塔索引) => {
    const 行 = Math.floor(塔索引 / 状态.宽度)
    const 列 = 塔索引 % 状态.宽度
    const 类型 = 状态.已知塔类型.get(塔索引)
    const x = 列 * 格宽
    const y = 行 * 格高

    画塔标记(ctx, x, y, 大小, 类型, 当前动画时间)
    if (类型 === '中立塔') {
      画中立塔兵力(ctx, 塔索引, x, y, 大小)
    } else if (类型 === '我方塔') {
      画我方塔兵力(ctx, 塔索引, x, y, 大小)
      画我方开塔增长(ctx, 塔索引, x, y, 大小)
    }
  })
}

function 画塔标记(ctx, x, y, 大小, 类型, 当前动画时间) {
  const 是敌方塔 = 类型 === '敌方塔'
  const 是我方塔 = 类型 === '我方塔'
  const 是已占领塔 = 是敌方塔 || 是我方塔
  const 外线宽 = Math.max(2, 大小 * 0.09)
  const 内线宽 = Math.max(1.5, 大小 * (是敌方塔 ? 0.065 : 0.05))
  const 外偏移 = 外线宽 / 2 + 1
  const 内偏移 = 外偏移 + 外线宽 / 2 + 内线宽 / 2
  const 主色 = 是敌方塔 ? '#ff1010' : 是我方塔 ? '#00a8ff' : 中立黄色

  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  if (是我方塔) {
    画我方塔背景()
  }

  if (是已占领塔) {
    画旋转框(ctx, x, y, 大小, 当前动画时间, 旋转框动画毫秒, '#ffffff')
  }

  ctx.lineWidth = 外线宽
  ctx.strokeStyle = 主色
  ctx.strokeRect(
    x + 外偏移,
    y + 外偏移,
    Math.max(1, 大小 - 外偏移 * 2),
    Math.max(1, 大小 - 外偏移 * 2),
  )

  ctx.lineWidth = 内线宽
  ctx.strokeStyle = 主色
  ctx.strokeRect(
    x + 内偏移,
    y + 内偏移,
    Math.max(1, 大小 - 内偏移 * 2),
    Math.max(1, 大小 - 内偏移 * 2),
  )

  if (是已占领塔) {
    const 角长 = Math.max(5, 大小 * 0.24)
    const 角偏移 = Math.max(3, 大小 * 0.12)
    ctx.globalAlpha = 1
    ctx.lineWidth = Math.max(2, 大小 * 0.055)
    ctx.strokeStyle = 主色
    ctx.beginPath()
    ctx.moveTo(x + 角偏移, y + 角偏移 + 角长)
    ctx.lineTo(x + 角偏移, y + 角偏移)
    ctx.lineTo(x + 角偏移 + 角长, y + 角偏移)
    ctx.moveTo(x + 大小 - 角偏移 - 角长, y + 角偏移)
    ctx.lineTo(x + 大小 - 角偏移, y + 角偏移)
    ctx.lineTo(x + 大小 - 角偏移, y + 角偏移 + 角长)
    ctx.moveTo(x + 大小 - 角偏移, y + 大小 - 角偏移 - 角长)
    ctx.lineTo(x + 大小 - 角偏移, y + 大小 - 角偏移)
    ctx.lineTo(x + 大小 - 角偏移 - 角长, y + 大小 - 角偏移)
    ctx.moveTo(x + 角偏移 + 角长, y + 大小 - 角偏移)
    ctx.lineTo(x + 角偏移, y + 大小 - 角偏移)
    ctx.lineTo(x + 角偏移, y + 大小 - 角偏移 - 角长)
    ctx.stroke()
  }

  ctx.restore()

  function 画我方塔背景() {
    const 边距 = Math.max(1, 大小 * 0.025)
    ctx.fillStyle = 'rgba(0, 42, 112, 0.58)'
    ctx.fillRect(
      x + 边距,
      y + 边距,
      Math.max(1, 大小 - 边距 * 2),
      Math.max(1, 大小 - 边距 * 2),
    )
  }
}

function 画中立塔兵力(ctx, 塔索引, x, y, 大小) {
  const 兵力 = 状态.中立塔兵力表.get(塔索引)
  if (!Number.isInteger(兵力) || 兵力 < 0) return

  画兵力文本(ctx, x, y, 大小, String(兵力), '#ffffff')
}

function 画我方塔兵力(ctx, 塔索引, x, y, 大小) {
  const 兵力 = 取得可见地块兵力(塔索引)
  if (!Number.isInteger(兵力) || 兵力 < 0) return

  画兵力文本(ctx, x, y, 大小, String(兵力), '#ffffff')
}

function 画我方开塔增长(ctx, 塔索引, x, y, 大小) {
  const 增长 = 取得我方开塔增长(塔索引)
  if (!Number.isInteger(增长)) return

  const 文本 = 增长 > 0 ? `+${增长}` : String(增长)
  const 字号 = Math.max(9, Math.min(16, 大小 * 0.36))
  const 边距 = Math.max(3, 大小 * 0.1)
  const 文本x = x + 大小 - 边距
  const 文本y = y + 大小 - 边距

  ctx.save()
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.lineJoin = 'round'
  ctx.font = `900 ${字号}px Arial, sans-serif`
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.92)'
  ctx.lineWidth = Math.max(2, 大小 * 0.08)
  ctx.fillStyle = 增长 < 0 ? '#ffe26a' : 增长 > 0 ? '#76ff96' : '#ffffff'
  ctx.strokeText(文本, 文本x, 文本y)
  ctx.fillText(文本, 文本x, 文本y)
  ctx.restore()
}

function 取得可见地块兵力(索引) {
  return 读取地图兵力(状态.地图数组, 索引)
}

function 取得我方开塔增长(塔索引) {
  const 记忆 = 状态.我方开塔增长表.get(塔索引)
  if (!记忆 || !Number.isInteger(记忆.开塔耗兵) || 记忆.开塔耗兵 < 0) {
    return null
  }

  const 当前回合 = 状态.当前回合
  const 记录回合 = Number.isInteger(记忆.回合) ? 记忆.回合 : 当前回合
  if (!Number.isInteger(当前回合) || !Number.isInteger(记录回合)) {
    return -记忆.开塔耗兵
  }

  const 回合差 = 当前回合 - 记录回合
  if (回合差 <= 0) return -记忆.开塔耗兵

  const 塔自然增长 = 取得周期增长次数(记录回合, 当前回合, 2)
  const 大回合额外增长 = 取得周期增长次数(记录回合, 当前回合, 50)

  return -记忆.开塔耗兵 + 塔自然增长 + 大回合额外增长
}

export function 更新塔类型(数据包, 塔索引) {
  if (!功能已启用('塔记忆标记')) return
  if (!Number.isInteger(塔索引) || 塔索引 < 0) return
  if (!状态.已知塔类型.has(塔索引)) {
    状态.已知塔类型.set(塔索引, '中立塔')
  }

  const 地块归属 = 读取可见地块归属(数据包, 塔索引)
  let 可见类型 = null
  const 旧类型 = 状态.已知塔类型.get(塔索引)
  if (地块归属 != null && 地块归属 < -1 && 旧类型 === '我方塔') {
    可见类型 = '敌方塔'
    状态.已知塔类型.set(塔索引, 可见类型)
  } else if (地块归属 != null && 地块归属 >= -1) {
    可见类型 =
      地块归属 < 0 ? '中立塔' : 是我方或队友(地块归属) ? '我方塔' : '敌方塔'
    if (旧类型 !== 可见类型) {
      状态.已知塔类型.set(塔索引, 可见类型)
    }
  }
  if (可见类型) {
    更新我方开塔增长(旧类型, 可见类型)
    更新敌方开塔确认(旧类型, 可见类型)
  }

  更新中立塔兵力()

  function 更新我方开塔增长(旧类型, 可见类型) {
    if (旧类型 === '中立塔' && 可见类型 === '我方塔') {
      const 开塔耗兵 =
        状态.中立塔开塔成本表.get(塔索引) ?? 状态.中立塔兵力表.get(塔索引)
      if (!Number.isInteger(开塔耗兵) || 开塔耗兵 < 0) return
      状态.我方开塔增长表.set(塔索引, {
        开塔耗兵,
        回合: 读取当前回合(数据包),
      })
      状态.中立塔开塔成本表.delete(塔索引)
    } else if (可见类型 === '敌方塔') {
      状态.中立塔开塔成本表.delete(塔索引)
    }
  }

  function 更新敌方开塔确认(旧类型, 可见类型) {
    if (旧类型 === '中立塔' && 可见类型 === '敌方塔') {
      状态.敌方开塔确认集合.add(塔索引)
      状态.敌方推断开塔数 = Math.max(
        状态.敌方推断开塔数,
        状态.敌方开塔确认集合.size,
      )
    }
  }

  function 更新中立塔兵力() {
    if (可见类型 === '我方塔' || 可见类型 === '敌方塔') {
      状态.中立塔兵力表.delete(塔索引)
      return
    }

    const 是中立兵力更新 =
      地块归属 == null && 状态.已知塔类型.get(塔索引) === '中立塔'
    if (可见类型 !== '中立塔' && !是中立兵力更新) return

    const 兵力 = 读取可见地块兵力(数据包, 塔索引)
    if (!Number.isInteger(兵力) || 兵力 < 0) return

    状态.中立塔兵力表.set(塔索引, 兵力)
    const 已记成本 = 状态.中立塔开塔成本表.get(塔索引)
    if (兵力 > 0 && (!Number.isInteger(已记成本) || 兵力 > 已记成本)) {
      状态.中立塔开塔成本表.set(塔索引, 兵力)
    }
  }
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 功能恢复, socket功能, 覆盖层功能 })
