// 功能目的:
// 提供地图覆盖 canvas 的公共生命周期，并按功能注册表调用覆盖层 hook。
//
// 作用范围:
// 只负责创建覆盖层、同步尺寸、安装基础样式和调度绘制。
// 具体功能的判断、绘制和动画状态放在对应功能文件里。
import { 样式编号, 覆盖层类名 } from './配置.js'
import { 功能已启用 } from './功能状态.js'
import { 覆盖层功能列表, 功能样式列表 } from './功能注册.js'
import { 状态 } from './状态.js'

let 覆盖层动画帧 = null

export function 清空覆盖层() {
  const 覆盖层 = document.querySelector(`.${覆盖层类名}`)
  if (!覆盖层) return
  const ctx = 覆盖层.getContext('2d')
  if (ctx) ctx.clearRect(0, 0, 覆盖层.width, 覆盖层.height)
}

export function 渲染() {
  状态.已请求渲染 = false
  安装样式()

  if (!状态.回放正在显示) {
    执行覆盖层渲染前Hook()
  }

  const 可绘制功能列表 = 取得可绘制功能列表()
  if (!可绘制功能列表.length) {
    清空覆盖层()
    return
  }

  if (!状态.宽度 || !状态.高度) return

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
  const 当前动画时间 = 状态.回放正在显示
    ? (状态.回放动画时间 ?? 0)
    : performance.now()
  const 上下文 = {
    ctx,
    格宽,
    格高,
    大小,
    格子数: 状态.宽度 * 状态.高度,
    当前动画时间,
    尺寸,
    部件,
  }

  for (const 功能 of 可绘制功能列表) {
    功能.绘制?.(上下文)
  }

  if (需要连续动画()) 请求连续动画帧()
}

export function 请求覆盖层重绘() {
  if (状态.已请求渲染) return
  状态.已请求渲染 = true
  requestAnimationFrame(() => {
    渲染()
  })
}

function 执行覆盖层渲染前Hook() {
  const 上下文 = { 请求重绘: 请求覆盖层重绘 }
  for (const 功能 of 覆盖层功能列表) {
    if (!功能已启用(功能.id)) continue
    功能.渲染前?.(上下文)
  }
}

function 取得可绘制功能列表() {
  return 覆盖层功能列表.filter((功能) => {
    return 功能已启用(功能.id) && 功能.需要绘制?.()
  })
}

function 需要连续动画() {
  if (状态.回放正在显示) return false
  return 覆盖层功能列表.some((功能) => {
    return 功能已启用(功能.id) && 功能.需要连续动画?.()
  })
}

function 请求连续动画帧() {
  if (覆盖层动画帧 !== null) return
  覆盖层动画帧 = requestAnimationFrame(() => {
    覆盖层动画帧 = null
    if (!需要连续动画()) return
    if (状态.已请求渲染) {
      请求连续动画帧()
      return
    }
    状态.已请求渲染 = true
    渲染()
  })
}

function 确保覆盖层() {
  安装样式()
  const 画布 = 取游戏画布()
  if (!画布) return null

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
${功能样式列表.join('\n')}
`.trim()
  document.documentElement.appendChild(样式)
}

function 取游戏画布() {
  return document.querySelector('#game-page #gameMap .game-map-canvas')
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
