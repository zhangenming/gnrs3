import { 兵力着色最小兵力 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import {
  取得地图格子数,
  取得本次塔列表,
  地图可读,
  是我方或队友,
  读取地图地块,
} from '../游戏.js'
import { 状态 } from '../状态.js'
import { 安装原始兵力文本捕获 } from './原始兵力文本.js'

export const 功能定义 = {
  id: '兵力分布着色',
  名称: '兵力分布着色',
  分类: '地图覆盖',
  描述: '高亮当前最值得调用的大兵力地块',
}

export const 主程序功能 = {
  id: 功能定义.id,
  启动({ 请求渲染 }) {
    if (!功能已启用('兵力分布着色')) return
    安装原始兵力文本捕获(请求渲染)
  },
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭后需要清空覆盖层: true,
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置() {
    状态.原始兵力文本.clear()
    状态.兵力分布着色列表 = []
    状态.兵力分布调试 = null
  },
}

export const 地图更新功能 = {
  id: 功能定义.id,
  地图更新({ 数据包, 来源事件 }) {
    状态.兵力分布着色列表 = 功能已启用('兵力分布着色')
      ? 取得兵力分布着色列表(数据包, 来源事件)
      : []
  },
}

export const 覆盖层功能 = {
  id: 功能定义.id,
  需要绘制() {
    return 状态.兵力分布着色列表.length > 0
  },
  绘制: 画兵力分布着色,
}

export function 画兵力分布着色({ ctx, 格宽, 格高, 大小 }) {
  const 可绘制着色列表 = 取得当前有效着色列表()
  if (!可绘制着色列表.length) return

  const 同步着色列表 = 取得同步着色列表(可绘制着色列表)
  if (!同步着色列表.length) return

  ctx.save()
  同步着色列表.forEach((地块) => {
    const 样式 = 取得兵力大组样式(地块.大组)
    if (!样式) return
    const 行 = Math.floor(地块.索引 / 状态.宽度)
    const 列 = 地块.索引 % 状态.宽度
    const x = 列 * 格宽
    const y = 行 * 格高
    const 宽 = Math.max(1, 格宽 * 样式.覆盖比例)
    const 高 = Math.max(1, 格高 * 样式.覆盖比例)

    画兵力信号块(x, y, 宽, 高, 样式)
  })
  画兵力读数()
  ctx.restore()

  function 画兵力读数() {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    同步着色列表.forEach((地块) => {
      const 样式 = 取得兵力大组样式(地块.大组)
      if (!样式) return
      const 行 = Math.floor(地块.索引 / 状态.宽度)
      const 列 = 地块.索引 % 状态.宽度
      const x = 列 * 格宽 + 格宽 / 2
      const y = 行 * 格高 + 格高 / 2
      const 文本 = 取得兵力读数文本(地块)
      const 字号比例 = 文本.length >= 3 ? 0.46 : 文本.length >= 2 ? 0.54 : 0.64
      const 字号 = Math.max(12, Math.min(24, 大小 * 字号比例 * 样式.字号比例))

      ctx.font = `900 ${字号}px Arial, sans-serif`
      画读数底片(x, y, 文本, 字号)
      ctx.shadowColor = 'transparent'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(文本, x, y)
    })
  }

  function 画兵力信号块(x, y, 宽, 高, 样式) {
    const 左 = x + (格宽 - 宽) / 2
    const 上 = y + (格高 - 高) / 2
    const 提示高 = Math.min(高, Math.max(2, 大小 * 0.1))

    ctx.fillStyle = 样式.背景色
    ctx.fillRect(左, 上, 宽, 高)
    ctx.fillStyle = 样式.提示色
    ctx.fillRect(左, 上, 宽, 提示高)
  }

  function 画读数底片(x, y, 文本, 字号) {
    const 文本宽 = ctx.measureText(文本).width
    const 最小留白 = Math.max(2, 大小 * 0.08)
    const 底片宽 = Math.min(
      格宽 - 最小留白,
      Math.max(大小 * 0.58, 文本宽 + 大小 * 0.26),
    )
    const 底片高 = Math.min(格高 - 最小留白, Math.max(字号 * 1.2, 大小 * 0.52))
    const 圆角 = Math.min(4, 底片高 * 0.2)

    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)'
    ctx.shadowBlur = Math.max(1.5, 大小 * 0.04)
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    ctx.fillStyle = 'rgba(0, 0, 0, 0.86)'
    ctx.beginPath()
    ctx.roundRect(x - 底片宽 / 2, y - 底片高 / 2, 底片宽, 底片高, 圆角)
    ctx.fill()
  }

  function 取得兵力读数文本(地块) {
    const 原始文本 = 状态.原始兵力文本.get(地块.索引)
    if (原始文本?.兵力 === 地块.兵力) return 原始文本.文本
    return String(地块.兵力)
  }

  function 取得同步着色列表(列表) {
    const 同步列表 = []
    for (const 地块 of 列表) {
      const 原始文本 = 状态.原始兵力文本.get(地块.索引)
      if (原始文本) {
        if (原始文本.兵力 < 兵力着色最小兵力) continue
        同步列表.push({
          ...地块,
          兵力: 原始文本.兵力,
        })
      } else {
        同步列表.push(地块)
      }
    }
    同步列表.sort((左, 右) => {
      if (右.兵力 !== 左.兵力) return 右.兵力 - 左.兵力
      return 左.索引 - 右.索引
    })
    return 同步列表
  }

  function 取得当前有效着色列表() {
    const 原列表 = 状态.兵力分布着色列表
    if (!原列表.length) return 原列表
    if (!地图可读(状态.地图数组)) {
      return 原列表
    }

    const 格子数 = 取得地图格子数(状态.地图数组)
    const 路径集合 = new Set()
    状态.移动队列.forEach((移动) => {
      if (Number.isInteger(移动.起点) && 移动.起点 >= 0) {
        路径集合.add(移动.起点)
      }
      if (Number.isInteger(移动.终点) && 移动.终点 >= 0) {
        路径集合.add(移动.终点)
      }
    })

    const 有效列表 = []
    let 发生变化 = false
    for (const 地块 of 原列表) {
      if (
        !地块 ||
        !Number.isInteger(地块.索引) ||
        地块.索引 < 0 ||
        地块.索引 >= 格子数
      ) {
        发生变化 = true
        continue
      }

      const 当前地块 = 读取地图地块(状态.地图数组, 地块.索引)
      const 兵力 = 当前地块?.兵力
      const 归属 = 当前地块?.归属
      const 符合要求 =
        Number.isInteger(兵力) &&
        兵力 >= 兵力着色最小兵力 &&
        Number.isInteger(归属) &&
        是我方或队友(归属) &&
        !状态.已知塔集合.has(地块.索引) &&
        !状态.已知基地集合.has(地块.索引) &&
        !状态.已知敌方基地集合.has(地块.索引) &&
        !路径集合.has(地块.索引)
      if (!符合要求) {
        发生变化 = true
        continue
      }

      if (兵力 !== 地块.兵力 || 归属 !== 地块.归属) {
        发生变化 = true
      }
      有效列表.push({
        索引: 地块.索引,
        兵力,
        归属,
        大组: 地块.大组,
      })
    }

    if (发生变化) {
      状态.兵力分布着色列表 = 有效列表
    }
    return 有效列表
  }

  function 取得兵力大组样式(大组) {
    if (大组 === 1) {
      return {
        覆盖比例: 1,
        字号比例: 1,
        背景色: 'rgba(255, 118, 0, 0.84)',
        提示色: 'rgba(255, 244, 92, 0.32)',
      }
    }
    if (大组 === 2) {
      return {
        覆盖比例: 0.82,
        字号比例: 0.94,
        背景色: 'rgba(0, 0, 0, 0)',
        提示色: 'rgba(0, 0, 0, 0)',
      }
    }
    return null
  }
}

export function 取得兵力分布着色列表(数据包, 来源事件) {
  const 地图数组 = 状态.地图数组
  if (!地图可读(地图数组)) {
    状态.兵力分布调试 = {
      来源事件,
      原因: '缺少地图或尺寸',
      地图长度: Array.isArray(地图数组) ? 地图数组.length : null,
      宽度: 状态.宽度,
      高度: 状态.高度,
    }
    return []
  }

  const 格子数 = 取得地图格子数(地图数组)

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
      ? 数据包.generals.filter((基地索引) => {
          return Number.isInteger(基地索引) && 基地索引 >= 0
        })
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
    const 地块 = 读取地图地块(地图数组, idx)
    const 兵力 = 地块?.兵力
    const 地形 = 地块?.归属
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

import { 注册功能 } from '../注册中心.js'
注册功能({
  功能定义,
  主程序功能,
  功能恢复,
  socket功能,
  覆盖层功能,
  地图更新功能,
})
