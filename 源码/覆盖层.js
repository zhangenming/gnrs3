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
  战场数据差类名,
  未到达视野背景色,
  样式编号,
  敌方红色,
  覆盖层类名,
  我方蓝色,
  兵力着色最小兵力,
} from './配置.js'
import { 是我方或队友 } from './游戏.js'
import { 状态 } from './状态.js'
import { 清理敌方移动高亮 } from './功能/敌方移动高亮.js'
import { 有未到达视野标记 } from './功能/视野.js'

export function 清空覆盖层() {
  const 覆盖层 = document.querySelector(`.${覆盖层类名}`)
  if (!覆盖层) return
  const ctx = 覆盖层.getContext('2d')
  if (ctx) ctx.clearRect(0, 0, 覆盖层.width, 覆盖层.height)
}

export function 渲染() {
  状态.已请求渲染 = false
  清理敌方移动高亮()

  if (
    !状态.已知塔集合.size &&
    !状态.已知敌方基地集合.size &&
    !状态.移动队列.length &&
    !状态.敌方移动高亮列表.length &&
    !状态.兵力分布着色列表.length &&
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

  画未到达视野背景()
  画兵力分布着色()
  画操作轨迹(ctx, 格宽, 格高, 大小)
  画敌方移动高亮(ctx, 格宽, 格高, 大小)

  状态.已知塔集合.forEach((塔索引) => {
    const 行 = Math.floor(塔索引 / 状态.宽度)
    const 列 = 塔索引 % 状态.宽度
    画塔标记(ctx, 列 * 格宽, 行 * 格高, 大小, 状态.已知塔类型.get(塔索引))
  })

  状态.已知敌方基地集合.forEach((基地, 基地索引) => {
    const 行 = Math.floor(基地索引 / 状态.宽度)
    const 列 = 基地索引 % 状态.宽度
    画敌方基地标记(ctx, 列 * 格宽, 行 * 格高, 大小)
  })

  if (状态.敌方移动高亮列表.length) {
    requestAnimationFrame(() => {
      if (!状态.敌方移动高亮列表.length || 状态.已请求渲染) return
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

  function 画兵力分布着色() {
    const 可绘制着色列表 = 取得当前有效着色列表()
    if (!可绘制着色列表.length) return

    const 同步着色列表 = 取得同步着色列表(可绘制着色列表)
    const 兵力级别 = Array.from(
      new Set(同步着色列表.map((地块) => 地块.兵力)),
    ).slice(0, 5)
    if (!兵力级别.length) return
    const 级别覆盖比例 = [1, 0.7, 0.4, 0.2, 0.1]
    const 兵力级别覆盖比例 = new Map(
      兵力级别.map((兵力, idx) => [兵力, 级别覆盖比例[idx]]),
    )
    const 级别样式 = [
      {
        背景色: 'rgba(255, 118, 0, 0.84)',
        提示色: 'rgba(255, 244, 92, 0.32)',
      },
      {
        背景色: 'rgba(0, 222, 214, 0.78)',
        提示色: 'rgba(180, 255, 250, 0.28)',
      },
      {
        背景色: 'rgba(68, 107, 255, 0.72)',
        提示色: 'rgba(166, 188, 255, 0.24)',
      },
      {
        背景色: 'rgba(45, 76, 214, 0.62)',
        提示色: 'rgba(128, 158, 255, 0.2)',
      },
      {
        背景色: 'rgba(30, 52, 170, 0.54)',
        提示色: 'rgba(98, 130, 255, 0.16)',
      },
    ]
    const 兵力级别样式 = new Map(
      兵力级别.map((兵力, idx) => [兵力, 级别样式[idx]]),
    )

    ctx.save()
    同步着色列表.forEach((地块) => {
      const 覆盖比例 = 兵力级别覆盖比例.get(地块.兵力)
      if (!覆盖比例) return
      const 样式 = 兵力级别样式.get(地块.兵力)
      const 行 = Math.floor(地块.索引 / 状态.宽度)
      const 列 = 地块.索引 % 状态.宽度
      const x = 列 * 格宽
      const y = 行 * 格高
      const 宽 = Math.max(1, 格宽 * 覆盖比例)
      const 高 = Math.max(1, 格高 * 覆盖比例)

      画兵力信号块(x, y, 宽, 高, 样式)
    })
    画兵力读数()
    ctx.restore()

    function 画兵力读数() {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineJoin = 'round'
      同步着色列表.forEach((地块) => {
        if (!兵力级别覆盖比例.has(地块.兵力)) return
        const 行 = Math.floor(地块.索引 / 状态.宽度)
        const 列 = 地块.索引 % 状态.宽度
        const x = 列 * 格宽 + 格宽 / 2
        const y = 行 * 格高 + 格高 / 2
        const 文本 = 取得兵力读数文本(地块)
        const 字号比例 =
          文本.length >= 3 ? 0.46 : 文本.length >= 2 ? 0.54 : 0.64
        const 字号 = Math.max(12, Math.min(24, 大小 * 字号比例))

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
          同步列表.push({ ...地块, 兵力: 原始文本.兵力 })
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
        有效列表.push({ 索引: 地块.索引, 兵力, 归属 })
      }

      if (发生变化) {
        状态.兵力分布着色列表 = 有效列表
      }
      return 有效列表
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
    const css宽 = Math.max(1, 画布矩形.width)
    const css高 = Math.max(1, 画布矩形.height)
    const 像素宽 = Math.round(css宽 * dpr)
    const 像素高 = Math.round(css高 * dpr)

    if (部件.覆盖层.width !== 像素宽) 部件.覆盖层.width = 像素宽
    if (部件.覆盖层.height !== 像素高) 部件.覆盖层.height = 像素高
    部件.覆盖层.style.width = `${css宽}px`
    部件.覆盖层.style.height = `${css高}px`
    部件.覆盖层.style.left = `${画布矩形.left - 宿主矩形.left}px`
    部件.覆盖层.style.top = `${画布矩形.top - 宿主矩形.top}px`

    return { dpr, css宽, css高 }
  }

  function 画塔标记(ctx, x, y, 大小, 类型) {
    const 是敌方塔 = 类型 === '敌方塔'
    const 是我方塔 = 类型 === '我方塔'
    const 外线宽 = Math.max(2, 大小 * 0.09)
    const 内线宽 = Math.max(1.5, 大小 * (是敌方塔 ? 0.065 : 0.05))
    const 外偏移 = 外线宽 / 2 + 1
    const 内偏移 = 外偏移 + 外线宽 / 2 + 内线宽 / 2
    const 主色 = 是敌方塔 ? 敌方红色 : 是我方塔 ? 我方蓝色 : 中立黄色
    const 高光色 = 是敌方塔 ? '#ffb3b3' : 是我方塔 ? '#b8dcff' : '#fff4a8'

    ctx.save()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    if (是敌方塔) {
      ctx.globalAlpha = 0.42
      ctx.fillStyle = 敌方红色
      ctx.fillRect(x + 外偏移, y + 外偏移, 大小 - 外偏移 * 2, 大小 - 外偏移 * 2)
      ctx.globalAlpha = 1
    }

    ctx.lineWidth = 外线宽
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.88)'
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

    ctx.globalAlpha = 0.55
    ctx.lineWidth = Math.max(1, 内线宽 * 0.75)
    ctx.strokeStyle = 高光色
    ctx.strokeRect(
      x + 内偏移 + 内线宽 * 1.5,
      y + 内偏移 + 内线宽 * 1.5,
      Math.max(1, 大小 - (内偏移 + 内线宽 * 1.5) * 2),
      Math.max(1, 大小 - (内偏移 + 内线宽 * 1.5) * 2),
    )

    if (是敌方塔 || 是我方塔) {
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
  }

  function 画敌方基地标记(ctx, x, y, 大小) {
    const 外线宽 = Math.max(6, 大小 * 0.28)
    const 内线宽 = Math.max(4, 大小 * 0.16)
    const 十字线宽 = Math.max(2.5, 大小 * 0.1)
    const 外偏移 = 外线宽 / 2 + 1
    const 内偏移 = 外偏移 + 外线宽 / 2 + 内线宽 / 2
    const 中心x = x + 大小 / 2
    const 中心y = y + 大小 / 2
    const 十字长度 = Math.max(6, 大小 * 0.34)

    ctx.save()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    ctx.globalAlpha = 0.5
    ctx.fillStyle = 敌方红色
    ctx.fillRect(x + 1, y + 1, Math.max(1, 大小 - 2), Math.max(1, 大小 - 2))
    ctx.globalAlpha = 1

    ctx.lineWidth = 外线宽
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.96)'
    ctx.strokeRect(
      x + 外偏移,
      y + 外偏移,
      Math.max(1, 大小 - 外偏移 * 2),
      Math.max(1, 大小 - 外偏移 * 2),
    )

    ctx.lineWidth = 内线宽
    ctx.strokeStyle = 敌方红色
    ctx.strokeRect(
      x + 内偏移,
      y + 内偏移,
      Math.max(1, 大小 - 内偏移 * 2),
      Math.max(1, 大小 - 内偏移 * 2),
    )

    ctx.lineWidth = 十字线宽 + Math.max(2, 大小 * 0.06)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.92)'
    ctx.beginPath()
    ctx.moveTo(中心x - 十字长度, 中心y)
    ctx.lineTo(中心x + 十字长度, 中心y)
    ctx.moveTo(中心x, 中心y - 十字长度)
    ctx.lineTo(中心x, 中心y + 十字长度)
    ctx.stroke()

    ctx.lineWidth = 十字线宽
    ctx.strokeStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(中心x - 十字长度, 中心y)
    ctx.lineTo(中心x + 十字长度, 中心y)
    ctx.moveTo(中心x, 中心y - 十字长度)
    ctx.lineTo(中心x, 中心y + 十字长度)
    ctx.stroke()

    ctx.restore()
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
html.${基地危险类名}, body.${基地危险类名} {
    background-color: #4a0000 !important;
}
@keyframes gio-current-move-pulse {
    0% { box-shadow: inset 0 0 0 2px #00eaff, 0 0 0 2px rgba(0, 0, 0, 0.95), 0 0 7px rgba(0, 234, 255, 0.85) !important; }
    50% { box-shadow: inset 0 0 0 3px #ffffff, 0 0 0 2px rgba(0, 0, 0, 0.95), 0 0 14px rgba(0, 234, 255, 1) !important; }
    100% { box-shadow: inset 0 0 0 2px #00eaff, 0 0 0 2px rgba(0, 0, 0, 0.95), 0 0 7px rgba(0, 234, 255, 0.85) !important; }
}
#gameMap td.selected, #gameMap td.selected50, #gameMap td[class*='selected-'],
.tiles-canvas-preview td.selected, .tiles-canvas-preview td.selected50, .tiles-canvas-preview td[class*='selected-'] {
    border-color: #ffffff !important;
    outline: 2px solid #00eaff !important;
    outline-offset: -3px !important;
    animation: gio-current-move-pulse 0.9s infinite !important;
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
    return document.querySelector('.game-map-canvas')
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

  function 画当前移动位置(ctx, 格子索引, 格宽, 格高, 大小) {
    const 行 = Math.floor(格子索引 / 状态.宽度)
    const 列 = 格子索引 % 状态.宽度
    const x = 列 * 格宽
    const y = 行 * 格高
    const 外线宽 = Math.max(2, 大小 * 0.07)
    const 内线宽 = Math.max(1.2, 大小 * 0.035)
    const 角长 = Math.max(4, 大小 * 0.2)
    const 角偏移 = Math.max(4, 大小 * 0.18)

    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.globalAlpha = 0.46
    ctx.lineWidth = 外线宽
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)'
    ctx.beginPath()
    ctx.moveTo(x + 角偏移, y + 角偏移 + 角长)
    ctx.lineTo(x + 角偏移, y + 角偏移)
    ctx.lineTo(x + 角偏移 + 角长, y + 角偏移)
    ctx.moveTo(x + 格宽 - 角偏移 - 角长, y + 角偏移)
    ctx.lineTo(x + 格宽 - 角偏移, y + 角偏移)
    ctx.lineTo(x + 格宽 - 角偏移, y + 角偏移 + 角长)
    ctx.moveTo(x + 格宽 - 角偏移, y + 格高 - 角偏移 - 角长)
    ctx.lineTo(x + 格宽 - 角偏移, y + 格高 - 角偏移)
    ctx.lineTo(x + 格宽 - 角偏移 - 角长, y + 格高 - 角偏移)
    ctx.moveTo(x + 角偏移 + 角长, y + 格高 - 角偏移)
    ctx.lineTo(x + 角偏移, y + 格高 - 角偏移)
    ctx.lineTo(x + 角偏移, y + 格高 - 角偏移 - 角长)
    ctx.stroke()

    ctx.globalAlpha = 0.9
    ctx.lineWidth = 内线宽
    ctx.strokeStyle = '#25f1ff'
    ctx.beginPath()
    ctx.moveTo(x + 角偏移, y + 角偏移 + 角长)
    ctx.lineTo(x + 角偏移, y + 角偏移)
    ctx.lineTo(x + 角偏移 + 角长, y + 角偏移)
    ctx.moveTo(x + 格宽 - 角偏移 - 角长, y + 角偏移)
    ctx.lineTo(x + 格宽 - 角偏移, y + 角偏移)
    ctx.lineTo(x + 格宽 - 角偏移, y + 角偏移 + 角长)
    ctx.moveTo(x + 格宽 - 角偏移, y + 格高 - 角偏移 - 角长)
    ctx.lineTo(x + 格宽 - 角偏移, y + 格高 - 角偏移)
    ctx.lineTo(x + 格宽 - 角偏移 - 角长, y + 格高 - 角偏移)
    ctx.moveTo(x + 角偏移 + 角长, y + 格高 - 角偏移)
    ctx.lineTo(x + 角偏移, y + 格高 - 角偏移)
    ctx.lineTo(x + 角偏移, y + 格高 - 角偏移 - 角长)
    ctx.stroke()

    ctx.restore()
  }
}
