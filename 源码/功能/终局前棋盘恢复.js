// 功能目的:
// 基地被吃导致游戏结束时，用终局前一 turn 的棋盘盖住官方“兵力减半并改色”的终局画面。
import { 注册功能 } from '../注册中心.js'
import { 状态 } from '../状态.js'
import { 功能已启用 } from '../功能状态.js'
import { 取游戏画布, 取宿主, 是游戏结束事件 } from '../游戏工具.js'
import { 大回合turn数, 基地自然增长turn数, 覆盖层层级 } from '../配置.js'

const iframe编号 = 'gio-before-end-board-replay-frame'
const 回放编号重试间隔毫秒 = 500
const 回放编号最大重试次数 = 40
const 回放画布轮询间隔毫秒 = 180
const 回放画布最大轮询次数 = 170

let 恢复任务 = null
let 回放编号重试定时器 = null
let 回放画布轮询定时器 = null
let 请求重绘 = null
let 终局前兵力表格 = null

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
  渲染前() {
    同步终局前兵力表格()
  },
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
  移除终局前兵力表格()
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
    兵力表格数据: 读取当前页面兵力表格数据(),
    目标回合,
    来源: '当前画布',
    回放编号: null,
  }
  重建终局前兵力表格()
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

  任务.回放数据包 = null
  加载回放数据(任务)

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

  const 回放结果 = 读取iframe回放结果(iframe, 任务.目标回合)
  if (回放结果) {
    记录回放棋盘快照(回放结果, 任务)
    清理回放iframe()
    return
  }

  回放画布轮询定时器 = window.setTimeout(function () {
    回放画布轮询定时器 = null
    轮询回放画布(任务, iframe, 尝试次数 + 1)
  }, 回放画布轮询间隔毫秒)
}

function 读取iframe回放结果(iframe, 目标回合) {
  const 文档 = iframe.contentDocument
  if (!文档) return null

  const 回合 = 读取回放页面回合(文档)
  if (Number.isInteger(回合) && 回合 !== 目标回合) return null

  const 画布 = 文档.querySelector('#gameMap .game-map-canvas')
  if (!画布?.width || !画布?.height) return null

  const 兵力表格数据 = 读取兵力表格数据(
    文档.querySelector('#gameMap .game-cursor-table'),
  )
  const 数据包 = 恢复任务?.回放数据包 ?? 读取回放数据包(文档)
  if (!数据包 && !兵力表格数据) return null
  return { 画布, 数据包, 兵力表格数据 }
}

async function 加载回放数据(任务) {
  try {
    const 响应 = await fetch(取得回放文件地址(任务.回放编号))
    if (任务 !== 恢复任务) return
    if (!响应.ok) return

    const 内容 = new Uint8Array(await 响应.arrayBuffer())
    if (任务 !== 恢复任务) return

    const 回放 = 解析回放文件(内容)
    const 数据包 = 模拟回放数据包(回放, 任务.目标回合)
    if (!数据包) return

    任务.回放数据包 = 数据包
    补当前棋盘快照数字(任务)
  } catch (错误) {
    console.warn('终局前棋盘恢复读取回放失败', 错误)
  }
}

function 记录回放棋盘快照(回放结果, 任务) {
  const { 画布: 回放画布, 数据包, 兵力表格数据 } = 回放结果
  const 图像画布 = document.createElement('canvas')
  图像画布.width = 回放画布.width
  图像画布.height = 回放画布.height

  const ctx = 图像画布.getContext('2d')
  if (!ctx) return

  ctx.drawImage(回放画布, 0, 0)
  状态.终局前棋盘恢复 = {
    图像画布,
    兵力表格数据: 兵力表格数据 ?? 生成回放兵力表格数据(数据包),
    目标回合: 任务.目标回合,
    来源: '回放',
    回放编号: 任务.回放编号,
  }
  重建终局前兵力表格()
  请求重绘?.()
}

function 补当前棋盘快照数字(任务) {
  if (任务 !== 恢复任务 || !任务.回放数据包) return

  const 快照 = 状态.终局前棋盘恢复
  if (!快照?.图像画布 || 快照.来源 === '回放') return

  const 兵力表格数据 = 生成回放兵力表格数据(任务.回放数据包)
  if (!兵力表格数据) return

  状态.终局前棋盘恢复 = {
    ...快照,
    兵力表格数据,
    来源: '回放文件数字',
    回放编号: 任务.回放编号,
  }
  重建终局前兵力表格()
  请求重绘?.()
}

function 读取回放数据包(文档) {
  const 起点列表 = [
    文档.getElementById('gameMap'),
    文档.querySelector('.game-map-canvas'),
    文档.getElementById('game-page'),
    文档.getElementById('react-container'),
  ]

  for (const 起点 of 起点列表) {
    const 数据包 = 读取节点回放数据包(起点)
    if (数据包) return 数据包
  }
  return null

  function 读取节点回放数据包(节点) {
    const fiber = 读取ReactFiber(节点)
    if (!fiber) return null

    const 已访问 = new Set()
    const 栈 = [fiber]
    while (栈.length) {
      const 当前 = 栈.pop()
      if (!当前 || 已访问.has(当前)) continue
      已访问.add(当前)

      const 数据包 = 读取fiber回放数据包(当前)
      if (数据包) return 数据包

      if (当前.return) 栈.push(当前.return)
      if (当前.child) 栈.push(当前.child)
      if (当前.sibling) 栈.push(当前.sibling)
    }
    return null
  }

  function 读取fiber回放数据包(fiber) {
    const props列表 = [
      fiber.memoizedProps,
      fiber.pendingProps,
      fiber.stateNode?.props,
      fiber.stateNode?.props?.props,
    ]
    for (const props of props列表) {
      if (!是回放数据Props(props)) continue
      return {
        map: props.map,
        cities: props.cities,
        generals: props.generals,
        turn: props.turn,
      }
    }
    return null
  }

  function 读取ReactFiber(节点) {
    if (!节点) return null
    const fiber键 = Object.keys(节点).find(function (键) {
      return (
        键.startsWith('__reactFiber$') ||
        键.startsWith('__reactInternalInstance$')
      )
    })
    return fiber键 ? 节点[fiber键] : null
  }

  function 是回放数据Props(props) {
    return Boolean(
      props?.isReplay === true &&
      props.map &&
      Number.isInteger(props.turn) &&
      Number.isInteger(props.map?.width) &&
      Number.isInteger(props.map?.height) &&
      Array.isArray(props.map?._armies),
    )
  }
}

function 读取当前页面兵力表格数据() {
  return 读取兵力表格数据(document.querySelector('#gameMap .game-cursor-table'))
}

function 读取兵力表格数据(文字表格) {
  const 行列表 = Array.from(文字表格?.rows ?? [])
  if (!行列表.length) return null

  const 高度 = 行列表.length
  const 宽度 = Math.max(
    ...行列表.map(function (行) {
      return 行.cells.length
    }),
  )
  if (!Number.isInteger(宽度) || 宽度 <= 0) return null

  const 文本列表 = new Array(宽度 * 高度).fill('')
  for (let 行idx = 0; 行idx < 高度; 行idx += 1) {
    const 单元格列表 = 行列表[行idx].cells
    for (let 列idx = 0; 列idx < 宽度; 列idx += 1) {
      const 单元格 = 单元格列表[列idx]
      const 文本 = (
        单元格?.querySelector('span')?.textContent ??
        单元格?.textContent ??
        ''
      ).trim()
      if (/^\d+$/.test(文本)) 文本列表[行idx * 宽度 + 列idx] = 文本
    }
  }

  if (!文本列表.some(Boolean)) return null
  return { 宽度, 高度, 文本列表 }
}

function 生成回放兵力表格数据(数据包) {
  const 地图信息 = 取得回放地图信息(数据包)
  if (!地图信息) return null

  const { 宽度, 高度, 兵力列表, 归属列表 } = 地图信息
  const 塔集合 = new Set(
    (数据包?.cities ?? []).filter(function (索引) {
      return Number.isInteger(索引)
    }),
  )
  const 文本列表 = new Array(宽度 * 高度).fill('')

  for (let idx = 0; idx < 文本列表.length; idx += 1) {
    const 兵力 = 兵力列表[idx]
    const 归属 = 归属列表[idx]
    if (!Number.isInteger(兵力) || 兵力 <= 0) continue
    if (!塔集合.has(idx) && (!Number.isInteger(归属) || 归属 < 0)) continue

    文本列表[idx] = String(兵力)
  }

  if (!文本列表.some(Boolean)) return null
  return { 宽度, 高度, 文本列表 }
}

function 重建终局前兵力表格() {
  移除终局前兵力表格()
  同步终局前兵力表格()
}

function 同步终局前兵力表格() {
  const 兵力表格数据 = 状态.终局前棋盘恢复?.兵力表格数据
  if (!兵力表格数据) {
    移除终局前兵力表格()
    return
  }

  const 画布 = 取游戏画布()
  const 宿主 = 取宿主(画布)
  if (!画布 || !宿主) {
    移除终局前兵力表格()
    return
  }

  if (!终局前兵力表格) {
    终局前兵力表格 = 创建终局前兵力表格(兵力表格数据)
  }
  if (终局前兵力表格.parentElement !== 宿主) {
    宿主.appendChild(终局前兵力表格)
  }

  const 定位 = 读取终局前兵力表格定位(画布, 宿主)
  if (!定位) return

  const 样式 = 终局前兵力表格.style
  样式.left = `${定位.左}px`
  样式.top = `${定位.上}px`
  样式.width = `${定位.宽}px`
  样式.height = `${定位.高}px`
}

function 创建终局前兵力表格(兵力表格数据) {
  const 表格 = document.createElement('table')
  表格.className = 'gio-before-end-army-table'
  表格.setAttribute('aria-hidden', 'true')
  Object.assign(表格.style, {
    position: 'absolute',
    left: '0px',
    top: '0px',
    borderCollapse: 'collapse',
    borderSpacing: '0',
    tableLayout: 'fixed',
    pointerEvents: 'none',
    zIndex: String(覆盖层层级 + 1),
    color: '#fff',
    font:
      '700 12px Quicksand, "Microsoft YaHei", "PingFang SC", ' +
      '"Hiragino Sans GB", "Noto Sans CJK SC", "Source Han Sans SC", ' +
      '"WenQuanYi Micro Hei", "Liberation Sans", sans-serif',
    lineHeight: 'normal',
    textShadow:
      'rgb(0, 0, 0) -1px 0px 2px, rgb(0, 0, 0) 0px 1px 2px, ' +
      'rgb(0, 0, 0) 1px 0px 2px, rgb(0, 0, 0) 0px -1px 2px',
  })

  const tbody = document.createElement('tbody')
  for (let 行idx = 0; 行idx < 兵力表格数据.高度; 行idx += 1) {
    const 行 = document.createElement('tr')
    行.style.height = `${100 / 兵力表格数据.高度}%`

    for (let 列idx = 0; 列idx < 兵力表格数据.宽度; 列idx += 1) {
      const 单元格 = document.createElement('td')
      Object.assign(单元格.style, {
        width: `${100 / 兵力表格数据.宽度}%`,
        padding: '0',
        border: '0',
        boxSizing: 'border-box',
        position: 'relative',
        textAlign: 'center',
        verticalAlign: 'middle',
        whiteSpace: 'nowrap',
      })

      const 文本 = document.createElement('span')
      文本.textContent =
        兵力表格数据.文本列表[行idx * 兵力表格数据.宽度 + 列idx] ?? ''
      单元格.appendChild(文本)
      行.appendChild(单元格)
    }

    tbody.appendChild(行)
  }
  表格.appendChild(tbody)
  return 表格
}

function 移除终局前兵力表格() {
  终局前兵力表格?.remove()
  终局前兵力表格 = null
}

function 读取终局前兵力表格定位(画布, 宿主) {
  const 画布矩形 = 画布.getBoundingClientRect()
  const 宿主矩形 = 宿主.getBoundingClientRect()
  const 地图元素 = 画布.closest('#gameMap')
  const 官方文字表格 = 地图元素?.querySelector('.game-cursor-table')
  const 当前缩放 = Math.max(
    0.0001,
    读取数字(地图元素?.style.getPropertyValue('--gio-adaptive-map-scale'), 1),
  )
  const 宽 = Math.max(
    1,
    读取像素尺寸(
      画布.style.width,
      官方文字表格?.style.width,
      地图元素?.style.width,
      地图元素?.style.getPropertyValue('--gio-adaptive-map-width'),
      画布矩形.width / 当前缩放,
      画布.offsetWidth,
      画布矩形.width,
    ),
  )
  const 高 = Math.max(
    1,
    读取像素尺寸(
      画布.style.height,
      官方文字表格?.style.height,
      地图元素?.style.height,
      地图元素?.style.getPropertyValue('--gio-adaptive-map-height'),
      画布矩形.height / 当前缩放,
      画布.offsetHeight,
      画布矩形.height,
    ),
  )
  const 左 =
    画布.parentElement === 宿主
      ? 画布.offsetLeft
      : 画布矩形.left - 宿主矩形.left
  const 上 =
    画布.parentElement === 宿主 ? 画布.offsetTop : 画布矩形.top - 宿主矩形.top

  return { 左, 上, 宽, 高 }
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

function 取得回放地图信息(数据包) {
  const 地图 = 数据包?.map
  if (!地图) return null

  if (Number.isInteger(地图.width) && Number.isInteger(地图.height)) {
    const 格子数 = 地图.width * 地图.height
    if (格子数 <= 0) return null
    if (地图._armies?.length < 格子数 || 地图._map?.length < 格子数) {
      return null
    }
    return {
      宽度: 地图.width,
      高度: 地图.height,
      兵力列表: 地图._armies.slice(0, 格子数),
      归属列表: 地图._map.slice(0, 格子数),
    }
  }

  if (!Array.isArray(地图) || 地图.length < 2) return null

  const 宽度 = 地图[0]
  const 高度 = 地图[1]
  const 格子数 = 宽度 * 高度
  if (!Number.isFinite(宽度) || !Number.isFinite(高度) || 格子数 <= 0) {
    return null
  }
  if (地图.length < 2 + 格子数 * 2) return null

  return {
    宽度,
    高度,
    兵力列表: 地图.slice(2, 2 + 格子数),
    归属列表: 地图.slice(2 + 格子数, 2 + 格子数 * 2),
  }
}

function 解析回放文件(内容) {
  const 原始列表 = JSON.parse(解压Uint8数组(内容))
  return {
    版本: 原始列表[0],
    回放编号: 原始列表[1],
    宽度: 原始列表[2],
    高度: 原始列表[3],
    玩家名列表: 原始列表[4],
    塔列表: 原始列表[6],
    塔兵力列表: 原始列表[7],
    基地列表: 原始列表[8],
    山列表: 原始列表[9],
    移动列表: Array.isArray(原始列表[10])
      ? 原始列表[10].map(function (移动, idx) {
          return {
            idx,
            玩家索引: 移动?.[0],
            起点: 移动?.[1],
            终点: 移动?.[2],
            是否半兵: Boolean(移动?.[3]),
            回合: 移动?.[4],
          }
        })
      : [],
    队伍: 原始列表[12],
  }
}

function 模拟回放数据包(回放, 目标回合) {
  if (!Number.isInteger(目标回合) || 目标回合 < 0) return null
  if (!Number.isInteger(回放?.宽度) || !Number.isInteger(回放?.高度))
    return null

  const 格子数 = 回放.宽度 * 回放.高度
  if (格子数 <= 0) return null

  const 兵力列表 = new Array(格子数).fill(0)
  const 归属列表 = new Array(格子数).fill(-1)
  const 塔集合 = new Set()
  const 基地集合 = new Set()

  if (Array.isArray(回放.山列表)) {
    for (const 索引 of 回放.山列表) {
      if (是有效索引(索引)) 归属列表[索引] = -2
    }
  }

  if (Array.isArray(回放.塔列表)) {
    for (let idx = 0; idx < 回放.塔列表.length; idx += 1) {
      const 索引 = 回放.塔列表[idx]
      if (!是有效索引(索引)) continue

      塔集合.add(索引)
      兵力列表[索引] = Number.isInteger(回放.塔兵力列表?.[idx])
        ? 回放.塔兵力列表[idx]
        : 40
      归属列表[索引] = -1
    }
  }

  if (Array.isArray(回放.基地列表)) {
    for (let 玩家索引 = 0; 玩家索引 < 回放.基地列表.length; 玩家索引 += 1) {
      const 索引 = 回放.基地列表[玩家索引]
      if (!是有效索引(索引)) continue

      基地集合.add(索引)
      兵力列表[索引] = 1
      归属列表[索引] = 玩家索引
    }
  }

  const 移动列表 = 回放.移动列表
    .filter(function (移动) {
      return (
        Number.isInteger(移动.玩家索引) &&
        Number.isInteger(移动.起点) &&
        Number.isInteger(移动.终点) &&
        Number.isInteger(移动.回合) &&
        移动.回合 >= 0 &&
        移动.回合 < 目标回合
      )
    })
    .sort(function (左, 右) {
      if (左.回合 !== 右.回合) return 左.回合 - 右.回合
      return 左.idx - 右.idx
    })

  let 移动idx = 0
  for (let 回合 = 0; 回合 < 目标回合; 回合 += 1) {
    while (移动idx < 移动列表.length && 移动列表[移动idx].回合 === 回合) {
      应用移动(移动列表[移动idx])
      移动idx += 1
    }
    应用自然增长(回合)
  }

  return {
    map: {
      width: 回放.宽度,
      height: 回放.高度,
      _armies: 兵力列表,
      _map: 归属列表,
    },
    cities: Array.isArray(回放.塔列表) ? 回放.塔列表.slice() : [],
    generals: Array.isArray(回放.基地列表) ? 回放.基地列表.slice() : [],
    turn: 目标回合,
  }

  function 应用移动(移动) {
    if (!是有效索引(移动.起点) || !是有效索引(移动.终点)) return
    if (归属列表[移动.起点] !== 移动.玩家索引) return

    const 起点兵力 = 兵力列表[移动.起点]
    const 终点兵力 = 兵力列表[移动.终点]
    const 终点归属 = 归属列表[移动.终点]
    if (!Number.isInteger(起点兵力) || 起点兵力 <= 1) return
    if (!Number.isInteger(终点兵力) || !Number.isInteger(终点归属)) return

    const 留守兵力 = 移动.是否半兵 ? Math.ceil(起点兵力 / 2) : 1
    const 移动兵力 = Math.max(0, 起点兵力 - 留守兵力)
    if (移动兵力 <= 0) return

    兵力列表[移动.起点] = 留守兵力
    if (终点归属 === 移动.玩家索引) {
      兵力列表[移动.终点] = 终点兵力 + 移动兵力
      return
    }

    if (移动兵力 > 终点兵力) {
      兵力列表[移动.终点] = 移动兵力 - 终点兵力
      归属列表[移动.终点] = 移动.玩家索引
    } else {
      兵力列表[移动.终点] = 终点兵力 - 移动兵力
    }
  }

  function 应用自然增长(回合) {
    const 基地塔增长 = 取得周期增长次数(回合, 回合 + 1, 基地自然增长turn数)
    if (基地塔增长 > 0) {
      基地集合.forEach(function (索引) {
        增加兵力(索引, 基地塔增长)
      })
      塔集合.forEach(function (索引) {
        增加兵力(索引, 基地塔增长)
      })
    }

    const 大回合增长 = 取得周期增长次数(回合, 回合 + 1, 大回合turn数)
    if (大回合增长 <= 0) return

    for (let idx = 0; idx < 格子数; idx += 1) {
      增加兵力(idx, 大回合增长)
    }
  }

  function 增加兵力(索引, 增长) {
    if (!是有效索引(索引)) return
    if (!Number.isInteger(归属列表[索引]) || 归属列表[索引] < 0) return
    if (!Number.isInteger(兵力列表[索引])) return
    兵力列表[索引] += 增长
  }

  function 是有效索引(索引) {
    return Number.isInteger(索引) && 索引 >= 0 && 索引 < 格子数
  }
}

function 取得周期增长次数(起始回合, 目标回合, 周期) {
  return Math.floor(目标回合 / 周期) - Math.floor(起始回合 / 周期)
}

function 解压Uint8数组(压缩数组) {
  if (!压缩数组?.length) return ''

  const 压缩码列表 = []
  for (let idx = 0; idx < 压缩数组.length; idx += 2) {
    压缩码列表.push(压缩数组[idx] * 256 + (压缩数组[idx + 1] ?? 0))
  }
  return 解压压缩码(压缩码列表.length, 32768, function (idx) {
    return 压缩码列表[idx]
  })
}

function 解压压缩码(长度, 重置值, 读取值) {
  const 字典 = []
  let 扩容剩余 = 4
  let 字典大小 = 4
  let 位数 = 3
  let 词条 = ''
  let 字符 = ''
  let 旧词条 = ''
  const 结果 = []
  const 数据 = {
    值: 读取值(0),
    位置: 重置值,
    索引: 1,
  }

  for (let idx = 0; idx < 3; idx += 1) 字典[idx] = idx

  const 初始标记 = 读取位(2)
  if (初始标记 === 0) {
    字符 = String.fromCharCode(读取位(8))
  } else if (初始标记 === 1) {
    字符 = String.fromCharCode(读取位(16))
  } else if (初始标记 === 2) {
    return ''
  }

  字典[3] = 字符
  旧词条 = 字符
  结果.push(字符)

  while (true) {
    if (数据.索引 > 长度) return ''

    let 字典索引 = 读取位(位数)
    if (字典索引 === 0) {
      字典[字典大小] = String.fromCharCode(读取位(8))
      字典索引 = 字典大小
      字典大小 += 1
      扩容剩余 -= 1
    } else if (字典索引 === 1) {
      字典[字典大小] = String.fromCharCode(读取位(16))
      字典索引 = 字典大小
      字典大小 += 1
      扩容剩余 -= 1
    } else if (字典索引 === 2) {
      return 结果.join('')
    }

    if (扩容剩余 === 0) {
      扩容剩余 = 2 ** 位数
      位数 += 1
    }

    if (字典[字典索引]) {
      词条 = 字典[字典索引]
    } else if (字典索引 === 字典大小) {
      词条 = 旧词条 + 旧词条.charAt(0)
    } else {
      return ''
    }

    结果.push(词条)
    字典[字典大小] = 旧词条 + 词条.charAt(0)
    字典大小 += 1
    扩容剩余 -= 1
    旧词条 = 词条

    if (扩容剩余 === 0) {
      扩容剩余 = 2 ** 位数
      位数 += 1
    }
  }

  function 读取位(数量) {
    let bits = 0
    let power = 1
    const 最大 = 2 ** 数量
    while (power !== 最大) {
      const resb = 数据.值 & 数据.位置
      数据.位置 >>= 1
      if (数据.位置 === 0) {
        数据.位置 = 重置值
        数据.值 = 读取值(数据.索引)
        数据.索引 += 1
      }
      bits |= (resb > 0 ? 1 : 0) * power
      power <<= 1
    }
    return bits
  }
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

function 取得回放文件地址(回放编号) {
  return `https://generalsio-replays-na.s3.amazonaws.com/${回放编号}.gior`
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
