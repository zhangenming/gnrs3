import { 状态 } from '../状态.js'
import {
  取得地图格子数,
  取得本次塔列表,
  地图可读,
  读取地图归属,
} from '../游戏.js'
import { 是阻挡地形 } from '../游戏工具.js'

export const 功能定义 = {
  id: '障碍物标记',
  名称: '障碍物标记',
  分类: '地图覆盖',
  描述: '补出已知障碍物和未探索黑块标记',
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭后需要清空覆盖层: true,
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置() {
    状态.已知障碍物集合.clear()
  },
}

export const 地图更新功能 = {
  id: 功能定义.id,
  地图更新({ 数据包 }) {
    记录已知障碍物(数据包)
  },
}

export const 覆盖层功能 = {
  id: 功能定义.id,
  层级: -100,
  需要绘制() {
    return 状态.已知障碍物集合.size > 0
  },
  绘制: 画障碍物底色,
}

const 障碍物文字覆盖层功能 = {
  id: 功能定义.id,
  层级: 100,
  需要绘制() {
    return 状态.已知障碍物集合.size > 0
  },
  绘制: 画障碍物文字,
}

export function 画障碍物底色({ ctx, 格宽, 格高, 大小 }) {
  if (!状态.已知障碍物集合.size) return

  const 格子数 = 状态.宽度 * 状态.高度
  const 地图数组 = 状态.地图数组
  const 边框宽度 = Math.max(2, Math.min(3, 大小 * 0.08))

  ctx.save()
  ctx.fillStyle = '#000000'
  状态.已知障碍物集合.forEach((障碍物索引) => {
    const 当前地形 = 读取地图归属(地图数组, 障碍物索引)
    if (
      !Number.isInteger(障碍物索引) ||
      障碍物索引 < 0 ||
      障碍物索引 >= 格子数 ||
      状态.已知塔集合.has(障碍物索引)
    ) {
      return
    }
    if (地图可读(地图数组)) {
      if (Number.isInteger(当前地形) && 当前地形 >= -1) return
    }
    const 行 = Math.floor(障碍物索引 / 状态.宽度)
    const 列 = 障碍物索引 % 状态.宽度
    const x = 列 * 格宽
    const y = 行 * 格高
    ctx.fillStyle = '#000000'
    ctx.fillRect(x, y, 格宽, 格高)
    if (是确认山(障碍物索引)) 画山边框(障碍物索引, 行, 列, x, y)
  })
  ctx.restore()

  function 是确认山(索引) {
    return (
      状态.已知障碍物集合.has(索引) &&
      状态.已确认视野集合.has(索引) &&
      !状态.已知塔集合.has(索引)
    )
  }

  function 画山边框(索引, 行, 列, x, y) {
    ctx.fillStyle = '#ffd84d'

    if (行 === 0 || !是确认山(索引 - 状态.宽度)) {
      ctx.fillRect(x, y, 格宽, 边框宽度)
    }
    if (行 === 状态.高度 - 1 || !是确认山(索引 + 状态.宽度)) {
      ctx.fillRect(x, y + 格高 - 边框宽度, 格宽, 边框宽度)
    }
    if (列 === 0 || !是确认山(索引 - 1)) {
      ctx.fillRect(x, y, 边框宽度, 格高)
    }
    if (列 === 状态.宽度 - 1 || !是确认山(索引 + 1)) {
      ctx.fillRect(x + 格宽 - 边框宽度, y, 边框宽度, 格高)
    }

    画对角山连接(索引, 行, 列, x, y)
  }

  function 画对角山连接(索引, 行, 列, x, y) {
    const 半径 = 边框宽度 * 0.72
    ctx.fillStyle = '#ffd84d'
    if (
      行 < 状态.高度 - 1 &&
      列 < 状态.宽度 - 1 &&
      是确认山(索引 + 状态.宽度 + 1) &&
      !是确认山(索引 + 1) &&
      !是确认山(索引 + 状态.宽度)
    ) {
      ctx.beginPath()
      ctx.arc(x + 格宽, y + 格高, 半径, 0, Math.PI * 2)
      ctx.fill()
    }
    if (
      行 > 0 &&
      列 < 状态.宽度 - 1 &&
      是确认山(索引 - 状态.宽度 + 1) &&
      !是确认山(索引 + 1) &&
      !是确认山(索引 - 状态.宽度)
    ) {
      ctx.beginPath()
      ctx.arc(x + 格宽, y, 半径, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function 画障碍物文字({ ctx, 格宽, 格高, 大小 }) {
  if (!状态.已知障碍物集合.size) return

  const 格子数 = 状态.宽度 * 状态.高度
  const 地图数组 = 状态.地图数组

  ctx.save()
  状态.已知障碍物集合.forEach((障碍物索引) => {
    const 当前地形 = 读取地图归属(地图数组, 障碍物索引)
    if (
      !Number.isInteger(障碍物索引) ||
      障碍物索引 < 0 ||
      障碍物索引 >= 格子数 ||
      状态.已知塔集合.has(障碍物索引) ||
      状态.已确认视野集合.has(障碍物索引)
    ) {
      return
    }
    if (地图可读(地图数组)) {
      if (Number.isInteger(当前地形) && 当前地形 >= -1) return
    }
    const 行 = Math.floor(障碍物索引 / 状态.宽度)
    const 列 = 障碍物索引 % 状态.宽度
    const x = 列 * 格宽
    const y = 行 * 格高
    画未知阻挡物标记(x, y)
  })
  ctx.restore()

  function 画未知阻挡物标记(x, y) {
    ctx.save()
    const 文本 = '?'
    const 字号 = Math.max(14, Math.min(28, 大小 * 0.58))
    ctx.font = `900 ${字号}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(2, 大小 * 0.075)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'
    ctx.fillStyle = '#ffffff'
    ctx.strokeText(文本, x + 格宽 / 2, y + 格高 / 2)
    ctx.fillText(文本, x + 格宽 / 2, y + 格高 / 2)
    ctx.restore()
  }
}

export function 记录已知障碍物(数据包) {
  const 地图数组 = 状态.地图数组
  if (!地图可读(地图数组)) return

  const 格子数 = 取得地图格子数(地图数组)

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
    } else if (是阻挡地形(地形)) {
      状态.已知障碍物集合.add(idx)
    } else if (Number.isInteger(地形) && 地形 >= -1) {
      状态.已知障碍物集合.delete(idx)
    }
  }
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 功能恢复, socket功能, 覆盖层功能, 地图更新功能 })
注册功能({ 覆盖层功能: 障碍物文字覆盖层功能 })
