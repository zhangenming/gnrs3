// 功能目的:
// 基地被吃导致游戏结束时，用终局前一 turn 的棋盘盖住官方“兵力减半并改色”的终局画面。
import { 注册功能 } from '../注册中心.js'
import { 状态 } from '../状态.js'
import { 功能已启用 } from '../功能状态.js'
import { 取游戏画布, 是游戏结束事件 } from '../游戏工具.js'

const iframe编号 = 'gio-before-end-board-replay-frame'
const 回放编号重试间隔毫秒 = 500
const 回放编号最大重试次数 = 40
const 回放画布轮询间隔毫秒 = 180
const 回放画布最大轮询次数 = 170

let 恢复任务 = null
let 回放编号重试定时器 = null
let 回放画布轮询定时器 = null
let 请求重绘 = null

export const 功能定义 = {
  id: '终局前棋盘恢复',
  名称: '终局前棋盘恢复',
  分类: '地图覆盖',
  描述: '吃基地后覆盖回终局前一 turn 的棋盘',
}

export const socket功能 = {
  id: 功能定义.id,
  入站预处理({ 事件名, 数据包, 参数, 请求渲染 }) {
    if (!功能已启用(功能定义.id)) return
    if (!是终局前棋盘恢复事件(事件名, 数据包)) return
    准备终局前棋盘恢复(数据包 ?? {}, 参数 ?? [], 请求渲染)
  },
  新局重置: 重置终局前棋盘恢复,
}

export const 主程序功能 = {
  id: 功能定义.id,
  页面同步() {
    if (是投降结算弹窗()) 重置终局前棋盘恢复()
  },
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭: 重置终局前棋盘恢复,
  关闭后需要清空覆盖层: true,
}

export const 覆盖层功能 = {
  id: 功能定义.id,
  层级: -10000,
  需要绘制() {
    return Boolean(状态.终局前棋盘恢复?.图像画布)
  },
  绘制({ ctx, 尺寸 }) {
    const 图像画布 = 状态.终局前棋盘恢复?.图像画布
    if (!图像画布) return

    ctx.save()
    ctx.drawImage(图像画布, 0, 0, 尺寸.css宽, 尺寸.css高)
    ctx.restore()
  },
}

function 准备终局前棋盘恢复(数据包, 参数, 请求渲染) {
  请求重绘 = 请求渲染

  const 目标回合 = 状态.终局前棋盘恢复?.目标回合 ?? 取得终局前回合(数据包)
  if (!Number.isInteger(目标回合)) return

  if (!状态.终局前棋盘恢复?.图像画布) {
    记录当前棋盘快照(目标回合)
  }

  const 回放编号 = 读取回放编号(数据包, 参数) ?? 读取页面回放编号()
  const 任务 = 取得恢复任务(目标回合)
  if (回放编号) {
    任务.回放编号 = 回放编号
    加载回放棋盘(任务)
    return
  }

  安排查找回放编号(任务)
}

function 重置终局前棋盘恢复() {
  状态.终局前棋盘恢复 = null
  恢复任务 = null
  请求重绘 = null
  清理回放定时器()
  清理回放iframe()
}

function 是终局前棋盘恢复事件(事件名, 数据包) {
  if (!是游戏结束事件(事件名) && !包含死亡分数(数据包)) return false
  if (是投降结算弹窗()) return false
  return 包含死亡分数(数据包) && 包含地图更新数据(数据包)
}

function 包含死亡分数(数据包) {
  if (!Array.isArray(数据包?.scores)) return false
  return 数据包.scores.some(function (分数) {
    return 分数?.dead === true
  })
}

function 包含地图更新数据(数据包) {
  return Array.isArray(数据包?.map) || Array.isArray(数据包?.map_diff)
}

function 取得终局前回合(数据包) {
  if (Number.isInteger(数据包?.turn)) return Math.max(0, 数据包.turn - 1)
  if (Number.isInteger(状态.当前回合)) return Math.max(0, 状态.当前回合 - 1)
  return null
}

function 取得恢复任务(目标回合) {
  if (恢复任务?.目标回合 === 目标回合) return 恢复任务

  恢复任务 = {
    id: Symbol('终局前棋盘恢复'),
    目标回合,
    回放编号: null,
    回放编号尝试次数: 0,
  }
  return 恢复任务
}

function 记录当前棋盘快照(目标回合) {
  const 画布 = 取游戏画布()
  if (!画布?.width || !画布?.height) return

  const 图像画布 = document.createElement('canvas')
  图像画布.width = 画布.width
  图像画布.height = 画布.height

  const ctx = 图像画布.getContext('2d')
  if (!ctx) return

  ctx.drawImage(画布, 0, 0)
  状态.终局前棋盘恢复 = {
    图像画布,
    目标回合,
    来源: '当前画布',
    回放编号: null,
  }
  请求重绘?.()
}

function 安排查找回放编号(任务) {
  if (任务 !== 恢复任务) return
  if (任务.回放编号尝试次数 >= 回放编号最大重试次数) return
  if (回放编号重试定时器 !== null) return

  回放编号重试定时器 = window.setTimeout(function () {
    回放编号重试定时器 = null
    if (任务 !== 恢复任务) return

    const 回放编号 = 读取页面回放编号()
    if (回放编号) {
      任务.回放编号 = 回放编号
      加载回放棋盘(任务)
      return
    }

    任务.回放编号尝试次数 += 1
    安排查找回放编号(任务)
  }, 回放编号重试间隔毫秒)
}

function 加载回放棋盘(任务) {
  if (任务 !== 恢复任务 || !任务.回放编号) return
  if (状态.终局前棋盘恢复?.来源 === '回放') return

  清理回放定时器()
  清理回放iframe()

  const iframe = document.createElement('iframe')
  iframe.id = iframe编号
  iframe.src = 取得回放地址(任务)
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '-10000px'
  iframe.style.width = `${取得回放iframe宽度()}px`
  iframe.style.height = `${取得回放iframe高度()}px`
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  iframe.tabIndex = -1
  document.body?.appendChild(iframe)

  轮询回放画布(任务, iframe, 0)
}

function 轮询回放画布(任务, iframe, 尝试次数) {
  if (任务 !== 恢复任务) return
  if (尝试次数 >= 回放画布最大轮询次数) {
    清理回放iframe()
    return
  }

  const 回放画布 = 读取iframe回放画布(iframe, 任务.目标回合)
  if (回放画布) {
    记录回放棋盘快照(回放画布, 任务)
    清理回放iframe()
    return
  }

  回放画布轮询定时器 = window.setTimeout(function () {
    回放画布轮询定时器 = null
    轮询回放画布(任务, iframe, 尝试次数 + 1)
  }, 回放画布轮询间隔毫秒)
}

function 读取iframe回放画布(iframe, 目标回合) {
  const 文档 = iframe.contentDocument
  if (!文档) return null

  const 回合 = 读取回放页面回合(文档)
  if (Number.isInteger(回合) && 回合 !== 目标回合) return null

  const 画布 = 文档.querySelector('#gameMap .game-map-canvas')
  if (!画布?.width || !画布?.height) return null
  return 画布
}

function 记录回放棋盘快照(回放画布, 任务) {
  const 图像画布 = document.createElement('canvas')
  图像画布.width = 回放画布.width
  图像画布.height = 回放画布.height

  const ctx = 图像画布.getContext('2d')
  if (!ctx) return

  ctx.drawImage(回放画布, 0, 0)
  状态.终局前棋盘恢复 = {
    图像画布,
    目标回合: 任务.目标回合,
    来源: '回放',
    回放编号: 任务.回放编号,
  }
  请求重绘?.()
}

function 读取回放页面回合(文档) {
  const 文本列表 = [
    文档.getElementById('replay-turn-jump-input')?.placeholder,
    文档.getElementById('turn-counter')?.textContent,
  ]

  for (const 文本 of 文本列表) {
    const 回合 = 解析回合文本(文本)
    if (Number.isInteger(回合)) return 回合
  }
  return null
}

function 解析回合文本(文本) {
  const 匹配 = String(文本 ?? '').match(/(?:Turn\s*)?(\d+)/i)
  if (!匹配) return null

  const 回合 = Number.parseInt(匹配[1], 10)
  return Number.isInteger(回合) ? 回合 : null
}

function 取得回放地址(任务) {
  const 地址 = new URL(`/replays/${任务.回放编号}`, globalThis.location.origin)
  地址.searchParams.set('t', String(任务.目标回合))
  return 地址.href
}

function 读取回放编号(数据包, 参数) {
  const 来源列表 = [数据包, ...参数]
  for (const 来源 of 来源列表) {
    const 回放编号 = 读取值里的回放编号(来源, 0, new Set(), '')
    if (回放编号) return 回放编号
  }
  return null
}

function 读取值里的回放编号(值, 深度, 已访问, 键名) {
  if (深度 > 4 || 值 == null) return null

  const 字符串编号 = 解析回放编号文本(值, 键名)
  if (字符串编号) return 字符串编号

  if (typeof 值 !== 'object') return null
  if (已访问.has(值)) return null
  已访问.add(值)

  if (Array.isArray(值)) {
    const 长度 = Math.min(值.length, 40)
    for (let idx = 0; idx < 长度; idx += 1) {
      const 回放编号 = 读取值里的回放编号(值[idx], 深度 + 1, 已访问, 键名)
      if (回放编号) return 回放编号
    }
    return null
  }

  for (const [子键名, 子值] of Object.entries(值)) {
    const 回放编号 = 读取值里的回放编号(子值, 深度 + 1, 已访问, 子键名)
    if (回放编号) return 回放编号
  }
  return null
}

function 解析回放编号文本(值, 键名) {
  if (typeof 值 !== 'string') return null

  const 回放路径匹配 = 值.match(/\/replays\/([^/?#]+)/)
  if (回放路径匹配) return 回放路径匹配[1]

  const gior匹配 = 值.match(/\/([^/?#]+)\.gior(?:[?#]|$)/)
  if (gior匹配) return gior匹配[1]

  if (/replay/i.test(键名) && /^[A-Za-z0-9_-]{6,32}$/.test(值)) return 值
  return null
}

function 读取页面回放编号() {
  if (是投降结算弹窗()) return null

  const 元素列表 = document.querySelectorAll(
    [
      '[href*="/replays/"]',
      '[href*=".gior"]',
      '[data-href*="/replays/"]',
      '[data-url*="/replays/"]',
      '[data-replay-id]',
      '[data-replay_id]',
      'input',
      'textarea',
    ].join(','),
  )
  for (const 元素 of 元素列表) {
    const 回放编号 = 读取元素回放编号(元素)
    if (回放编号) return 回放编号
  }
  return null

  function 读取元素回放编号(元素) {
    const 候选文本列表 = [
      元素.href,
      元素.value,
      元素.getAttribute?.('href'),
      元素.getAttribute?.('data-href'),
      元素.getAttribute?.('data-url'),
      元素.getAttribute?.('data-replay-id'),
      元素.getAttribute?.('data-replay_id'),
    ]
    for (const 文本 of 候选文本列表) {
      const 回放编号 = 解析回放编号文本(文本, 'replay')
      if (回放编号) return 回放编号
    }
    return null
  }
}

function 取得回放iframe宽度() {
  const 宽度 = 取游戏画布()?.getBoundingClientRect?.().width
  return Math.max(900, Math.ceil((宽度 || 640) + 360))
}

function 取得回放iframe高度() {
  const 高度 = 取游戏画布()?.getBoundingClientRect?.().height
  return Math.max(650, Math.ceil((高度 || 480) + 140))
}

function 清理回放定时器() {
  if (回放编号重试定时器 !== null) {
    window.clearTimeout(回放编号重试定时器)
    回放编号重试定时器 = null
  }
  if (回放画布轮询定时器 !== null) {
    window.clearTimeout(回放画布轮询定时器)
    回放画布轮询定时器 = null
  }
}

function 清理回放iframe() {
  document.getElementById(iframe编号)?.remove()
}

function 是投降结算弹窗() {
  const 候选列表 = document.body?.querySelectorAll(
    '.popup, .modal, .alert, [role="dialog"]',
  )
  for (const 候选 of 候选列表 ?? []) {
    const 文本 = (候选.textContent ?? '').toLowerCase()
    if (文本.includes('your opponent left')) return true
    if (文本.includes('opponent left')) return true
    if (文本.includes('surrender')) return true
    if (文本.includes('resign')) return true
    if (文本.includes('对手离开')) return true
    if (文本.includes('对手已离开')) return true
    if (文本.includes('投降')) return true
  }
  return false
}

注册功能({ 功能定义, 主程序功能, socket功能, 覆盖层功能, 功能恢复 })
