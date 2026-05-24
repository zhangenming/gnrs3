// 功能目的:
// 当敌方把我方塔直接打成敌方塔时，在被抢塔格子上播放一次快速闪烁和放大恢复提示。
//
// 实现原理:
// 地图缓存更新时会同时拿到旧地图数组和新地图数组；地图数组的前 2 位是宽高，
// 后半段是每个格子的归属值。抢塔提示只遍历已知塔列表、当前数据包塔列表和塔记忆集合的并集，
// 对每个塔格读取旧归属和新归属：旧归属属于我方或队友，新归属属于敌方，就判定为敌方抢塔。
// 触发后把被抢塔索引和当前时间写入状态.抢塔提示列表，覆盖层每帧根据经过时间计算闪烁强度和缩放比例，
// 在该格中心画一个红色放大框和半透明背景。动画到达持续时间后由清理函数移除记录，新局也会主动清空。
//
// 作用范围:
// 只读取地图归属、塔列表和玩家归属关系，只维护抢塔提示动画列表。
// 它不修改游戏地图、塔记忆、移动队列或页面全局样式。
import { 抢塔提示持续毫秒 } from '../配置.js'
import { 取得本次塔列表, 是我方或队友 } from '../游戏.js'
import { 状态 } from '../状态.js'

export function 更新抢塔提示(旧地图数组, 新地图数组, 数据包) {
  清理抢塔提示()
  const 抢塔索引列表 = 取得抢塔索引列表()
  if (!抢塔索引列表.length) return

  const 记录时间 = performance.now()
  for (const 塔索引 of 抢塔索引列表) {
    状态.抢塔提示列表 = 状态.抢塔提示列表.filter((提示) => {
      return 提示.索引 !== 塔索引
    })
    状态.抢塔提示列表.push({ 索引: 塔索引, 记录时间 })
  }
  if (状态.抢塔提示列表.length > 20) {
    状态.抢塔提示列表 = 状态.抢塔提示列表.slice(-20)
  }

  function 取得抢塔索引列表() {
    if (!Array.isArray(旧地图数组) || !Array.isArray(新地图数组)) return []
    if (!状态.宽度 || !状态.高度) return []

    const 格子数 = 状态.宽度 * 状态.高度
    if (
      旧地图数组.length < 2 + 格子数 * 2 ||
      新地图数组.length < 2 + 格子数 * 2
    ) {
      return []
    }

    const 抢塔索引列表 = []
    const 塔索引集合 = 取得塔索引集合()
    for (const 塔索引 of 塔索引集合) {
      if (塔索引 < 0 || 塔索引 >= 格子数) continue

      const 旧归属 = 旧地图数组[2 + 格子数 + 塔索引]
      const 新归属 = 新地图数组[2 + 格子数 + 塔索引]
      if (是我方格(旧归属) && 是敌方格(新归属)) {
        抢塔索引列表.push(塔索引)
      }
    }
    return 抢塔索引列表

    function 取得塔索引集合() {
      const 塔索引集合 = new Set()
      添加塔列表(状态.塔列表)
      添加塔列表(取得本次塔列表(数据包)?.塔列表)
      状态.已知塔集合.forEach((塔索引) => {
        if (Number.isInteger(塔索引)) 塔索引集合.add(塔索引)
      })
      return 塔索引集合

      function 添加塔列表(塔列表) {
        if (!Array.isArray(塔列表)) return
        塔列表.forEach((塔索引) => {
          if (Number.isInteger(塔索引)) 塔索引集合.add(塔索引)
        })
      }
    }

    function 是我方格(归属) {
      return Number.isInteger(归属) && 归属 >= 0 && 是我方或队友(归属)
    }

    function 是敌方格(归属) {
      return Number.isInteger(归属) && 归属 >= 0 && !是我方或队友(归属)
    }
  }
}

export function 清理抢塔提示() {
  const 当前时间 = performance.now()
  状态.抢塔提示列表 = 状态.抢塔提示列表.filter((提示) => {
    if (!Number.isInteger(提示.索引)) return false
    if (!Number.isFinite(提示.记录时间)) return false
    return 当前时间 - 提示.记录时间 < 抢塔提示持续毫秒
  })
}

export function 清除抢塔提示() {
  状态.抢塔提示列表 = []
}
