import { 状态 } from './状态.js'
import { 是我方或队友 } from './游戏.js'

export function 读取分数玩家数据(数据包) {
  if (!Array.isArray(数据包?.scores)) return null

  let 我方 = null
  let 敌方 = null
  for (let idx = 0; idx < 数据包.scores.length; idx += 1) {
    const 分数 = 数据包.scores[idx]
    if (!Number.isInteger(分数?.i)) continue

    const 玩家数据 = 读取单个分数(分数)
    if (!玩家数据) continue

    if (是我方或队友(分数.i)) {
      我方 = 玩家数据
    } else {
      敌方 = 玩家数据
    }
  }
  return 我方 && 敌方 ? { 我方, 敌方 } : null
}

export function 读取快照玩家数据() {
  const 快照 = 状态.战场数据快照
  if (!快照 || !Array.isArray(状态.玩家名列表)) return null

  const 我方玩家名 = 状态.玩家名列表[状态.我方索引]
  const 敌方玩家名 = 状态.玩家名列表.find((玩家名, 玩家索引) => {
    return 玩家名 && !是我方或队友(玩家索引)
  })
  if (!我方玩家名 || !敌方玩家名) return null

  const 我方 = 读取快照玩家(快照.get(我方玩家名))
  const 敌方 = 读取快照玩家(快照.get(敌方玩家名))
  return 我方 && 敌方 ? { 我方, 敌方 } : null
}

export function 读取单个分数(分数) {
  const 兵力 = 读取字段数字(分数, ['total', 'army'])
  const 陆地 = 读取字段数字(分数, ['tiles', 'land'])
  if (!Number.isInteger(兵力) || !Number.isInteger(陆地)) return null
  return { 兵力, 陆地 }
}

export function 读取快照玩家(玩家快照) {
  const 兵力 = 读取文本数字(玩家快照?.兵力文本)
  const 陆地 = 读取文本数字(玩家快照?.陆地文本)
  if (!Number.isInteger(兵力) || !Number.isInteger(陆地)) return null
  return { 兵力, 陆地 }
}

export function 读取字段数字(对象, 字段列表) {
  for (const 字段 of 字段列表) {
    const 数字 = Number(对象?.[字段])
    if (Number.isInteger(数字)) return 数字
  }
  return null
}

export function 读取文本数字(文本) {
  const 数字 = Number.parseInt(String(文本 ?? '').trim(), 10)
  return Number.isInteger(数字) ? 数字 : null
}
