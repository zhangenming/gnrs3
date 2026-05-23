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
} from './config.js'
import { 是我方或队友 } from './game.js'
import { 状态 } from './state.js'
import { 有未到达视野标记 } from './feats/vision.js'

export function 清空覆盖层() {
  const 覆盖层 = document.querySelector(`.${覆盖层类名}`)
  if (!覆盖层) return
  const ctx = 覆盖层.getContext('2d')
  if (ctx) ctx.clearRect(0, 0, 覆盖层.width, 覆盖层.height)
}

export function 渲染() {
  状态.已请求渲染 = false

  if (
    !状态.已知塔集合.size &&
    !状态.已知敌方基地集合.size &&
    !状态.移动队列.length &&
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
    const 级别背景色 = [
      'rgba(0, 24, 170, 0.82)',
      'rgba(0, 214, 170, 0.74)',
      'rgba(0, 54, 220, 0.72)',
      'rgba(0, 54, 220, 0.72)',
      'rgba(0, 54, 220, 0.72)',
    ]
    const 兵力级别背景色 = new Map(
      兵力级别.map((兵力, idx) => [兵力, 级别背景色[idx]]),
    )

    ctx.save()
    同步着色列表.forEach((地块) => {
      const 覆盖比例 = 兵力级别覆盖比例.get(地块.兵力)
      if (!覆盖比例) return
      ctx.fillStyle = 兵力级别背景色.get(地块.兵力)
      const 行 = Math.floor(地块.索引 / 状态.宽度)
      const 列 = 地块.索引 % 状态.宽度
      const x = 列 * 格宽
      const y = 行 * 格高
      const 宽 = Math.max(1, 格宽 * 覆盖比例)
      const 高 = Math.max(1, 格高 * 覆盖比例)

      ctx.fillRect(x + (格宽 - 宽) / 2, y + (格高 - 高) / 2, 宽, 高)
    })
    画同步兵力数字()
    ctx.restore()

    function 画同步兵力数字() {
      if (!状态.原始兵力文本.size) return

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `900 ${Math.max(13, Math.min(24, 大小 * 0.62))}px Arial, sans-serif`
      ctx.lineJoin = 'round'
      ctx.lineWidth = Math.max(1.5, Math.min(2.6, 大小 * 0.055))
      ctx.strokeStyle = 'rgba(0, 7, 26, 0.98)'
      ctx.fillStyle = '#ffe95c'
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
      ctx.shadowBlur = Math.max(1, 大小 * 0.025)
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = Math.max(1, 大小 * 0.03)
      同步着色列表.forEach((地块) => {
        if (!兵力级别覆盖比例.has(地块.兵力)) return
        const 原始文本 = 状态.原始兵力文本.get(地块.索引)
        if (!原始文本 || 原始文本.兵力 !== 地块.兵力) return
        const 行 = Math.floor(地块.索引 / 状态.宽度)
        const 列 = 地块.索引 % 状态.宽度
        const x = 列 * 格宽 + 格宽 / 2
        const y = 行 * 格高 + 格高 / 2
        const 文本 = 原始文本.文本

        ctx.strokeText(文本, x, y)
        ctx.fillText(文本, x, y)
      })
    }

    function 取得同步着色列表(列表) {
      if (!状态.原始兵力文本.size) return 列表

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
    const 外线宽 = Math.max(4, 大小 * 0.17)
    const 内线宽 = Math.max(2.5, 大小 * 0.09)
    const 高光线宽 = Math.max(1.5, 大小 * 0.045)
    const 外偏移 = 外线宽 / 2 + 1
    const 内偏移 = 外偏移 + 外线宽 / 2 + 内线宽 / 2
    const 高光偏移 = 内偏移 + 内线宽 / 2 + 高光线宽 / 2
    const 角长 = Math.max(5, 大小 * 0.26)
    const 角偏移 = Math.max(2, 大小 * 0.07)

    ctx.save()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

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

    ctx.lineWidth = 高光线宽
    ctx.strokeStyle = '#fff2f2'
    ctx.strokeRect(
      x + 高光偏移,
      y + 高光偏移,
      Math.max(1, 大小 - 高光偏移 * 2),
      Math.max(1, 大小 - 高光偏移 * 2),
    )

    ctx.lineWidth = Math.max(2.5, 大小 * 0.085)
    ctx.strokeStyle = 敌方红色
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
