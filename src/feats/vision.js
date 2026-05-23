import { 玩家最小距离 } from '../config.js'
import { 是我方或队友 } from '../game.js'
import { 状态 } from '../state.js'

export function 有未到达视野标记() {
  if (!状态.宽度 || !状态.高度) return false
  return 状态.已到达视野集合.size < 状态.宽度 * 状态.高度
}

export function 记录已到达视野(数据包) {
  if (!状态.宽度 || !状态.高度) return

  const 格子数 = 状态.宽度 * 状态.高度
  const 地图数组 = 状态.地图数组
  if (!Array.isArray(地图数组) || 地图数组.length < 2 + 格子数 * 2) return

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
        状态.已到达视野集合.add(行 * 状态.宽度 + 列)
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
}
