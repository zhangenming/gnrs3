import { 敌方红色索引, 我方蓝色索引 } from '../config.js'
import { 读取玩家信息, 是我方或队友 } from '../game.js'
import { 状态 } from '../state.js'

export function 重构玩家颜色(数据包) {
  if (!数据包) return
  if (typeof 数据包 === 'object' && 状态.已处理颜色数据包) {
    if (状态.已处理颜色数据包.has(数据包)) return
    状态.已处理颜色数据包.add(数据包)
  }

  读取玩家信息(数据包)

  if (!Array.isArray(数据包.playerColors)) {
    return
  }

  if (!Number.isInteger(状态.我方索引)) {
    return
  }

  for (let 玩家索引 = 0; 玩家索引 < 数据包.playerColors.length; 玩家索引 += 1) {
    if (是我方或队友(玩家索引)) {
      数据包.playerColors[玩家索引] = 我方蓝色索引
    } else {
      数据包.playerColors[玩家索引] = 敌方红色索引
    }
  }
}
