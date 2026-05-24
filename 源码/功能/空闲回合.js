// 功能目的:
// 记录玩家每个 turn 是否发出操作，并在右侧显示已经确认空闲的回合。
//
// 作用范围:
// 只读取本地 socket 出站事件和当前回合，不改变真实游戏操作队列。
import { 大回合turn数 } from '../配置.js'
import { 状态 } from '../状态.js'

const 面板类名 = 'gio-idle-turn-panel'
const 样式编号 = 'gio-idle-turn-style'
const 空闲记录起始回合 = 50

export function 记录空闲回合操作() {
  const 回合 = 状态.当前回合
  if (!Number.isInteger(回合) || 回合 < 空闲记录起始回合) return

  状态.空闲回合操作集合.add(回合)
  状态.空闲回合集合.delete(回合)
  更新空闲回合UI()
}

export function 结算空闲回合(回合) {
  if (!Number.isInteger(回合) || 回合 < 空闲记录起始回合) return

  if (!状态.空闲回合操作集合.has(回合)) {
    状态.空闲回合集合.add(回合)
  }
  更新空闲回合UI()
}

export function 结算当前空闲回合() {
  结算空闲回合(状态.当前回合)
}

export function 重置空闲回合() {
  状态.空闲回合集合.clear()
  状态.空闲回合操作集合.clear()
  更新空闲回合UI()
}

export function 更新空闲回合UI() {
  if (!document.body) return

  安装样式()
  const 面板 = 确保面板()
  if (!面板) return

  const 回合状态列表 = 取得回合状态列表()
  const 空闲回合列表 = 回合状态列表
    .filter((回合状态) => 回合状态.是空闲)
    .map((回合状态) => 回合状态.回合)
  const 计数元素 = 面板.querySelector('.gio-idle-turn-count')
  const 列表元素 = 面板.querySelector('.gio-idle-turn-list')
  const 回合文本 = 回合状态列表
    .map((回合状态) => `${回合状态.回合}:${回合状态.是空闲 ? 1 : 0}`)
    .join(',')

  if (面板.dataset.gioIdleTurns === 回合文本) return
  面板.dataset.gioIdleTurns = 回合文本

  if (计数元素) 计数元素.textContent = String(空闲回合列表.length)
  if (!列表元素) return

  列表元素.replaceChildren()
  面板.dataset.gioIdleEmpty = 回合状态列表.length ? 'false' : 'true'

  if (!回合状态列表.length) {
    const 空状态 = document.createElement('span')
    空状态.className = 'gio-idle-turn-empty'
    空状态.textContent = '等待回合'
    列表元素.appendChild(空状态)
    面板.title = '等待空闲回合记录'
    return
  }

  for (const [大回合序号, 分组回合列表] of 取得大回合分组(回合状态列表)) {
    const 行 = document.createElement('div')
    行.className = 'gio-idle-turn-row'

    const 标题 = document.createElement('span')
    标题.className = 'gio-idle-turn-round'
    标题.textContent = `大${大回合序号}`
    行.appendChild(标题)

    const 回合组 = document.createElement('span')
    回合组.className = 'gio-idle-turn-row-list'
    for (const 回合状态 of 分组回合列表) {
      const 标签 = document.createElement('span')
      标签.className = 回合状态.是空闲
        ? 'gio-idle-turn-chip gio-idle-turn-chip-idle'
        : 'gio-idle-turn-chip gio-idle-turn-chip-active'
      标签.textContent = String(回合状态.回合)
      标签.title = 回合状态.是空闲 ? '空闲回合' : '已操作回合'
      回合组.appendChild(标签)
    }
    行.appendChild(回合组)
    列表元素.appendChild(行)
  }
  面板.title = 空闲回合列表.length
    ? `空闲回合：${空闲回合列表.join(', ')}`
    : '暂无空闲回合'

  function 取得回合状态列表() {
    const 最大回合 = 取得最大已确认回合()
    if (!Number.isInteger(最大回合) || 最大回合 < 空闲记录起始回合) return []

    const 列表 = []
    for (let 回合 = 空闲记录起始回合; 回合 <= 最大回合; 回合 += 1) {
      列表.push({
        回合,
        是空闲: 状态.空闲回合集合.has(回合),
      })
    }
    return 列表
  }

  function 取得最大已确认回合() {
    const 当前已确认回合 = Number.isInteger(状态.当前回合)
      ? 状态.当前回合 - 1
      : null
    let 最大回合 = 当前已确认回合

    for (const 回合集合 of [状态.空闲回合集合, 状态.空闲回合操作集合]) {
      回合集合.forEach((回合) => {
        if (!Number.isInteger(回合) || 回合 < 空闲记录起始回合) return
        if (!Number.isInteger(最大回合) || 回合 > 最大回合) 最大回合 = 回合
      })
    }
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

  function 确保面板() {
    let 面板 = 状态.空闲回合面板
    if (!面板 || !document.documentElement.contains(面板)) {
      面板 = document.querySelector(`.${面板类名}`)
    }
    if (!面板) {
      面板 = document.createElement('section')
      面板.className = 面板类名
      面板.innerHTML =
        '<div class="gio-idle-turn-head">' +
        '<span class="gio-idle-turn-title">空闲回合</span>' +
        '<span class="gio-idle-turn-count">0</span>' +
        '</div>' +
        '<div class="gio-idle-turn-list"></div>'
    }

    const 宿主 = 取得右侧宿主()
    if (!宿主) {
      面板.classList.add('gio-idle-turn-floating')
      面板.style.left = ''
      面板.style.top = ''
      面板.style.right = '12px'
      面板.style.bottom = '12px'
      if (面板.parentElement !== document.body) document.body.appendChild(面板)
      状态.空闲回合面板 = 面板
      return 面板
    }

    面板.classList.remove('gio-idle-turn-floating')
    delete 面板.dataset.gioIdlePositioned
    面板.style.left = ''
    面板.style.top = ''
    面板.style.right = ''
    面板.style.bottom = ''
    面板.style.width = ''
    if (面板.parentElement !== 宿主) 宿主.appendChild(面板)

    状态.空闲回合面板 = 面板
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
.${面板类名}.gio-idle-turn-floating {
    position: fixed;
    width: min(420px, calc(100vw - 24px));
    z-index: 2147482999;
}
.gio-idle-turn-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
}
.gio-idle-turn-title {
    color: #f7fbff;
    font: 800 12px/1 Arial, sans-serif;
}
.gio-idle-turn-count {
    min-width: 24px;
    padding: 2px 6px;
    border-radius: 6px;
    background: #ffbf3f;
    color: #14110a;
    text-align: center;
    font: 900 12px/1 Arial, sans-serif;
}
.gio-idle-turn-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 220px;
    overflow-y: auto;
    scrollbar-width: thin;
}
.gio-idle-turn-row {
    display: grid;
    grid-template-columns: 38px 1fr;
    align-items: start;
    gap: 6px;
}
.gio-idle-turn-round {
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
.gio-idle-turn-row-list {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
}
.gio-idle-turn-chip,
.gio-idle-turn-empty {
    box-sizing: border-box;
    min-width: 30px;
    padding: 4px 6px;
    border-radius: 4px;
    text-align: center;
    white-space: nowrap;
    font: 800 11px/1 Arial, sans-serif;
}
.gio-idle-turn-chip-active {
    background: rgba(124, 148, 176, 0.24);
    color: rgba(247, 251, 255, 0.82);
}
.gio-idle-turn-chip-idle {
    background: #b4232a;
    color: #ffffff;
}
.gio-idle-turn-empty {
    width: 100%;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(247, 251, 255, 0.72);
}
`.trim()
  document.documentElement.appendChild(样式)
}
