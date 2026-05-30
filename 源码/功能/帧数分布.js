// 功能目的:
// 在右侧战场数据区域展示 requestAnimationFrame 每帧耗时的数量分布。
//
// 作用范围:
// 采集当前游戏页的 raf 时间戳，并用 ECharts 柱状图展示耗时从小到大的分布。
import { 我方蓝色, 样式编号 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import { 状态 } from '../状态.js'
import { 安装样式 as 注入样式 } from '../工具.js'
import { 取得战场数据表格 } from './战场表格.js'

const 面板类名 = 'gio-frame-distribution-panel'
const 图表类名 = 'gio-frame-distribution-chart'
const 样式元素编号 = `${样式编号}-frame-distribution`
const ECharts脚本编号 = 'gio-echarts-script'
const ECharts地址 =
  'https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js'
const 图表更新间隔 = 1000
const 柱状图颜色 = 我方蓝色

const raf = []
let 图表实例 = null
let ECharts加载Promise = null
let 正在等待ECharts = false
let 采样动画帧编号 = 0
let 上次图表更新时间 = 0
let 图表渲染签名 = ''

export const 功能定义 = {
  id: '帧数分布',
  名称: '帧数分布',
  分类: '战场面板',
  描述: '统计 requestAnimationFrame 每帧耗时分布',
}

export const 主程序功能 = {
  id: 功能定义.id,
  页面同步: 更新帧数分布,
  窗口尺寸变化: 更新帧数分布,
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭() {
    重置帧数分布()
    更新帧数分布()
  },
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置: 重置帧数分布,
  新局重置后: 更新帧数分布,
}

export function 更新帧数分布() {
  if (!功能已启用('帧数分布')) {
    移除帧数分布面板()
    停止帧数采样()
    return
  }
  if (!document.body) return
  if (!document.querySelector('#game-page #gameMap')) {
    移除帧数分布面板()
    停止帧数采样()
    return
  }

  安装样式()
  启动帧数采样()
  const 面板 = 确保面板()
  if (!面板) return

  更新面板状态(面板)
  if (raf.length < 2) return

  if (globalThis.echarts?.init) {
    渲染图表(globalThis.echarts, 面板)
    return
  }
  if (正在等待ECharts) return

  正在等待ECharts = true
  加载ECharts()
    .then(() => {
      正在等待ECharts = false
      更新帧数分布()
    })
    .catch((错误) => {
      正在等待ECharts = false
      ECharts加载Promise = null
      console.warn('[帧数分布] ECharts 加载失败:', 错误)
    })
}

export function 重置帧数分布() {
  raf.length = 0
  上次图表更新时间 = 0
  图表渲染签名 = ''
  图表实例?.clear()
  更新帧数分布()
}

function 启动帧数采样() {
  if (采样动画帧编号) return

  采样动画帧编号 = requestAnimationFrame(function 统计帧数分布(时间) {
    raf.push(时间)
    if (时间 - 上次图表更新时间 >= 图表更新间隔) {
      上次图表更新时间 = 时间
      更新帧数分布()
    }

    if (
      功能已启用('帧数分布') &&
      document.querySelector('#game-page #gameMap')
    ) {
      采样动画帧编号 = requestAnimationFrame(统计帧数分布)
    } else {
      采样动画帧编号 = 0
    }
  })
}

function 停止帧数采样() {
  if (采样动画帧编号) cancelAnimationFrame(采样动画帧编号)
  采样动画帧编号 = 0
  上次图表更新时间 = 0
}

function 确保面板() {
  let 面板 = 状态.帧数分布面板
  if (!面板 || !document.documentElement.contains(面板)) {
    面板 = document.querySelector(`.${面板类名}`)
  }
  if (!面板) {
    面板 = document.createElement('section')
    面板.className = 面板类名
    面板.innerHTML =
      '<div class="gio-frame-distribution-head">' +
      '<span class="gio-frame-distribution-title">帧数分布</span>' +
      '<span class="gio-frame-distribution-summary">样本 0</span>' +
      '</div>' +
      '<div class="gio-frame-distribution-body">' +
      `<div class="${图表类名}"></div>` +
      '<div class="gio-frame-distribution-empty">等待帧数据</div>' +
      '</div>'
  }

  const 宿主 = 取得右侧宿主()
  if (!宿主) {
    面板.remove()
    状态.帧数分布面板 = null
    return null
  }
  if (面板.parentElement !== 宿主) 宿主.appendChild(面板)

  状态.帧数分布面板 = 面板
  return 面板
}

function 取得右侧宿主() {
  const 表格 = 取得战场数据表格()
  if (!表格) return null

  const 标签名 = 表格.tagName?.toLowerCase() ?? ''
  if (标签名 !== 'table') return 表格

  const 宿主 = 表格.parentElement
  if (!宿主 || 宿主 === document.body) return null
  return 宿主
}

function 更新面板状态(面板, 已有分布列表 = null) {
  const 分布列表 = 已有分布列表 ?? 取得帧耗时分布()
  const 样本数 = Math.max(0, raf.length - 1)
  const 空状态 = 分布列表.length ? 'false' : 'true'
  if (面板.dataset.gioFrameDistributionEmpty !== 空状态) {
    面板.dataset.gioFrameDistributionEmpty = 空状态
  }

  const 摘要 = 面板.querySelector('.gio-frame-distribution-summary')
  if (摘要) 摘要.textContent = `样本 ${样本数}`
  面板.title = `已统计 ${样本数} 个 raf 帧间隔`
}

function 取得帧耗时分布() {
  const 分组 = Object.groupBy(
    raf.map((e, i, a) => (a[i + 1] - e).toFixed(1)).slice(0, -1),
    (e) => e,
  )

  return Object.entries(分组)
    .filter(([耗时]) => {
      return Number.isFinite(Number(耗时))
    })
    .sort(([左耗时], [右耗时]) => {
      return Number(左耗时) - Number(右耗时)
    })
    .map(([耗时, 列表]) => {
      return {
        耗时,
        数量: 列表.length,
      }
    })
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
        reject(new Error('ECharts 未初始化'))
      }
    }
  })

  return ECharts加载Promise
}

function 渲染图表(echarts, 面板) {
  const 图表元素 = 面板.querySelector(`.${图表类名}`)
  if (!图表元素) return

  const 分布列表 = 取得帧耗时分布()
  更新面板状态(面板, 分布列表)
  if (!分布列表.length) {
    图表实例?.clear()
    图表渲染签名 = ''
    return
  }

  const 数据签名 = 分布列表
    .map((数据点) => {
      return `${数据点.耗时}:${数据点.数量}`
    })
    .join('|')
  const 渲染签名 = `${图表元素.clientWidth}:${图表元素.clientHeight}:${数据签名}`
  if (图表渲染签名 === 渲染签名) {
    图表实例?.resize()
    return
  }

  if (!图表实例 || 图表实例.isDisposed?.()) {
    图表实例 = echarts.init(图表元素)
  } else {
    图表实例.resize()
  }
  图表实例.setOption(取得图表配置(分布列表), true)
  图表渲染签名 = 渲染签名
}

function 取得图表配置(分布列表) {
  const 类目数量 = 分布列表.length
  const x轴标签间隔 = 类目数量 > 24 ? Math.ceil(类目数量 / 16) : 0

  return {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: 'rgba(8, 12, 19, 0.96)',
      borderColor: 'rgba(124, 148, 176, 0.55)',
      textStyle: {
        color: '#f7fbff',
        fontWeight: 800,
      },
      formatter(参数列表) {
        const 参数 = 参数列表?.[0]
        if (!参数) return ''
        return `${参数.axisValue}ms<br/>数量 ${参数.data}`
      },
    },
    grid: {
      left: 42,
      right: 10,
      top: 14,
      bottom: 34,
    },
    xAxis: {
      type: 'category',
      name: 'ms',
      nameTextStyle: {
        color: 'rgba(220, 232, 248, 0.76)',
        fontWeight: 800,
      },
      data: 分布列表.map((数据点) => 数据点.耗时),
      axisLabel: {
        color: 'rgba(220, 232, 248, 0.82)',
        fontWeight: 800,
        interval: x轴标签间隔,
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
      minInterval: 1,
      axisLabel: {
        color: 'rgba(220, 232, 248, 0.82)',
        fontWeight: 800,
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(220, 232, 248, 0.12)',
        },
      },
    },
    series: [
      {
        name: '数量',
        type: 'bar',
        barMinWidth: 3,
        barMaxWidth: 16,
        data: 分布列表.map((数据点) => 数据点.数量),
        itemStyle: {
          color: 柱状图颜色,
          borderRadius: [2, 2, 0, 0],
        },
      },
    ],
  }
}

function 移除帧数分布面板() {
  状态.帧数分布面板?.remove()
  状态.帧数分布面板 = null
  图表实例?.dispose()
  图表实例 = null
  图表渲染签名 = ''
}

function 安装样式() {
  注入样式(
    样式元素编号,
    `
.${面板类名} {
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
.gio-frame-distribution-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 2px;
}
.gio-frame-distribution-title {
    color: #f7fbff;
    font: 900 12px/1 Arial, sans-serif;
}
.gio-frame-distribution-summary {
    color: rgba(220, 232, 248, 0.78);
    font: 900 12px/1 Arial, sans-serif;
}
.gio-frame-distribution-body {
    position: relative;
    height: 164px;
}
.${图表类名} {
    width: 100%;
    height: 164px;
}
.gio-frame-distribution-empty {
    position: absolute;
    inset: 28px 0 0;
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
.${面板类名}[data-gio-frame-distribution-empty="true"] .gio-frame-distribution-empty {
    display: flex;
}`,
  )
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 主程序功能, 功能恢复, socket功能 })
