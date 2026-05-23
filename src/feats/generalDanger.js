import { 基地危险类名 } from '../config.js'
import { 是我方或队友 } from '../game.js'
import { 状态 } from '../state.js'

export function 更新基地危险状态() {
  if (状态.基地被敌发现) {
    更新基地危险背景()
    return
  }
  if (
    !Number.isInteger(状态.我方基地索引) ||
    !状态.宽度 ||
    !状态.高度 ||
    !Array.isArray(状态.地图数组)
  ) {
    更新基地危险背景()
    return
  }

  const 格子数 = 状态.宽度 * 状态.高度
  if (状态.地图数组.length < 2 + 格子数 * 2) {
    更新基地危险背景()
    return
  }

  const 基地行 = Math.floor(状态.我方基地索引 / 状态.宽度)
  const 基地列 = 状态.我方基地索引 % 状态.宽度
  for (let 行偏移 = -1; 行偏移 <= 1; 行偏移 += 1) {
    const 行 = 基地行 + 行偏移
    if (行 < 0 || 行 >= 状态.高度) continue
    for (let 列偏移 = -1; 列偏移 <= 1; 列偏移 += 1) {
      const 列 = 基地列 + 列偏移
      if (列 < 0 || 列 >= 状态.宽度) continue
      const idx = 行 * 状态.宽度 + 列
      const 归属 = 状态.地图数组[2 + 格子数 + idx]
      if (Number.isInteger(归属) && 归属 >= 0 && !是我方或队友(归属)) {
        状态.基地被敌发现 = true
        更新基地危险背景()
        return
      }
    }
  }

  更新基地危险背景()
}

export function 更新基地危险背景() {
  document.documentElement?.classList.toggle(基地危险类名, 状态.基地被敌发现)
  document.body?.classList.toggle(基地危险类名, 状态.基地被敌发现)
}
