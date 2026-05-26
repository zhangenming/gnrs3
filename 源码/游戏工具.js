import { 状态 } from './状态.js'
import { 是我方或队友 } from './游戏.js'

export function 取得相邻索引列表(索引) {
  const 行 = Math.floor(索引 / 状态.宽度)
  const 列 = 索引 % 状态.宽度
  const 列表 = []
  if (行 > 0) 列表.push(索引 - 状态.宽度)
  if (行 < 状态.高度 - 1) 列表.push(索引 + 状态.宽度)
  if (列 > 0) 列表.push(索引 - 1)
  if (列 < 状态.宽度 - 1) 列表.push(索引 + 1)
  return 列表
}

export function 是敌方格(归属) {
  return Number.isInteger(归属) && 归属 >= 0 && !是我方或队友(归属)
}

export function 取得周期增长次数(起始回合, 目标回合, 周期) {
  return Math.floor(目标回合 / 周期) - Math.floor(起始回合 / 周期)
}

export function 取游戏画布() {
  return document.querySelector('#game-page #gameMap .game-map-canvas')
}
