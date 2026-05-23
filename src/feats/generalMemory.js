// 功能目的:
// 从 game_start/game_update 数据包中记录双方基地位置，尤其是敌方基地首次进入视野时的位置。
//
// 作用范围:
// 负责把 generals 字段同步进全局状态，区分我方/队友与敌方基地。
// 这些记忆会被覆盖层渲染、调试接口和基地危险判断复用，帮助 1v1 中持续追踪敌方核心目标。
import { 读取玩家信息, 尝试从地图读取尺寸, 是我方或队友 } from '../game.js'
import { 状态 } from '../state.js'

export function 处理基地位置(数据包, 请求渲染) {
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
}
