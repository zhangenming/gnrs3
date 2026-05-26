// 功能目的:
// 从 game_start/game_update 数据包中记录双方基地位置，尤其是敌方基地首次进入视野时的位置。
//
// 作用范围:
// 负责把 generals 字段同步进全局状态，区分我方/队友与敌方基地。
// 这些记忆会被覆盖层渲染、调试接口和基地危险判断复用，帮助 1v1 中持续追踪敌方核心目标。
import {
  读取玩家信息,
  尝试从地图读取尺寸,
  是我方或队友,
  读取地图兵力,
} from '../游戏.js'
import { 取得周期增长次数, 读取当前回合 } from '../游戏工具.js'
import { 旋转框动画毫秒 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import { 状态 } from '../状态.js'
import { 画兵力文本, 画旋转框 } from '../覆盖层工具.js'

export const 功能定义 = {
  id: '基地记忆标记',
  名称: '基地记忆标记',
  分类: '地图覆盖',
  描述: '持续标记我方基地和已发现的敌方基地',
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭后需要清空覆盖层: true,
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置() {
    状态.已知基地集合.clear()
    状态.已知敌方基地集合.clear()
    状态.基地兵力表.clear()
    状态.我方基地索引 = null
  },
  game_start({ 数据包, 请求渲染 }) {
    处理基地位置(数据包 ?? {}, 请求渲染)
  },
  game_update({ 数据包, 请求渲染 }) {
    处理基地位置(数据包 ?? {}, 请求渲染)
  },
}

export const 覆盖层功能 = {
  id: 功能定义.id,
  需要绘制() {
    return 状态.已知敌方基地集合.size > 0 || Number.isInteger(状态.我方基地索引)
  },
  需要连续动画() {
    return (
      状态.已知敌方基地集合.size > 0 ||
      (Number.isInteger(状态.我方基地索引) && 状态.我方基地索引 >= 0)
    )
  },
  绘制: 画基地记忆,
}

export function 处理基地位置(数据包, 请求渲染) {
  if (!功能已启用('基地记忆标记')) {
    请求渲染()
    return
  }
  读取玩家信息(数据包)
  尝试从地图读取尺寸(数据包)

  const 基地列表 = Array.isArray(数据包?.generals) ? 数据包.generals : null

  if (!基地列表) {
    请求渲染()
    return
  }

  if (!Number.isInteger(状态.我方索引)) {
    请求渲染()
    return
  }

  for (let 玩家索引 = 0; 玩家索引 < 基地列表.length; 玩家索引 += 1) {
    const 基地索引 = 基地列表[玩家索引]
    if (!Number.isInteger(基地索引) || 基地索引 < 0) continue
    状态.已知基地集合.add(基地索引)
    更新基地兵力记忆(基地索引, 数据包)
    if (是我方或队友(玩家索引)) {
      if (玩家索引 === 状态.我方索引) 状态.我方基地索引 = 基地索引
      continue
    }
    if (!状态.已知敌方基地集合.has(基地索引)) {
      状态.已知敌方基地集合.set(基地索引, {
        索引: 基地索引,
        玩家索引,
        首次回合: 数据包?.turn == null ? null : 数据包.turn,
      })
    }
  }

  请求渲染()

  function 更新基地兵力记忆(基地索引, 数据包) {
    const 兵力 = 读取地图兵力(状态.地图数组, 基地索引)
    if (!Number.isInteger(兵力) || 兵力 < 0) return

    状态.基地兵力表.set(基地索引, {
      兵力,
      回合: 读取当前回合(数据包),
    })
  }
}

function 画基地记忆({ ctx, 格宽, 格高, 大小, 当前动画时间 }) {
  状态.已知敌方基地集合.forEach((_基地, 基地索引) => {
    const 行 = Math.floor(基地索引 / 状态.宽度)
    const 列 = 基地索引 % 状态.宽度
    画基地(ctx, 列 * 格宽, 行 * 格高, 大小, 当前动画时间)
    画基地模拟兵力(ctx, 基地索引, 列 * 格宽, 行 * 格高, 大小)
  })

  if (Number.isInteger(状态.我方基地索引) && 状态.我方基地索引 >= 0) {
    const 行 = Math.floor(状态.我方基地索引 / 状态.宽度)
    const 列 = 状态.我方基地索引 % 状态.宽度
    画基地(ctx, 列 * 格宽, 行 * 格高, 大小, 当前动画时间)
    画基地模拟兵力(ctx, 状态.我方基地索引, 列 * 格宽, 行 * 格高, 大小)
  }
}

function 画基地(ctx, x, y, 大小, 当前动画时间) {
  const 主色 = '#f6c945'
  const 外边线宽 = Math.max(2, 大小 * 0.07)
  const 外偏移 = Math.max(2, 外边线宽 / 2 + 1)
  const 内偏移 = Math.max(5, 大小 * 0.16)
  const 标记大小 = Math.max(1, 大小 - 外偏移 * 2)
  const 高光大小 = Math.max(1, 大小 - 内偏移 * 2)

  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  画旋转框(ctx, x, y, 大小, 当前动画时间, 旋转框动画毫秒, 主色)

  ctx.globalAlpha = 0.22
  ctx.fillStyle = 主色
  ctx.fillRect(x + 外偏移, y + 外偏移, 标记大小, 标记大小)

  ctx.globalAlpha = 1
  ctx.strokeStyle = '#9a7720'
  ctx.lineWidth = 外边线宽
  ctx.strokeRect(x + 外偏移, y + 外偏移, 标记大小, 标记大小)

  ctx.strokeStyle = 'rgba(255, 241, 181, 0.95)'
  ctx.lineWidth = Math.max(2, 大小 * 0.04)
  ctx.strokeRect(x + 内偏移, y + 内偏移, 高光大小, 高光大小)

  ctx.restore()
}

function 画基地模拟兵力(ctx, 基地索引, x, y, 大小) {
  const 兵力 = 取得模拟基地兵力(基地索引)
  if (!Number.isInteger(兵力) || 兵力 < 0) return
  画兵力文本(ctx, x, y, 大小, String(兵力), '#ffffff')
}

function 取得模拟基地兵力(基地索引) {
  const 记忆 = 状态.基地兵力表.get(基地索引)
  if (!记忆 || !Number.isInteger(记忆.兵力) || 记忆.兵力 < 0) return null

  const 当前回合 = 状态.当前回合
  const 记录回合 = Number.isInteger(记忆.回合) ? 记忆.回合 : 当前回合
  if (!Number.isInteger(当前回合) || !Number.isInteger(记录回合)) {
    return 记忆.兵力
  }

  const 回合差 = 当前回合 - 记录回合
  if (回合差 <= 0) return 记忆.兵力

  const 基地自然增长 = 取得周期增长次数(记录回合, 当前回合, 2)
  const 大回合额外增长 = 取得周期增长次数(记录回合, 当前回合, 50)

  return 记忆.兵力 + 基地自然增长 + 大回合额外增长
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 功能恢复, socket功能, 覆盖层功能 })
