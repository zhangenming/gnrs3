// 功能目的:
// 记住已进入视野的塔位置，并持续更新每座塔当前属于中立、我方还是敌方。
//
// 实现原理:
// 优先使用数据包里的 cities/cities_diff 维护塔位置列表，并在每次更新时复用已知塔位置重读可见归属。
// 当塔离开视野时沿用最后一次可见归属，让覆盖层和排行榜塔数统计共享同一份塔归属记忆。
//
// 作用范围:
// 从 game_start/game_update 数据包中读取 cities/towers 信息，写入全局塔集合和塔类型表。
// 覆盖层会根据这些记忆继续标出离开视野后的塔，帮助 1v1 中判断据点和威胁位置。
import {
  取得完整地图数组,
  读取可见地块归属,
  读取玩家信息,
  取得本次塔列表,
  尝试从地图读取尺寸,
  是我方或队友,
} from '../游戏.js'
import { 状态 } from '../状态.js'

export function 处理塔位置(数据包, 请求渲染) {
  读取玩家信息(数据包)
  尝试从地图读取尺寸(数据包)

  const 塔信息 = 取得本次塔列表(数据包)
  const 本次塔列表 = Array.isArray(塔信息?.塔列表)
    ? 塔信息.塔列表
    : Array.isArray(状态.塔列表)
      ? 状态.塔列表
      : null

  if (!Array.isArray(本次塔列表)) {
    请求渲染()
    return
  }

  状态.塔列表 = 本次塔列表.slice()

  for (const 塔索引 of 状态.塔列表) {
    if (!Number.isInteger(塔索引) || 塔索引 < 0) continue
    状态.已知障碍物集合.delete(塔索引)
    if (!状态.已知塔集合.has(塔索引)) {
      状态.已知塔集合.add(塔索引)
      状态.已知塔类型.set(塔索引, '中立塔')
    }
    更新塔类型(数据包, 塔索引)
  }

  请求渲染()
}

export function 更新塔类型(数据包, 塔索引) {
  if (!Number.isInteger(塔索引) || 塔索引 < 0) return
  if (!状态.已知塔类型.has(塔索引)) {
    状态.已知塔类型.set(塔索引, '中立塔')
  }

  const 地块归属 = 读取可见地块归属(数据包, 塔索引)
  let 可见类型 = null
  if (地块归属 != null && 地块归属 >= -1) {
    可见类型 =
      地块归属 < 0 ? '中立塔' : 是我方或队友(地块归属) ? '我方塔' : '敌方塔'
    const 旧类型 = 状态.已知塔类型.get(塔索引)
    if (旧类型 !== 可见类型) {
      状态.已知塔类型.set(塔索引, 可见类型)
    }
  }

  更新中立塔兵力()

  function 更新中立塔兵力() {
    if (可见类型 === '我方塔' || 可见类型 === '敌方塔') {
      状态.中立塔兵力表.delete(塔索引)
      return
    }

    const 是中立兵力更新 =
      地块归属 == null && 状态.已知塔类型.get(塔索引) === '中立塔'
    if (可见类型 !== '中立塔' && !是中立兵力更新) return

    const 兵力 = 读取可见地块兵力(数据包, 塔索引)
    if (!Number.isInteger(兵力) || 兵力 < 0) return

    状态.中立塔兵力表.set(塔索引, 兵力)
  }

  function 读取可见地块兵力(数据包, 格子索引) {
    const 地图数组 = 取得完整地图数组(数据包)
    if (地图数组 && Number.isInteger(格子索引)) {
      const 宽度 = 地图数组[0]
      const 高度 = 地图数组[1]
      const 格子数 = 宽度 * 高度
      if (格子索引 >= 0 && 格子索引 < 格子数) {
        const 地块值 = 地图数组[2 + 格子索引]
        return Number.isInteger(地块值) ? 地块值 : null
      }
    }

    if (!Array.isArray(数据包?.map_diff)) return null
    if (!状态.宽度 || !状态.高度 || !Number.isInteger(格子索引)) return null

    const 目标位置 = 2 + 格子索引
    let 输出位置 = 0
    for (let idx = 0; idx < 数据包.map_diff.length; ) {
      const 保留数量 = 数据包.map_diff[idx] ?? 0
      if (目标位置 >= 输出位置 && 目标位置 < 输出位置 + 保留数量) return null
      输出位置 += 保留数量

      idx += 1
      if (idx < 数据包.map_diff.length) {
        const 插入数量 = 数据包.map_diff[idx] ?? 0
        if (目标位置 >= 输出位置 && 目标位置 < 输出位置 + 插入数量) {
          const 地块增量值 = 数据包.map_diff[idx + 1 + (目标位置 - 输出位置)]
          return Number.isInteger(地块增量值) ? 地块增量值 : null
        }
        输出位置 += 插入数量
        idx += 插入数量
      }

      idx += 1
    }

    return null
  }
}
