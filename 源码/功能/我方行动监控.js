// 功能目的:
// 总结每个 turn 我方的行动类型，并在右侧显示已经确认的行动监控。
//
// 作用范围:
// 读取本地 socket 出站事件、当前回合、地图归属差分和塔记忆。
// 只维护本地行动记录与页面面板，真实游戏操作队列由原 socket 流程处理。
import { 大回合turn数 } from '../配置.js'
import { 是我方或队友 } from '../游戏.js'
import { 状态 } from '../状态.js'

const 面板类名 = 'gio-action-watch-panel'
const 画布类名 = 'gio-action-watch-canvas'
const 样式编号 = 'gio-action-watch-style'
const 监控起始回合 = 50
const 每行回合数 = 25
const 行动类型列表 = ['空闲', '集兵', '扩地(开塔)', '抢地(抢塔)']
const 行动优先级表 = new Map(
  行动类型列表.map((行动类型, idx) => [行动类型, idx]),
)

export function 记录我方行动操作(目标索引) {
  const 回合 = 状态.当前回合
  if (!Number.isInteger(回合) || 回合 < 监控起始回合) return

  设置我方行动类型(回合, 取得攻击行动类型(目标索引))
}

export function 更新我方行动地图判断(旧地图数组, 新地图数组, 数据包) {
  const 回合 = Number.isInteger(数据包?.turn) ? 数据包.turn - 1 : 状态.当前回合
  if (!Number.isInteger(回合) || 回合 < 监控起始回合) return
  if (!Array.isArray(旧地图数组) || !Array.isArray(新地图数组)) return
  if (!状态.宽度 || !状态.高度) return

  const 格子数 = 状态.宽度 * 状态.高度
  if (
    旧地图数组.length < 2 + 格子数 * 2 ||
    新地图数组.length < 2 + 格子数 * 2
  ) {
    return
  }

  for (let idx = 0; idx < 格子数; idx += 1) {
    const 旧归属 = 旧地图数组[2 + 格子数 + idx]
    const 新归属 = 新地图数组[2 + 格子数 + idx]
    if (旧归属 === 新归属 || !是我方格(新归属)) continue

    if (是敌方格(旧归属)) {
      设置我方行动类型(回合, '抢地(抢塔)')
      return
    }
    if (旧归属 === -1) {
      设置我方行动类型(回合, '扩地(开塔)')
    }
  }

  function 是我方格(归属) {
    return Number.isInteger(归属) && 归属 >= 0 && 是我方或队友(归属)
  }

  function 是敌方格(归属) {
    return Number.isInteger(归属) && 归属 >= 0 && !是我方或队友(归属)
  }
}

export function 结算我方行动回合(回合) {
  if (!Number.isInteger(回合) || 回合 < 监控起始回合) return

  if (!状态.我方行动类型表.has(回合)) {
    状态.我方行动类型表.set(回合, '空闲')
  }
  更新我方行动监控UI()
}

export function 结算当前我方行动回合() {
  结算我方行动回合(状态.当前回合)
}

export function 重置我方行动监控() {
  状态.我方行动类型表.clear()
  更新我方行动监控UI()
}

export function 更新我方行动监控UI() {
  if (!document.body) return

  安装样式()
  const 面板 = 确保面板()
  if (!面板) return

  const 回合状态列表 = 取得回合状态列表()
  const 空闲数量 = 回合状态列表.filter((回合状态) => {
    return 回合状态.行动类型 === '空闲'
  }).length
  const 计数元素 = 面板.querySelector('.gio-action-watch-count')
  const 列表元素 = 面板.querySelector('.gio-action-watch-list')
  if (!列表元素) return

  const { 画布, 空状态 } = 确保画布列表(列表元素)
  const 画布宽 = 取得画布CSS宽(列表元素)
  const 回合文本 = 回合状态列表
    .map((回合状态) => `${回合状态.回合}:${回合状态.行动类型}`)
    .join(',')
  const 绘制签名 = `${画布宽}:${回合文本}`

  if (面板.dataset.gioActionWatchTurns === 绘制签名) return
  面板.dataset.gioActionWatchTurns = 绘制签名

  if (计数元素 && 计数元素.textContent !== String(空闲数量)) {
    计数元素.textContent = String(空闲数量)
  }

  面板.dataset.gioActionWatchEmpty = 回合状态列表.length ? 'false' : 'true'

  if (!回合状态列表.length) {
    空状态.textContent = '等待回合'
    列表元素.appendChild(空状态)
    面板.title = '等待我方行动记录'
    return
  }

  绘制行动监控画布(画布, 画布宽, 取得大回合分组(回合状态列表))
  面板.title = `空闲 ${空闲数量} / 已记录 ${回合状态列表.length}`

  function 取得回合状态列表() {
    const 最大回合 = 取得最大已确认回合()
    if (!Number.isInteger(最大回合) || 最大回合 < 监控起始回合) return []

    const 列表 = []
    for (let 回合 = 监控起始回合; 回合 <= 最大回合; 回合 += 1) {
      列表.push({
        回合,
        大回合内回合: 取得大回合内回合(回合),
        行动类型: 状态.我方行动类型表.get(回合) ?? '空闲',
      })
    }
    return 列表
  }

  function 取得最大已确认回合() {
    const 当前已确认回合 = Number.isInteger(状态.当前回合)
      ? 状态.当前回合 - 1
      : null
    let 最大回合 = 当前已确认回合

    状态.我方行动类型表.forEach((_行动类型, 回合) => {
      if (!Number.isInteger(回合) || 回合 < 监控起始回合) return
      if (!Number.isInteger(最大回合) || 回合 > 最大回合) 最大回合 = 回合
    })
    return 最大回合
  }

  function 取得大回合分组(回合列表) {
    const 分组表 = new Map()
    for (const 回合状态 of 回合列表) {
      const 大回合序号 = Math.floor(回合状态.回合 / 大回合turn数) + 1
      const 分组 = 分组表.get(大回合序号)
      if (分组) {
        分组.push(回合状态)
      } else {
        分组表.set(大回合序号, [回合状态])
      }
    }
    return 分组表
  }

  function 取得大回合内回合(回合) {
    return (回合 % 大回合turn数) + 1
  }

  function 确保面板() {
    let 面板 = 状态.我方行动监控面板
    if (!面板 || !document.documentElement.contains(面板)) {
      面板 = document.querySelector(`.${面板类名}`)
    }
    if (!面板) {
      面板 = document.createElement('section')
      面板.className = 面板类名
      面板.innerHTML =
        '<div class="gio-action-watch-head">' +
        '<span class="gio-action-watch-title">我方行动监控</span>' +
        '<span class="gio-action-watch-count">0</span>' +
        '</div>' +
        '<div class="gio-action-watch-legend">' +
        '<span data-gio-action-watch-kind="idle">空闲</span>' +
        '<span data-gio-action-watch-kind="gather">集兵</span>' +
        '<span data-gio-action-watch-kind="expand">扩地(开塔)</span>' +
        '<span data-gio-action-watch-kind="fight">抢地(抢塔)</span>' +
        '</div>' +
        `<div class="gio-action-watch-list"><canvas class="${画布类名}"></canvas><span class="gio-action-watch-empty">等待回合</span></div>`
    }

    if (
      面板.parentElement &&
      面板.parentElement !== document.body &&
      document.documentElement.contains(面板.parentElement)
    ) {
      状态.我方行动监控面板 = 面板
      return 面板
    }

    const 宿主 = 取得右侧宿主()
    if (!宿主) {
      面板.classList.add('gio-action-watch-floating')
      面板.style.left = ''
      面板.style.top = ''
      面板.style.right = '12px'
      面板.style.bottom = '12px'
      if (面板.parentElement !== document.body) document.body.appendChild(面板)
      状态.我方行动监控面板 = 面板
      return 面板
    }

    面板.classList.remove('gio-action-watch-floating')
    delete 面板.dataset.gioActionWatchPositioned
    面板.style.left = ''
    面板.style.top = ''
    面板.style.right = ''
    面板.style.bottom = ''
    面板.style.width = ''
    if (面板.parentElement !== 宿主) 宿主.appendChild(面板)

    状态.我方行动监控面板 = 面板
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

  function 取得战场数据表格() {
    const 表格列表 = document.body.querySelectorAll(
      'table, .leaderboard, #leaderboard',
    )
    for (const 表格 of 表格列表) {
      const 文本 = 表格.textContent ?? ''
      if (
        (文本.includes('Player') ||
          表格.querySelector('[data-gio-battle-player-column="true"]')) &&
        是战场数据表格(表格)
      ) {
        return 表格
      }
    }
    return null
  }

  function 是战场数据表格(表格) {
    const 文本 = 表格.textContent ?? ''
    if (文本.includes('Army') && 文本.includes('Land')) return true
    return Boolean(
      表格.querySelector(
        '[data-gio-battle-kind="army"], [data-gio-battle-kind="land"]',
      ),
    )
  }

  function 确保画布列表(列表元素) {
    let 画布 = 列表元素.querySelector(`.${画布类名}`)
    let 空状态 = 列表元素.querySelector('.gio-action-watch-empty')
    if (!画布 || !空状态 || 列表元素.children.length > 2) {
      画布 = document.createElement('canvas')
      画布.className = 画布类名
      空状态 = document.createElement('span')
      空状态.className = 'gio-action-watch-empty'
      空状态.textContent = '等待回合'
      列表元素.replaceChildren(画布, 空状态)
    }
    return { 画布, 空状态 }
  }

  function 取得画布CSS宽(列表元素) {
    return Math.max(716, Math.floor(列表元素.clientWidth || 0))
  }

  function 绘制行动监控画布(画布, css宽, 分组表) {
    const dpr = window.devicePixelRatio ?? 1
    const 标签宽 = 38
    const 标签间距 = 6
    const 单元间距 = 3
    const 组间距 = 6
    const 单元高 = 19
    const 单元宽 = Math.max(
      24,
      (css宽 - 标签宽 - 标签间距 - 单元间距 * (每行回合数 - 1)) / 每行回合数,
    )
    const 内容宽 =
      标签宽 + 标签间距 + 单元宽 * 每行回合数 + 单元间距 * (每行回合数 - 1)
    const 分组列表 = Array.from(分组表)
    const 组高度列表 = 分组列表.map(([, 分组回合列表]) => {
      const 最大回合 = 分组回合列表.reduce((最大值, 回合状态) => {
        return Math.max(最大值, 回合状态.大回合内回合)
      }, 1)
      const 行数 = Math.max(1, Math.ceil(最大回合 / 每行回合数))
      return 行数 * 单元高 + (行数 - 1) * 单元间距
    })
    const css高 = Math.max(
      单元高,
      组高度列表.reduce((总高, 组高) => 总高 + 组高, 0) +
        Math.max(0, 组高度列表.length - 1) * 组间距,
    )
    const 像素宽 = Math.round(内容宽 * dpr)
    const 像素高 = Math.round(css高 * dpr)

    if (画布.width !== 像素宽) 画布.width = 像素宽
    if (画布.height !== 像素高) 画布.height = 像素高
    画布.style.width = `${内容宽}px`
    画布.style.height = `${css高}px`

    const ctx = 画布.getContext('2d')
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, 内容宽, css高)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.letterSpacing = '0px'

    let y = 0
    for (let idx = 0; idx < 分组列表.length; idx += 1) {
      const [大回合序号, 分组回合列表] = 分组列表[idx]
      const 组高 = 组高度列表[idx]
      绘制大回合标签(大回合序号, y, 组高)
      for (const 回合状态 of 分组回合列表) {
        绘制回合单元(回合状态, y)
      }
      y += 组高 + 组间距
    }

    function 绘制大回合标签(大回合序号, y, 高) {
      ctx.fillStyle = 'rgba(255, 191, 63, 0.16)'
      ctx.beginPath()
      ctx.roundRect(0, y, 标签宽, 高, 5)
      ctx.fill()
      ctx.fillStyle = '#ffcf66'
      ctx.font = '900 11px Arial, sans-serif'
      ctx.fillText(`大${大回合序号}`, 标签宽 / 2, y + 高 / 2)
    }

    function 绘制回合单元(回合状态, 组Y) {
      const 序号 = Math.max(1, 回合状态.大回合内回合) - 1
      const 行 = Math.floor(序号 / 每行回合数)
      const 列 = 序号 % 每行回合数
      const x = 标签宽 + 标签间距 + 列 * (单元宽 + 单元间距)
      const y = 组Y + 行 * (单元高 + 单元间距)
      const 样式 = 取得行动样式(回合状态.行动类型)

      ctx.fillStyle = 样式.背景
      ctx.beginPath()
      ctx.roundRect(x, y, 单元宽, 单元高, 4)
      ctx.fill()
      ctx.fillStyle = 样式.文字
      ctx.font = '800 11px Arial, sans-serif'
      ctx.fillText(
        String(回合状态.大回合内回合),
        x + 单元宽 / 2,
        y + 单元高 / 2,
      )
    }

    function 取得行动样式(行动类型) {
      if (行动类型 === '空闲') {
        return { 背景: '#b4232a', 文字: '#fff7f7' }
      }
      if (行动类型 === '扩地(开塔)') {
        return { 背景: '#247448', 文字: '#effff5' }
      }
      if (行动类型 === '抢地(抢塔)') {
        return { 背景: '#b4481e', 文字: '#fff4ec' }
      }
      return {
        背景: 'rgba(124, 148, 176, 0.24)',
        文字: 'rgba(247, 251, 255, 0.82)',
      }
    }
  }
}

function 设置我方行动类型(回合, 行动类型) {
  const 旧行动类型 = 状态.我方行动类型表.get(回合)
  const 旧优先级 = 行动优先级表.get(旧行动类型) ?? -1
  const 新优先级 = 行动优先级表.get(行动类型) ?? -1
  if (旧行动类型 === 行动类型) return
  if (旧优先级 > 新优先级) return

  状态.我方行动类型表.set(回合, 行动类型)
  更新我方行动监控UI()
}

function 取得攻击行动类型(目标索引) {
  if (!Number.isInteger(目标索引) || 目标索引 < 0) return '集兵'

  const 塔类型 = 状态.已知塔类型.get(目标索引)
  if (塔类型 === '中立塔') return '扩地(开塔)'
  if (塔类型 === '敌方塔') return '抢地(抢塔)'

  const 地图数组 = 状态.地图数组
  if (!Array.isArray(地图数组) || !状态.宽度 || !状态.高度) return '集兵'

  const 格子数 = 状态.宽度 * 状态.高度
  if (目标索引 >= 格子数 || 地图数组.length < 2 + 格子数 * 2) return '集兵'

  const 归属 = 地图数组[2 + 格子数 + 目标索引]
  if (归属 === -1) return '扩地(开塔)'
  if (Number.isInteger(归属) && 归属 >= 0 && !是我方或队友(归属)) {
    return '抢地(抢塔)'
  }
  return '集兵'
}

function 安装样式() {
  if (!document.documentElement || document.getElementById(样式编号)) return

  const 样式 = document.createElement('style')
  样式.id = 样式编号
  样式.textContent = `
.${面板类名} {
    box-sizing: border-box;
    width: 100%;
    margin-top: 6px;
    padding: 8px;
    border: 1px solid rgba(124, 148, 176, 0.42);
    border-radius: 6px;
    background: rgba(13, 17, 23, 0.94);
    color: #f7fbff;
    font: 700 12px/1.25 Arial, sans-serif;
    text-shadow: none;
    box-shadow: 0 10px 26px rgba(0, 0, 0, 0.34);
}
.${面板类名}.gio-action-watch-floating {
    position: fixed;
    width: min(520px, calc(100vw - 24px));
    z-index: 2147482999;
}
.gio-action-watch-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
}
.gio-action-watch-title {
    color: #f7fbff;
    font: 800 12px/1 Arial, sans-serif;
}
.gio-action-watch-count {
    min-width: 24px;
    padding: 2px 6px;
    border-radius: 6px;
    background: #ffbf3f;
    color: #14110a;
    text-align: center;
    font: 900 12px/1 Arial, sans-serif;
}
.gio-action-watch-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 6px;
}
.gio-action-watch-legend span {
    box-sizing: border-box;
    padding: 3px 5px;
    border-radius: 4px;
    background: rgba(124, 148, 176, 0.16);
    color: rgba(247, 251, 255, 0.78);
    font: 800 10px/1 Arial, sans-serif;
}
.gio-action-watch-legend [data-gio-action-watch-kind="idle"] {
    background: rgba(180, 35, 42, 0.76);
    color: #fff7f7;
}
.gio-action-watch-legend [data-gio-action-watch-kind="gather"] {
    background: rgba(124, 148, 176, 0.28);
    color: rgba(247, 251, 255, 0.86);
}
.gio-action-watch-legend [data-gio-action-watch-kind="expand"] {
    background: rgba(36, 116, 72, 0.82);
    color: #effff5;
}
.gio-action-watch-legend [data-gio-action-watch-kind="fight"] {
    background: rgba(180, 72, 30, 0.88);
    color: #fff4ec;
}
.gio-action-watch-list {
    max-height: 220px;
    overflow: auto;
    scrollbar-width: thin;
}
.${画布类名} {
    display: block;
}
.${面板类名}[data-gio-action-watch-empty="true"] .${画布类名} {
    display: none;
}
.gio-action-watch-empty {
    box-sizing: border-box;
    display: none;
    width: 100%;
    padding: 4px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(247, 251, 255, 0.72);
    text-align: center;
    white-space: nowrap;
    font: 800 11px/1 Arial, sans-serif;
}
.${面板类名}[data-gio-action-watch-empty="true"] .gio-action-watch-empty {
    display: block;
}
`.trim()
  document.documentElement.appendChild(样式)
}
