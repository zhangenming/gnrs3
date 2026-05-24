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
const 样式编号 = 'gio-action-watch-style'
const 监控起始回合 = 50
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
  const 回合文本 = 回合状态列表
    .map((回合状态) => `${回合状态.回合}:${回合状态.行动类型}`)
    .join(',')

  if (面板.dataset.gioActionWatchTurns === 回合文本) return
  面板.dataset.gioActionWatchTurns = 回合文本

  if (计数元素) 计数元素.textContent = String(空闲数量)
  if (!列表元素) return

  列表元素.replaceChildren()
  面板.dataset.gioActionWatchEmpty = 回合状态列表.length ? 'false' : 'true'

  if (!回合状态列表.length) {
    const 空状态 = document.createElement('span')
    空状态.className = 'gio-action-watch-empty'
    空状态.textContent = '等待回合'
    列表元素.appendChild(空状态)
    面板.title = '等待我方行动记录'
    return
  }

  for (const [大回合序号, 分组回合列表] of 取得大回合分组(回合状态列表)) {
    const 行 = document.createElement('div')
    行.className = 'gio-action-watch-row'

    const 标题 = document.createElement('span')
    标题.className = 'gio-action-watch-round'
    标题.textContent = `大${大回合序号}`
    行.appendChild(标题)

    const 回合组 = document.createElement('span')
    回合组.className = 'gio-action-watch-row-list'
    for (const 回合状态 of 分组回合列表) {
      const 标签 = document.createElement('span')
      标签.className = `gio-action-watch-chip ${取得类型类名(回合状态.行动类型)}`
      标签.textContent = String(回合状态.回合)
      标签.title = `${回合状态.回合}: ${回合状态.行动类型}`
      回合组.appendChild(标签)
    }
    行.appendChild(回合组)
    列表元素.appendChild(行)
  }
  面板.title = 取得标题文本()

  function 取得回合状态列表() {
    const 最大回合 = 取得最大已确认回合()
    if (!Number.isInteger(最大回合) || 最大回合 < 监控起始回合) return []

    const 列表 = []
    for (let 回合 = 监控起始回合; 回合 <= 最大回合; 回合 += 1) {
      列表.push({
        回合,
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

  function 取得类型类名(行动类型) {
    if (行动类型 === '空闲') return 'gio-action-watch-chip-idle'
    if (行动类型 === '扩地(开塔)') return 'gio-action-watch-chip-expand'
    if (行动类型 === '抢地(抢塔)') return 'gio-action-watch-chip-fight'
    return 'gio-action-watch-chip-gather'
  }

  function 取得标题文本() {
    const 文本列表 = 回合状态列表.map((回合状态) => {
      return `${回合状态.回合}: ${回合状态.行动类型}`
    })
    return 文本列表.join('；')
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
        '<div class="gio-action-watch-list"></div>'
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
}

function 设置我方行动类型(回合, 行动类型) {
  const 旧行动类型 = 状态.我方行动类型表.get(回合)
  const 旧优先级 = 行动优先级表.get(旧行动类型) ?? -1
  const 新优先级 = 行动优先级表.get(行动类型) ?? -1
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
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 220px;
    overflow-y: auto;
    scrollbar-width: thin;
}
.gio-action-watch-row {
    display: grid;
    grid-template-columns: 38px 1fr;
    align-items: start;
    gap: 6px;
}
.gio-action-watch-round {
    box-sizing: border-box;
    min-width: 38px;
    padding: 4px 5px;
    border-radius: 5px;
    background: rgba(255, 191, 63, 0.16);
    color: #ffcf66;
    text-align: center;
    white-space: nowrap;
    font: 900 11px/1 Arial, sans-serif;
}
.gio-action-watch-row-list {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
}
.gio-action-watch-chip,
.gio-action-watch-empty {
    box-sizing: border-box;
    min-width: 30px;
    padding: 4px 6px;
    border-radius: 4px;
    text-align: center;
    white-space: nowrap;
    font: 800 11px/1 Arial, sans-serif;
}
.gio-action-watch-chip-gather {
    background: rgba(124, 148, 176, 0.24);
    color: rgba(247, 251, 255, 0.82);
}
.gio-action-watch-chip-idle {
    background: #b4232a;
    color: #fff7f7;
}
.gio-action-watch-chip-expand {
    background: #247448;
    color: #effff5;
}
.gio-action-watch-chip-fight {
    background: #b4481e;
    color: #fff4ec;
}
.gio-action-watch-empty {
    width: 100%;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(247, 251, 255, 0.72);
}
`.trim()
  document.documentElement.appendChild(样式)
}
