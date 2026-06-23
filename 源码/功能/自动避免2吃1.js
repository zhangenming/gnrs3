// 功能目的:
// 第一大回合内拦截我方 2 兵攻击非我方 1 兵，避免浪费一步。
//
// 作用范围:
// 只阻止当前这条 attack 出站，不清空、不重放已有移动队列。
import { 大回合turn数 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import { 地图可读, 是我方或队友, 读取地图地块 } from '../游戏.js'
import { 状态 } from '../状态.js'
import { 是阻挡地形 } from '../游戏工具.js'

export const 功能定义 = {
  id: '自动避免2吃1',
  名称: '自动避免2吃1',
  分类: '操作防呆',
  描述: '第一大回合内阻止 2 兵攻击 1 兵',
}

export const socket功能 = {
  id: 功能定义.id,
  阻止出站: 阻止2吃1,
}

export function 阻止2吃1({ 事件名, 参数 }) {
  if (!功能已启用(功能定义.id)) return false
  if (事件名 !== 'attack') return false
  if (!在第一大回合()) return false
  if (!地图可读(状态.地图数组)) return false

  const 起点 = 参数?.[0]
  const 终点 = 参数?.[1]
  if (!Number.isInteger(起点) || !Number.isInteger(终点)) return false

  const 起点地块 = 读取地图地块(状态.地图数组, 起点)
  const 终点地块 = 读取地图地块(状态.地图数组, 终点)
  if (!起点地块 || !终点地块) return false
  if (起点地块.兵力 !== 2 || 终点地块.兵力 !== 1) return false
  if (!是我方或队友(起点地块.归属)) return false
  if (是我方或队友(终点地块.归属)) return false
  if (是阻挡地形(终点地块.归属)) return false

  return true

  function 在第一大回合() {
    return (
      Number.isInteger(状态.当前回合) &&
      状态.当前回合 >= 0 &&
      状态.当前回合 < 大回合turn数
    )
  }
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, socket功能 })
