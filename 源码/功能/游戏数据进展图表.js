// 功能目的:
// 在右侧战场数据区域展示每回合的 Army 差和 Land 差走势。
//
// 作用范围:
// 每回合采样数据，并维护一个 ECharts 折线图。
import { 我方蓝色, 样式编号, 覆盖层层级 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import { 同步我方玩家索引, 是我方或队友 } from '../游戏.js'
import { 状态 } from '../状态.js'
import { 读取分数玩家数据, 读取快照玩家数据 } from '../战场工具.js'
import { 取得战场数据表格 } from './战场表格.js'
import { 取得周期增长次数, 读取当前回合 } from '../游戏工具.js'
import { 读取显示回合 } from './大回合倒计时.js'
import { 取得单元格列表, 取得玩家列索引, 取得表头行 } from '../战场DOM工具.js'
import { 安装样式 as 注入样式 } from '../工具.js'

const 面板编号 = 'gio-data-progress-chart-panel'
const 图表类名 = 'gio-data-progress-chart'
const 样式元素编号 = `${样式编号}-data-progress-chart`
const 图表显示版本 = '大回合陆地拆分-11'
const ECharts脚本编号 = 'gio-echarts-script'
const ECharts地址 =
  'https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js'
const 陆地线颜色 = '#ffbf3f'
const 修正兵力差线颜色 = '#3ecf8e'
const 地差劣势文字颜色 = '#ff3d5a'
const 地差持平文字颜色 = '#000'
const 主图表类型 = '主图表'
const 大回合陆地兵力差图表类型 = '大回合陆地兵力差'
const 修正兵力差图表类型 = '修正兵力差'
const 底部标签列表 = [
  '陆地差',
  '兵力差',
  '耗兵差',
  '我方开塔兵力',
  '敌方开塔兵力',
]

const 图表实例表 = new Map()
let ECharts加载Promise = null
let 正在等待ECharts = false
const 图表渲染签名表 = new Map()
const 图表尺寸签名表 = new Map()
let 图表显示系列 = { 兵力差: true, 陆地差: false }
let 网页回放同步动画帧编号 = null
let 回放最新数据签名 = null
let 回放稳定数据签名 = null

export const 功能定义 = {
  id: '游戏数据进展图表',
  名称: '游戏数据进展图表',
  分类: '战场面板',
  描述: '按回合画出 Army 差和 Land 差走势',
}

export const 主程序功能 = {
  id: 功能定义.id,
  启动: 安装网页回放数据进展同步,
  页面同步: 同步游戏数据进展图表,
  窗口尺寸变化: 更新游戏数据进展图表,
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭() {
    重置游戏数据进展()
    更新游戏数据进展图表()
  },
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置: 重置游戏数据进展,
  新局重置后: 更新游戏数据进展图表,
  game_update({ 数据包 }) {
    记录游戏数据进展(数据包 ?? {})
  },
}

export function 记录游戏数据进展(数据包) {
  if (!功能已启用('游戏数据进展图表')) return
  const 回合 = 读取当前回合(数据包)
  记录游戏数据进展点(回合, () => 读取数据差(数据包))
}

function 同步游戏数据进展图表() {
  记录网页回放数据进展()
  更新游戏数据进展图表()
}

function 记录网页回放数据进展() {
  if (!是网页回放页()) return
  const 回合 = 读取显示回合()
  const 差值 = 读取页面数据差()
  if (是回放终局数据(差值)) {
    回放最新数据签名 = null
    回放稳定数据签名 = null
    截断回放数据进展(回合 - 1)
    return
  }
  const 当前数据签名 = 取得回放数据签名(回合, 差值)
  let 稳定状态已变化 = false
  if (当前数据签名) {
    if (当前数据签名 === 回放最新数据签名) {
      if (回放稳定数据签名 !== 当前数据签名) {
        回放稳定数据签名 = 当前数据签名
        稳定状态已变化 = true
      }
    } else {
      回放最新数据签名 = 当前数据签名
    }
  }
  截断回放数据进展(回合)
  记录游戏数据进展点(回合, () => 差值)
  if (稳定状态已变化) {
    图表渲染签名表.clear()
    更新游戏数据进展图表()
  }
}

function 安装网页回放数据进展同步() {
  if (网页回放同步动画帧编号 !== null) return
  function 同步网页回放数据进展() {
    if (功能已启用('游戏数据进展图表') && 是网页回放页()) {
      记录网页回放数据进展()
    }
    网页回放同步动画帧编号 = window.requestAnimationFrame(同步网页回放数据进展)
  }
  网页回放同步动画帧编号 = window.requestAnimationFrame(同步网页回放数据进展)
}

function 记录游戏数据进展点(回合, 读取差值) {
  if (!Number.isInteger(回合) || 回合 <= 0) return

  const 差值 = 读取差值()
  if (!差值) return

  const 开塔进展 = 读取开塔进展(回合)
  const 数据点 = {
    回合,
    兵力差: 差值.兵力差,
    陆地差: 差值.陆地差,
    ...开塔进展,
  }
  const 最后数据点 = 状态.游戏数据进展列表.at(-1)
  const 已有索引 =
    最后数据点?.回合 === 回合
      ? 状态.游戏数据进展列表.length - 1
      : 状态.游戏数据进展列表.findIndex((点) => {
          return 点.回合 === 回合
        })
  if (已有索引 >= 0) {
    const 旧数据点 = 状态.游戏数据进展列表[已有索引]
    if (
      状态.游戏数据进展上次统计回合 === 回合 &&
      旧数据点.兵力差 === 数据点.兵力差 &&
      旧数据点.陆地差 === 数据点.陆地差 &&
      取得开塔进展签名(开塔进展) === 取得开塔进展签名(旧数据点)
    ) {
      return
    }
    状态.游戏数据进展列表[已有索引] = {
      ...旧数据点,
      ...数据点,
    }
  } else if (!最后数据点 || 最后数据点.回合 < 回合) {
    状态.游戏数据进展列表.push(数据点)
  } else {
    状态.游戏数据进展列表.push(数据点)
    状态.游戏数据进展列表.sort((左, 右) => 左.回合 - 右.回合)
  }
  状态.游戏数据进展上次统计回合 = 回合
  更新游戏数据进展图表()
}

function 截断回放数据进展(回合) {
  if (!Number.isInteger(回合) || 回合 <= 0) return
  const 原数据数量 = 状态.游戏数据进展列表.length
  状态.游戏数据进展列表 = 状态.游戏数据进展列表.filter((数据点) => {
    return 数据点.回合 <= 回合
  })
  if (状态.游戏数据进展列表.length === 原数据数量) return

  图表渲染签名表.clear()
  更新游戏数据进展图表()
}

export function 重置游戏数据进展() {
  状态.游戏数据进展列表 = []
  状态.游戏数据进展上次统计回合 = null
  回放最新数据签名 = null
  回放稳定数据签名 = null
  图表渲染签名表.clear()
  图表尺寸签名表.clear()
  图表实例表.forEach((图表实例) => {
    图表实例.clear()
  })
  更新游戏数据进展图表()
}

export function 更新游戏数据进展图表() {
  if (!功能已启用('游戏数据进展图表')) {
    状态.游戏数据进展面板?.remove()
    状态.游戏数据进展面板 = null
    图表实例表.forEach((图表实例) => {
      图表实例.dispose()
    })
    图表实例表.clear()
    图表渲染签名表.clear()
    图表尺寸签名表.clear()
    return
  }
  if (!document.body) return

  安装样式()
  const 面板 = 确保面板()
  if (!面板) return

  更新面板状态(面板)
  if (!状态.游戏数据进展列表.length) {
    面板.querySelector('.gio-data-progress-big-turn-lines')?.replaceChildren()
    return
  }

  if (globalThis.echarts?.init) {
    渲染图表(globalThis.echarts, 面板)
    return
  }
  if (正在等待ECharts) return

  正在等待ECharts = true
  加载ECharts()
    .then(() => {
      正在等待ECharts = false
      更新游戏数据进展图表()
    })
    .catch((错误) => {
      正在等待ECharts = false
      ECharts加载Promise = null
      console.warn('[游戏数据进展图表] ECharts 加载失败:', 错误)
    })
}

function 读取数据差(数据包) {
  if (是游戏结束数据(数据包)) return null
  同步我方玩家索引()
  const 玩家数据 = 读取分数玩家数据(数据包) ?? 读取快照玩家数据()
  if (!玩家数据) return null

  return {
    兵力差: 玩家数据.我方.兵力 - 玩家数据.敌方.兵力,
    陆地差: 玩家数据.我方.陆地 - 玩家数据.敌方.陆地,
  }
}

function 读取页面数据差() {
  同步我方玩家索引()
  const 表格 = 取得战场数据表格()
  if (!表格) return null

  const 表头行 = 取得表头行(表格)
  if (!表头行) return null

  const 表头格列表 = 取得单元格列表(表头行)
  const 玩家列 = 取得玩家列索引(表头格列表)
  const 兵力列 = 取得列索引(表头格列表, 'Army', 'army')
  const 陆地列 = 取得列索引(表头格列表, 'Land', 'land')
  if (玩家列 < 0 || 兵力列 < 0 || 陆地列 < 0) return null

  const 玩家行列表 = Array.from(表格.querySelectorAll('tr')).filter((行) => {
    return 行 !== 表头行 && 取得单元格列表(行).length > 陆地列
  })
  const 我方行 = 取得我方行(玩家行列表)
  const 敌方行 = 取得敌方行(玩家行列表, 我方行)
  if (!我方行 || !敌方行) return null

  const 我方格列表 = 取得单元格列表(我方行)
  const 敌方格列表 = 取得单元格列表(敌方行)
  const 我方兵力 = 读取页面数字(我方格列表[兵力列])
  const 敌方兵力 = 读取页面数字(敌方格列表[兵力列])
  const 我方陆地 = 读取页面数字(我方格列表[陆地列])
  const 敌方陆地 = 读取页面数字(敌方格列表[陆地列])
  if (
    !Number.isInteger(我方兵力) ||
    !Number.isInteger(敌方兵力) ||
    !Number.isInteger(我方陆地) ||
    !Number.isInteger(敌方陆地)
  ) {
    return null
  }

  return {
    兵力差: 我方兵力 - 敌方兵力,
    陆地差: 我方陆地 - 敌方陆地,
    我方兵力,
    敌方兵力,
    我方陆地,
    敌方陆地,
  }

  function 取得列索引(单元格列表, 原文本, 类型) {
    return 单元格列表.findIndex((单元格) => {
      if (单元格.dataset.gioBattleKind === 类型) return true
      return (单元格.textContent ?? '').trim() === 原文本
    })
  }

  function 取得我方行(玩家行列表) {
    return (
      玩家行列表.find((行) => {
        const 玩家索引 = 取得行玩家索引(行)
        return Number.isInteger(玩家索引) && 是我方或队友(玩家索引)
      }) ??
      玩家行列表.find((行) => {
        return 是我方玩家格(取得单元格列表(行)[玩家列])
      }) ??
      玩家行列表[0] ??
      null
    )
  }

  function 取得敌方行(玩家行列表, 我方行) {
    return (
      玩家行列表.find((行) => {
        const 玩家索引 = 取得行玩家索引(行)
        return Number.isInteger(玩家索引) && !是我方或队友(玩家索引)
      }) ??
      玩家行列表.find((行) => {
        return 是敌方玩家格(取得单元格列表(行)[玩家列])
      }) ??
      玩家行列表.find((行) => 行 !== 我方行) ??
      null
    )
  }

  function 取得行玩家索引(行) {
    const 玩家名 = (取得单元格列表(行)[玩家列]?.textContent ?? '').trim()
    if (!玩家名 || !Array.isArray(状态.玩家名列表)) return null
    const 玩家索引 = 状态.玩家名列表.indexOf(玩家名)
    return 玩家索引 >= 0 ? 玩家索引 : null
  }

  function 是我方玩家格(单元格) {
    return 有颜色类(单元格, [
      'blue',
      'lightblue',
      'selected-blue',
      'selected-lightblue',
    ])
  }

  function 是敌方玩家格(单元格) {
    return 有颜色类(单元格, ['red', 'selected-red'])
  }

  function 有颜色类(单元格, 类名列表) {
    if (!单元格) return false
    return 类名列表.some((类名) => {
      return (
        单元格.classList.contains(类名) ||
        Boolean(单元格.querySelector(`.${类名}`))
      )
    })
  }

  function 读取页面数字(单元格) {
    const 文本 = (单元格?.textContent ?? '').trim()
    if (/^[+-]\d+$/.test(文本)) return null
    const 数字 = Number.parseInt(文本, 10)
    return Number.isInteger(数字) ? 数字 : null
  }
}

function 是网页回放页() {
  return Boolean(
    globalThis.location?.pathname?.startsWith('/replays/') ||
    document.getElementById('replay-turn-jump-input'),
  )
}

function 是回放终局数据(差值) {
  if (是投降结算弹窗()) return true
  if (!差值) return false
  return (
    (差值.我方兵力 <= 0 && 差值.我方陆地 <= 0) ||
    (差值.敌方兵力 <= 0 && 差值.敌方陆地 <= 0)
  )
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

function 取得回放数据签名(回合, 数据点) {
  if (!Number.isInteger(回合) || !数据点) return ''
  return [回合, 数据点.兵力差, 数据点.陆地差].join(':')
}

function 是游戏结束数据(数据包) {
  return Array.isArray(数据包?.scores)
    ? 数据包.scores.some((分数) => 分数?.dead === true)
    : false
}

function 确保面板() {
  let 面板 = 状态.游戏数据进展面板
  if (!面板 || !document.documentElement.contains(面板)) {
    面板 = document.getElementById(面板编号)
  }
  if (!面板) {
    面板 = document.createElement('section')
    面板.id = 面板编号
    面板.innerHTML =
      '<div class="gio-data-progress-head">' +
      '<span class="gio-data-progress-title">数据进展</span>' +
      '<span class="gio-data-progress-legend">' +
      '<span class="gio-data-progress-legend-item" data-gio-data-progress-series="兵力差"><span class="gio-data-progress-legend-line gio-data-progress-legend-army"></span>兵力差</span>' +
      '<span class="gio-data-progress-legend-item" data-gio-data-progress-series="陆地差"><span class="gio-data-progress-legend-line gio-data-progress-legend-land"></span>陆地差</span>' +
      '</span>' +
      '</div>' +
      '<div class="gio-data-progress-chart-section">' +
      '<div class="gio-data-progress-body">' +
      '<div class="gio-data-progress-row-labels" aria-hidden="true">' +
      底部标签列表
        .map(
          (标签) => `<span class="gio-data-progress-row-label">${标签}</span>`,
        )
        .join('') +
      '</div>' +
      `<div class="${图表类名}" data-gio-data-progress-chart="${主图表类型}"></div>` +
      '<div class="gio-data-progress-empty">等待回合</div>' +
      '</div>' +
      '</div>' +
      '<div class="gio-data-progress-chart-section">' +
      '<div class="gio-data-progress-subtitle">50回合陆地兵力差</div>' +
      '<div class="gio-data-progress-body gio-data-progress-body-simple">' +
      `<div class="${图表类名}" data-gio-data-progress-chart="${大回合陆地兵力差图表类型}"></div>` +
      '</div>' +
      '</div>' +
      '<div class="gio-data-progress-chart-section">' +
      '<div class="gio-data-progress-subtitle">排除50回合陆地后</div>' +
      '<div class="gio-data-progress-body gio-data-progress-body-simple">' +
      `<div class="${图表类名}" data-gio-data-progress-chart="${修正兵力差图表类型}"></div>` +
      '</div>' +
      '</div>' +
      '<div class="gio-data-progress-big-turn-lines" aria-hidden="true"></div>'
  }
  确保大回合虚线层(面板)

  面板.className = 'gio-data-progress-panel'

  const 挂载点 = 取得右侧挂载点()
  if (挂载点) {
    面板.classList.remove('gio-data-progress-floating')
    if (挂载点.表格?.parentElement === 挂载点.宿主) {
      if (挂载点.表格.nextElementSibling !== 面板) {
        挂载点.表格.insertAdjacentElement('afterend', 面板)
      }
    } else if (面板.parentElement !== 挂载点.宿主) {
      挂载点.宿主.appendChild(面板)
    }
  } else {
    面板.remove()
    状态.游戏数据进展面板 = null
    return null
  }

  状态.游戏数据进展面板 = 面板
  return 面板
}

function 确保大回合虚线层(面板) {
  if (面板.querySelector('.gio-data-progress-big-turn-lines')) return
  面板.insertAdjacentHTML(
    'beforeend',
    '<div class="gio-data-progress-big-turn-lines" aria-hidden="true"></div>',
  )
}

function 取得右侧挂载点() {
  const 表格 = 取得战场数据表格()
  if (!表格) return null

  const 标签名 = 表格.tagName?.toLowerCase() ?? ''
  if (标签名 !== 'table') return { 宿主: 表格, 表格: null }

  const 宿主 = 表格.parentElement
  if (!宿主 || 宿主 === document.body) return null
  return { 宿主, 表格 }
}

function 更新面板状态(面板) {
  const 数据数量 = 状态.游戏数据进展列表.length
  const 空状态 = 数据数量 ? 'false' : 'true'
  if (面板.dataset.gioDataProgressEmpty !== 空状态) {
    面板.dataset.gioDataProgressEmpty = 空状态
  }
  for (const 图例 of 面板.querySelectorAll('[data-gio-data-progress-series]')) {
    const 系列名 = 图例.dataset.gioDataProgressSeries
    图例.dataset.gioDataProgressActive = 图表显示系列[系列名] ? 'true' : 'false'
    if (图例.dataset.gioDataProgressReady) continue
    图例.dataset.gioDataProgressReady = 'true'
    图例.addEventListener('click', () => {
      切换图表系列(系列名)
    })
  }
}

function 切换图表系列(系列名) {
  图表显示系列 = {
    ...图表显示系列,
    [系列名]: !图表显示系列[系列名],
  }
  图表渲染签名表.clear()
  更新游戏数据进展图表()
}

function 加载ECharts() {
  if (globalThis.echarts?.init) return Promise.resolve(globalThis.echarts)
  if (ECharts加载Promise) return ECharts加载Promise

  ECharts加载Promise = new Promise((resolve, reject) => {
    const 已有脚本 = document.getElementById(ECharts脚本编号)
    if (已有脚本) {
      已有脚本.addEventListener('load', 处理脚本加载完成, { once: true })
      已有脚本.addEventListener('error', reject, { once: true })
      return
    }

    const 脚本 = document.createElement('script')
    脚本.id = ECharts脚本编号
    脚本.src = ECharts地址
    脚本.async = true
    脚本.onload = 处理脚本加载完成
    脚本.onerror = reject
    const 父元素 = document.head ?? document.documentElement
    父元素.appendChild(脚本)

    function 处理脚本加载完成() {
      if (globalThis.echarts?.init) {
        resolve(globalThis.echarts)
      } else {
        reject(new Error('ECharts 加载失败'))
      }
    }
  })
  return ECharts加载Promise
}

function 渲染图表(echarts, 面板) {
  const 图表元素列表 = Array.from(面板.querySelectorAll(`.${图表类名}`)).filter(
    图表元素可用,
  )
  if (!图表元素列表.length) return

  let 图表需要布局更新 = false
  清理失效图表实例(图表元素列表)
  for (const 图表元素 of 图表元素列表) {
    const 图表类型 = 图表元素.dataset.gioDataProgressChart || 主图表类型
    const 旧图表实例 = 图表实例表.get(图表类型)
    if (旧图表实例 && 旧图表实例.getDom?.() !== 图表元素) {
      旧图表实例.dispose()
      图表实例表.delete(图表类型)
      图表渲染签名表.delete(图表类型)
      图表尺寸签名表.delete(图表类型)
    }

    const 渲染签名 = 取得图表渲染签名(图表元素, 图表类型)
    const 图表实例 =
      图表实例表.get(图表类型) ??
      echarts.getInstanceByDom(图表元素) ??
      echarts.init(图表元素)
    if (图表渲染签名表.get(图表类型) !== 渲染签名) {
      图表实例.setOption(取得图表配置(图表类型), {
        notMerge: true,
        lazyUpdate: false,
        silent: true,
      })
      图表实例表.set(图表类型, 图表实例)
      图表渲染签名表.set(图表类型, 渲染签名)
      图表需要布局更新 = true
    }
  }
  requestAnimationFrame(() => {
    图表实例表.forEach((图表实例, 图表类型) => {
      if (!图表元素可用(图表实例?.getDom?.())) return
      const 图表元素 = 图表实例.getDom()
      const 尺寸签名 = `${图表元素.clientWidth}x${图表元素.clientHeight}`
      if (图表尺寸签名表.get(图表类型) === 尺寸签名) return
      图表尺寸签名表.set(图表类型, 尺寸签名)
      图表实例.resize({ silent: true })
      图表需要布局更新 = true
    })
    if (图表需要布局更新) {
      更新大回合虚线层(面板)
    }
  })

  function 清理失效图表实例(图表元素列表) {
    const 图表元素集合 = new Set(图表元素列表)
    图表实例表.forEach((图表实例, 图表类型) => {
      if (图表元素集合.has(图表实例.getDom?.())) return
      图表实例.dispose()
      图表实例表.delete(图表类型)
      图表渲染签名表.delete(图表类型)
      图表尺寸签名表.delete(图表类型)
    })
  }
}

function 更新大回合虚线层(面板) {
  const 虚线层 = 面板.querySelector('.gio-data-progress-big-turn-lines')
  if (!虚线层) return

  const 图表元素列表 = Array.from(面板.querySelectorAll(`.${图表类名}`)).filter(
    图表元素可用,
  )
  const 基准图表实例 = 图表实例表.get(主图表类型)
  const 基准图表元素 = 基准图表实例?.getDom?.()
  const 数据列表 = 取得图表数据列表()
  if (!图表元素列表.length || !图表元素可用(基准图表元素) || !数据列表.length) {
    虚线层.replaceChildren()
    return
  }

  const 面板位置 = 面板.getBoundingClientRect()
  const 首图表位置 = 图表元素列表[0].getBoundingClientRect()
  const 末图表位置 = 图表元素列表.at(-1).getBoundingClientRect()
  const 基准图表位置 = 基准图表元素.getBoundingClientRect()
  虚线层.style.top = `${首图表位置.top - 面板位置.top}px`
  虚线层.style.height = `${末图表位置.bottom - 首图表位置.top}px`

  const 最大回合 = Math.max(
    ...数据列表.map((数据点) => {
      return 数据点.回合
    }),
  )
  const 回合集合 = new Set(
    数据列表.map((数据点) => {
      return 数据点.回合
    }),
  )
  const 线列表 = []
  for (let 回合 = 50; 回合 <= 最大回合; 回合 += 50) {
    if (!回合集合.has(回合)) continue
    const 像素 = 基准图表实例.convertToPixel({ xAxisIndex: 0 }, String(回合))
    const 图表内x = Array.isArray(像素) ? 像素[0] : 像素
    if (!Number.isFinite(图表内x)) continue
    const 线 = document.createElement('span')
    线.className = 'gio-data-progress-big-turn-line'
    线.style.left = `${基准图表位置.left - 面板位置.left + 图表内x}px`
    线列表.push(线)
  }
  虚线层.replaceChildren(...线列表)
}

function 图表元素可用(图表元素) {
  return Boolean(图表元素?.isConnected && 图表元素.offsetParent)
}

function 取得图表数据列表() {
  const 数据列表 = 状态.游戏数据进展列表
  if (!是网页回放页() || 数据列表.length <= 1) return 数据列表

  const 最后数据点 = 数据列表.at(-1)
  const 最后数据签名 = 取得回放数据签名(最后数据点?.回合, 最后数据点)
  if (最后数据签名 === 回放稳定数据签名) return 数据列表
  return 数据列表.slice(0, -1)
}

function 取得图表渲染签名(图表元素, 图表类型) {
  const 数据签名 = 取得图表数据列表()
    .map((数据点) => {
      return [
        数据点.回合,
        数据点.兵力差,
        数据点.陆地差,
        读取开塔兵力列表(数据点, '我方').join(','),
        读取开塔兵力列表(数据点, '敌方').join(','),
        数据点.我方开塔成功 ? 1 : 0,
        数据点.敌方开塔成功 ? 1 : 0,
      ].join(':')
    })
    .join('|')
  const 显示签名 = Object.entries(图表显示系列)
    .map(([系列名, 显示]) => `${系列名}:${显示 ? 1 : 0}`)
    .join('|')
  return `${图表显示版本}|${图表类型}|${显示签名}|${图表元素.clientWidth}x${图表元素.clientHeight}|${数据签名}`
}

function 取得图表配置(图表类型) {
  const 数据列表 = 取得图表数据列表()
  const x轴回合列表 = 取得x轴回合列表(数据列表)
  const 兵力差变化列表 = 取得兵力差变化列表(数据列表)
  const 大回合陆地兵力差列表 = 取得大回合陆地兵力差列表(数据列表)
  if (图表类型 === 大回合陆地兵力差图表类型) {
    return 取得单线图表配置({
      数据列表,
      系列名: '50回合陆地兵力差',
      数据值列表: 大回合陆地兵力差列表,
      线颜色: 陆地线颜色,
      显示变化标签: true,
    })
  }
  if (图表类型 === 修正兵力差图表类型) {
    return 取得单线图表配置({
      数据列表,
      系列名: '排除50回合陆地后',
      数据值列表: 数据列表.map((数据点, idx) => {
        return 数据点.兵力差 - 大回合陆地兵力差列表[idx]
      }),
      线颜色: 修正兵力差线颜色,
    })
  }

  function 渲染底部数字(参数, api) {
    const 回合 = Number(api.value(4))
    const 数据点 = 数据列表[Number(api.value(5))]
    const 我方开塔兵力列表 = 读取开塔兵力列表(数据点, '我方')
    const 敌方开塔兵力列表 = 读取开塔兵力列表(数据点, '敌方')
    const 兵力差变化 = Number(api.value(2))
    const 陆地差 = Number(api.value(3))
    const [x] = api.coord([api.value(0), 0])
    const 底部y = 参数.coordSys.y + 参数.coordSys.height
    const children = []
    const 有效地差 = 回合 > 0 && 回合 % 50 === 0 && Number.isFinite(陆地差)
    const 有效兵力差变化 = Number.isFinite(兵力差变化) && 兵力差变化 !== 0
    const 兵力差变化文本 = 格式化非零差值(兵力差变化)
    if (兵力差变化文本) {
      children.push({
        type: 'text',
        x,
        y: 底部y + 38,
        style: {
          text: 兵力差变化文本,
          fill: 取得差值颜色(兵力差变化),
          align: 'center',
          font: '900 9px Arial',
        },
      })
    }
    if (有效地差) {
      children.push({
        type: 'text',
        x,
        y: 底部y + 20,
        style: {
          text: 格式化地差标签(陆地差),
          fill: 取得地差颜色(陆地差),
          align: 'center',
          font: '900 10px Arial',
        },
      })
    }
    if (有效地差 && 有效兵力差变化) {
      const 两行差 = 陆地差 - 兵力差变化
      children.push({
        type: 'text',
        x,
        y: 底部y + 54,
        style: {
          text: 格式化差值(两行差),
          fill: 取得差值颜色(两行差),
          align: 'center',
          font: '900 9px Arial',
        },
      })
    }
    添加开塔兵力列表文本(
      children,
      x,
      底部y + 70,
      我方开塔兵力列表,
      数据点?.我方开塔成功,
    )
    添加开塔兵力列表文本(
      children,
      x,
      底部y + 86,
      敌方开塔兵力列表,
      数据点?.敌方开塔成功,
    )
    return { type: 'group', children }
  }

  return {
    animation: false,
    animationDuration: 0,
    animationDurationUpdate: 0,
    textStyle: {
      color: '#dce8f8',
      fontFamily: 'Arial, sans-serif',
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      axisPointer: {
        label: {
          show: false,
        },
      },
      backgroundColor: 'rgba(9, 13, 20, 0.96)',
      borderColor: 'rgba(124, 148, 176, 0.55)',
      textStyle: {
        color: '#f7fbff',
        fontFamily: 'Arial, sans-serif',
        fontWeight: 700,
      },
      formatter(参数列表) {
        const 索引 = 参数列表?.[0]?.dataIndex ?? 0
        const 数据点 = 数据列表[索引]
        if (!数据点) return ''
        const 文本列表 = [
          `turn ${数据点.回合}`,
          `兵力差 ${格式化差值(数据点.兵力差)}`,
          `陆地差 ${格式化差值(数据点.陆地差)}`,
        ]
        const 兵力差变化文本 = 格式化非零差值(兵力差变化列表[索引])
        if (兵力差变化文本)
          文本列表.splice(2, 0, `兵力差变化 ${兵力差变化文本}`)
        const 我方开塔兵力列表 = 读取开塔兵力列表(数据点, '我方')
        const 敌方开塔兵力列表 = 读取开塔兵力列表(数据点, '敌方')
        if (我方开塔兵力列表.length) {
          文本列表.push(
            `我方开塔兵力 ${我方开塔兵力列表.join(' / ')}${数据点.我方开塔成功 ? ' 成功' : ''}`,
          )
        }
        if (敌方开塔兵力列表.length) {
          文本列表.push(
            `敌方开塔兵力 ${敌方开塔兵力列表.join(' / ')}${数据点.敌方开塔成功 ? ' 成功' : ''}`,
          )
        }
        return 文本列表.join('<br>')
      },
    },
    legend: {
      show: false,
      data: ['兵力差', '陆地差'],
      selected: 图表显示系列,
    },
    grid: {
      left: 56,
      right: 12,
      top: 14,
      bottom: 108,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: x轴回合列表,
      axisLabel: {
        show: false,
      },
      axisLine: {
        lineStyle: { color: 'rgba(220, 232, 248, 0.32)' },
      },
      axisTick: {
        show: false,
      },
    },
    yAxis: {
      type: 'value',
      min(范围) {
        return Math.min(范围.min, -10)
      },
      minInterval: 1,
      axisLabel: {
        color: 'rgba(220, 232, 248, 0.82)',
        fontWeight: 700,
        formatter(值) {
          const 数值 = Number(值)
          if (!Number.isInteger(数值)) return ''
          return 格式化差值(数值)
        },
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(220, 232, 248, 0.12)',
        },
      },
    },
    series: [
      {
        name: '兵力差',
        type: 'line',
        smooth: false,
        step: 'end',
        showSymbol: false,
        data: 数据列表.map((数据点) => 数据点.兵力差),
        itemStyle: { color: 我方蓝色 },
        lineStyle: { color: 我方蓝色, width: 2.4 },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.26)',
            type: 'dashed',
            width: 1,
          },
          data: [{ yAxis: 0 }],
        },
      },
      {
        name: '陆地差',
        type: 'line',
        smooth: false,
        step: 'end',
        showSymbol: false,
        data: 数据列表.map((数据点) => 数据点.陆地差),
        itemStyle: { color: 陆地线颜色 },
        lineStyle: { color: 陆地线颜色, width: 2.4 },
      },
      {
        type: 'custom',
        silent: true,
        clip: false,
        z: 8,
        renderItem: 渲染底部数字,
        tooltip: { show: false },
        data: 取得底部数字数据列表(数据列表, 兵力差变化列表),
      },
    ],
  }

  function 取得大回合陆地兵力差列表(数据列表) {
    let 累计兵力差 = 0
    return 数据列表.map((数据点, idx) => {
      const 上回合数据点 = 数据列表[idx - 1]
      if (!上回合数据点) return 累计兵力差

      const 大回合增长次数 = 取得周期增长次数(
        上回合数据点.回合,
        数据点.回合,
        50,
      )
      if (大回合增长次数 > 0) {
        累计兵力差 += 大回合增长次数 * 数据点.陆地差
      }
      return 累计兵力差
    })
  }

  function 取得x轴回合列表(数据列表) {
    const 最大回合 = Math.max(
      0,
      ...数据列表.map((数据点) => {
        return 数据点.回合
      }),
    )
    const x轴最大回合 = Math.max(50, (Math.floor(最大回合 / 50) + 1) * 50)
    return Array.from({ length: x轴最大回合 }, (_, idx) => {
      return String(idx + 1)
    })
  }

  function 取得单线图表配置({
    数据列表,
    系列名,
    数据值列表,
    线颜色,
    显示变化标签 = false,
  }) {
    const 变化标签数据列表 = 取得变化标签数据列表()
    const y轴范围 = 取得y轴范围()
    return {
      animation: false,
      animationDuration: 0,
      animationDurationUpdate: 0,
      textStyle: {
        color: '#dce8f8',
        fontFamily: 'Arial, sans-serif',
      },
      tooltip: {
        trigger: 'axis',
        confine: true,
        axisPointer: {
          label: {
            show: false,
          },
        },
        backgroundColor: 'rgba(9, 13, 20, 0.96)',
        borderColor: 'rgba(124, 148, 176, 0.55)',
        textStyle: {
          color: '#f7fbff',
          fontFamily: 'Arial, sans-serif',
          fontWeight: 700,
        },
        formatter(参数列表) {
          const 索引 = 参数列表?.[0]?.dataIndex ?? 0
          const 数据点 = 数据列表[索引]
          if (!数据点) return ''
          const 文本列表 = [
            `turn ${数据点.回合}`,
            `${系列名} ${格式化差值(数据值列表[索引])}`,
          ]
          const 标签数据 = 变化标签数据列表.find((候选) => {
            return 候选[3] === 索引
          })
          if (标签数据) {
            文本列表.push(
              `当前陆地差 ${格式化带符号差值(标签数据[2])}`,
              `累计陆地差 ${格式化带符号差值(标签数据[4])}`,
              `本次陆地差变动 ${格式化带符号差值(标签数据[5])}`,
            )
          }
          return 文本列表.join('<br>')
        },
      },
      grid: {
        left: 56,
        right: 12,
        top: 显示变化标签 ? 48 : 10,
        bottom: 显示变化标签 ? 36 : 24,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: x轴回合列表,
        axisLabel: {
          show: false,
        },
        axisLine: {
          lineStyle: { color: 'rgba(220, 232, 248, 0.32)' },
        },
        axisTick: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        min: y轴范围.min,
        max: y轴范围.max,
        minInterval: 1,
        axisLabel: {
          show: false,
        },
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        splitLine: {
          show: false,
        },
      },
      series: [
        {
          name: 系列名,
          type: 'line',
          smooth: false,
          step: 'end',
          showSymbol: false,
          data: 数据值列表,
          itemStyle: { color: 线颜色 },
          lineStyle: { color: 线颜色, width: 2.4 },
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: false },
            lineStyle: {
              color: 'rgba(255, 255, 255, 0.26)',
              type: 'dashed',
              width: 1,
            },
            data: [{ yAxis: 0 }],
          },
        },
        ...(显示变化标签
          ? [
              {
                type: 'custom',
                silent: true,
                clip: false,
                z: 8,
                renderItem: 渲染变化标签,
                tooltip: { show: false },
                data: 变化标签数据列表,
              },
            ]
          : []),
      ],
    }

    function 取得变化标签数据列表() {
      const 输出列表 = []
      let 上次大回合陆地差 = 0
      for (let idx = 1; idx < 数据列表.length; idx += 1) {
        const 当前值 = 数据值列表[idx]
        const 数据点 = 数据列表[idx]
        if (数据点.回合 <= 0 || 数据点.回合 % 50 !== 0) continue
        if (!Number.isFinite(当前值) || !Number.isFinite(数据点.陆地差))
          continue

        const 陆地差变动 = 数据点.陆地差 - 上次大回合陆地差
        上次大回合陆地差 = 数据点.陆地差
        输出列表.push([
          String(数据点.回合),
          当前值,
          数据点.陆地差,
          idx,
          当前值,
          陆地差变动,
        ])
      }
      return 输出列表
    }

    function 渲染变化标签(参数, api) {
      const 当前陆地差 = Number(api.value(2))
      const 累计陆地差 = Number(api.value(4))
      const 陆地差变动 = Number(api.value(5))
      if (
        !Number.isFinite(当前陆地差) ||
        !Number.isFinite(累计陆地差) ||
        !Number.isFinite(陆地差变动)
      ) {
        return { type: 'group' }
      }

      const [x] = api.coord([api.value(0), 0])
      return {
        type: 'group',
        children: [
          取得标签图形(x, 参数.coordSys.y - 28, '地', 当前陆地差),
          取得标签图形(x, 参数.coordSys.y - 10, '变', 陆地差变动),
          取得标签图形(
            x,
            参数.coordSys.y + 参数.coordSys.height + 20,
            '总',
            累计陆地差,
          ),
        ],
      }
    }

    function 取得标签图形(x, y, 标签, 值) {
      return {
        type: 'text',
        x,
        y,
        style: {
          text: `${标签}${格式化带符号差值(值)}`,
          fill: 取得标签颜色(值),
          align: 'center',
          font: '900 12px Arial',
        },
      }
    }

    function 取得标签颜色(值) {
      const 数值 = Number(值)
      if (!Number.isFinite(数值) || 数值 === 0) return '#dce8f8'
      return 取得差值颜色(数值)
    }

    function 格式化带符号差值(值) {
      const 数值 = Number(值)
      if (!Number.isFinite(数值)) return ''
      return 数值 < 0 ? `-${Math.abs(数值)}` : String(数值)
    }

    function 取得y轴范围() {
      const 有效值列表 = 数据值列表.filter((值) => {
        return Number.isFinite(值)
      })
      const 最小值 = Math.min(0, ...有效值列表)
      const 最大值 = Math.max(0, ...有效值列表)
      const 留白 = Math.max(2, Math.ceil((最大值 - 最小值) * 0.18))
      return {
        min: 最小值 - 留白,
        max: 最大值 + 留白,
      }
    }
  }
}

function 取得底部数字数据列表(数据列表, 兵力差变化列表) {
  const 输出列表 = []
  for (let idx = 0; idx < 数据列表.length; idx += 1) {
    const 数据点 = 数据列表[idx]
    const 兵力差变化 = 兵力差变化列表[idx]
    const 有兵力差变化 = Number.isFinite(兵力差变化) && 兵力差变化 !== 0
    const 是大回合点 = 数据点.回合 > 0 && 数据点.回合 % 50 === 0
    const 有开塔兵力 =
      读取开塔兵力列表(数据点, '我方').length ||
      读取开塔兵力列表(数据点, '敌方').length
    if (!有兵力差变化 && !是大回合点 && !有开塔兵力) continue

    输出列表.push([
      String(数据点.回合),
      0,
      兵力差变化,
      数据点.陆地差,
      数据点.回合,
      idx,
    ])
  }
  return 输出列表
}

function 读取开塔进展(回合) {
  const 我方开塔记录 = 读取我方开塔记录(回合)
  const 敌方开塔记录 = 读取敌方开塔记录(回合)
  const 记录 = {
    我方开塔兵力列表: 我方开塔记录.开塔兵力列表,
    敌方开塔兵力列表: 敌方开塔记录.开塔兵力列表,
    我方开塔成功: 我方开塔记录.开塔成功,
    敌方开塔成功: 敌方开塔记录.开塔成功,
  }
  return 记录

  function 读取我方开塔记录(当前回合) {
    const 开塔兵力列表 = []
    状态.我方开塔增长表.forEach((记忆) => {
      if (记忆?.回合 !== 当前回合) return
      const 本次开塔兵力 = Number(记忆.开塔耗兵)
      if (!Number.isInteger(本次开塔兵力) || 本次开塔兵力 <= 0) return
      开塔兵力列表.push(本次开塔兵力)
    })
    return { 开塔兵力列表, 开塔成功: 开塔兵力列表.length > 0 }
  }

  function 读取敌方开塔记录(当前回合) {
    const 调试 = 状态.敌方开塔调试
    if (调试?.回合 === 当前回合) {
      return {
        开塔兵力列表: 调试.敌方偷塔耗兵 > 0 ? [调试.敌方偷塔耗兵] : [],
        开塔成功: Boolean(调试.是敌方成功开塔 || 调试.新增开塔数 > 0),
      }
    }
    const 旧记录 = 状态.游戏数据进展列表.find((数据点) => {
      return 数据点.回合 === 当前回合
    })
    return {
      开塔兵力列表: 读取开塔兵力列表(旧记录, '敌方'),
      开塔成功: Boolean(旧记录?.敌方开塔成功),
    }
  }
}

function 取得开塔进展签名(数据点) {
  return [
    读取开塔兵力列表(数据点, '我方').join(','),
    读取开塔兵力列表(数据点, '敌方').join(','),
    数据点?.我方开塔成功 ? 1 : 0,
    数据点?.敌方开塔成功 ? 1 : 0,
  ].join(':')
}

function 读取开塔兵力列表(数据点, 玩家) {
  if (!数据点) return []

  const 列表 = 数据点[`${玩家}开塔兵力列表`]
  if (Array.isArray(列表)) {
    return 列表.filter((开塔兵力) => {
      return Number.isInteger(开塔兵力) && 开塔兵力 > 0
    })
  }

  const 旧兵力 = 数据点[`${玩家}开塔兵力`]
  return Number.isInteger(旧兵力) && 旧兵力 > 0 ? [旧兵力] : []
}

function 添加开塔兵力列表文本(children, x, y, 开塔兵力列表, 开塔成功) {
  const 有效开塔兵力列表 = 开塔兵力列表.filter((开塔兵力) => {
    return Number.isFinite(开塔兵力) && 开塔兵力 > 0
  })
  const 起始x = x - ((有效开塔兵力列表.length - 1) * 18) / 2
  有效开塔兵力列表.forEach((开塔兵力, idx) => {
    添加开塔兵力文本(children, 起始x + idx * 18, y, 开塔兵力, 开塔成功)
  })
}

function 添加开塔兵力文本(children, x, y, 开塔兵力, 开塔成功) {
  if (!Number.isFinite(开塔兵力) || 开塔兵力 <= 0) return

  if (开塔成功) {
    children.push({
      type: 'circle',
      shape: { cx: x, cy: y - 4, r: 8 },
      style: {
        fill: 'rgba(62, 207, 142, 0.2)',
        stroke: '#3ecf8e',
        lineWidth: 1.5,
      },
    })
  }
  children.push({
    type: 'text',
    x,
    y,
    style: {
      text: 格式化差值(开塔兵力),
      fill: 开塔成功 ? '#4dffad' : 'rgba(220, 232, 248, 0.72)',
      align: 'center',
      font: '900 9px Arial',
    },
  })
}

function 取得兵力差变化列表(数据列表) {
  return 数据列表.map((数据点, idx) => {
    const 上回合数据点 = 数据列表[idx - 1]
    if (!上回合数据点) return null
    return 数据点.兵力差 - 上回合数据点.兵力差
  })
}

function 格式化差值(值) {
  const 数值 = Number(值)
  if (!Number.isFinite(数值)) return ''
  return String(Math.abs(数值))
}

function 格式化非零差值(值) {
  const 数值 = Number(值)
  if (!Number.isFinite(数值) || 数值 === 0) return ''
  return 格式化差值(数值)
}

function 格式化地差标签(值) {
  const 数值 = Number(值)
  if (!Number.isFinite(数值)) return ''
  return 格式化差值(数值)
}

function 取得地差颜色(值) {
  return 取得差值颜色(值)
}

function 取得差值颜色(值) {
  const 数值 = Number(值)
  if (!Number.isFinite(数值) || 数值 === 0) return 地差持平文字颜色
  return 数值 > 0 ? 我方蓝色 : 地差劣势文字颜色
}

function 安装样式() {
  注入样式(
    样式元素编号,
    `
.gio-data-progress-panel {
    position: relative;
    box-sizing: border-box;
    width: 100%;
    margin-top: 6px;
    padding: 8px;
    border: 1px solid rgba(124, 148, 176, 0.42);
    border-radius: 6px;
    background: rgba(8, 12, 19, 0.95);
    color: #f7fbff;
    font: 700 12px/1.25 Arial, sans-serif;
    text-shadow: none;
    box-shadow: 0 10px 26px rgba(0, 0, 0, 0.34);
}
.gio-data-progress-panel.gio-data-progress-floating {
    position: fixed;
    right: 12px;
    top: 104px;
    z-index: ${覆盖层层级 + 1};
    width: 300px;
}
.gio-data-progress-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 2px;
}
.gio-data-progress-title {
    color: #f7fbff;
    font: 900 12px/1 Arial, sans-serif;
}
.gio-data-progress-chart-section + .gio-data-progress-chart-section {
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px solid rgba(124, 148, 176, 0.2);
}
.gio-data-progress-panel[data-gio-data-progress-empty="true"] .gio-data-progress-chart-section + .gio-data-progress-chart-section {
    display: none;
}
.gio-data-progress-subtitle {
    margin: 0 0 2px;
    color: rgba(247, 251, 255, 0.9);
    font: 900 11px/1 Arial, sans-serif;
}
.gio-data-progress-legend {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    color: #dce8f8;
    font: 900 12px/1 Arial, sans-serif;
}
.gio-data-progress-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    user-select: none;
    transition: opacity 120ms ease;
}
.gio-data-progress-legend-item[data-gio-data-progress-active="false"] {
    opacity: 0.38;
}
.gio-data-progress-legend-line {
    position: relative;
    display: inline-block;
    width: 16px;
    height: 2px;
    background: var(--gio-data-progress-legend-color);
}
.gio-data-progress-legend-line::after {
    content: "";
    position: absolute;
    left: 6px;
    top: -2px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--gio-data-progress-legend-color);
}
.gio-data-progress-legend-army {
    --gio-data-progress-legend-color: ${我方蓝色};
}
.gio-data-progress-legend-land {
    --gio-data-progress-legend-color: ${陆地线颜色};
}
.gio-data-progress-body {
    position: relative;
    height: 220px;
}
.gio-data-progress-body-simple {
    height: 150px;
}
.gio-data-progress-row-labels {
    position: absolute;
    left: 2px;
    bottom: 16px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    color: rgba(220, 232, 248, 0.82);
    font: 900 10px/1 Arial, sans-serif;
    pointer-events: none;
}
.gio-data-progress-row-label {
    display: block;
    min-width: 52px;
    text-align: left;
}
.${图表类名} {
    width: 100%;
    height: 220px;
}
.gio-data-progress-body-simple .${图表类名} {
    height: 150px;
}
.gio-data-progress-big-turn-lines {
    position: absolute;
    left: 0;
    right: 0;
    z-index: 3;
    pointer-events: none;
}
.gio-data-progress-big-turn-line {
    position: absolute;
    top: 0;
    bottom: 0;
    border-left: 1px dashed rgba(220, 232, 248, 0.24);
}
.gio-data-progress-empty {
    position: absolute;
    inset: 34px 0 0;
    display: none;
    align-items: center;
    justify-content: center;
    border: 1px dashed rgba(124, 148, 176, 0.36);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    color: rgba(247, 251, 255, 0.68);
    font: 800 12px/1 Arial, sans-serif;
    pointer-events: none;
}
.gio-data-progress-panel[data-gio-data-progress-empty="true"] .gio-data-progress-empty {
    display: flex;
}`,
  )
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 主程序功能, 功能恢复, socket功能 })
