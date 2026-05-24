// 功能目的:
// 在游戏地图 canvas 上方绘制辅助覆盖层，集中展示塔记忆、敌方基地、移动路线、
// 未到达视野背景和高兵力地块等实战信息。
//
// 作用范围:
// 负责创建覆盖 canvas、同步尺寸、安装必要样式并完成所有视觉绘制。
// 它只读取状态并更新 DOM/CSS 展示，不直接解析 socket 数据，也不修改游戏原始地图。
import {
  中立黄色,
  大回合倒计时元素编号,
  大回合倒计时类名,
  基地危险类名,
  战场塔信息类名,
  战场数据差类名,
  未到达视野背景色,
  抢塔提示持续毫秒,
  样式编号,
  敌方红色,
  覆盖层类名,
  我方蓝色,
  兵力着色最小兵力,
} from './配置.js'
import { 是我方或队友 } from './游戏.js'
import { 状态 } from './状态.js'
import { 清理敌方移动高亮 } from './功能/敌方移动高亮.js'
import { 清理抢塔提示 } from './功能/抢塔提示.js'
import { 有未到达视野标记 } from './功能/视野.js'

const 自适应样式编号 = `${样式编号}-adaptive-ui`
const 地图大小元素编号 = `${样式编号}-map-size`
let 选中格子索引 = null
let 已安装选中监听 = false

export function 同步自适应棋盘() {
  安装自适应样式()

  const 画布 = 取游戏画布()
  if (!画布) return
  安装选中监听()

  const 地图元素 = 画布.closest('#gameMap')
  if (!地图元素?.closest('#game-page')) return

  const 宿主 = 地图元素.parentElement
  if (!宿主) return

  标记当前棋盘(地图元素, 宿主)

  const 尺寸 = 取得地图原始尺寸(地图元素, 画布)
  if (!尺寸) return

  const 可用宽 = Math.max(1, window.innerWidth)
  const 可用高 = Math.max(1, window.innerHeight)
  const 缩放 = Math.max(0.1, Math.min(可用宽 / 尺寸.宽, 可用高 / 尺寸.高))

  地图元素.style.setProperty('--gio-adaptive-map-scale', String(缩放))
  地图元素.style.setProperty('--gio-adaptive-map-width', `${尺寸.宽}px`)
  地图元素.style.setProperty('--gio-adaptive-map-height', `${尺寸.高}px`)
  宿主.style.setProperty('--gio-adaptive-map-width', `${尺寸.宽}px`)
  宿主.style.setProperty('--gio-adaptive-map-height', `${尺寸.高}px`)
  同步地图大小标签(地图元素)
}

export function 清空覆盖层() {
  const 覆盖层 = document.querySelector(`.${覆盖层类名}`)
  if (!覆盖层) return
  const ctx = 覆盖层.getContext('2d')
  if (ctx) ctx.clearRect(0, 0, 覆盖层.width, 覆盖层.height)
}

export function 渲染() {
  状态.已请求渲染 = false
  清理敌方移动高亮()
  清理抢塔提示()
  同步自适应棋盘()

  if (
    !状态.已知塔集合.size &&
    !状态.已知敌方基地集合.size &&
    !Number.isInteger(状态.我方基地索引) &&
    !状态.已知障碍物集合.size &&
    !状态.移动队列.length &&
    !状态.敌方移动高亮列表.length &&
    !状态.抢塔提示列表.length &&
    !状态.兵力分布着色列表.length &&
    !Number.isInteger(选中格子索引) &&
    !有未到达视野标记()
  ) {
    清空覆盖层()
    return
  }

  if (!状态.宽度 || !状态.高度) {
    return
  }

  const 部件 = 确保覆盖层()
  if (!部件) return

  const 尺寸 = 调整覆盖层(部件)
  const ctx = 部件.覆盖层.getContext('2d')
  if (!ctx) return

  ctx.setTransform(尺寸.dpr, 0, 0, 尺寸.dpr, 0, 0)
  ctx.clearRect(0, 0, 尺寸.css宽, 尺寸.css高)

  const 格宽 = 尺寸.css宽 / 状态.宽度
  const 格高 = 尺寸.css高 / 状态.高度
  const 大小 = Math.min(格宽, 格高)
  const 动画时间 = performance.now()

  画未到达视野背景()
  画障碍物()
  画兵力分布着色()
  画操作轨迹(ctx, 格宽, 格高, 大小)
  画敌方移动高亮(ctx, 格宽, 格高, 大小)

  let 有已占领塔 = false
  状态.已知塔集合.forEach((塔索引) => {
    const 行 = Math.floor(塔索引 / 状态.宽度)
    const 列 = 塔索引 % 状态.宽度
    const 类型 = 状态.已知塔类型.get(塔索引)
    if (类型 === '敌方塔' || 类型 === '我方塔') 有已占领塔 = true
    画塔标记(ctx, 列 * 格宽, 行 * 格高, 大小, 类型)
    if (类型 === '中立塔') {
      画中立塔兵力(ctx, 塔索引, 列 * 格宽, 行 * 格高, 大小)
    }
  })
  画抢塔提示(ctx, 格宽, 格高, 大小)

  状态.已知敌方基地集合.forEach((基地, 基地索引) => {
    const 行 = Math.floor(基地索引 / 状态.宽度)
    const 列 = 基地索引 % 状态.宽度
    画基地标记(ctx, 列 * 格宽, 行 * 格高, 大小)
    画基地模拟兵力(ctx, 基地索引, 列 * 格宽, 行 * 格高, 大小)
  })

  if (Number.isInteger(状态.我方基地索引) && 状态.我方基地索引 >= 0) {
    const 行 = Math.floor(状态.我方基地索引 / 状态.宽度)
    const 列 = 状态.我方基地索引 % 状态.宽度
    画基地标记(ctx, 列 * 格宽, 行 * 格高, 大小)
    画基地模拟兵力(ctx, 状态.我方基地索引, 列 * 格宽, 行 * 格高, 大小)
  }

  画选中棋子(ctx, 格宽, 格高, 大小, 动画时间)

  if (
    状态.敌方移动高亮列表.length ||
    状态.抢塔提示列表.length ||
    有已占领塔 ||
    Number.isInteger(选中格子索引)
  ) {
    requestAnimationFrame(() => {
      const 仍有已占领塔 = Array.from(状态.已知塔类型.values()).some((类型) => {
        return 类型 === '敌方塔' || 类型 === '我方塔'
      })
      if (
        (!状态.敌方移动高亮列表.length &&
          !状态.抢塔提示列表.length &&
          !仍有已占领塔 &&
          !Number.isInteger(选中格子索引)) ||
        状态.已请求渲染
      ) {
        return
      }
      状态.已请求渲染 = true
      渲染()
    })
  }

  function 画未到达视野背景() {
    if (!有未到达视野标记()) return
    const 格子数 = 状态.宽度 * 状态.高度

    ctx.save()
    ctx.fillStyle = 未到达视野背景色
    for (let idx = 0; idx < 格子数; idx += 1) {
      if (状态.已到达视野集合.has(idx)) continue
      const 行 = Math.floor(idx / 状态.宽度)
      const 列 = idx % 状态.宽度
      ctx.fillRect(列 * 格宽, 行 * 格高, 格宽, 格高)
    }
    ctx.restore()
  }

  function 画障碍物() {
    if (!状态.已知障碍物集合.size) return

    const 格子数 = 状态.宽度 * 状态.高度
    const 地图数组 = 状态.地图数组

    ctx.save()
    ctx.fillStyle = '#000000'
    状态.已知障碍物集合.forEach((障碍物索引) => {
      const 当前地形 = Array.isArray(地图数组)
        ? 地图数组[2 + 格子数 + 障碍物索引]
        : null
      if (
        !Number.isInteger(障碍物索引) ||
        障碍物索引 < 0 ||
        障碍物索引 >= 格子数 ||
        状态.已知塔集合.has(障碍物索引)
      ) {
        return
      }
      if (Array.isArray(地图数组)) {
        if (Number.isInteger(当前地形) && 当前地形 >= -1) return
      }
      const 行 = Math.floor(障碍物索引 / 状态.宽度)
      const 列 = 障碍物索引 % 状态.宽度
      const x = 列 * 格宽
      const y = 行 * 格高
      ctx.fillStyle = '#000000'
      ctx.fillRect(x, y, 格宽, 格高)
      if (是未探索阻挡物(障碍物索引, 当前地形)) {
        画未知阻挡物标记(x, y)
      }
    })
    ctx.restore()

    function 是未探索阻挡物(障碍物索引, 当前地形) {
      return 当前地形 === -4
    }

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

  function 画兵力分布着色() {
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
        const 字号比例 =
          文本.length >= 3 ? 0.46 : 文本.length >= 2 ? 0.54 : 0.64
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
      const 底片高 = Math.min(
        格高 - 最小留白,
        Math.max(字号 * 1.2, 大小 * 0.52),
      )
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
      if (!Array.isArray(状态.地图数组) || !状态.宽度 || !状态.高度) {
        return 原列表
      }

      const 格子数 = 状态.宽度 * 状态.高度
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

        const 兵力 = 状态.地图数组[2 + 地块.索引]
        const 归属 = 状态.地图数组[2 + 格子数 + 地块.索引]
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
          背景色: 'rgba(0, 222, 214, 0.74)',
          提示色: 'rgba(180, 255, 250, 0.24)',
        }
      }
      return null
    }
  }

  function 确保覆盖层() {
    安装样式()
    const 画布 = 取画布()
    if (!画布) {
      return null
    }

    const 宿主 = 取宿主(画布)
    if (!宿主) return null

    宿主.classList.add('gio-tower-memory-host')
    let 覆盖层 = 宿主.querySelector(`.${覆盖层类名}`)
    if (!覆盖层) {
      document.querySelectorAll(`.${覆盖层类名}`).forEach((旧覆盖层) => {
        if (旧覆盖层.parentElement !== 宿主) 旧覆盖层.remove()
      })
      覆盖层 = document.createElement('canvas')
      覆盖层.className = 覆盖层类名
      宿主.appendChild(覆盖层)
    }

    return { 画布, 宿主, 覆盖层 }
  }

  function 调整覆盖层(部件) {
    const 画布矩形 = 部件.画布.getBoundingClientRect()
    const 宿主矩形 = 部件.宿主.getBoundingClientRect()
    const dpr = window.devicePixelRatio ?? 1
    const css宽 = Math.max(1, 部件.画布.offsetWidth || 画布矩形.width)
    const css高 = Math.max(1, 部件.画布.offsetHeight || 画布矩形.height)
    const 像素宽 = Math.round(css宽 * dpr)
    const 像素高 = Math.round(css高 * dpr)
    const 左 =
      部件.画布.parentElement === 部件.宿主
        ? 部件.画布.offsetLeft
        : 画布矩形.left - 宿主矩形.left
    const 上 =
      部件.画布.parentElement === 部件.宿主
        ? 部件.画布.offsetTop
        : 画布矩形.top - 宿主矩形.top

    if (部件.覆盖层.width !== 像素宽) 部件.覆盖层.width = 像素宽
    if (部件.覆盖层.height !== 像素高) 部件.覆盖层.height = 像素高
    部件.覆盖层.style.width = `${css宽}px`
    部件.覆盖层.style.height = `${css高}px`
    部件.覆盖层.style.left = `${左}px`
    部件.覆盖层.style.top = `${上}px`

    return { dpr, css宽, css高 }
  }

  function 画塔标记(ctx, x, y, 大小, 类型) {
    const 是敌方塔 = 类型 === '敌方塔'
    const 是我方塔 = 类型 === '我方塔'
    const 是已占领塔 = 是敌方塔 || 是我方塔
    const 外线宽 = Math.max(2, 大小 * 0.09)
    const 内线宽 = Math.max(1.5, 大小 * (是敌方塔 ? 0.065 : 0.05))
    const 外偏移 = 外线宽 / 2 + 1
    const 内偏移 = 外偏移 + 外线宽 / 2 + 内线宽 / 2
    const 主色 = 是敌方塔 ? '#ff1010' : 是我方塔 ? '#00a8ff' : 中立黄色

    ctx.save()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    if (是已占领塔) {
      画占领塔旋转框()
    }

    ctx.lineWidth = 外线宽
    ctx.strokeStyle = 主色
    ctx.strokeRect(
      x + 外偏移,
      y + 外偏移,
      Math.max(1, 大小 - 外偏移 * 2),
      Math.max(1, 大小 - 外偏移 * 2),
    )

    ctx.lineWidth = 内线宽
    ctx.strokeStyle = 主色
    ctx.strokeRect(
      x + 内偏移,
      y + 内偏移,
      Math.max(1, 大小 - 内偏移 * 2),
      Math.max(1, 大小 - 内偏移 * 2),
    )

    if (是已占领塔) {
      const 角长 = Math.max(5, 大小 * 0.24)
      const 角偏移 = Math.max(3, 大小 * 0.12)
      ctx.globalAlpha = 1
      ctx.lineWidth = Math.max(2, 大小 * 0.055)
      ctx.strokeStyle = 主色
      ctx.beginPath()
      ctx.moveTo(x + 角偏移, y + 角偏移 + 角长)
      ctx.lineTo(x + 角偏移, y + 角偏移)
      ctx.lineTo(x + 角偏移 + 角长, y + 角偏移)
      ctx.moveTo(x + 大小 - 角偏移 - 角长, y + 角偏移)
      ctx.lineTo(x + 大小 - 角偏移, y + 角偏移)
      ctx.lineTo(x + 大小 - 角偏移, y + 角偏移 + 角长)
      ctx.moveTo(x + 大小 - 角偏移, y + 大小 - 角偏移 - 角长)
      ctx.lineTo(x + 大小 - 角偏移, y + 大小 - 角偏移)
      ctx.lineTo(x + 大小 - 角偏移 - 角长, y + 大小 - 角偏移)
      ctx.moveTo(x + 角偏移 + 角长, y + 大小 - 角偏移)
      ctx.lineTo(x + 角偏移, y + 大小 - 角偏移)
      ctx.lineTo(x + 角偏移, y + 大小 - 角偏移 - 角长)
      ctx.stroke()
    }

    ctx.restore()

    function 画占领塔旋转框() {
      const 中心X = x + 大小 / 2
      const 中心Y = y + 大小 / 2
      const 扩张 = Math.max(3, 大小 * 0.14)
      const 框大小 = 大小 + 扩张 * 2
      const 角长 = Math.max(8, 大小 * 0.34)
      const 线宽 = Math.max(3, 大小 * 0.1)
      const 左 = 中心X - 框大小 / 2
      const 上 = 中心Y - 框大小 / 2
      const 右 = 左 + 框大小
      const 下 = 上 + 框大小
      const 角度 = (动画时间 / 1400) * Math.PI * 2

      ctx.save()
      ctx.translate(中心X, 中心Y)
      ctx.rotate(角度)
      ctx.translate(-中心X, -中心Y)
      ctx.lineWidth = 线宽
      ctx.strokeStyle = '#ffffff'
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
      ctx.shadowBlur = Math.max(2, 大小 * 0.08)
      ctx.beginPath()
      ctx.moveTo(左, 上 + 角长)
      ctx.lineTo(左, 上)
      ctx.lineTo(左 + 角长, 上)
      ctx.moveTo(右 - 角长, 上)
      ctx.lineTo(右, 上)
      ctx.lineTo(右, 上 + 角长)
      ctx.moveTo(右, 下 - 角长)
      ctx.lineTo(右, 下)
      ctx.lineTo(右 - 角长, 下)
      ctx.moveTo(左 + 角长, 下)
      ctx.lineTo(左, 下)
      ctx.lineTo(左, 下 - 角长)
      ctx.stroke()
      ctx.restore()
    }
  }

  function 画基地标记(ctx, x, y, 大小) {
    const 外扩 = Math.max(6, 大小 * 0.18)
    const 外框左 = x - 外扩
    const 外框上 = y - 外扩
    const 外框大小 = 大小 + 外扩 * 2
    const 外边线宽 = Math.max(3, 大小 * 0.08)
    const 高光边距 = Math.max(2, 外扩 * 0.36)
    const 高光左 = 外框左 + 高光边距
    const 高光上 = 外框上 + 高光边距
    const 高光大小 = Math.max(1, 外框大小 - 高光边距 * 2)

    ctx.save()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)'
    ctx.shadowBlur = Math.max(2, 大小 * 0.06)
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = Math.max(1, 大小 * 0.03)

    ctx.fillStyle = '#d9b43b'
    ctx.fillRect(外框左, 外框上, 外框大小, 外框大小)

    ctx.shadowColor = 'transparent'
    ctx.strokeStyle = '#9a7720'
    ctx.lineWidth = 外边线宽
    ctx.strokeRect(外框左, 外框上, 外框大小, 外框大小)

    ctx.strokeStyle = 'rgba(255, 241, 181, 0.95)'
    ctx.lineWidth = Math.max(2, 大小 * 0.04)
    ctx.strokeRect(高光左, 高光上, 高光大小, 高光大小)

    ctx.restore()
  }

  function 画基地模拟兵力(ctx, 基地索引, x, y, 大小) {
    const 兵力 = 取得模拟基地兵力(基地索引)
    if (!Number.isInteger(兵力) || 兵力 < 0) return

    const 文本 = String(兵力)
    const 字号比例 = 文本.length >= 3 ? 0.46 : 文本.length >= 2 ? 0.54 : 0.64
    const 字号 = Math.max(12, Math.min(24, 大小 * 字号比例))
    const 中心x = x + 大小 / 2
    const 中心y = y + 大小 / 2

    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.font = `900 ${字号}px Arial, sans-serif`
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'
    ctx.lineWidth = Math.max(2, 大小 * 0.12)
    ctx.fillStyle = '#ffffff'
    ctx.strokeText(文本, 中心x, 中心y)
    ctx.fillText(文本, 中心x, 中心y)
    ctx.restore()
  }

  function 画中立塔兵力(ctx, 塔索引, x, y, 大小) {
    const 兵力 = 状态.中立塔兵力表.get(塔索引)
    if (!Number.isInteger(兵力) || 兵力 < 0) return

    const 文本 = String(兵力)
    const 字号比例 = 文本.length >= 3 ? 0.46 : 文本.length >= 2 ? 0.54 : 0.64
    const 字号 = Math.max(12, Math.min(24, 大小 * 字号比例))
    const 中心x = x + 大小 / 2
    const 中心y = y + 大小 / 2

    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.font = `900 ${字号}px Arial, sans-serif`
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'
    ctx.lineWidth = Math.max(2, 大小 * 0.12)
    ctx.fillStyle = '#ffffff'
    ctx.strokeText(文本, 中心x, 中心y)
    ctx.fillText(文本, 中心x, 中心y)
    ctx.restore()
  }

  function 取得模拟基地兵力(基地索引) {
    const 记忆 = 状态.基地兵力表.get(基地索引)
    if (!记忆 || !Number.isInteger(记忆.兵力) || 记忆.兵力 < 0) return null

    const 当前回合 = 状态.当前回合
    const 记录回合 = Number.isInteger(记忆.回合) ? 记忆.回合 : 当前回合
    if (!Number.isInteger(当前回合) || !Number.isInteger(记录回合)) {
      return 记忆.兵力
    }

    const 回合差 = 当前回合 - 记录回合
    if (回合差 <= 0) return 记忆.兵力

    const 基地自然增长 = Math.floor(回合差 / 2)
    const 大回合额外增长 = Math.floor(当前回合 / 50) - Math.floor(记录回合 / 50)

    return 记忆.兵力 + 基地自然增长 + 大回合额外增长
  }

  function 画操作轨迹(ctx, 格宽, 格高, 大小) {
    if (!状态.移动队列.length) return

    const 格子数 = 状态.宽度 * 状态.高度
    const 可绘制移动 = 状态.移动队列.filter((移动) => {
      return (
        Number.isInteger(移动.起点) &&
        Number.isInteger(移动.终点) &&
        移动.起点 >= 0 &&
        移动.终点 >= 0 &&
        移动.起点 < 格子数 &&
        移动.终点 < 格子数
      )
    })
    if (!可绘制移动.length) return

    const 线宽 = Math.max(1.5, Math.min(3, 大小 * 0.07))
    ctx.save()
    ctx.globalAlpha = 0.78
    可绘制移动.forEach((移动, 下标) => {
      const 起点 = 取得格子中心(移动.起点, 格宽, 格高)
      const 终点 = 取得格子中心(移动.终点, 格宽, 格高)
      ctx.globalAlpha = 下标 === 可绘制移动.length - 1 ? 0.9 : 0.45
      画箭头线(ctx, 起点, 终点, 线宽, 移动.是否半兵)
    })
    ctx.restore()

    画当前移动位置(
      ctx,
      可绘制移动[可绘制移动.length - 1].终点,
      格宽,
      格高,
      大小,
    )
  }

  function 画敌方移动高亮(ctx, 格宽, 格高, 大小) {
    if (!状态.敌方移动高亮列表.length) return

    const 格子数 = 状态.宽度 * 状态.高度
    const 可绘制移动 = 状态.敌方移动高亮列表.filter((移动) => {
      return (
        Number.isInteger(移动.起点) &&
        Number.isInteger(移动.终点) &&
        移动.起点 >= 0 &&
        移动.终点 >= 0 &&
        移动.起点 < 格子数 &&
        移动.终点 < 格子数
      )
    })
    if (!可绘制移动.length) return

    const 动画相位 = (performance.now() % 900) / 900
    const 脉冲 = 0.5 - Math.cos(动画相位 * Math.PI * 2) / 2
    const 线宽 = Math.max(2, Math.min(5, 大小 * (0.08 + 脉冲 * 0.05)))

    ctx.save()
    可绘制移动.forEach((移动) => {
      const 起点 = 取得格子中心(移动.起点, 格宽, 格高)
      const 终点 = 取得格子中心(移动.终点, 格宽, 格高)
      画敌方移动箭头(ctx, 起点, 终点, 线宽, 脉冲)
      画敌方移动终点(ctx, 移动.终点, 格宽, 格高, 大小, 脉冲)
    })
    ctx.restore()
  }

  function 画抢塔提示(ctx, 格宽, 格高, 大小) {
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

  function 安装样式() {
    if (!document.documentElement || document.getElementById(样式编号)) return
    const 样式 = document.createElement('style')
    样式.id = 样式编号
    样式.textContent = `
.${覆盖层类名} {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
    z-index: 2147483000;
}
.gio-tower-memory-host {
    position: relative !important;
}
#${大回合倒计时元素编号} {
    display: none !important;
}
.${大回合倒计时类名} {
    text-align: center !important;
    vertical-align: middle !important;
    white-space: nowrap !important;
    min-width: 38px !important;
    padding-left: 2px !important;
    padding-right: 2px !important;
}
.${大回合倒计时类名} .gio-big-turn-main {
    display: inline-block;
    font: 800 18px/1 Arial, sans-serif;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
}
.${大回合倒计时类名} .gio-big-turn-index {
    display: inline-block;
    margin-left: 2px;
    font: 700 10px/1 Arial, sans-serif;
    vertical-align: baseline;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
}
.${战场数据差类名} {
    color: #ffffff !important;
    font-weight: 800 !important;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85) !important;
}
.${战场数据差类名}[data-gio-battle-diff="advantage"] {
    background-color: ${我方蓝色} !important;
}
.${战场数据差类名}[data-gio-battle-diff="disadvantage"] {
    background-color: ${敌方红色} !important;
}
.${战场塔信息类名} {
    text-align: center !important;
    white-space: nowrap !important;
    color: #000000 !important;
}
.${战场塔信息类名} .gio-battle-tower-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin: 0 auto;
    padding: 2px 8px;
    border-radius: 999px;
    background-color: #d8d8d8;
    color: #000000 !important;
    font: 700 11px/1.2 Arial, sans-serif;
    text-shadow: none !important;
}
.${战场塔信息类名} .gio-battle-tower-item {
    color: #000000 !important;
}
.${战场塔信息类名} .gio-battle-tower-diff {
    color: #000000 !important;
}
.${战场塔信息类名}[data-gio-tower-diff="advantage"] .gio-battle-tower-diff {
    color: ${我方蓝色};
}
.${战场塔信息类名}[data-gio-tower-diff="disadvantage"] .gio-battle-tower-diff {
    color: ${敌方红色};
}
html.${基地危险类名}, body.${基地危险类名} {
    background-color: #4a0000 !important;
}
:root {
    --map-rgb-p1: 255,0,0;
    --map-color-p1: ${敌方红色};
    --map-rgb-p2: 39,146,255;
    --map-color-p2: ${我方蓝色};
}
.red, .selected-red, .leaderboard .red, #leaderboard .red {
    background-color: ${敌方红色} !important;
    fill: ${敌方红色} !important;
}
.lightblue, .selected-lightblue, .leaderboard .lightblue, #leaderboard .lightblue {
    background-color: ${我方蓝色} !important;
    fill: ${我方蓝色} !important;
}
.blue, .selected-blue, .leaderboard .blue, #leaderboard .blue {
    background-color: ${我方蓝色} !important;
    fill: ${我方蓝色} !important;
}
#turn-counter{
      display: none !important;
}    
`.trim()
    document.documentElement.appendChild(样式)
  }

  function 取画布() {
    return 取游戏画布()
  }

  function 取宿主(画布) {
    if (!画布) return null
    const 候选宿主 =
      画布.parentElement ||
      画布.closest('.relative') ||
      画布.closest('.game-page')
    if (!候选宿主) return null
    const 样式 = window.getComputedStyle(候选宿主)
    if (样式?.position === 'static') return document.body ?? 候选宿主
    return 候选宿主
  }

  function 取得格子中心(格子索引, 格宽, 格高) {
    const 行 = Math.floor(格子索引 / 状态.宽度)
    const 列 = 格子索引 % 状态.宽度
    return {
      x: 列 * 格宽 + 格宽 / 2,
      y: 行 * 格高 + 格高 / 2,
      行,
      列,
    }
  }

  function 画箭头线(ctx, 起点, 终点, 线宽, 半兵) {
    const dx = 终点.x - 起点.x
    const dy = 终点.y - 起点.y
    const 距离 = Math.hypot(dx, dy)
    if (!Number.isFinite(距离) || 距离 < 1) return

    const 缩进 = Math.max(4, 线宽 * 2.2)
    const 起x = 起点.x + (dx / 距离) * 缩进
    const 起y = 起点.y + (dy / 距离) * 缩进
    const 终x = 终点.x - (dx / 距离) * 缩进
    const 终y = 终点.y - (dy / 距离) * 缩进
    const 角度 = Math.atan2(终y - 起y, 终x - 起x)
    const 箭头长 = Math.max(5, Math.min(10, 线宽 * 3.1))
    const 箭头角 = Math.PI / 6

    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.globalAlpha = 0.62
    ctx.lineWidth = 线宽 + Math.max(1.5, 线宽 * 0.75)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)'
    ctx.setLineDash(
      半兵 ? [Math.max(4, 线宽 * 2.2), Math.max(3, 线宽 * 1.4)] : [],
    )
    ctx.beginPath()
    ctx.moveTo(起x, 起y)
    ctx.lineTo(终x, 终y)
    ctx.stroke()

    ctx.globalAlpha = 0.78
    ctx.lineWidth = 线宽
    ctx.strokeStyle = 半兵 ? '#d7fbff' : '#25f1ff'
    ctx.beginPath()
    ctx.moveTo(起x, 起y)
    ctx.lineTo(终x, 终y)
    ctx.stroke()

    ctx.setLineDash([])
    ctx.globalAlpha = 0.68
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.76)'
    ctx.lineWidth = 线宽 + Math.max(1.5, 线宽 * 0.6)
    ctx.beginPath()
    ctx.moveTo(终x, 终y)
    ctx.lineTo(
      终x - 箭头长 * Math.cos(角度 - 箭头角),
      终y - 箭头长 * Math.sin(角度 - 箭头角),
    )
    ctx.moveTo(终x, 终y)
    ctx.lineTo(
      终x - 箭头长 * Math.cos(角度 + 箭头角),
      终y - 箭头长 * Math.sin(角度 + 箭头角),
    )
    ctx.stroke()

    ctx.globalAlpha = 0.95
    ctx.strokeStyle = 半兵 ? '#d7fbff' : '#25f1ff'
    ctx.lineWidth = 线宽
    ctx.beginPath()
    ctx.moveTo(终x, 终y)
    ctx.lineTo(
      终x - 箭头长 * Math.cos(角度 - 箭头角),
      终y - 箭头长 * Math.sin(角度 - 箭头角),
    )
    ctx.moveTo(终x, 终y)
    ctx.lineTo(
      终x - 箭头长 * Math.cos(角度 + 箭头角),
      终y - 箭头长 * Math.sin(角度 + 箭头角),
    )
    ctx.stroke()

    if (半兵) {
      ctx.globalAlpha = 0.85
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)'
      ctx.lineWidth = Math.max(1, 线宽 * 0.45)
      ctx.beginPath()
      ctx.arc(
        (起x + 终x) / 2,
        (起y + 终y) / 2,
        Math.max(2, 线宽 * 0.75),
        0,
        Math.PI * 2,
      )
      ctx.stroke()
      ctx.fill()
    }

    ctx.restore()
  }

  function 画敌方移动箭头(ctx, 起点, 终点, 线宽, 脉冲) {
    const dx = 终点.x - 起点.x
    const dy = 终点.y - 起点.y
    const 距离 = Math.hypot(dx, dy)
    if (!Number.isFinite(距离) || 距离 < 1) return

    const 缩进 = Math.max(4, 线宽 * 2.1)
    const 起x = 起点.x + (dx / 距离) * 缩进
    const 起y = 起点.y + (dy / 距离) * 缩进
    const 终x = 终点.x - (dx / 距离) * 缩进
    const 终y = 终点.y - (dy / 距离) * 缩进
    const 角度 = Math.atan2(终y - 起y, 终x - 起x)
    const 箭头长 = Math.max(7, Math.min(14, 线宽 * 3.2))
    const 箭头角 = Math.PI / 6

    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalAlpha = 0.68 + 脉冲 * 0.22
    ctx.lineWidth = 线宽 + Math.max(2, 线宽 * 0.85)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.82)'
    ctx.beginPath()
    ctx.moveTo(起x, 起y)
    ctx.lineTo(终x, 终y)
    ctx.stroke()

    ctx.globalAlpha = 0.86
    ctx.lineWidth = 线宽
    ctx.strokeStyle = 敌方红色
    ctx.beginPath()
    ctx.moveTo(起x, 起y)
    ctx.lineTo(终x, 终y)
    ctx.stroke()

    ctx.globalAlpha = 0.82
    ctx.lineWidth = Math.max(1.5, 线宽 * 0.45)
    ctx.strokeStyle = '#fff0f0'
    ctx.beginPath()
    ctx.moveTo(起x, 起y)
    ctx.lineTo(终x, 终y)
    ctx.stroke()

    ctx.globalAlpha = 0.78
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.82)'
    ctx.lineWidth = 线宽 + Math.max(2, 线宽 * 0.7)
    ctx.beginPath()
    ctx.moveTo(终x, 终y)
    ctx.lineTo(
      终x - 箭头长 * Math.cos(角度 - 箭头角),
      终y - 箭头长 * Math.sin(角度 - 箭头角),
    )
    ctx.moveTo(终x, 终y)
    ctx.lineTo(
      终x - 箭头长 * Math.cos(角度 + 箭头角),
      终y - 箭头长 * Math.sin(角度 + 箭头角),
    )
    ctx.stroke()

    ctx.globalAlpha = 0.95
    ctx.strokeStyle = '#ff3838'
    ctx.lineWidth = 线宽
    ctx.beginPath()
    ctx.moveTo(终x, 终y)
    ctx.lineTo(
      终x - 箭头长 * Math.cos(角度 - 箭头角),
      终y - 箭头长 * Math.sin(角度 - 箭头角),
    )
    ctx.moveTo(终x, 终y)
    ctx.lineTo(
      终x - 箭头长 * Math.cos(角度 + 箭头角),
      终y - 箭头长 * Math.sin(角度 + 箭头角),
    )
    ctx.stroke()
    ctx.restore()
  }

  function 画敌方移动终点(ctx, 格子索引, 格宽, 格高, 大小, 脉冲) {
    const 行 = Math.floor(格子索引 / 状态.宽度)
    const 列 = 格子索引 % 状态.宽度
    const x = 列 * 格宽
    const y = 行 * 格高
    const 外线宽 = Math.max(2, 大小 * (0.08 + 脉冲 * 0.06))
    const 内缩 = Math.max(3, 大小 * (0.12 - 脉冲 * 0.03))

    ctx.save()
    ctx.lineJoin = 'round'
    ctx.globalAlpha = 0.36 + 脉冲 * 0.18
    ctx.fillStyle = 'rgba(255, 0, 0, 0.32)'
    ctx.fillRect(x + 1, y + 1, Math.max(1, 格宽 - 2), Math.max(1, 格高 - 2))

    ctx.globalAlpha = 0.9
    ctx.lineWidth = 外线宽
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'
    ctx.strokeRect(
      x + 内缩,
      y + 内缩,
      Math.max(1, 格宽 - 内缩 * 2),
      Math.max(1, 格高 - 内缩 * 2),
    )

    ctx.lineWidth = Math.max(1.5, 外线宽 * 0.5)
    ctx.strokeStyle = '#ff3838'
    ctx.strokeRect(
      x + 内缩,
      y + 内缩,
      Math.max(1, 格宽 - 内缩 * 2),
      Math.max(1, 格高 - 内缩 * 2),
    )
    ctx.restore()
  }

  function 画选中棋子(ctx, 格宽, 格高, 大小, 动画时间) {
    const 格子索引 = 选中格子索引
    const 格子数 = 状态.宽度 * 状态.高度
    if (!Number.isInteger(格子索引)) return
    if (格子索引 < 0 || 格子索引 >= 格子数) {
      选中格子索引 = null
      return
    }

    const 行 = Math.floor(格子索引 / 状态.宽度)
    const 列 = 格子索引 % 状态.宽度
    const 中心x = 列 * 格宽 + 格宽 / 2
    const 中心y = 行 * 格高 + 格高 / 2
    const 动画相位 = (动画时间 % 760) / 760
    const 脉冲 = 0.5 - Math.cos(动画相位 * Math.PI * 2) / 2
    const 半径 = Math.max(5, 大小 * (0.42 + 脉冲 * 0.05))
    const 外线宽 = Math.max(3, 大小 * (0.12 + 脉冲 * 0.03))
    const 内线宽 = Math.max(1.5, 外线宽 * 0.35)

    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.shadowColor = 'rgba(255, 228, 77, 0.88)'
    ctx.shadowBlur = Math.max(6, 大小 * (0.18 + 脉冲 * 0.1))

    ctx.globalAlpha = 0.96
    ctx.lineWidth = 外线宽 + Math.max(3, 大小 * 0.08)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.98)'
    画圆环(半径)

    ctx.globalAlpha = 1
    ctx.lineWidth = 外线宽
    ctx.strokeStyle = '#ffe44d'
    画圆环(半径)

    ctx.shadowColor = 'transparent'
    ctx.lineWidth = 内线宽
    ctx.strokeStyle = '#ffffff'
    画圆环(Math.max(2, 半径 - 外线宽 * 0.95))

    ctx.restore()

    function 画圆环(半径) {
      ctx.beginPath()
      ctx.arc(中心x, 中心y, 半径, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  function 画当前移动位置(ctx, 格子索引, 格宽, 格高, 大小) {
    const 行 = Math.floor(格子索引 / 状态.宽度)
    const 列 = 格子索引 % 状态.宽度
    const x = 列 * 格宽
    const y = 行 * 格高
    const 方形边长 = Math.max(4, 大小 * 0.76)
    const 方形x = x + (格宽 - 方形边长) / 2
    const 方形y = y + (格高 - 方形边长) / 2
    const 外线宽 = Math.max(2, 大小 * 0.08)
    const 内线宽 = Math.max(1.2, 大小 * 0.035)

    ctx.save()
    ctx.lineCap = 'square'
    ctx.lineJoin = 'miter'

    ctx.globalAlpha = 0.72
    ctx.lineWidth = 外线宽
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)'
    ctx.strokeRect(方形x, 方形y, 方形边长, 方形边长)

    ctx.globalAlpha = 0.9
    ctx.lineWidth = 内线宽
    ctx.strokeStyle = '#25f1ff'
    ctx.strokeRect(方形x, 方形y, 方形边长, 方形边长)

    ctx.restore()
  }
}

function 安装自适应样式() {
  if (!document.documentElement || document.getElementById(自适应样式编号))
    return

  const 样式 = document.createElement('style')
  样式.id = 自适应样式编号
  样式.textContent = `
body:has(#game-page #gameMap.gio-adaptive-map) {
    overflow: hidden !important;
}
#${地图大小元素编号} {
    position: fixed !important;
    pointer-events: none !important;
    z-index: 2147483001 !important;
    display: none;
    padding: 5px 8px !important;
    border-radius: 4px !important;
    background: rgba(0, 0, 0, 0.72) !important;
    color: #ffffff !important;
    font: 800 13px/1 Arial, sans-serif !important;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9) !important;
    white-space: nowrap !important;
}
#game-page #gameMap.gio-adaptive-map {
    transform: scale(var(--gio-adaptive-map-scale, 1)) !important;
    transform-origin: left top !important;
}
#game-page #gameMap.gio-adaptive-map-host,
#game-page .gio-adaptive-map-host {
    position: fixed !important;
    left: 0 !important;
    top: 0 !important;
    right: auto !important;
    bottom: auto !important;
    width: var(--gio-adaptive-map-width, auto) !important;
    height: var(--gio-adaptive-map-height, auto) !important;
    transform: none !important;
    margin: 0 !important;
    padding: 0 !important;
    z-index: 20 !important;
}
`.trim()
  document.documentElement.appendChild(样式)
}

function 取游戏画布() {
  return document.querySelector('#game-page #gameMap .game-map-canvas')
}

function 安装选中监听() {
  if (已安装选中监听) return
  if (!document) return
  已安装选中监听 = true
  document.addEventListener('pointerdown', 记录点击选中格子, {
    capture: true,
    passive: true,
  })
}

function 记录点击选中格子(事件) {
  if (Number.isInteger(事件.button) && 事件.button !== 0) return
  const 目标 = 事件.target instanceof Element ? 事件.target : null
  const 地图元素 = 目标?.closest?.('#game-page #gameMap')
  if (!地图元素) return

  const 画布 = 地图元素.querySelector('.game-map-canvas')
  if (!画布) return

  const 格子索引 = 取得点击格子索引(事件, 画布)
  if (!Number.isInteger(格子索引)) return

  选中格子索引 = 格子索引
  请求覆盖层渲染()
}

function 取得点击格子索引(事件, 画布) {
  if (!状态.宽度 || !状态.高度) return null

  const 矩形 = 画布.getBoundingClientRect()
  if (矩形.width <= 0 || 矩形.height <= 0) return null

  const x = 事件.clientX - 矩形.left
  const y = 事件.clientY - 矩形.top
  if (x < 0 || y < 0 || x >= 矩形.width || y >= 矩形.height) return null

  const 列 = Math.min(状态.宽度 - 1, Math.floor((x / 矩形.width) * 状态.宽度))
  const 行 = Math.min(状态.高度 - 1, Math.floor((y / 矩形.height) * 状态.高度))
  return 行 * 状态.宽度 + 列
}

function 请求覆盖层渲染() {
  if (状态.已请求渲染) return
  状态.已请求渲染 = true
  requestAnimationFrame(() => {
    渲染()
  })
}

function 同步地图大小标签(地图元素) {
  const 标签 = 确保地图大小标签()
  if (!标签) return

  if (!状态.宽度 || !状态.高度) {
    标签.style.display = 'none'
    return
  }

  const 长 = 状态.宽度
  const 宽 = 状态.高度
  const 文本 = `地图大小: ${长} * ${宽} = ${长 * 宽}`
  if (标签.textContent !== 文本) 标签.textContent = 文本
  if (标签.style.display !== 'block') 标签.style.display = 'block'

  const 间距 = 8
  const 地图矩形 = 地图元素.getBoundingClientRect()
  const 标签矩形 = 标签.getBoundingClientRect()
  const 右侧x = 地图矩形.right + 间距
  const 内侧x = 地图矩形.right - 标签矩形.width - 间距
  const x = 右侧x + 标签矩形.width + 间距 <= window.innerWidth ? 右侧x : 内侧x
  const y = 地图矩形.top + 间距

  const left = `${Math.max(间距, x)}px`
  const top = `${Math.max(间距, y)}px`
  if (标签.style.left !== left) 标签.style.left = left
  if (标签.style.top !== top) 标签.style.top = top
}

function 确保地图大小标签() {
  const 已有标签 = document.getElementById(地图大小元素编号)
  if (已有标签) return 已有标签
  if (!document.body) return null

  const 标签 = document.createElement('div')
  标签.id = 地图大小元素编号
  document.body.appendChild(标签)
  return 标签
}

function 标记当前棋盘(地图元素, 宿主) {
  document.querySelectorAll('.gio-adaptive-map').forEach((元素) => {
    if (元素 !== 地图元素) 元素.classList.remove('gio-adaptive-map')
  })
  document.querySelectorAll('.gio-adaptive-map-host').forEach((元素) => {
    if (元素 !== 地图元素 && 元素 !== 宿主) {
      元素.classList.remove('gio-adaptive-map-host')
    }
  })

  地图元素.classList.add('gio-adaptive-map')
  宿主.classList.add('gio-adaptive-map-host')
}

function 取得地图原始尺寸(地图元素, 画布) {
  const 宽 = 读取像素尺寸(
    画布.offsetWidth,
    地图元素.offsetWidth,
    地图元素.style.getPropertyValue('--gio-adaptive-map-width'),
    画布.getBoundingClientRect().width /
      读取数字(地图元素.style.getPropertyValue('--gio-adaptive-map-scale'), 1),
  )
  const 高 = 读取像素尺寸(
    画布.offsetHeight,
    地图元素.offsetHeight,
    地图元素.style.getPropertyValue('--gio-adaptive-map-height'),
    画布.getBoundingClientRect().height /
      读取数字(地图元素.style.getPropertyValue('--gio-adaptive-map-scale'), 1),
  )

  if (宽 <= 0 || 高 <= 0) return null
  return { 宽, 高 }
}

function 读取像素尺寸(...候选值列表) {
  for (const 候选值 of 候选值列表) {
    const 数值 = 读取数字(候选值, 0)
    if (数值 > 0) return 数值
  }
  return 0
}

function 读取数字(值, 默认值) {
  const 数值 = Number.parseFloat(值)
  return Number.isFinite(数值) ? 数值 : 默认值
}
