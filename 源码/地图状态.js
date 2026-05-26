// 功能目的:
// 维护当前地图缓存，并把地图更新上下文分发给已注册的地图更新 hook。
//
// 作用范围:
// 支持完整地图和 map_diff 增量更新；功能派生状态由对应功能文件维护。
import { 地图更新功能列表 } from './功能注册.js'
import { 取得完整地图数组, 应用增量 } from './游戏.js'
import { 状态 } from './状态.js'

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

  const 上下文 = {
    旧地图数组,
    新地图数组: 状态.地图数组,
    数据包,
    来源事件,
    已处理我方移动列表,
  }
  for (const 功能 of 地图更新功能列表) {
    功能.地图更新?.(上下文)
  }
}
