// 功能目的:
// 维护当前地图缓存，并从地图里筛选值得关注的我方兵力高点。
//
// 作用范围:
// 支持完整地图和 map_diff 增量更新，随后计算兵力分布着色列表。
// 计算时会排除塔、基地和当前移动路径，让覆盖层优先标出可调用的大兵力地块，辅助 1v1 调兵判断。
import { 兵力着色最小兵力 } from './配置.js'
import { 功能已启用 } from './功能开关.js'
import {
  取得本次塔列表,
  取得完整地图数组,
  应用增量,
  是我方或队友,
} from './游戏.js'
import { 状态 } from './状态.js'
import { 更新敌方移动高亮 } from './功能/敌方移动高亮.js'
import { 更新敌方最强兵力位置 } from './功能/敌方主力标记.js'
import { 更新抢塔提示 } from './功能/抢塔提示.js'
import { 更新我方行动地图判断 } from './功能/我方行动监控.js'
import { 记录已到达视野 } from './功能/视野.js'

export function 更新地图缓存和兵力分布(
  数据包,
  来源事件,
  已处理我方移动列表 = [],
) {
  const 完整地图数组 = 取得完整地图数组(数据包)
  const 旧地图数组 = Array.isArray(状态.地图数组) ? 状态.地图数组.slice() : null
  if (完整地图数组) {
    状态.地图数组 = 完整地图数组.slice()
  } else if (Array.isArray(数据包?.map_diff) && Array.isArray(状态.地图数组)) {
    const 新地图数组 = 应用增量(状态.地图数组, 数据包.map_diff)
    if (
      Array.isArray(新地图数组) &&
      新地图数组.length >= 状态.地图数组.length
    ) {
      状态.地图数组 = 新地图数组
    }
  }

  更新敌方移动高亮(旧地图数组, 状态.地图数组, 数据包)
  更新敌方最强兵力位置()
  更新抢塔提示(旧地图数组, 状态.地图数组, 数据包)
  if (功能已启用('我方行动监控')) {
    更新我方行动地图判断(旧地图数组, 状态.地图数组, 数据包, 已处理我方移动列表)
  }
  记录已知障碍物()
  状态.兵力分布着色列表 = 功能已启用('兵力分布着色')
    ? 取得兵力分布着色列表()
    : []
  if (功能已启用('未到达视野') || 功能已启用('敌方基地推测')) {
    记录已到达视野(数据包)
  }

  function 记录已知障碍物() {
    const 地图数组 = 状态.地图数组
    if (!Array.isArray(地图数组) || !状态.宽度 || !状态.高度) return

    const 格子数 = 状态.宽度 * 状态.高度
    if (地图数组.length < 2 + 格子数 * 2) return

    const 塔索引集合 = new Set(状态.已知塔集合)
    const 当前塔信息 = 取得本次塔列表(数据包)
    if (Array.isArray(当前塔信息?.塔列表)) {
      当前塔信息.塔列表.forEach((塔索引) => {
        if (Number.isInteger(塔索引) && 塔索引 >= 0) 塔索引集合.add(塔索引)
      })
    }
    for (let idx = 0; idx < 格子数; idx += 1) {
      const 地形 = 地图数组[2 + 格子数 + idx]
      if (塔索引集合.has(idx)) {
        状态.已知障碍物集合.delete(idx)
      } else if (地形 === -2 || 地形 === -4) {
        状态.已知障碍物集合.add(idx)
      } else if (Number.isInteger(地形) && 地形 >= -1) {
        状态.已知障碍物集合.delete(idx)
      }
    }
  }

  function 取得兵力分布着色列表() {
    const 地图数组 = 状态.地图数组
    if (!Array.isArray(地图数组) || !状态.宽度 || !状态.高度) {
      状态.兵力分布调试 = {
        来源事件,
        原因: '缺少地图或尺寸',
        地图长度: Array.isArray(地图数组) ? 地图数组.length : null,
        宽度: 状态.宽度,
        高度: 状态.高度,
      }
      return []
    }

    const 格子数 = 状态.宽度 * 状态.高度
    if (地图数组.length < 2 + 格子数 * 2) {
      状态.兵力分布调试 = {
        来源事件,
        原因: '地图长度不足',
        地图长度: 地图数组.length,
        需要长度: 2 + 格子数 * 2,
      }
      return []
    }

    const 地块列表 = []
    let 可调用地块数量 = 0
    let 达标地块数量 = 0
    let 被排除塔和基地数量 = 0
    let 被排除路径数量 = 0
    let 第一大组数量 = 0
    let 第二大组数量 = 0
    let 未着色跳过数量 = 0
    let 最高兵力 = 0
    const 当前塔信息 = 取得本次塔列表(数据包)
    const 当前塔集合 = new Set(状态.已知塔集合)
    if (Array.isArray(当前塔信息?.塔列表)) {
      当前塔信息.塔列表.forEach((塔索引) => {
        if (Number.isInteger(塔索引) && 塔索引 >= 0) 当前塔集合.add(塔索引)
      })
    }
    const 基地集合 = new Set(
      Array.isArray(数据包?.generals)
        ? 数据包.generals.filter(
            (基地索引) => Number.isInteger(基地索引) && 基地索引 >= 0,
          )
        : [],
    )
    状态.已知敌方基地集合.forEach((_基地, 基地索引) => {
      if (Number.isInteger(基地索引) && 基地索引 >= 0) 基地集合.add(基地索引)
    })
    状态.已知基地集合.forEach((基地索引) => {
      if (Number.isInteger(基地索引) && 基地索引 >= 0) 基地集合.add(基地索引)
    })
    const 路径集合 = new Set()
    状态.移动队列.forEach((移动) => {
      if (Number.isInteger(移动.起点) && 移动.起点 >= 0) 路径集合.add(移动.起点)
      if (Number.isInteger(移动.终点) && 移动.终点 >= 0) 路径集合.add(移动.终点)
    })
    for (let idx = 0; idx < 格子数; idx += 1) {
      const 兵力 = 地图数组[2 + idx]
      const 地形 = 地图数组[2 + 格子数 + idx]
      if (!Number.isInteger(地形) || !是我方或队友(地形)) continue
      可调用地块数量 += 1
      if (!Number.isInteger(兵力) || 兵力 < 兵力着色最小兵力) continue
      if (当前塔集合.has(idx) || 基地集合.has(idx)) {
        被排除塔和基地数量 += 1
        continue
      }
      if (路径集合.has(idx)) {
        被排除路径数量 += 1
        continue
      }
      达标地块数量 += 1
      if (兵力 > 最高兵力) 最高兵力 = 兵力
      地块列表.push({ 索引: idx, 兵力, 归属: 地形 })
    }

    地块列表.sort((左, 右) => {
      if (右.兵力 !== 左.兵力) return 右.兵力 - 左.兵力
      return 左.索引 - 右.索引
    })
    const 着色列表 = 取得兵力分布大组列表(地块列表)
    状态.兵力分布调试 = {
      来源事件,
      地图长度: 地图数组.length,
      格子数,
      可调用地块数量,
      达标地块数量,
      被排除塔和基地数量,
      被排除路径数量,
      第一大组数量,
      第二大组数量,
      未着色跳过数量,
      着色数量: 着色列表.length,
      最高兵力,
      我方索引: 状态.我方索引,
    }
    return 着色列表

    function 取得兵力分布大组列表(地块列表) {
      const 着色列表 = []
      const 兵力分组 = new Map()
      for (const 地块 of 地块列表) {
        if (!兵力分组.has(地块.兵力)) 兵力分组.set(地块.兵力, [])
        兵力分组.get(地块.兵力).push(地块)
      }

      const 同兵力小组列表 = Array.from(兵力分组.values())
      const 第一大组 = 取得单个大组(同兵力小组列表, 10)
      const 第二大组 = 取得单个大组(
        同兵力小组列表.slice(第一大组.已使用小组数量),
        20,
      )

      第一大组数量 = 第一大组.地块列表.length
      第二大组数量 = 第二大组.地块列表.length
      未着色跳过数量 = 地块列表.length - 第一大组数量 - 第二大组数量

      着色列表.push(
        ...第一大组.地块列表.map((地块) => ({ ...地块, 大组: 1 })),
        ...第二大组.地块列表.map((地块) => ({ ...地块, 大组: 2 })),
      )
      return 着色列表

      function 取得单个大组(剩余小组列表, 容量上限) {
        const 地块列表 = []
        let 已使用小组数量 = 0
        let 已加入数量 = 0

        for (const 同兵力地块 of 剩余小组列表) {
          const 添加后数量 = 已加入数量 + 同兵力地块.length
          const 允许加入 = 已使用小组数量 === 0 || 添加后数量 <= 容量上限
          if (!允许加入) break
          地块列表.push(...同兵力地块)
          已使用小组数量 += 1
          已加入数量 = 添加后数量
        }

        return { 地块列表, 已使用小组数量 }
      }
    }
  }
}
