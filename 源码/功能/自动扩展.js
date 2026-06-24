// 功能目的:
// 当前没有排队操作时自动补一手扩地，避免空过当前回合。
//
// 作用范围:
// 只在队列为空时插入 1 步；用户随后操作时，若自动步仍是队列最后一步，则先撤回自动步。
import { 功能已启用 } from '../功能状态.js'
import { 大回合turn数 } from '../配置.js'
import {
  取得地图格子数,
  地图可读,
  是我方或队友,
  读取地图地块,
} from '../游戏.js'
import { 状态 } from '../状态.js'
import { 取得相邻索引列表, 是阻挡地形 } from '../游戏工具.js'

export const 功能定义 = {
  id: '自动扩展',
  名称: '自动扩展',
  分类: '自动操作',
  描述: '空队列时自动补 3 吃 1 或 2 扩地',
}

let 正在发送自动操作 = false
let 正在撤销自动操作 = false
let 自动扩展任务序号 = 0

export const socket功能 = {
  id: 功能定义.id,
  阻止出站: 处理用户出站前,
  新局重置: 重置自动扩展,
  game_update前({ 数据包 }) {
    const 自动记录 = 状态.自动扩展记录
    const 攻击序号 = 数据包?.attackIndex
    if (!自动记录) return
    if (
      Number.isInteger(攻击序号) &&
      Number.isInteger(自动记录.攻击序号) &&
      攻击序号 >= 自动记录.攻击序号
    ) {
      状态.自动扩展记录 = null
    }
  },
  game_update({ socket, 请求渲染, 延后执行 }) {
    自动扩展任务序号 += 1
    const 当前任务序号 = 自动扩展任务序号
    延后执行('自动扩展', () => {
      if (当前任务序号 !== 自动扩展任务序号) return
      尝试自动扩展(socket, 请求渲染)
    })
  },
}

export function 尝试自动扩展(socket, 请求渲染) {
  if (!功能已启用(功能定义.id)) return false
  if (!socket || typeof socket.emit !== 'function') return false
  if (globalThis.location?.pathname?.startsWith('/replays/')) return false
  if (!状态.游戏进行中) return false
  if (!Number.isInteger(状态.当前回合) || 状态.当前回合 < 大回合turn数) {
    return false
  }
  if (!地图可读(状态.地图数组)) return false
  if (状态.移动队列.length) return false
  if (状态.自动扩展记录) return false

  const 计划 = 取得自动扩展计划()
  if (!计划) return false

  const 攻击序号 = 取得下个攻击序号()
  状态.自动扩展记录 = {
    ...计划,
    攻击序号,
    回合: Number.isInteger(状态.当前回合) ? 状态.当前回合 : null,
  }

  正在发送自动操作 = true
  try {
    socket.emit('attack', 计划.起点, 计划.终点, false, 攻击序号)
  } finally {
    正在发送自动操作 = false
  }

  if (!自动移动仍在队列末尾(状态.自动扩展记录)) {
    状态.自动扩展记录 = null
    return false
  }

  状态.自动扩展攻击序号 = 攻击序号 + 1
  请求渲染()
  return true

  function 取得自动扩展计划() {
    return 取得指定兵力计划(3, 1, '3吃1') ?? 取得指定兵力计划(2, 0, '2扩地')
  }

  function 取得指定兵力计划(起点兵力, 终点兵力, 类型) {
    const 格子数 = 取得地图格子数(状态.地图数组)
    if (!Number.isInteger(格子数)) return null

    for (let 起点 = 0; 起点 < 格子数; 起点 += 1) {
      const 起点地块 = 读取地图地块(状态.地图数组, 起点)
      if (!是可用起点(起点地块, 起点兵力)) continue

      for (const 终点 of 取得相邻索引列表(起点)) {
        const 终点地块 = 读取地图地块(状态.地图数组, 终点)
        if (!是可扩展目标(终点地块, 终点兵力)) continue
        return { 起点, 终点, 类型 }
      }
    }
    return null
  }

  function 是可用起点(地块, 兵力) {
    return 地块?.兵力 === 兵力 && 是我方或队友(地块.归属)
  }

  function 是可扩展目标(地块, 兵力) {
    if (地块?.兵力 !== 兵力) return false
    if (!Number.isInteger(地块.归属)) return false
    if (是我方或队友(地块.归属)) return false
    return !是阻挡地形(地块.归属)
  }

  function 取得下个攻击序号() {
    let 队列最大攻击序号 = 0
    for (const 移动 of 状态.移动队列) {
      if (
        Number.isInteger(移动?.攻击序号) &&
        移动.攻击序号 > 队列最大攻击序号
      ) {
        队列最大攻击序号 = 移动.攻击序号
      }
    }
    return Math.max(
      Number.isInteger(状态.自动扩展攻击序号) ? 状态.自动扩展攻击序号 : 1,
      Number.isInteger(状态.自动保护基地攻击序号)
        ? 状态.自动保护基地攻击序号
        : 1,
      Number.isInteger(状态.自动吃基地攻击序号) ? 状态.自动吃基地攻击序号 : 1,
      队列最大攻击序号 + 1,
    )
  }
}

export function 重置自动扩展() {
  状态.自动扩展记录 = null
  状态.自动扩展攻击序号 = 1
  自动扩展任务序号 += 1
}

function 处理用户出站前({ 事件名, socket }) {
  if (正在发送自动操作 || 正在撤销自动操作) return false
  if (!状态.自动扩展记录) return false
  if (!是用户操作事件(事件名)) return false

  if (事件名 === 'attack') {
    撤销待执行自动扩展(socket)
  } else {
    状态.自动扩展记录 = null
  }
  return false

  function 是用户操作事件(事件名) {
    return (
      事件名 === 'attack' || 事件名 === 'undo_move' || 事件名 === 'clear_moves'
    )
  }

  function 撤销待执行自动扩展(socket) {
    const 自动记录 = 状态.自动扩展记录
    状态.自动扩展记录 = null
    if (!自动移动仍在队列末尾(自动记录)) return
    if (!socket || typeof socket.emit !== 'function') return

    正在撤销自动操作 = true
    try {
      socket.emit('undo_move')
    } finally {
      正在撤销自动操作 = false
    }
  }
}

function 自动移动仍在队列末尾(自动记录) {
  if (!自动记录) return false
  const 最后移动 = 状态.移动队列.at(-1)
  return (
    最后移动?.起点 === 自动记录.起点 &&
    最后移动?.终点 === 自动记录.终点 &&
    最后移动?.攻击序号 === 自动记录.攻击序号
  )
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, socket功能 })
