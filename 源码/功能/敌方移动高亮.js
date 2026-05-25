// 功能目的:
// 根据可见地图前后状态推断敌方刚发生的相邻移动，并保留一个小回合用于覆盖层高亮。
//
// 作用范围:
// 只记录可见范围内能从地图变化确认的敌方移动，不猜测迷雾外路径。
import { 敌方移动高亮持续turn数 } from '../配置.js'
import { 是我方或队友 } from '../游戏.js'
import { 功能已启用 } from '../功能开关.js'
import { 状态 } from '../状态.js'

export function 更新敌方移动高亮(旧地图数组, 新地图数组, 数据包) {
  if (!功能已启用('敌方移动高亮')) {
    状态.敌方移动高亮列表 = []
    return
  }
  清理敌方移动高亮()
  if (!Array.isArray(旧地图数组) || !Array.isArray(新地图数组)) return
  if (!状态.宽度 || !状态.高度) return

  const 格子数 = 状态.宽度 * 状态.高度
  if (
    旧地图数组.length < 2 + 格子数 * 2 ||
    新地图数组.length < 2 + 格子数 * 2
  ) {
    return
  }

  const 当前回合 = Number.isInteger(数据包?.turn) ? 数据包.turn : 状态.当前回合
  const 新移动列表 = 取得敌方移动列表()
  if (!新移动列表.length) return

  const 已有移动集合 = new Set(
    状态.敌方移动高亮列表.map((移动) => {
      return `${移动.起点}:${移动.终点}:${移动.回合}`
    }),
  )
  for (const 移动 of 新移动列表) {
    const 键 = `${移动.起点}:${移动.终点}:${移动.回合}`
    if (已有移动集合.has(键)) continue
    状态.敌方移动高亮列表.push(移动)
    已有移动集合.add(键)
  }
  if (状态.敌方移动高亮列表.length > 80) {
    状态.敌方移动高亮列表 = 状态.敌方移动高亮列表.slice(-80)
  }

  function 取得敌方移动列表() {
    const 来源列表 = []
    const 目的列表 = []
    const 归属偏移 = 2 + 格子数

    for (let idx = 0; idx < 格子数; idx += 1) {
      const 旧兵力 = 旧地图数组[2 + idx]
      const 新兵力 = 新地图数组[2 + idx]
      const 旧归属 = 旧地图数组[归属偏移 + idx]
      const 新归属 = 新地图数组[归属偏移 + idx]
      const 旧是敌方 = 是敌方格(旧归属)
      const 新是敌方 = 是敌方格(新归属)

      if (
        旧是敌方 &&
        新是敌方 &&
        Number.isInteger(旧兵力) &&
        Number.isInteger(新兵力) &&
        旧兵力 > 1 &&
        旧兵力 > 新兵力
      ) {
        来源列表.push({
          索引: idx,
          兵力减少: 旧兵力 - 新兵力,
        })
      }

      if (
        ((新是敌方 && (新兵力 > 旧兵力 || !旧是敌方)) ||
          (!新是敌方 &&
            !旧是敌方 &&
            Number.isInteger(旧兵力) &&
            旧兵力 > 新兵力)) &&
        Number.isInteger(新兵力) &&
        Number.isInteger(旧兵力)
      ) {
        目的列表.push({
          索引: idx,
          兵力变化: Math.abs(新兵力 - 旧兵力),
          旧是敌方,
        })
      }
    }

    const 已用来源集合 = new Set()
    const 移动列表 = []
    for (const 目的 of 目的列表) {
      const 来源 = 取得最佳来源(目的)
      if (!来源) continue
      已用来源集合.add(来源.索引)
      移动列表.push({
        起点: 来源.索引,
        终点: 目的.索引,
        回合: 当前回合,
        记录时间: performance.now(),
      })
    }
    return 移动列表

    function 取得最佳来源(目的) {
      let 最佳来源 = null
      let 最佳差距 = Infinity
      for (const 来源 of 来源列表) {
        if (已用来源集合.has(来源.索引)) continue
        if (!是相邻格(来源.索引, 目的.索引)) continue

        const 兵力变化 = 目的.旧是敌方
          ? Math.max(1, 目的.兵力变化)
          : Math.max(1, 目的.兵力变化, 来源.兵力减少)
        const 差距 = Math.abs(来源.兵力减少 - 兵力变化)
        if (差距 < 最佳差距) {
          最佳来源 = 来源
          最佳差距 = 差距
        }
      }
      return 最佳来源
    }
  }

  function 是敌方格(归属) {
    return Number.isInteger(归属) && 归属 >= 0 && !是我方或队友(归属)
  }

  function 是相邻格(左索引, 右索引) {
    const 左行 = Math.floor(左索引 / 状态.宽度)
    const 右行 = Math.floor(右索引 / 状态.宽度)
    const 左列 = 左索引 % 状态.宽度
    const 右列 = 右索引 % 状态.宽度
    return Math.abs(左行 - 右行) + Math.abs(左列 - 右列) === 1
  }
}

export function 清理敌方移动高亮() {
  if (!功能已启用('敌方移动高亮')) {
    状态.敌方移动高亮列表 = []
    return
  }
  const 当前回合 = 状态.当前回合
  if (!Number.isInteger(当前回合)) return
  const 原长度 = 状态.敌方移动高亮列表.length
  if (!原长度) return

  状态.敌方移动高亮列表 = 状态.敌方移动高亮列表.filter((移动) => {
    if (!Number.isInteger(移动.回合)) return true
    return 当前回合 - 移动.回合 < 敌方移动高亮持续turn数
  })
}
