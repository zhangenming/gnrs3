// 功能目的:
// 重写数据包里的玩家颜色，让 1v1 视角下我方/队友统一显示为蓝色，敌方统一显示为红色。
//
// 作用范围:
// 只处理带 playerColors 的入站数据包，并用 WeakSet 避免同一对象重复处理。
// 颜色统一后，排行榜识别、地图显示和战场数据差功能都能用稳定的敌我颜色规则。
import { 敌方红色, 敌方红色索引, 我方蓝色, 我方蓝色索引 } from '../配置.js'
import {
  读取玩家信息,
  同步回放玩家索引,
  同步我方玩家索引,
  是我方或队友,
} from '../游戏.js'
import { 功能已启用 } from '../功能状态.js'
import { 状态 } from '../状态.js'
import { 取得表头行, 取得单元格列表, 取得玩家列索引 } from '../战场DOM工具.js'
import { 取得战场数据表格 } from './战场表格.js'

export const 功能定义 = {
  id: '玩家颜色统一',
  名称: '玩家颜色统一',
  分类: '系统',
  描述: '把我方固定成蓝色，敌方固定成红色',
}

const 原始地图颜色列表 = [
  '#ff0000',
  '#2792ff',
  '#008000',
  '#008080',
  '#fa8c01',
  '#f032e6',
  '#800080',
  '#9b0101',
  '#b3ac32',
  '#9a5e24',
  '#1031ff',
  '#594ca5',
  '#85a91c',
  '#ff6668',
  '#b47fca',
  '#b49971',
]
const 原始地图颜色索引表 = new Map(
  原始地图颜色列表.map((颜色, idx) => {
    return [标准化颜色(颜色), idx]
  }),
)
let 已安装地图画布颜色替换 = false
let 玩家原始颜色索引列表 = null
let 回放地图已重绘签名 = ''
let 回放地图重绘请求签名 = ''

export const 功能样式 = `
:root {
    --map-rgb-p1: 255,0,0;
    --map-color-p1: #ff0000;
    --map-rgb-p2: 39,146,255;
    --map-color-p2: #2792ff;
}
.red, .selected-red, .leaderboard .red, #leaderboard .red {
    background-color: #ff0000 !important;
    fill: #ff0000 !important;
}
.lightblue, .selected-lightblue, .leaderboard .lightblue, #leaderboard .lightblue {
    background-color: #2792ff !important;
    fill: #2792ff !important;
}
.blue, .selected-blue, .leaderboard .blue, #leaderboard .blue {
    background-color: #2792ff !important;
    fill: #2792ff !important;
}
`

export const 主程序功能 = {
  id: 功能定义.id,
  启动: 启动玩家颜色统一,
  页面同步: 同步页面颜色,
}

export const socket功能 = {
  id: 功能定义.id,
  入站预处理({ 事件名, 数据包 }) {
    if (事件名 !== 'game_start' && 事件名 !== 'game_update') return
    重构玩家颜色(数据包 ?? {})
  },
  新局重置() {
    状态.已处理颜色数据包 = new WeakSet()
    玩家原始颜色索引列表 = null
    回放地图已重绘签名 = ''
    回放地图重绘请求签名 = ''
  },
}

function 启动玩家颜色统一() {
  安装地图画布颜色替换()
  安装网页回放颜色同步()
  同步页面颜色()
}

function 安装网页回放颜色同步() {
  if (回放颜色动画帧编号 !== null) return
  function 同步网页回放颜色() {
    if (功能已启用('玩家颜色统一') && 是网页回放中()) {
      同步页面颜色()
    }
    回放颜色动画帧编号 = window.requestAnimationFrame(同步网页回放颜色)
  }
  回放颜色动画帧编号 = window.requestAnimationFrame(同步网页回放颜色)
}

export function 重构玩家颜色(数据包) {
  if (!功能已启用('玩家颜色统一')) return
  if (!数据包) return
  if (typeof 数据包 === 'object' && 状态.已处理颜色数据包) {
    if (状态.已处理颜色数据包.has(数据包)) return
    状态.已处理颜色数据包.add(数据包)
  }

  读取玩家信息(数据包)
  记录玩家原始颜色索引(数据包)
  请求同步页面颜色()

  if (!同步玩家颜色我方索引(数据包)) return

  if (!Array.isArray(数据包.playerColors)) {
    return
  }

  if (是网页回放中()) {
    请求回放地图颜色重绘()
    return
  }

  if (!Number.isInteger(状态.我方索引)) {
    return
  }

  for (let 玩家索引 = 0; 玩家索引 < 数据包.playerColors.length; 玩家索引 += 1) {
    if (是我方或队友(玩家索引)) {
      数据包.playerColors[玩家索引] = 我方蓝色索引
    } else {
      数据包.playerColors[玩家索引] = 敌方红色索引
    }
  }
}

function 记录玩家原始颜色索引(数据包) {
  if (!Array.isArray(数据包.playerColors)) return
  玩家原始颜色索引列表 = 数据包.playerColors.map((颜色索引) => {
    return Number.isInteger(颜色索引) ? 颜色索引 : null
  })
}

function 同步地图颜色变量() {
  if (!功能已启用('玩家颜色统一')) return
  const 样式 = document.body?.style
  if (!样式) return

  原始地图颜色列表.forEach((颜色, idx) => {
    const 编号 = idx + 1
    样式.setProperty(`--map-rgb-p${编号}`, 颜色转RGB文本(颜色))
    样式.setProperty(`--map-color-p${编号}`, 颜色)
  })
}

let 已请求同步页面颜色 = false
let 回放颜色动画帧编号 = null

function 请求同步页面颜色() {
  if (已请求同步页面颜色) return
  已请求同步页面颜色 = true
  requestAnimationFrame(() => {
    已请求同步页面颜色 = false
    同步页面颜色()
  })
}

function 同步页面颜色() {
  同步战场面板颜色()
  同步地图颜色变量()
  请求回放地图颜色重绘()
}

function 同步战场面板颜色() {
  if (!功能已启用('玩家颜色统一')) return
  if (!同步玩家颜色我方索引()) return

  const 表格 = 取得战场数据表格()
  if (!表格) return

  const 表头行 = 取得表头行(表格)
  if (!表头行) return

  const 玩家列 = 取得玩家列索引(取得单元格列表(表头行))
  if (玩家列 < 0) return

  const 数据行列表 = Array.from(表格.querySelectorAll('tr')).filter((行) => {
    return 行 !== 表头行
  })
  const 我方玩家名 = 状态.玩家名列表[状态.我方索引]
  const 我方行 = 取得指定玩家行(数据行列表, 我方玩家名)
  if (!我方行) return
  固定指定数据第一行(数据行列表, 我方行)

  数据行列表.forEach((行) => {
    if (行 === 表头行) return
    const 玩家格 = 取得单元格列表(行)[玩家列]
    const 玩家名 = (玩家格?.textContent ?? '').trim()
    const 玩家索引 = 状态.玩家名列表.indexOf(玩家名)
    if (玩家索引 < 0) return

    const 是我方 = 是我方或队友(玩家索引)
    应用玩家格颜色(玩家格, 是我方)
  })

  function 固定指定数据第一行(数据行列表, 我方行) {
    const 第一行 = 数据行列表.find((行) => {
      return 行.parentElement === 我方行.parentElement
    })
    if (第一行 && 第一行 !== 我方行) {
      我方行.parentElement.insertBefore(我方行, 第一行)
      return
    }

    if (表头行.parentElement === 我方行.parentElement) 表头行.after(我方行)
  }

  function 取得指定玩家行(数据行列表, 玩家名) {
    return 数据行列表.find((行) => {
      const 玩家格 = 取得单元格列表(行)[玩家列]
      return (玩家格?.textContent ?? '').trim() === 玩家名
    })
  }
}

function 应用玩家格颜色(玩家格, 是我方) {
  const 颜色 = 是我方 ? 我方蓝色 : 敌方红色
  const 类名 = 是我方 ? 'lightblue' : 'red'
  const 节点列表 = [玩家格, ...玩家格.querySelectorAll('*')]

  节点列表.forEach((节点) => {
    清理颜色类名(节点)
    节点.style.setProperty('background-color', 颜色, 'important')
    节点.style.setProperty('color', '#ffffff', 'important')
  })
  玩家格.classList.add(类名)
}

function 清理颜色类名(节点) {
  节点.classList.remove(
    'red',
    'selected-red',
    'blue',
    'selected-blue',
    'lightblue',
    'selected-lightblue',
  )
}

function 安装地图画布颜色替换() {
  if (已安装地图画布颜色替换) return
  const 原型 = globalThis.CanvasRenderingContext2D?.prototype
  const 描述 = 原型 && Object.getOwnPropertyDescriptor(原型, 'fillStyle')
  if (!原型 || !描述?.get || !描述?.set) return

  已安装地图画布颜色替换 = true
  Object.defineProperty(原型, 'fillStyle', {
    configurable: 描述.configurable,
    enumerable: 描述.enumerable,
    get: 描述.get,
    set(颜色) {
      return 描述.set.call(this, 转换地图画布颜色(this, 颜色))
    },
  })
}

function 转换地图画布颜色(ctx, 颜色) {
  if (!玩家颜色统一已启用()) return 颜色
  if (!是网页回放中()) return 颜色
  if (!ctx?.canvas?.classList?.contains('game-map-canvas')) return 颜色
  if (!是有效颜色玩家索引(状态.我方索引)) return 颜色

  const 颜色索引 = 取得原始地图颜色索引(颜色)
  if (颜色索引 < 0) return 颜色

  const 玩家索引 = 取得颜色玩家索引(颜色索引)
  if (!Number.isInteger(玩家索引)) return 颜色
  return 是我方或队友(玩家索引) ? 我方蓝色 : 敌方红色
}

function 取得颜色玩家索引(颜色索引) {
  if (Array.isArray(玩家原始颜色索引列表)) {
    const 玩家索引 = 玩家原始颜色索引列表.indexOf(颜色索引)
    if (玩家索引 >= 0) return 玩家索引
  }
  return null
}

function 请求回放地图颜色重绘() {
  const 签名 = 取得回放地图颜色重绘签名()
  if (!签名) return
  if (回放地图已重绘签名 === 签名) return
  if (回放地图重绘请求签名 === 签名) return

  回放地图重绘请求签名 = 签名
  let 剩余尝试次数 = 8
  安排重绘()

  function 安排重绘() {
    requestAnimationFrame(尝试重绘)
  }

  function 尝试重绘() {
    if (回放地图重绘请求签名 !== 签名) return
    if (!是网页回放中() || !需要转换回放地图颜色()) {
      回放地图重绘请求签名 = ''
      return
    }
    if (重绘回放游戏画布()) {
      回放地图已重绘签名 = 签名
      回放地图重绘请求签名 = ''
      return
    }

    剩余尝试次数 -= 1
    if (剩余尝试次数 > 0) {
      安排重绘()
    } else {
      回放地图重绘请求签名 = ''
    }
  }

  function 取得回放地图颜色重绘签名() {
    if (!是网页回放中()) return ''
    if (!document.querySelector('#gameMap .game-map-canvas')) return ''
    if (!是有效颜色玩家索引(状态.我方索引)) return ''
    if (!Array.isArray(玩家原始颜色索引列表)) return ''
    if (!需要转换回放地图颜色()) return ''

    return [
      globalThis.location?.pathname ?? '',
      globalThis.location?.search ?? '',
      状态.我方索引,
      玩家原始颜色索引列表.join(','),
    ].join(':')
  }

  function 需要转换回放地图颜色() {
    if (!Array.isArray(玩家原始颜色索引列表)) return false

    for (
      let 玩家索引 = 0;
      玩家索引 < 玩家原始颜色索引列表.length;
      玩家索引 += 1
    ) {
      const 原始颜色索引 = 玩家原始颜色索引列表[玩家索引]
      const 原始颜色 = 原始地图颜色列表[原始颜色索引]
      if (!原始颜色) continue

      const 目标颜色 = 是我方或队友(玩家索引) ? 我方蓝色 : 敌方红色
      if (标准化颜色(原始颜色) !== 标准化颜色(目标颜色)) return true
    }
    return false
  }

  function 重绘回放游戏画布() {
    const 地图实例 = 取得地图绘制实例()
    if (!地图实例) return false

    地图实例.drawCanvas()
    return true
  }

  function 取得地图绘制实例() {
    const 地图元素 =
      document.getElementById('gameMap') ??
      document.querySelector('.game-map-canvas')?.closest('#gameMap')
    const 已访问 = new Set()
    for (
      let fiber = 读取ReactFiber(地图元素);
      fiber && !已访问.has(fiber);
      fiber = fiber.return
    ) {
      已访问.add(fiber)
      if (typeof fiber.stateNode?.drawCanvas === 'function')
        return fiber.stateNode
    }
    return null

    function 读取ReactFiber(节点) {
      if (!节点) return null
      const fiber键 = Object.keys(节点).find((键) => {
        return (
          键.startsWith('__reactFiber$') ||
          键.startsWith('__reactInternalInstance$')
        )
      })
      return fiber键 ? 节点[fiber键] : null
    }
  }
}

function 同步玩家颜色我方索引(数据包 = null) {
  if (是网页回放中()) {
    const 回放玩家索引 = 数据包 ? 同步回放玩家索引(数据包) : 同步我方玩家索引()
    return 是有效颜色玩家索引(回放玩家索引, 数据包)
  }

  const 数据包玩家索引 = 数据包?.playerIndex
  if (是有效颜色玩家索引(数据包玩家索引, 数据包)) {
    状态.我方索引 = 数据包玩家索引
    return true
  }

  if (是有效颜色玩家索引(状态.我方索引, 数据包)) return true

  const 玩家索引 = 同步我方玩家索引()
  return 是有效颜色玩家索引(玩家索引, 数据包)
}

function 是有效颜色玩家索引(玩家索引, 数据包 = null) {
  if (!Number.isInteger(玩家索引) || 玩家索引 < 0) return false
  if (
    Array.isArray(数据包?.playerColors) &&
    玩家索引 >= 数据包.playerColors.length
  ) {
    return false
  }
  return (
    Array.isArray(状态.玩家名列表) &&
    typeof 状态.玩家名列表[玩家索引] === 'string'
  )
}

function 玩家颜色统一已启用() {
  return 状态.功能总开关 !== false && 状态.功能开关['玩家颜色统一'] !== false
}

function 是网页回放中() {
  return Boolean(
    globalThis.location?.pathname?.startsWith('/replays/') ||
    document.getElementById('replay-turn-jump-input'),
  )
}

function 取得原始地图颜色索引(颜色) {
  const 标准颜色 = 标准化颜色(颜色)
  if (!标准颜色) return -1

  return 原始地图颜色索引表.get(标准颜色) ?? -1
}

function 标准化颜色(颜色) {
  if (typeof 颜色 !== 'string') return ''
  const 文本 = 颜色.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(文本)) return 文本
  if (/^#[0-9a-f]{3}$/.test(文本)) {
    return `#${文本[1]}${文本[1]}${文本[2]}${文本[2]}${文本[3]}${文本[3]}`
  }

  const rgb匹配 = 文本.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)
  if (!rgb匹配) return 文本
  return `#${转两位十六进制(rgb匹配[1])}${转两位十六进制(rgb匹配[2])}${转两位十六进制(rgb匹配[3])}`
}

function 转两位十六进制(值) {
  return Math.max(0, Math.min(255, Number.parseInt(值, 10) || 0))
    .toString(16)
    .padStart(2, '0')
}

function 颜色转RGB文本(颜色) {
  const 文本 = 标准化颜色(颜色)
  if (!/^#[0-9a-f]{6}$/.test(文本)) return '255,0,0'

  return [
    Number.parseInt(文本.slice(1, 3), 16),
    Number.parseInt(文本.slice(3, 5), 16),
    Number.parseInt(文本.slice(5, 7), 16),
  ].join(',')
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 主程序功能, socket功能, 功能样式 })
