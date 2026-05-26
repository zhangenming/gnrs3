import { 状态 } from './状态.js'
import { 是我方或队友 } from './游戏.js'
import { 大回合turn数, 基地自然增长turn数 } from './配置.js'

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
  return (
    document.querySelector('#game-page #gameMap .game-map-canvas') ??
    document.querySelector('.game-map-canvas')
  )
}

export function 取宿主(画布) {
  if (!画布) return null
  const 候选宿主 =
    画布.parentElement ||
    画布.closest('.relative') ||
    画布.closest('.game-page')
  if (!候选宿主) return null
  const 样式 = window.getComputedStyle(候选宿主)
  if (样式?.position === 'static') return document.body ?? 候选宿主
  return 候选宿主
}

export function 读取当前回合(数据包) {
  return Number.isInteger(数据包?.turn) ? 数据包.turn : 状态.当前回合
}

export function 取得回合间增长(起始回合, 目标回合) {
  if (!Number.isInteger(起始回合) || !Number.isInteger(目标回合)) return null
  return (
    取得周期增长次数(起始回合, 目标回合, 基地自然增长turn数) +
    取得周期增长次数(起始回合, 目标回合, 大回合turn数)
  )
}
