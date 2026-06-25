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
import { 功能已启用 } from '../功能状态.js'
import { 状态 } from '../状态.js'
import { 画兵力文本 } from '../覆盖层工具.js'
import { 自动选中我方基地 } from './选中棋子提示.js'

const 基地边框动画毫秒 = 600

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
    自动选中我方基地(请求渲染)
  },
  game_update({ 数据包, 请求渲染 }) {
    const 原我方基地索引 = 状态.我方基地索引
    处理基地位置(数据包 ?? {}, 请求渲染)
    if (
      !Number.isInteger(原我方基地索引) &&
      Number.isInteger(状态.我方基地索引)
    ) {
      自动选中我方基地(请求渲染)
    }
  },
}

export const 覆盖层功能 = {
  id: 功能定义.id,
  需要绘制() {
    if (是网页回放中()) return false
    return 状态.已知敌方基地集合.size > 0 || Number.isInteger(状态.我方基地索引)
  },
  需要连续动画() {
    if (是网页回放中()) return false
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
    画基地(ctx, 列 * 格宽, 行 * 格高, 大小, 当前动画时间, '敌方')
    画基地模拟兵力(ctx, 基地索引, 列 * 格宽, 行 * 格高, 大小)
  })

  if (Number.isInteger(状态.我方基地索引) && 状态.我方基地索引 >= 0) {
    const 行 = Math.floor(状态.我方基地索引 / 状态.宽度)
    const 列 = 状态.我方基地索引 % 状态.宽度
    画基地(ctx, 列 * 格宽, 行 * 格高, 大小, 当前动画时间, '我方')
    画基地模拟兵力(ctx, 状态.我方基地索引, 列 * 格宽, 行 * 格高, 大小)
  }
}

function 画基地(ctx, x, y, 大小, 当前动画时间, 阵营) {
  const 是敌方 = 阵营 === '敌方'
  const 背景色 = '#2ecc71'
  const 脉冲边框颜色 = '#ffffff'
  const 外边线颜色 = 是敌方 ? '#7f0000' : '#9a7720'
  const 高光颜色 = 是敌方
    ? 'rgba(255, 224, 214, 0.98)'
    : 'rgba(255, 241, 181, 0.95)'
  const 外边线宽 = Math.max(2, 大小 * (是敌方 ? 0.11 : 0.07))
  const 外偏移 = Math.max(2, 外边线宽 / 2 + 1)
  const 内偏移 = Math.max(5, 大小 * (是敌方 ? 0.12 : 0.16))
  const 标记大小 = Math.max(1, 大小 - 外偏移 * 2)
  const 高光大小 = Math.max(1, 大小 - 内偏移 * 2)

  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  画醒目背景()

  画脉冲边框()

  ctx.globalAlpha = 0.78
  ctx.fillStyle = 背景色
  ctx.fillRect(x + 外偏移, y + 外偏移, 标记大小, 标记大小)

  ctx.globalAlpha = 1
  ctx.strokeStyle = 外边线颜色
  ctx.lineWidth = 外边线宽
  ctx.strokeRect(x + 外偏移, y + 外偏移, 标记大小, 标记大小)

  ctx.strokeStyle = 高光颜色
  ctx.lineWidth = Math.max(2, 大小 * (是敌方 ? 0.06 : 0.04))
  ctx.strokeRect(x + 内偏移, y + 内偏移, 高光大小, 高光大小)

  ctx.restore()

  function 画醒目背景() {
    const 背景边距 = 大小 * (是敌方 ? 0.3 : 0.24)
    const 背景大小 = 大小 + 背景边距 * 2
    const 背景x = x - 背景边距
    const 背景y = y - 背景边距

    ctx.globalAlpha = 是敌方 ? 0.48 : 0.4
    ctx.fillStyle = 背景色
    ctx.fillRect(背景x, 背景y, 背景大小, 背景大小)

    ctx.globalAlpha = 0.78
    ctx.strokeStyle = 是敌方
      ? 'rgba(127, 0, 0, 0.86)'
      : 'rgba(255, 242, 178, 0.9)'
    ctx.lineWidth = Math.max(2, 大小 * 0.08)
    ctx.strokeRect(背景x, 背景y, 背景大小, 背景大小)

    ctx.globalAlpha = 1
  }

  function 画脉冲边框() {
    const 进度 = (当前动画时间 % 基地边框动画毫秒) / 基地边框动画毫秒
    const 缩放 = 1 + (1 - Math.cos(进度 * Math.PI * 2)) * (是敌方 ? 0.11 : 0.09)
    const 边框大小 = 大小 * (是敌方 ? 1.08 : 1)
    const 当前大小 = 边框大小 * 缩放
    const 边框x = x + 大小 / 2 - 当前大小 / 2
    const 边框y = y + 大小 / 2 - 当前大小 / 2

    ctx.globalAlpha = 是敌方 ? 0.94 : 0.88
    ctx.strokeStyle = 脉冲边框颜色
    ctx.lineWidth = Math.max(3, 大小 * (是敌方 ? 0.09 : 0.075))
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
    ctx.shadowBlur = Math.max(2, 大小 * 0.08)
    ctx.strokeRect(边框x, 边框y, 当前大小, 当前大小)
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }
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

function 是网页回放中() {
  return Boolean(
    globalThis.location?.pathname?.startsWith('/replays/') ||
    document.getElementById('replay-turn-jump-input'),
  )
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 功能恢复, socket功能, 覆盖层功能 })
