// 功能目的:
// 判断我方基地周围是否已经出现敌方可见地块，用于提醒基地位置可能已经暴露。
//
// 作用范围:
// 读取当前地图数组、我方基地索引和玩家归属信息，只维护“基地被敌发现”状态。
// 一旦发现敌方贴近基地周围九宫格，就给页面根节点和 body 添加危险类名，让样式层做醒目提示。
import { 基地危险类名 } from '../配置.js'
import { 是我方或队友 } from '../游戏.js'
import { 功能已启用 } from '../功能开关.js'
import { 状态 } from '../状态.js'

const 死亡前基地刚暴露turn数 = 6

export function 更新基地危险状态() {
  if (!功能已启用('基地危险提醒')) {
    更新基地危险背景()
    return
  }
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
        状态.基地被敌发现回合 = 取得当前回合()
        更新基地危险背景()
        return
      }
    }
  }

  更新基地危险背景()
}

export function 处理死亡时基地危险状态() {
  if (!功能已启用('基地危险提醒')) {
    更新基地危险背景()
    return
  }
  if (!状态.基地被敌发现) return
  const 当前回合 = 取得当前回合()
  if (!Number.isInteger(当前回合) || !Number.isInteger(状态.基地被敌发现回合)) {
    更新基地危险背景()
    return
  }
  if (当前回合 - 状态.基地被敌发现回合 <= 死亡前基地刚暴露turn数) {
    状态.基地危险背景豁免 = true
  }
  更新基地危险背景()
}

export function 更新基地危险背景() {
  const 显示危险背景 =
    功能已启用('基地危险提醒') && 状态.基地被敌发现 && !状态.基地危险背景豁免
  document.documentElement?.classList.toggle(基地危险类名, 显示危险背景)
  document.body?.classList.toggle(基地危险类名, 显示危险背景)
}

function 取得当前回合() {
  return Number.isInteger(状态.当前回合) ? 状态.当前回合 : null
}
