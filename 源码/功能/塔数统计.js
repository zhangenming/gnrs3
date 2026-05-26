// 功能目的:
// 给战场表头和敌方开塔判断提供统一的 1v1 塔数口径。
import { 是我方或队友, 读取地图归属 } from '../游戏.js'
import { 状态 } from '../状态.js'

export function 统计塔数() {
  const 结果 = {
    我方塔数: 0,
    敌方塔数: 0,
    我方开塔数: 0,
    敌方开塔数: 0,
  }
  const 已确认敌方开塔集合 = new Set()

  for (const 塔索引 of 取得塔索引集合()) {
    const 归属 = 读取当前地图归属(塔索引)
    if (Number.isInteger(归属)) {
      if (归属 >= 0) {
        计入可见塔(归属, 塔索引)
        continue
      }
      if (归属 === -1) continue
    }

    const 塔类型 = 状态.已知塔类型.get(塔索引)
    if (塔类型 === '我方塔') {
      结果.我方塔数 += 1
    } else if (塔类型 === '敌方塔') {
      结果.敌方塔数 += 1
      if (状态.敌方开塔确认集合.has(塔索引)) 已确认敌方开塔集合.add(塔索引)
    }
  }

  结果.我方开塔数 = 状态.我方开塔增长表.size
  结果.敌方开塔数 = Math.max(状态.敌方推断开塔数, 已确认敌方开塔集合.size)
  结果.敌方塔数 += Math.max(0, 结果.敌方开塔数 - 已确认敌方开塔集合.size)

  return 结果

  function 取得塔索引集合() {
    const 塔索引集合 = new Set()
    if (Array.isArray(状态.塔列表)) {
      状态.塔列表.forEach((塔索引) => {
        if (Number.isInteger(塔索引) && 塔索引 >= 0) 塔索引集合.add(塔索引)
      })
    }
    状态.已知塔集合.forEach((塔索引) => {
      if (Number.isInteger(塔索引) && 塔索引 >= 0) 塔索引集合.add(塔索引)
    })
    return 塔索引集合
  }

  function 计入可见塔(归属, 塔索引) {
    if (是我方或队友(归属)) {
      结果.我方塔数 += 1
      return
    }

    结果.敌方塔数 += 1
    const 塔类型 = 状态.已知塔类型.get(塔索引)
    if (塔类型 === '敌方塔' && 状态.敌方开塔确认集合.has(塔索引)) {
      已确认敌方开塔集合.add(塔索引)
    }
  }
}

function 读取当前地图归属(格子索引) {
  return 读取地图归属(状态.地图数组, 格子索引)
}
