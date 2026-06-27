// 功能目的:
// 当前没有排队操作时自动补一手扩地，避免空过当前回合。
//
// 作用范围:
// 只在队列为空时插入自动移动；用户随后操作时，若自动步仍在队列最后，则先撤回自动步。
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
import { 取得选中棋子索引, 执行后恢复选中棋子 } from './选中棋子提示.js'

export const 功能定义 = {
  id: '自动扩展',
  名称: '自动扩展',
  分类: '自动操作',
  描述: '空队列时优先自动吃地，再 3/4/5 扩地，最后两步合力吃地',
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
    const 末尾攻击序号 = 取得自动记录末尾攻击序号(自动记录)
    if (
      Number.isInteger(攻击序号) &&
      Number.isInteger(末尾攻击序号) &&
      攻击序号 >= 末尾攻击序号
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

  const 当前选中格子索引 = 取得选中棋子索引()
  const 计划 = 取得自动扩展计划()
  if (!计划) return false

  const 攻击序号 = 取得下个攻击序号()
  const 攻击列表 = 计划.攻击列表.map((攻击, idx) => {
    return {
      ...攻击,
      攻击序号: 攻击序号 + idx,
    }
  })
  状态.自动扩展记录 = {
    ...计划,
    攻击列表,
    攻击序号: 攻击列表.at(-1)?.攻击序号,
    回合: Number.isInteger(状态.当前回合) ? 状态.当前回合 : null,
  }

  正在发送自动操作 = true
  try {
    执行后恢复选中棋子(() => {
      for (const 攻击 of 攻击列表) {
        socket.emit('attack', 攻击.起点, 攻击.终点, false, 攻击.攻击序号)
      }
    }, 请求渲染)
  } finally {
    正在发送自动操作 = false
  }

  if (!自动移动仍在队列末尾(状态.自动扩展记录)) {
    状态.自动扩展记录 = null
    return false
  }

  状态.自动扩展攻击序号 = 攻击序号 + 攻击列表.length
  请求渲染()
  return true

  function 取得自动扩展计划() {
    return 取得吃地计划() ?? 取得扩地计划() ?? 取得两步吃地计划()
  }

  function 取得吃地计划() {
    const 格子数 = 取得地图格子数(状态.地图数组)
    if (!Number.isInteger(格子数)) return null

    for (let 起点 = 0; 起点 < 格子数; 起点 += 1) {
      if (是当前选中格子(起点)) continue
      const 起点地块 = 读取地图地块(状态.地图数组, 起点)
      if (!是我方可移动起点(起点地块)) continue

      for (const 终点 of 取得相邻索引列表(起点)) {
        const 终点地块 = 读取地图地块(状态.地图数组, 终点)
        if (!是可吃目标(起点地块, 终点地块, 终点)) continue
        return {
          类型: `${起点地块.兵力}吃${终点地块.兵力}`,
          攻击列表: [{ 起点, 终点 }],
        }
      }
    }
    return null
  }

  function 取得扩地计划() {
    const 格子数 = 取得地图格子数(状态.地图数组)
    if (!Number.isInteger(格子数)) return null

    for (let 起点 = 0; 起点 < 格子数; 起点 += 1) {
      if (是当前选中格子(起点)) continue
      const 起点地块 = 读取地图地块(状态.地图数组, 起点)
      if (!是扩地起点(起点地块)) continue

      for (const 终点 of 取得相邻索引列表(起点)) {
        const 终点地块 = 读取地图地块(状态.地图数组, 终点)
        if (!是可扩目标(终点地块, 终点)) continue
        return { 类型: `${起点地块.兵力}扩地`, 攻击列表: [{ 起点, 终点 }] }
      }
    }
    return null
  }

  function 取得两步吃地计划() {
    const 格子数 = 取得地图格子数(状态.地图数组)
    if (!Number.isInteger(格子数)) return null

    for (let 终点 = 0; 终点 < 格子数; 终点 += 1) {
      const 终点地块 = 读取地图地块(状态.地图数组, 终点)
      if (!是两步可吃目标(终点地块, 终点)) continue

      const 起点候选列表 = 取得两步起点候选列表(终点)
      for (let idx = 0; idx < 起点候选列表.length; idx += 1) {
        const 左候选 = 起点候选列表[idx]
        for (let 右idx = idx + 1; 右idx < 起点候选列表.length; 右idx += 1) {
          const 右候选 = 起点候选列表[右idx]
          if (左候选.可出兵 + 右候选.可出兵 <= 终点地块.兵力) continue
          return {
            类型: `${左候选.兵力}和${右候选.兵力}吃${终点地块.兵力}`,
            攻击列表: [
              { 起点: 左候选.起点, 终点 },
              { 起点: 右候选.起点, 终点 },
            ],
          }
        }
      }
    }
    return null
  }

  function 是扩地起点(地块) {
    return [3, 4, 5].includes(地块?.兵力) && 是我方或队友(地块.归属)
  }

  function 是我方可移动起点(地块) {
    return (
      Number.isInteger(地块?.兵力) &&
      地块.兵力 > 1 &&
      地块.兵力 <= 10 &&
      是我方或队友(地块.归属)
    )
  }

  function 是可吃目标(起点地块, 终点地块, 终点) {
    if (!是非我方可攻击目标(终点地块, 终点)) return false
    if (!Number.isInteger(终点地块.兵力) || 终点地块.兵力 <= 0) return false
    return 起点地块.兵力 - 1 > 终点地块.兵力
  }

  function 是可扩目标(地块, 终点) {
    return 地块?.兵力 === 0 && 是非我方可攻击目标(地块, 终点)
  }

  function 是两步可吃目标(地块, 终点) {
    if (!是非我方可攻击目标(地块, 终点)) return false
    return Number.isInteger(地块.兵力) && 地块.兵力 > 0
  }

  function 是非我方可攻击目标(地块, 终点) {
    if (是已知中立塔(终点)) return false
    if (!Number.isInteger(地块?.归属)) return false
    if (是我方或队友(地块.归属)) return false
    return !是阻挡地形(地块.归属)
  }

  function 是已知中立塔(终点) {
    if (!Number.isInteger(终点) || !状态.已知塔集合.has(终点)) return false
    const 塔类型 = 状态.已知塔类型.get(终点)
    return 塔类型 !== '我方塔' && 塔类型 !== '敌方塔'
  }

  function 取得两步起点候选列表(终点) {
    const 候选列表 = []
    for (const 起点 of 取得相邻索引列表(终点)) {
      if (是当前选中格子(起点)) continue
      const 起点地块 = 读取地图地块(状态.地图数组, 起点)
      if (!是我方可移动起点(起点地块)) continue
      候选列表.push({
        起点,
        兵力: 起点地块.兵力,
        可出兵: 起点地块.兵力 - 1,
      })
    }
    return 候选列表
  }

  function 是当前选中格子(格子索引) {
    return Number.isInteger(当前选中格子索引) && 格子索引 === 当前选中格子索引
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
    const 自动移动数量 = 取得队列末尾自动移动数量(自动记录)
    if (!自动移动数量) return
    if (!socket || typeof socket.emit !== 'function') return

    正在撤销自动操作 = true
    try {
      for (let idx = 0; idx < 自动移动数量; idx += 1) {
        socket.emit('undo_move')
      }
    } finally {
      正在撤销自动操作 = false
    }
  }
}

function 自动移动仍在队列末尾(自动记录) {
  return 取得队列末尾自动移动数量(自动记录) === 自动记录?.攻击列表?.length
}

function 取得队列末尾自动移动数量(自动记录) {
  if (!自动记录) return 0
  const 攻击列表 = 自动记录.攻击列表
  if (!Array.isArray(攻击列表) || !攻击列表.length) return 0
  if (状态.移动队列.length < 攻击列表.length) return 0

  let 匹配数量 = 0
  for (let idx = 攻击列表.length - 1; idx >= 0; idx -= 1) {
    const 攻击 = 攻击列表[idx]
    const 移动 = 状态.移动队列.at(idx - 攻击列表.length)
    if (
      移动?.起点 !== 攻击.起点 ||
      移动?.终点 !== 攻击.终点 ||
      移动?.攻击序号 !== 攻击.攻击序号
    ) {
      return 0
    }
    匹配数量 += 1
  }
  return 匹配数量
}

function 取得自动记录末尾攻击序号(自动记录) {
  if (!自动记录) return null
  const 最后一条攻击 = 自动记录.攻击列表?.at(-1)
  if (Number.isInteger(最后一条攻击?.攻击序号)) return 最后一条攻击.攻击序号
  return Number.isInteger(自动记录.攻击序号) ? 自动记录.攻击序号 : null
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, socket功能 })
