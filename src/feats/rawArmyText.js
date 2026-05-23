import { 状态 } from '../state.js'
import { 安全执行 } from '../utils.js'

export function 安装原始兵力文本捕获(请求渲染) {
  const 钩子键 = '__gio兵力文本捕获钩子'
  const 记录器键 = '__gio兵力文本记录器'
  const 清理器键 = '__gio兵力文本清理器'
  const 原型 = window.CanvasRenderingContext2D?.prototype
  if (!原型) return

  if (!window[钩子键]) {
    const 原fillText = 原型.fillText
    const 原strokeText = 原型.strokeText
    const 原clearRect = 原型.clearRect
    原型.fillText = function (文本, x, y, ...参数) {
      window[记录器键]?.(this, 文本, x, y)
      return 原fillText.call(this, 文本, x, y, ...参数)
    }
    原型.strokeText = function (文本, x, y, ...参数) {
      window[记录器键]?.(this, 文本, x, y)
      return 原strokeText.call(this, 文本, x, y, ...参数)
    }
    原型.clearRect = function (x, y, 宽, 高) {
      window[清理器键]?.(this, x, y, 宽, 高)
      return 原clearRect.call(this, x, y, 宽, 高)
    }
    window[钩子键] = true
  }

  window[记录器键] = 捕获原始兵力文本
  window[清理器键] = 清理原始兵力文本

  function 捕获原始兵力文本(ctx, 文本, x, y) {
    const 画布 = ctx?.canvas
    if (!画布?.classList?.contains('game-map-canvas')) return
    if (!状态.宽度 || !状态.高度) return

    const 兵力 = 解析兵力文本(文本)
    if (!Number.isInteger(兵力)) return

    const 点 = 取得画布坐标(ctx, Number(x), Number(y))
    if (!点) return

    const 格宽 = 画布.width / 状态.宽度
    const 格高 = 画布.height / 状态.高度
    if (
      !Number.isFinite(格宽) ||
      !Number.isFinite(格高) ||
      格宽 <= 0 ||
      格高 <= 0
    )
      return

    const 列 = Math.floor(点.x / 格宽)
    const 行 = Math.floor(点.y / 格高)
    if (行 < 0 || 列 < 0 || 行 >= 状态.高度 || 列 >= 状态.宽度) return

    状态.原始兵力文本.set(行 * 状态.宽度 + 列, {
      兵力,
      文本: String(兵力),
      画布,
      画布宽: 画布.width,
      画布高: 画布.height,
      时间: performance.now(),
    })
    请求原始兵力文本重绘()
  }

  function 清理原始兵力文本(ctx, x, y, 宽, 高) {
    const 画布 = ctx?.canvas
    if (!画布?.classList?.contains('game-map-canvas')) return
    if (!状态.宽度 || !状态.高度) {
      状态.原始兵力文本.clear()
      return
    }

    const 起点 = 取得画布坐标(ctx, Number(x), Number(y))
    const 终点 = 取得画布坐标(
      ctx,
      Number(x) + Number(宽),
      Number(y) + Number(高),
    )
    if (!起点 || !终点) return

    const 左 = Math.min(起点.x, 终点.x)
    const 右 = Math.max(起点.x, 终点.x)
    const 上 = Math.min(起点.y, 终点.y)
    const 下 = Math.max(起点.y, 终点.y)
    if (左 <= 1 && 上 <= 1 && 右 >= 画布.width - 1 && 下 >= 画布.height - 1) {
      状态.原始兵力文本.clear()
      请求原始兵力文本重绘()
      return
    }

    const 格宽 = 画布.width / 状态.宽度
    const 格高 = 画布.height / 状态.高度
    for (const [索引] of 状态.原始兵力文本) {
      const 行 = Math.floor(索引 / 状态.宽度)
      const 列 = 索引 % 状态.宽度
      const 中心x = 列 * 格宽 + 格宽 / 2
      const 中心y = 行 * 格高 + 格高 / 2
      if (中心x >= 左 && 中心x <= 右 && 中心y >= 上 && 中心y <= 下) {
        状态.原始兵力文本.delete(索引)
      }
    }
    请求原始兵力文本重绘()
  }

  function 解析兵力文本(文本) {
    const 内容 = String(文本 ?? '').trim()
    if (!/^\d+$/.test(内容)) return null
    return Number(内容)
  }

  function 取得画布坐标(ctx, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    const 变换 = ctx.getTransform?.()
    if (!变换) return { x, y }
    return {
      x: x * 变换.a + y * 变换.c + 变换.e,
      y: x * 变换.b + y * 变换.d + 变换.f,
    }
  }

  function 请求原始兵力文本重绘() {
    if (状态.原始兵力文本待渲染) return
    状态.原始兵力文本待渲染 = true
    requestAnimationFrame(() => {
      状态.原始兵力文本待渲染 = false
      安全执行('原始兵力文本重绘', 请求渲染)
    })
  }
}
