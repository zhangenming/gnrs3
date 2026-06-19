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
import { 功能已启用 } from '../功能状态.js'
import {
  取得本次塔列表,
  地图可读,
  是我方或队友,
  读取地图归属,
} from '../游戏.js'
import { 是敌方格 } from '../游戏工具.js'
import { 状态 } from '../状态.js'

export const 功能定义 = {
  id: '抢塔提示',
  名称: '抢塔提示',
  分类: '地图覆盖',
  描述: '敌方把我方塔直接抢走时播放闪烁提示',
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭: 清除抢塔提示,
  关闭后需要清空覆盖层: true,
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置: 清除抢塔提示,
}

export const 地图更新功能 = {
  id: 功能定义.id,
  地图更新({ 旧地图数组, 新地图数组, 数据包 }) {
    更新抢塔提示(旧地图数组, 新地图数组, 数据包)
  },
}

export const 覆盖层功能 = {
  id: 功能定义.id,
  渲染前: 清理抢塔提示,
  需要绘制() {
    return 状态.抢塔提示列表.length > 0
  },
  需要连续动画() {
    return 状态.抢塔提示列表.length > 0
  },
  绘制: 画抢塔提示,
}

export function 更新抢塔提示(旧地图数组, 新地图数组, 数据包) {
  if (!功能已启用('抢塔提示')) {
    状态.抢塔提示列表 = []
    return
  }
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
    if (!地图可读(旧地图数组) || !地图可读(新地图数组)) return []

    const 格子数 = 状态.宽度 * 状态.高度

    const 抢塔索引列表 = []
    const 塔索引集合 = 取得塔索引集合()
    for (const 塔索引 of 塔索引集合) {
      if (塔索引 < 0 || 塔索引 >= 格子数) continue

      const 旧归属 = 读取地图归属(旧地图数组, 塔索引)
      const 新归属 = 读取地图归属(新地图数组, 塔索引)
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
  }
}

export function 清理抢塔提示() {
  if (!功能已启用('抢塔提示')) {
    状态.抢塔提示列表 = []
    return
  }
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

function 画抢塔提示({ ctx, 格宽, 格高, 大小 }) {
  if (!状态.抢塔提示列表.length) return

  const 格子数 = 状态.宽度 * 状态.高度
  const 当前时间 = performance.now()
  const 可绘制提示列表 = 状态.抢塔提示列表.filter((提示) => {
    return (
      Number.isInteger(提示.索引) &&
      Number.isFinite(提示.记录时间) &&
      提示.索引 >= 0 &&
      提示.索引 < 格子数
    )
  })
  if (!可绘制提示列表.length) return

  ctx.save()
  可绘制提示列表.forEach((提示) => {
    const 经过比例 = Math.min(
      1,
      Math.max(0, (当前时间 - 提示.记录时间) / 抢塔提示持续毫秒),
    )
    const 闪烁 = 0.5 - Math.cos(经过比例 * Math.PI * 10) / 2
    const 回弹 = 1 + (1 - 缓出四次方(经过比例)) * 0.58
    const 透明度 = (1 - 经过比例) * (0.48 + 闪烁 * 0.42)
    const 行 = Math.floor(提示.索引 / 状态.宽度)
    const 列 = 提示.索引 % 状态.宽度
    const 中心X = 列 * 格宽 + 格宽 / 2
    const 中心Y = 行 * 格高 + 格高 / 2
    const 宽 = 格宽 * 回弹
    const 高 = 格高 * 回弹
    const x = 中心X - 宽 / 2
    const y = 中心Y - 高 / 2
    const 线宽 = Math.max(2, 大小 * (0.08 + 闪烁 * 0.06))
    const 角长 = Math.max(6, 大小 * (0.26 + 闪烁 * 0.1))

    ctx.save()
    ctx.globalAlpha = 透明度
    ctx.fillStyle = 'rgba(255, 0, 0, 0.4)'
    ctx.fillRect(x, y, 宽, 高)

    ctx.globalAlpha = Math.min(1, 透明度 + 0.24)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.shadowColor = 'rgba(255, 0, 0, 0.8)'
    ctx.shadowBlur = Math.max(6, 大小 * 0.18)
    ctx.lineWidth = 线宽 + Math.max(2, 线宽 * 0.8)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.82)'
    画抢塔角标(x, y, 宽, 高, 角长)

    ctx.lineWidth = 线宽
    ctx.strokeStyle = '#ff2b2b'
    画抢塔角标(x, y, 宽, 高, 角长)
    ctx.restore()
  })
  ctx.restore()

  function 画抢塔角标(x, y, 宽, 高, 角长) {
    ctx.beginPath()
    ctx.moveTo(x, y + 角长)
    ctx.lineTo(x, y)
    ctx.lineTo(x + 角长, y)
    ctx.moveTo(x + 宽 - 角长, y)
    ctx.lineTo(x + 宽, y)
    ctx.lineTo(x + 宽, y + 角长)
    ctx.moveTo(x + 宽, y + 高 - 角长)
    ctx.lineTo(x + 宽, y + 高)
    ctx.lineTo(x + 宽 - 角长, y + 高)
    ctx.moveTo(x + 角长, y + 高)
    ctx.lineTo(x, y + 高)
    ctx.lineTo(x, y + 高 - 角长)
    ctx.stroke()
  }

  function 缓出四次方(值) {
    return 1 - (1 - 值) ** 4
  }
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 功能恢复, socket功能, 覆盖层功能, 地图更新功能 })
