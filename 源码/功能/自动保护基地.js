// 功能目的:
// 当敌方相邻兵力足以在下一步吃掉我方基地时，自动清空队列并插入保命动作。
//
// 作用范围:
// 只处理 1v1 中我方基地已经可见、敌方威胁已经贴脸的场景。
import { 大回合turn数 } from '../配置.js'
import { 是我方或队友 } from '../游戏.js'
import { 状态 } from '../状态.js'

const 基地自然增长turn数 = 2

export function 尝试自动保护基地(socket, 请求渲染) {
  if (!socket || typeof socket.emit !== 'function') return false
  if (globalThis.location?.pathname?.startsWith('/replays/')) return false
  if (接管冷却中()) return true
  if (!Array.isArray(状态.地图数组) || !状态.宽度 || !状态.高度) return false
  if (!Number.isInteger(状态.我方基地索引)) return false

  const 计划 = 取得保护计划()
  if (!计划) return false

  let 自动攻击序号 = 取得下个攻击序号()
  状态.自动保护基地接管 = {
    起点: 计划.起点,
    终点: 计划.终点,
    类型: 计划.类型,
    回合: Number.isInteger(状态.当前回合) ? 状态.当前回合 : null,
  }
  状态.自动吃基地接管 = null

  socket.emit('clear_moves')
  socket.emit('attack', 计划.起点, 计划.终点, false, 自动攻击序号)
  自动攻击序号 += 1
  状态.自动保护基地攻击序号 = 自动攻击序号
  状态.自动吃基地攻击序号 = Math.max(
    Number.isInteger(状态.自动吃基地攻击序号) ? 状态.自动吃基地攻击序号 : 1,
    自动攻击序号,
  )
  请求渲染()
  return true

  function 取得保护计划() {
    const 格子数 = 状态.宽度 * 状态.高度
    const 基地索引 = 状态.我方基地索引
    if (基地索引 < 0 || 基地索引 >= 格子数) return null
    if (状态.地图数组.length < 2 + 格子数 * 2) return null

    const 基地兵力 = 状态.地图数组[2 + 基地索引]
    const 基地归属 = 状态.地图数组[2 + 格子数 + 基地索引]
    if (!Number.isInteger(基地兵力) || 基地兵力 < 0) return null
    if (!是我方或队友(基地归属)) return null

    const 基地战力 = 基地兵力 + 取得基地预估增长(1)
    const 威胁列表 = 取得威胁列表(基地索引, 基地战力)
    if (!威胁列表.length) return null

    return (
      取得增援计划(基地索引, 基地战力, 威胁列表) ??
      取得削兵计划(基地索引, 基地战力, 威胁列表)
    )
  }

  function 取得威胁列表(基地索引, 基地战力) {
    const 格子数 = 状态.宽度 * 状态.高度
    const 列表 = []
    for (const 索引 of 取得相邻索引列表(基地索引)) {
      const 兵力 = 状态.地图数组[2 + 索引]
      const 归属 = 状态.地图数组[2 + 格子数 + 索引]
      if (!Number.isInteger(兵力) || 兵力 <= 1) continue
      if (!是敌方格(归属)) continue

      const 可出兵 = 兵力 - 1
      if (可出兵 <= 基地战力) continue
      列表.push({
        索引,
        兵力,
        可出兵,
        危险差: 可出兵 - 基地战力,
      })
    }
    列表.sort((左, 右) => {
      if (右.危险差 !== 左.危险差) return 右.危险差 - 左.危险差
      if (右.兵力 !== 左.兵力) return 右.兵力 - 左.兵力
      return 左.索引 - 右.索引
    })
    return 列表
  }

  function 取得增援计划(基地索引, 基地战力, 威胁列表) {
    const 格子数 = 状态.宽度 * 状态.高度
    const 候选列表 = []
    for (const 索引 of 取得相邻索引列表(基地索引)) {
      const 兵力 = 状态.地图数组[2 + 索引]
      const 归属 = 状态.地图数组[2 + 格子数 + 索引]
      if (!Number.isInteger(兵力) || 兵力 <= 1) continue
      if (!是我方或队友(归属)) continue

      const 保护后战力 = 基地战力 + 兵力 - 1
      const 最大危险差 = 取得最大危险差(威胁列表, 保护后战力)
      if (最大危险差 > 0) continue
      候选列表.push({
        类型: '增援基地',
        起点: 索引,
        终点: 基地索引,
        保护后战力,
        最大危险差,
      })
    }
    if (!候选列表.length) return null

    候选列表.sort((左, 右) => {
      if (右.保护后战力 !== 左.保护后战力) {
        return 右.保护后战力 - 左.保护后战力
      }
      return 左.起点 - 右.起点
    })
    return 候选列表[0]
  }

  function 取得削兵计划(基地索引, 基地战力, 威胁列表) {
    const 原最大危险差 = 取得最大危险差(威胁列表, 基地战力)
    const 候选列表 = []
    for (const 威胁 of 威胁列表) {
      for (const 来源 of 取得可攻击威胁的我方列表(威胁.索引)) {
        const 来源是基地 = 来源.索引 === 基地索引
        const 攻击兵力 = 来源.兵力 - 1
        const 基地战力后 = 来源是基地 ? 1 : 基地战力
        const 削减兵力 = Math.min(攻击兵力, 威胁.兵力)
        const 更新后威胁列表 = 威胁列表
          .map((当前威胁) => {
            if (当前威胁.索引 !== 威胁.索引) return 当前威胁

            const 剩余兵力 = 当前威胁.兵力 - 攻击兵力
            if (剩余兵力 <= 0) return null
            return {
              ...当前威胁,
              兵力: 剩余兵力,
              可出兵: Math.max(0, 剩余兵力 - 1),
            }
          })
          .filter(Boolean)
        const 最大危险差 = 取得最大危险差(更新后威胁列表, 基地战力后)
        if (最大危险差 >= 原最大危险差 && !来源是基地) continue

        候选列表.push({
          类型: 最大危险差 <= 0 ? '削兵解围' : '削弱威胁',
          起点: 来源.索引,
          终点: 威胁.索引,
          最大危险差,
          削减兵力,
          来源兵力: 来源.兵力,
        })
      }
    }
    if (!候选列表.length) return null

    候选列表.sort((左, 右) => {
      const 左已解围 = 左.最大危险差 <= 0 ? 1 : 0
      const 右已解围 = 右.最大危险差 <= 0 ? 1 : 0
      if (右已解围 !== 左已解围) return 右已解围 - 左已解围
      if (左.最大危险差 !== 右.最大危险差) {
        return 左.最大危险差 - 右.最大危险差
      }
      if (右.削减兵力 !== 左.削减兵力) return 右.削减兵力 - 左.削减兵力
      if (右.来源兵力 !== 左.来源兵力) return 右.来源兵力 - 左.来源兵力
      return 左.起点 - 右.起点
    })
    return 候选列表[0]
  }

  function 取得可攻击威胁的我方列表(威胁索引) {
    const 格子数 = 状态.宽度 * 状态.高度
    const 列表 = []
    for (const 索引 of 取得相邻索引列表(威胁索引)) {
      const 兵力 = 状态.地图数组[2 + 索引]
      const 归属 = 状态.地图数组[2 + 格子数 + 索引]
      if (!Number.isInteger(兵力) || 兵力 <= 1) continue
      if (!是我方或队友(归属)) continue
      列表.push({ 索引, 兵力 })
    }
    列表.sort((左, 右) => {
      if (右.兵力 !== 左.兵力) return 右.兵力 - 左.兵力
      return 左.索引 - 右.索引
    })
    return 列表
  }

  function 取得最大危险差(威胁列表, 基地战力) {
    let 最大危险差 = -Infinity
    for (const 威胁 of 威胁列表) {
      const 危险差 = 威胁.可出兵 - 基地战力
      if (危险差 > 最大危险差) 最大危险差 = 危险差
    }
    return 最大危险差 === -Infinity ? -基地战力 : 最大危险差
  }

  function 取得基地预估增长(移动数量) {
    const 当前回合 = 状态.当前回合
    if (
      !Number.isInteger(当前回合) ||
      !Number.isInteger(移动数量) ||
      移动数量 <= 0
    ) {
      return 0
    }

    const 目标回合 = 当前回合 + 移动数量
    const 基地自然增长 = 取得周期增长次数(
      当前回合,
      目标回合,
      基地自然增长turn数,
    )
    const 大回合增长 = 取得周期增长次数(当前回合, 目标回合, 大回合turn数)
    return 基地自然增长 + 大回合增长
  }

  function 取得周期增长次数(起始回合, 目标回合, 周期) {
    return Math.floor(目标回合 / 周期) - Math.floor(起始回合 / 周期)
  }

  function 是敌方格(归属) {
    return Number.isInteger(归属) && 归属 >= 0 && !是我方或队友(归属)
  }

  function 取得相邻索引列表(索引) {
    const 行 = Math.floor(索引 / 状态.宽度)
    const 列 = 索引 % 状态.宽度
    const 列表 = []
    if (行 > 0) 列表.push(索引 - 状态.宽度)
    if (行 < 状态.高度 - 1) 列表.push(索引 + 状态.宽度)
    if (列 > 0) 列表.push(索引 - 1)
    if (列 < 状态.宽度 - 1) 列表.push(索引 + 1)
    return 列表
  }

  function 接管冷却中() {
    const 接管 = 状态.自动保护基地接管
    if (!接管) return false
    if (!Number.isInteger(状态.当前回合)) return true
    if (接管.回合 === 状态.当前回合) return true
    状态.自动保护基地接管 = null
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
      Number.isInteger(状态.自动保护基地攻击序号)
        ? 状态.自动保护基地攻击序号
        : 1,
      Number.isInteger(状态.自动吃基地攻击序号) ? 状态.自动吃基地攻击序号 : 1,
      队列最大攻击序号 + 1,
    )
  }
}

export function 重置自动保护基地() {
  状态.自动保护基地接管 = null
  状态.自动保护基地攻击序号 = 1
}
