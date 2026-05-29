// 功能目的:
// 在右侧战场数据区域展示每回合的 Army 差和 Land 差走势。
//
// 作用范围:
// 每回合采样数据，并维护一个 ECharts 折线图。
import { 我方蓝色, 样式编号 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import { 同步我方玩家索引 } from '../游戏.js'
import { 状态 } from '../状态.js'
import { 读取分数玩家数据, 读取快照玩家数据 } from '../战场工具.js'
import { 取得战场数据表格 } from './战场表格.js'
import { 读取当前回合 } from '../游戏工具.js'
import { 安装样式 as 注入样式 } from '../工具.js'

const 面板编号 = 'gio-data-progress-chart-panel'
const 图表类名 = 'gio-data-progress-chart'
const 样式元素编号 = `${样式编号}-data-progress-chart`
const ECharts脚本编号 = 'gio-echarts-script'
const ECharts地址 =
  'https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js'
const 陆地线颜色 = '#ffbf3f'
const 兵力差变化文字颜色 = '#ff3d5a'
const 地差劣势文字颜色 = '#ff3d5a'
const 地差持平文字颜色 = '#000'

let 图表实例 = null
let ECharts加载Promise = null
let 正在等待ECharts = false
let 图表渲染签名 = ''

export const 功能定义 = {
  id: '游戏数据进展图表',
  名称: '游戏数据进展图表',
  分类: '战场面板',
  描述: '按回合画出 Army 差和 Land 差走势',
}

export const 主程序功能 = {
  id: 功能定义.id,
  页面同步: 更新游戏数据进展图表,
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
  if (!Number.isInteger(回合) || 回合 <= 0) return
  if (是游戏结束数据(数据包)) return
  if (状态.游戏数据进展上次统计回合 === 回合) return

  const 差值 = 读取数据差(数据包)
  if (!差值) return

  状态.游戏数据进展上次统计回合 = 回合
  const 数据点 = {
    回合,
    兵力差: 差值.兵力差,
    陆地差: 差值.陆地差,
  }
  const 已有索引 = 状态.游戏数据进展列表.findIndex((点) => {
    return 点.回合 === 回合
  })
  if (已有索引 >= 0) {
    状态.游戏数据进展列表[已有索引] = 数据点
  } else {
    状态.游戏数据进展列表.push(数据点)
  }
  状态.游戏数据进展列表.sort((左, 右) => 左.回合 - 右.回合)
  更新游戏数据进展图表()
}

export function 重置游戏数据进展() {
  状态.游戏数据进展列表 = []
  状态.游戏数据进展上次统计回合 = null
  图表渲染签名 = ''
  图表实例?.clear()
  更新游戏数据进展图表()
}

export function 更新游戏数据进展图表() {
  if (!功能已启用('游戏数据进展图表')) {
    状态.游戏数据进展面板?.remove()
    状态.游戏数据进展面板 = null
    图表实例?.dispose()
    图表实例 = null
    图表渲染签名 = ''
    return
  }
  if (!document.body) return

  安装样式()
  const 面板 = 确保面板()
  if (!面板) return

  更新面板状态(面板)
  if (!状态.游戏数据进展列表.length) return

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
  同步我方玩家索引()
  const 玩家数据 = 读取分数玩家数据(数据包) ?? 读取快照玩家数据()
  if (!玩家数据) return null

  return {
    兵力差: 玩家数据.我方.兵力 - 玩家数据.敌方.兵力,
    陆地差: 玩家数据.我方.陆地 - 玩家数据.敌方.陆地,
  }
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
      '<span class="gio-data-progress-legend-item"><span class="gio-data-progress-legend-line gio-data-progress-legend-army"></span>兵力差</span>' +
      '<span class="gio-data-progress-legend-item"><span class="gio-data-progress-legend-line gio-data-progress-legend-land"></span>陆地差</span>' +
      '</span>' +
      '</div>' +
      '<div class="gio-data-progress-body">' +
      `<div class="${图表类名}"></div>` +
      '<div class="gio-data-progress-empty">等待回合</div>' +
      '</div>'
  }

  面板.className = 'gio-data-progress-panel'
  面板.title = '每回合统计一次我方减敌方的 Army 和 Land'

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
  const 图表元素 = 面板.querySelector(`.${图表类名}`)
  if (!图表元素) return

  if (图表实例 && 图表实例.getDom?.() !== 图表元素) {
    图表实例.dispose()
    图表实例 = null
    图表渲染签名 = ''
  }
  const 渲染签名 = 取得图表渲染签名(图表元素)
  if (图表实例 && 图表渲染签名 === 渲染签名) return

  图表实例 ??= echarts.getInstanceByDom(图表元素) ?? echarts.init(图表元素)
  图表实例.setOption(取得图表配置(), true)
  图表渲染签名 = 渲染签名
  requestAnimationFrame(() => {
    图表实例?.resize()
  })
}

function 取得图表渲染签名(图表元素) {
  const 数据签名 = 状态.游戏数据进展列表
    .map((数据点) => {
      return `${数据点.回合}:${数据点.兵力差}:${数据点.陆地差}`
    })
    .join('|')
  return `${图表元素.clientWidth}x${图表元素.clientHeight}|${数据签名}`
}

function 取得图表配置() {
  const 数据列表 = 状态.游戏数据进展列表
  const 兵力差变化列表 = 取得兵力差变化列表(数据列表)
  return {
    animation: true,
    animationDuration: 260,
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
        return 文本列表.join('<br>')
      },
    },
    legend: {
      show: false,
      data: ['兵力差', '陆地差'],
    },
    grid: {
      left: 42,
      right: 12,
      top: 14,
      bottom: 62,
    },
    xAxis: [
      {
        type: 'category',
        boundaryGap: false,
        data: 数据列表.map((数据点) => String(数据点.回合)),
        axisLabel: {
          color: 'rgba(220, 232, 248, 0.82)',
          fontWeight: 700,
          interval(idx) {
            const 数据点 = 数据列表[idx]
            return 数据点?.回合 > 0 && 数据点.回合 % 50 === 0
          },
          formatter(回合) {
            const 数值 = Number(回合)
            return 数值 > 0 && 数值 % 50 === 0 ? 回合 : ''
          },
        },
        axisLine: {
          lineStyle: { color: 'rgba(220, 232, 248, 0.32)' },
        },
        axisTick: {
          show: false,
        },
      },
      {
        type: 'category',
        boundaryGap: false,
        position: 'bottom',
        offset: 18,
        data: 数据列表.map((数据点) => String(数据点.回合)),
        axisLabel: {
          color: 兵力差变化文字颜色,
          fontSize: 9,
          fontWeight: 900,
          hideOverlap: false,
          interval: 0,
          margin: 4,
          formatter(_回合, idx) {
            return 格式化非零差值(兵力差变化列表[idx])
          },
        },
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
      },
      {
        type: 'category',
        boundaryGap: false,
        position: 'bottom',
        offset: 34,
        data: 数据列表.map((数据点) => String(数据点.回合)),
        axisLabel: {
          fontSize: 10,
          fontWeight: 900,
          hideOverlap: false,
          interval(idx) {
            const 数据点 = 数据列表[idx]
            return 数据点?.回合 > 0 && 数据点.回合 % 50 === 0
          },
          margin: 4,
          rich: {
            优势: { color: 我方蓝色 },
            劣势: { color: 地差劣势文字颜色 },
            持平: { color: 地差持平文字颜色 },
          },
          formatter(_回合, idx) {
            return 格式化地差标签(数据列表[idx]?.陆地差)
          },
        },
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
      },
    ],
    yAxis: {
      type: 'value',
      axisLabel: {
        color: 'rgba(220, 232, 248, 0.82)',
        fontWeight: 700,
        formatter: 格式化差值,
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
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
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
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: 数据列表.map((数据点) => 数据点.陆地差),
        itemStyle: { color: 陆地线颜色 },
        lineStyle: { color: 陆地线颜色, width: 2.4 },
      },
    ],
  }
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
  return 数值 > 0 ? `+${数值}` : String(数值)
}

function 格式化非零差值(值) {
  const 数值 = Number(值)
  if (!Number.isFinite(数值) || 数值 === 0) return ''
  return 格式化差值(数值)
}

function 格式化地差标签(值) {
  const 数值 = Number(值)
  if (!Number.isFinite(数值)) return ''
  if (数值 > 0) return `{优势|${格式化差值(数值)}}`
  if (数值 < 0) return `{劣势|${数值}}`
  return `{持平|0}`
}

function 安装样式() {
  注入样式(
    样式元素编号,
    `
.gio-data-progress-panel {
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
    z-index: 2147482998;
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
    height: 188px;
}
.${图表类名} {
    width: 100%;
    height: 188px;
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
