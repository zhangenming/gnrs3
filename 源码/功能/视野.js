// 功能目的:
// 记录本局已经到达过视野的地图格子，用于区分从未探索过的区域。
//
// 作用范围:
// 根据我方/队友地块和基地安全范围推导已到达视野集合。
// 覆盖层会把未到达视野的区域铺上背景色，帮助 1v1 中判断哪些方向仍缺少侦察信息。
import { 玩家最小距离 } from '../配置.js'
import { 取得地图格子数, 地图可读, 是我方或队友 } from '../游戏.js'
import { 是迷雾地形 } from '../游戏工具.js'
import { 任一功能已启用 } from '../功能状态.js'
import { 未到达视野背景色 } from '../配置.js'
import { 状态 } from '../状态.js'

export const 功能定义 = {
  id: '未到达视野',
  名称: '未到达视野',
  分类: '地图覆盖',
  描述: '给从未到达过的视野区域铺底色',
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭后需要清空覆盖层: true,
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置() {
    状态.已到达视野集合.clear()
    状态.已确认视野集合.clear()
  },
}

export const 地图更新功能 = {
  id: 功能定义.id,
  地图更新({ 数据包 }) {
    记录已到达视野(数据包)
  },
}

export const 覆盖层功能 = {
  id: 功能定义.id,
  需要绘制: 有未到达视野标记,
  绘制: 画未到达视野背景,
}

export function 有未到达视野标记() {
  if (!任一功能已启用('未到达视野', '敌方基地推测')) return false
  if (!状态.宽度 || !状态.高度) return false
  if (状态.已知敌方基地集合.size) return false
  return 状态.已到达视野集合.size < 状态.宽度 * 状态.高度
}

function 画未到达视野背景({ ctx, 格宽, 格高, 格子数 }) {
  if (!有未到达视野标记()) return

  ctx.save()
  ctx.fillStyle = 未到达视野背景色
  for (let idx = 0; idx < 格子数; idx += 1) {
    if (状态.已到达视野集合.has(idx)) continue
    const 行 = Math.floor(idx / 状态.宽度)
    const 列 = idx % 状态.宽度
    ctx.fillRect(列 * 格宽, 行 * 格高, 格宽, 格高)
  }
  ctx.restore()
}

export function 记录已到达视野(数据包) {
  if (!任一功能已启用('未到达视野', '敌方基地推测', '障碍物标记')) return
  if (!状态.宽度 || !状态.高度) return

  const 地图数组 = 状态.地图数组
  if (!地图可读(地图数组)) return

  const 格子数 = 取得地图格子数(地图数组)

  if (地图已完全揭开(地图数组, 格子数)) {
    记录全图已确认(格子数)
    return
  }

  if (Array.isArray(数据包?.generals)) {
    for (let 玩家索引 = 0; 玩家索引 < 数据包.generals.length; 玩家索引 += 1) {
      const 基地索引 = 数据包.generals[玩家索引]
      if (Number.isInteger(基地索引) && 是我方或队友(玩家索引)) {
        记录基地安全范围(基地索引)
      }
    }
  }

  for (let idx = 0; idx < 格子数; idx += 1) {
    const 归属 = 地图数组[2 + 格子数 + idx]
    if (是我方或队友(归属)) 记录周围视野(idx)
  }

  function 记录周围视野(中心索引) {
    if (!Number.isInteger(中心索引) || 中心索引 < 0) return
    const 中心行 = Math.floor(中心索引 / 状态.宽度)
    const 中心列 = 中心索引 % 状态.宽度

    for (let 行偏移 = -1; 行偏移 <= 1; 行偏移 += 1) {
      const 行 = 中心行 + 行偏移
      if (行 < 0 || 行 >= 状态.高度) continue
      for (let 列偏移 = -1; 列偏移 <= 1; 列偏移 += 1) {
        const 列 = 中心列 + 列偏移
        if (列 < 0 || 列 >= 状态.宽度) continue
        const 索引 = 行 * 状态.宽度 + 列
        状态.已到达视野集合.add(索引)
        状态.已确认视野集合.add(索引)
      }
    }
  }

  function 记录基地安全范围(基地索引) {
    if (!Number.isInteger(基地索引) || 基地索引 < 0) return
    const 基地行 = Math.floor(基地索引 / 状态.宽度)
    const 基地列 = 基地索引 % 状态.宽度

    for (let 行偏移 = -玩家最小距离; 行偏移 <= 玩家最小距离; 行偏移 += 1) {
      const 行 = 基地行 + 行偏移
      if (行 < 0 || 行 >= 状态.高度) continue
      const 剩余距离 = 玩家最小距离 - Math.abs(行偏移)
      for (let 列偏移 = -剩余距离; 列偏移 <= 剩余距离; 列偏移 += 1) {
        const 列 = 基地列 + 列偏移
        if (列 < 0 || 列 >= 状态.宽度) continue
        状态.已到达视野集合.add(行 * 状态.宽度 + 列)
      }
    }
  }

  function 地图已完全揭开(地图数组, 格子数) {
    for (let idx = 0; idx < 格子数; idx += 1) {
      if (是迷雾地形(地图数组[2 + 格子数 + idx])) return false
    }
    return true
  }

  function 记录全图已确认(格子数) {
    for (let idx = 0; idx < 格子数; idx += 1) {
      状态.已到达视野集合.add(idx)
      状态.已确认视野集合.add(idx)
    }
  }
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 功能恢复, socket功能, 覆盖层功能, 地图更新功能 })
