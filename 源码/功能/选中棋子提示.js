import { 状态 } from '../状态.js'
import { 大回合turn数 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import {
  读取分数玩家数据,
  读取快照玩家数据,
  读取页面玩家数据,
} from '../战场工具.js'
import {
  取得完整地图数组,
  取得地图格子数,
  地图可读,
  是我方或队友,
  读取地图兵力,
  读取地图地块,
} from '../游戏.js'
import { 取游戏画布, 是阻挡地形 } from '../游戏工具.js'
import { 取得大回合倒计时 } from '../工具.js'
import { 读取显示回合 } from './大回合倒计时.js'

export const 功能定义 = {
  id: '选中棋子提示',
  名称: '选中棋子提示',
  分类: '地图覆盖',
  描述: '给当前选中的棋子补高亮和倒计时角标',
}

export const 当前棋子剩余步数功能定义 = {
  id: '当前棋子剩余步数',
  名称: '当前棋子剩余步数',
  分类: '操作防呆',
  描述: '第一大回合内当前扩地队列超过棋子可走步数后把选中框变黑',
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭后需要清空覆盖层: true,
}

let 选中格子索引 = null
let 已同步移动队列长度 = 0
let 已同步移动队列最后移动 = null
let 已安装选中监听 = false
let 已安装页面激活监听 = false
let 自动选中基地任务 = null
let 自动选中请求重绘 = null
let 自动选中基地定时器 = null

export const 覆盖层功能 = {
  id: 功能定义.id,
  层级: 1000,
  需要绘制() {
    return Number.isInteger(取得选中棋子索引())
  },
  需要连续动画() {
    return Number.isInteger(取得选中棋子索引())
  },
  绘制: 画选中棋子,
}

export const socket功能 = {
  id: 功能定义.id,
  阻止出站({ 事件名, 参数, 请求渲染 }) {
    if (事件名 !== 'attack') return false
    if (!是基地锁定中()) return false
    if (参数?.[0] === 状态.我方基地索引) return false
    if (是排队路线续走起点(参数?.[0])) return false

    真实选中我方基地(请求渲染)
    return true
  },
  出站({ 事件名, 参数, 请求渲染 }) {
    if (事件名 === 'attack') {
      停止自动选中基地()
      同步攻击终点选中(参数?.[1])
      请求渲染()
    } else if (事件名 === 'undo_move') {
      同步撤销移动选中()
      if (是基地锁定中() && !状态.移动队列.length) 真实选中我方基地(请求渲染)
      请求渲染()
    } else if (事件名 === 'clear_moves') {
      同步移动队列标记()
      if (是基地锁定中()) 真实选中我方基地(请求渲染)
      请求渲染()
    }
  },
  game_update前() {
    同步移动队列标记()
  },
  game_update({ 数据包, 请求渲染 }) {
    if (!是基地锁定中(数据包)) {
      停止自动选中基地()
      return
    }
    if (状态.移动队列.length) return

    真实选中我方基地(请求渲染)
  },
  新局重置: 清空选中状态,
}

export function 安装选中棋子监听(请求重绘) {
  if (已安装选中监听) return
  if (!document) return
  已安装选中监听 = true
  document.addEventListener('pointerdown', 记录点击选中格子, {
    capture: true,
    passive: false,
  })
  document.addEventListener('mousedown', 阻止基地锁定非基地点击, {
    capture: true,
    passive: false,
  })
  document.addEventListener('click', 阻止基地锁定非基地点击, {
    capture: true,
    passive: false,
  })
  document.addEventListener('keydown', 记录快捷键选中格子, {
    capture: true,
    passive: true,
  })

  function 记录点击选中格子(事件) {
    if (Number.isInteger(事件.button) && 事件.button !== 0) return
    if (处理基地锁定点击(事件, 请求重绘)) return

    const 目标 = 事件.target instanceof Element ? 事件.target : null
    const 地图元素 = 目标?.closest?.('#game-page #gameMap')
    if (!地图元素) return

    const 画布 = 地图元素.querySelector('.game-map-canvas')
    if (!画布) return

    const 格子索引 = 取得点击格子索引(事件, 画布)
    if (!Number.isInteger(格子索引)) return

    选中格子索引 = 格子索引
    标记新移动路线(格子索引)
    同步移动队列标记()
    请求重绘()
  }

  function 阻止基地锁定非基地点击(事件) {
    if (Number.isInteger(事件.button) && 事件.button !== 0) return
    处理基地锁定点击(事件, 请求重绘)
  }

  function 处理基地锁定点击(事件, 请求重绘) {
    if (!是基地锁定中()) return false
    if (状态.移动队列.length) return false

    const 目标 = 事件.target instanceof Element ? 事件.target : null
    const 地图元素 = 目标?.closest?.('#game-page #gameMap')
    if (!地图元素) return false

    const 画布 = 地图元素.querySelector('.game-map-canvas')
    if (!画布) return false

    const 格子索引 = 取得点击格子索引(事件, 画布)
    if (!Number.isInteger(格子索引)) return false
    if (格子索引 !== 状态.我方基地索引) {
      事件.preventDefault()
      事件.stopImmediatePropagation()
      真实选中我方基地(请求重绘)
      return true
    }

    选中我方基地(请求重绘)
    return true
  }

  function 记录快捷键选中格子(事件) {
    if (事件.key !== 'Shift') return

    选中我方基地(请求重绘)
  }
}

export function 自动选中我方基地(请求重绘) {
  自动选中请求重绘 = 请求重绘
  安装页面激活监听()
  if (!是基地锁定中()) {
    停止自动选中基地()
    return
  }

  const 基地索引 = 选中我方基地(请求重绘)
  if (!Number.isInteger(基地索引)) return

  const 当前任务 = 自动选中基地任务 ?? {}
  自动选中基地任务 = 当前任务
  尝试点击基地(0)

  function 尝试点击基地(尝试次数) {
    if (自动选中基地任务 !== 当前任务) return
    if (选中格子索引 !== 基地索引) return

    点击我方基地()

    const 间隔 = 尝试次数 < 12 ? 80 : 300
    clearTimeout(自动选中基地定时器)
    自动选中基地定时器 = setTimeout(() => {
      尝试点击基地(尝试次数 + 1)
    }, 间隔)
  }
}

function 安装页面激活监听() {
  if (已安装页面激活监听) return
  已安装页面激活监听 = true

  window.addEventListener('focus', 页面激活后选中基地, {
    capture: true,
    passive: true,
  })
  window.addEventListener('pageshow', 页面激活后选中基地, {
    capture: true,
    passive: true,
  })
  document.addEventListener('visibilitychange', 页面可见后选中基地, {
    capture: true,
    passive: true,
  })
}

function 页面可见后选中基地() {
  if (document.visibilityState !== 'visible') return
  页面激活后选中基地()
}

function 页面激活后选中基地() {
  自动选中我方基地(自动选中请求重绘)
}

export function 取得选中棋子索引() {
  const 当前移动队列长度 = 状态.移动队列.length
  if (当前移动队列长度 > 已同步移动队列长度) 同步移动队列最新终点选中()
  if (当前移动队列长度 < 已同步移动队列长度) 同步移动队列标记()
  return 选中格子索引
}

export function 执行后恢复选中棋子(函数体, 请求重绘) {
  const 原选中格子索引 = 选中格子索引
  try {
    return 函数体()
  } finally {
    选中格子索引 = 原选中格子索引
    同步移动队列标记()
    if (typeof 请求重绘 === 'function') 请求重绘()
  }
}

function 同步攻击终点选中(终点) {
  if (Number.isInteger(终点) && 终点 >= 0) {
    选中格子索引 = 终点
  }
  同步移动队列标记()
}

function 同步移动队列最新终点选中() {
  同步攻击终点选中(取得移动队列最后移动()?.终点)
}

function 是排队路线续走起点(起点) {
  if (!Number.isInteger(起点) || 起点 < 0) return false
  return 起点 === 取得移动队列最后移动()?.终点
}

function 同步撤销移动选中() {
  if (
    Number.isInteger(已同步移动队列最后移动?.起点) &&
    Number.isInteger(已同步移动队列最后移动?.终点) &&
    选中格子索引 === 已同步移动队列最后移动.终点
  ) {
    选中格子索引 = 已同步移动队列最后移动.起点
  }
  同步移动队列标记()
}

function 同步移动队列标记() {
  已同步移动队列长度 = 状态.移动队列.length
  已同步移动队列最后移动 = 取得移动队列最后移动()
}

function 选中我方基地(请求重绘) {
  if (!Number.isInteger(状态.我方基地索引) || 状态.我方基地索引 < 0) return null

  选中格子索引 = 状态.我方基地索引
  标记新移动路线(选中格子索引)
  同步移动队列标记()
  if (typeof 请求重绘 === 'function') 请求重绘()
  return 选中格子索引
}

function 标记新移动路线(格子索引) {
  const 地块 = 读取地图地块(状态.地图数组, 格子索引)
  if (!是我方或队友(地块?.归属)) return
  状态.移动队列选择序号 += 1
}

function 真实选中我方基地(请求重绘) {
  const 基地索引 = 选中我方基地(请求重绘)
  if (!Number.isInteger(基地索引)) return null

  setTimeout(() => {
    if (是基地锁定中()) 点击我方基地()
  }, 0)
  return 基地索引
}

function 点击我方基地() {
  const 基地索引 = 状态.我方基地索引
  if (!Number.isInteger(基地索引) || 基地索引 < 0) return false

  const 画布 = 取游戏画布()
  if (!画布) return false
  if (!状态.宽度 || !状态.高度) return false

  const 矩形 = 画布.getBoundingClientRect()
  if (矩形.width <= 0 || 矩形.height <= 0) return false

  const 列 = 基地索引 % 状态.宽度
  const 行 = Math.floor(基地索引 / 状态.宽度)
  const x = 矩形.left + ((列 + 0.5) / 状态.宽度) * 矩形.width
  const y = 矩形.top + ((行 + 0.5) / 状态.高度) * 矩形.height

  派发点击事件(画布, x, y)
  return true

  function 派发点击事件(画布, x, y) {
    const 公共选项 = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: x,
      clientY: y,
      screenX: window.screenX + x,
      screenY: window.screenY + y,
      button: 0,
    }

    画布.dispatchEvent(
      new PointerEvent('pointerdown', {
        ...公共选项,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
      }),
    )
    画布.dispatchEvent(new MouseEvent('mousedown', { ...公共选项, buttons: 1 }))
    画布.dispatchEvent(
      new PointerEvent('pointerup', {
        ...公共选项,
        buttons: 0,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
      }),
    )
    画布.dispatchEvent(new MouseEvent('mouseup', { ...公共选项, buttons: 0 }))
    画布.dispatchEvent(
      new MouseEvent('click', { ...公共选项, buttons: 0, detail: 1 }),
    )
  }
}

function 清空选中状态() {
  自动选中基地任务 = null
  clearTimeout(自动选中基地定时器)
  自动选中基地定时器 = null
  自动选中请求重绘 = null
  选中格子索引 = null
  已同步移动队列长度 = 0
  已同步移动队列最后移动 = null
  状态.移动队列选择序号 = 0
}

function 停止自动选中基地() {
  自动选中基地任务 = null
  clearTimeout(自动选中基地定时器)
  自动选中基地定时器 = null
  自动选中请求重绘 = null
}

function 是基地锁定中(数据包) {
  if (!Number.isInteger(状态.我方基地索引) || 状态.我方基地索引 < 0)
    return false
  return 读取我方陆地数(数据包) === 1
}

function 读取我方陆地数(数据包) {
  const 玩家数据 =
    读取分数玩家数据(数据包) ?? 读取快照玩家数据() ?? 读取页面玩家数据()
  if (Number.isInteger(玩家数据?.我方?.陆地)) return 玩家数据.我方.陆地

  return 读取地图我方陆地数(数据包)
}

function 读取地图我方陆地数(数据包) {
  const 地图数组 = 取得完整地图数组(数据包) ?? 状态.地图数组
  const 格子数 = 取得地图格子数(地图数组)
  if (!Number.isInteger(格子数)) return null

  let 陆地数 = 0
  for (let idx = 0; idx < 格子数; idx += 1) {
    if (是我方或队友(地图数组[2 + 格子数 + idx])) 陆地数 += 1
  }
  return 陆地数
}

function 取得移动队列最后移动() {
  const 最后移动 = 状态.移动队列.at(-1)
  if (
    !Number.isInteger(最后移动?.起点) ||
    !Number.isInteger(最后移动?.终点) ||
    最后移动.起点 < 0 ||
    最后移动.终点 < 0
  ) {
    return null
  }
  return { 起点: 最后移动.起点, 终点: 最后移动.终点 }
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

function 画选中棋子({ ctx, 格宽, 格高, 大小, 当前动画时间 }) {
  const 格子索引 = 取得选中棋子索引()
  const 格子数 = 状态.宽度 * 状态.高度
  if (!Number.isInteger(格子索引)) return
  if (格子索引 < 0 || 格子索引 >= 格子数) {
    选中格子索引 = null
    return
  }

  const 行 = Math.floor(格子索引 / 状态.宽度)
  const 列 = 格子索引 % 状态.宽度
  const x = 列 * 格宽
  const y = 行 * 格高
  const 中心x = 列 * 格宽 + 格宽 / 2
  const 中心y = 行 * 格高 + 格高 / 2
  const 动画相位 = (当前动画时间 % 820) / 820
  const 扩张比例 = 0.5 - Math.cos(动画相位 * Math.PI * 2) / 2
  const 外线宽 = Math.max(4, 大小 * (0.12 + 扩张比例 * 0.04))
  const 内线宽 = Math.max(2, 大小 * 0.055)
  const 角长 = Math.max(7, 大小 * (0.22 + 扩张比例 * 0.04))
  const 扩张 = Math.max(2, 大小 * 0.08) * 扩张比例
  const 内缩 = Math.max(0.5, 外线宽 / 2 + 0.5 - 扩张)
  const 选中框样式 = 取得选中框样式()

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.shadowColor = 选中框样式.阴影色
  ctx.shadowBlur = Math.max(6, 大小 * (0.18 + 扩张比例 * 0.12))

  ctx.globalAlpha = 1
  ctx.lineWidth = 外线宽 + Math.max(4, 大小 * 0.1)
  ctx.strokeStyle = 选中框样式.外框底色
  画整框()

  ctx.lineWidth = 外线宽
  ctx.strokeStyle = 选中框样式.外框色
  画整框()

  ctx.shadowColor = 选中框样式.角阴影色
  ctx.shadowBlur = Math.max(4, 大小 * 0.12)
  ctx.lineWidth = 外线宽 + Math.max(2, 大小 * 0.04)
  ctx.strokeStyle = 选中框样式.角底色
  画四角()

  ctx.shadowColor = 'transparent'
  ctx.lineWidth = 内线宽
  ctx.strokeStyle = 选中框样式.角内色
  画四角()

  画选中倒计时()
  ctx.restore()

  function 画整框() {
    ctx.beginPath()
    ctx.rect(
      x + 内缩,
      y + 内缩,
      Math.max(1, 格宽 - 内缩 * 2),
      Math.max(1, 格高 - 内缩 * 2),
    )
    ctx.stroke()
  }

  function 画四角() {
    const 左 = x + 内缩
    const 上 = y + 内缩
    const 右 = x + 格宽 - 内缩
    const 下 = y + 格高 - 内缩

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
  }

  function 画选中倒计时() {
    const 倒计时 = 取得大回合倒计时(读取显示回合())
    if (!Number.isInteger(倒计时)) return

    const 文本 = String(倒计时)
    const 徽标高 = Math.max(14, 大小 * 0.34)
    const 字号 = Math.max(10, 徽标高 * 0.68)
    ctx.font = `900 ${字号}px Arial, sans-serif`
    const 徽标宽 = Math.max(徽标高, ctx.measureText(文本).width + 徽标高 * 0.44)
    const x = Math.min(
      中心x + 大小 * 0.18,
      列 * 格宽 + 格宽 - 徽标宽 - Math.max(1, 大小 * 0.04),
    )
    const y = Math.min(
      中心y + 大小 * 0.18,
      行 * 格高 + 格高 - 徽标高 - Math.max(1, 大小 * 0.04),
    )
    const 圆角 = Math.max(3, 徽标高 * 0.22)

    ctx.shadowColor = 'rgba(0, 0, 0, 0.72)'
    ctx.shadowBlur = Math.max(3, 大小 * 0.08)
    ctx.lineWidth = Math.max(1, 大小 * 0.035)
    ctx.fillStyle = 取得倒计时背景色(倒计时)
    ctx.strokeStyle = 取得倒计时边框色(倒计时)
    ctx.beginPath()
    ctx.roundRect(x, y, 徽标宽, 徽标高, 圆角)
    ctx.fill()
    ctx.stroke()

    ctx.shadowColor = 'transparent'
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(文本, x + 徽标宽 / 2, y + 徽标高 / 2 + 徽标高 * 0.03)
  }

  function 取得倒计时背景色(倒计时) {
    if (倒计时 < 5) return 'rgba(206, 23, 23, 0.96)'
    if (倒计时 < 10) return 'rgba(214, 163, 0, 0.94)'
    return 'rgba(16, 18, 22, 0.88)'
  }

  function 取得倒计时边框色(倒计时) {
    if (倒计时 < 5) return 'rgba(255, 182, 182, 0.92)'
    if (倒计时 < 10) return 'rgba(255, 242, 150, 0.9)'
    return 'rgba(255, 255, 255, 0.72)'
  }

  function 取得选中框样式() {
    if (!是当前扩地队列已超过棋子步数()) {
      return {
        阴影色: 'rgba(255, 38, 38, 0.92)',
        外框底色: '#4b0000',
        外框色: '#ff3030',
        角阴影色: 'rgba(80, 0, 0, 0.76)',
        角底色: '#4b0000',
        角内色: '#ffb3b3',
      }
    }

    return {
      阴影色: 'rgba(0, 0, 0, 0.95)',
      外框底色: '#000000',
      外框色: '#000000',
      角阴影色: 'rgba(0, 0, 0, 0.95)',
      角底色: '#000000',
      角内色: '#000000',
    }
  }

  function 是当前扩地队列已超过棋子步数() {
    if (!功能已启用(当前棋子剩余步数功能定义.id)) return false

    const 路线 = 取得扩地路线步数(格子索引)
    return Boolean(路线 && 路线.已排步数 > 路线.最大步数)
  }

  function 取得扩地路线步数(下一步起点) {
    if (!地图可读(状态.地图数组)) return null
    if (!Number.isInteger(下一步起点) || 下一步起点 < 0) return null

    let 当前起点 = 下一步起点
    let 已排步数 = 0
    let 轨迹起点兵力 = null
    let 路线序号 = null
    for (let idx = 状态.移动队列.length - 1; idx >= 0; idx -= 1) {
      const 移动 = 状态.移动队列[idx]
      if (移动?.终点 !== 当前起点) break
      if (!是同一路线(移动)) break
      if (!是第一大回合内扩地移动(移动.起点, 移动.终点)) break

      已排步数 += 1
      当前起点 = 移动.起点
      if (Number.isInteger(移动.起点兵力)) 轨迹起点兵力 = 移动.起点兵力
    }

    const 起始兵力 = 轨迹起点兵力 ?? 读取地图兵力(状态.地图数组, 当前起点)
    const 起始地块 = 读取地图地块(状态.地图数组, 当前起点)
    if (!Number.isInteger(起始兵力) || 起始兵力 < 1) return null
    if (!是我方或队友(起始地块?.归属)) return null

    return {
      已排步数,
      最大步数: 起始兵力 - 1,
    }

    function 是第一大回合内扩地移动(起点, 终点) {
      if (!在第一大回合()) return false
      if (!Number.isInteger(起点) || !Number.isInteger(终点)) return false
      if (起点 < 0 || 终点 < 0) return false
      if (!地图可读(状态.地图数组)) return false
      if (状态.已知塔集合.has(终点)) return false

      const 终点地块 = 读取地图地块(状态.地图数组, 终点)
      if (终点地块?.兵力 !== 0) return false
      if (是我方或队友(终点地块?.归属)) return false
      if (!Number.isInteger(终点地块?.归属)) return false
      if (终点地块.归属 >= 0) return false
      return !是阻挡地形(终点地块.归属)
    }

    function 在第一大回合() {
      return (
        Number.isInteger(状态.当前回合) &&
        状态.当前回合 >= 0 &&
        状态.当前回合 < 大回合turn数
      )
    }

    function 是同一路线(移动) {
      if (!Number.isInteger(移动?.选择序号)) return 路线序号 === null
      if (路线序号 === null) {
        路线序号 = 移动.选择序号
        return true
      }
      return 移动.选择序号 === 路线序号
    }
  }
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 功能恢复, socket功能, 覆盖层功能 })
注册功能({ 功能定义: 当前棋子剩余步数功能定义 })
