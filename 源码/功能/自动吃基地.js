// 功能目的:
// 发现敌方基地四邻的我方兵力已经足够时，自动清空当前移动队列并直攻基地。
//
// 作用范围:
// 只处理敌方基地已经可见、且基地四邻我方兵力足够的 1v1 收尾场景。
import { 大回合turn数, 基地自然增长turn数 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import {
  地图可读,
  是我方或队友,
  读取地图兵力,
  读取地图地块,
  读取地图归属,
} from '../游戏.js'
import { 状态 } from '../状态.js'
import {
  取得相邻索引列表,
  取得周期增长次数,
  取得回合间增长,
} from '../游戏工具.js'
import { 执行后恢复选中棋子 } from './选中棋子提示.js'

export const 功能定义 = {
  id: '自动吃基地',
  名称: '自动吃基地',
  分类: '自动操作',
  描述: '四邻兵力足够时自动清队列并直吃敌方基地',
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭: 重置自动吃基地,
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置: 重置自动吃基地,
  game_update(上下文) {
    const { socket, 请求渲染, 已自动保护 } = 上下文
    if (已自动保护) return
    if (!功能已启用('自动吃基地')) return
    上下文.已自动吃基地 = 尝试自动吃敌方基地(socket, 请求渲染)
  },
}

export function 尝试自动吃敌方基地(socket, 请求渲染) {
  if (!socket || typeof socket.emit !== 'function') return false
  if (globalThis.location?.pathname?.startsWith('/replays/')) return false
  if (!地图可读(状态.地图数组)) return false
  if (!状态.已知敌方基地集合.size) return false
  if (接管冷却中()) return false

  const 计划 = 取得吃基地计划()
  if (!计划) return false
  let 自动攻击序号 = 取得下个攻击序号()

  状态.自动吃基地接管 = {
    基地索引: 计划.基地索引,
    截止回合: (状态.当前回合 ?? 0) + 计划.攻击列表.length + 2,
  }

  执行后恢复选中棋子(() => {
    socket.emit('clear_moves')
    for (const 攻击 of 计划.攻击列表) {
      socket.emit('attack', 攻击.起点, 攻击.终点, false, 自动攻击序号)
      自动攻击序号 += 1
    }
  }, 请求渲染)
  状态.自动吃基地攻击序号 = 自动攻击序号
  请求渲染()
  return true

  function 取得吃基地计划() {
    const 格子数 = 状态.宽度 * 状态.高度
    for (const [基地索引, 基地记忆] of 状态.已知敌方基地集合) {
      if (!Number.isInteger(基地索引) || 基地索引 < 0 || 基地索引 >= 格子数) {
        continue
      }

      const 基地兵力 = 取得基地兵力(基地索引)
      const 基地归属 = 读取地图归属(状态.地图数组, 基地索引)
      if (!Number.isInteger(基地兵力) || 基地兵力 < 0) continue
      if (
        Number.isInteger(基地归属)
          ? 是我方或队友(基地归属)
          : !是已知敌方基地(基地记忆)
      ) {
        continue
      }

      const 攻击列表 = 取得攻击列表(
        基地索引,
        取得相邻我方地块(基地索引),
        基地兵力,
      )
      if (攻击列表.length) {
        return { 基地索引, 攻击列表 }
      }
    }
    return null
  }

  function 取得基地兵力(基地索引) {
    const 实时兵力 = 读取地图兵力(状态.地图数组, 基地索引)
    if (Number.isInteger(实时兵力) && 实时兵力 >= 0) return 实时兵力

    const 记忆 = 状态.基地兵力表.get(基地索引)
    if (!记忆 || !Number.isInteger(记忆.兵力) || !Number.isInteger(记忆.回合)) {
      return null
    }
    if (!Number.isInteger(状态.当前回合) || 状态.当前回合 < 记忆.回合) {
      return 记忆.兵力
    }

    const 基地自然增长 = 取得周期增长次数(
      记忆.回合,
      状态.当前回合,
      基地自然增长turn数,
    )
    const 大回合增长 = 取得周期增长次数(记忆.回合, 状态.当前回合, 大回合turn数)
    return 记忆.兵力 + 基地自然增长 + 大回合增长
  }

  function 是已知敌方基地(基地记忆) {
    return (
      基地记忆 &&
      Number.isInteger(基地记忆.玩家索引) &&
      !是我方或队友(基地记忆.玩家索引)
    )
  }

  function 取得相邻我方地块(基地索引) {
    const 格子数 = 状态.宽度 * 状态.高度
    const 相邻索引列表 = 取得相邻索引列表(基地索引)
    const 地块列表 = []
    for (const 索引 of 相邻索引列表) {
      if (索引 < 0 || 索引 >= 格子数) continue
      const 地块 = 读取地图地块(状态.地图数组, 索引)
      const 兵力 = 地块?.兵力
      const 归属 = 地块?.归属
      if (!Number.isInteger(兵力) || 兵力 <= 1) continue
      if (!是我方或队友(归属)) continue
      地块列表.push({
        起点: 索引,
        兵力,
        可出兵: 兵力 - 1,
      })
    }
    地块列表.sort((左, 右) => {
      if (右.可出兵 !== 左.可出兵) return 右.可出兵 - 左.可出兵
      return 左.起点 - 右.起点
    })
    return 地块列表
  }

  function 取得攻击列表(基地索引, 相邻我方地块列表, 基地兵力) {
    const 攻击列表 = []
    let 伤害合计 = 0
    for (const 攻击 of 相邻我方地块列表) {
      攻击列表.push({
        起点: 攻击.起点,
        终点: 基地索引,
        伤害: 攻击.可出兵,
      })
      伤害合计 += 攻击.可出兵
      if (足够吃掉基地(伤害合计, 基地兵力, 攻击列表.length)) {
        return 攻击列表
      }
    }
    return []
  }

  function 足够吃掉基地(伤害合计, 基地兵力, 移动数量) {
    const 基地预估增长 =
      取得回合间增长(状态.当前回合, 状态.当前回合 + 移动数量) ?? Infinity
    return 伤害合计 > 基地兵力 + 基地预估增长
  }

  function 接管冷却中() {
    const 接管 = 状态.自动吃基地接管
    if (!接管) return false
    if (!Number.isInteger(状态.当前回合)) return true
    if (状态.当前回合 <= 接管.截止回合) return true
    状态.自动吃基地接管 = null
    return false
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
      Number.isInteger(状态.自动吃基地攻击序号) ? 状态.自动吃基地攻击序号 : 1,
      Number.isInteger(状态.自动保护基地攻击序号)
        ? 状态.自动保护基地攻击序号
        : 1,
      队列最大攻击序号 + 1,
    )
  }
}

export function 重置自动吃基地() {
  状态.自动吃基地接管 = null
  状态.自动吃基地攻击序号 = 1
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 功能恢复, socket功能 })
