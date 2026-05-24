// 功能目的:
// 游戏结束时冻结右侧战场数据表，保留结束前一回合的 Army 和 Land。
import { 状态 } from '../状态.js'

const 游戏结束事件集合 = new Set([
  'game_lost',
  'game_won',
  'game_over',
  'game_end',
])

export function 处理战场数据冻结事件(事件名, 数据包) {
  if (游戏结束事件集合.has(事件名) || 包含已结束分数(数据包)) {
    状态.战场数据已冻结 = true
  }
}

export function 重置战场数据冻结() {
  状态.战场数据已冻结 = false
  状态.战场数据快照 = null
}

export function 应用战场数据冻结(配置) {
  const { 玩家行列表, 玩家列, 兵力列, 陆地列, 取得单元格列表 } = 配置

  更新玩家数据快照()
  恢复冻结玩家数据()

  function 更新玩家数据快照() {
    if (状态.战场数据已冻结) return

    const 快照 = new Map()
    for (const 行 of 玩家行列表) {
      const 单元格列表 = 取得单元格列表(行)
      const 玩家名 = (单元格列表[玩家列]?.textContent ?? '').trim()
      if (!玩家名) continue

      const 兵力文本 = 读取数字文本(单元格列表[兵力列])
      const 陆地文本 = 读取数字文本(单元格列表[陆地列])
      if (!兵力文本 || !陆地文本) continue

      快照.set(玩家名, {
        兵力文本,
        陆地文本,
      })
    }

    if (快照.size >= 2) 状态.战场数据快照 = 快照
  }

  function 恢复冻结玩家数据() {
    if (!状态.战场数据已冻结 || !状态.战场数据快照) return

    for (const 行 of 玩家行列表) {
      const 单元格列表 = 取得单元格列表(行)
      const 玩家名 = (单元格列表[玩家列]?.textContent ?? '').trim()
      const 快照 = 状态.战场数据快照.get(玩家名)
      if (!快照) continue

      写入冻结文本(单元格列表[兵力列], 快照.兵力文本)
      写入冻结文本(单元格列表[陆地列], 快照.陆地文本)
    }
  }
}

function 包含已结束分数(数据包) {
  if (!Array.isArray(数据包?.scores)) return false

  return 数据包.scores.some((分数) => {
    return 分数?.dead === true && 分数.total === 0
  })
}

function 读取数字文本(单元格) {
  const 文本 = (单元格?.textContent ?? '').trim()
  return /^\d+$/.test(文本) ? 文本 : ''
}

function 写入冻结文本(单元格, 文本) {
  if (!单元格 || !文本 || 单元格.textContent === 文本) return
  单元格.textContent = 文本
}
