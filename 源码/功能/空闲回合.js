// 功能目的:
// 记录玩家每个 turn 是否发出操作，并在右侧显示已经确认空闲的回合。
//
// 作用范围:
// 只读取本地 socket 出站事件和当前回合，不改变真实游戏操作队列。
import { 状态 } from '../状态.js'

const 面板类名 = 'gio-idle-turn-panel'
const 样式编号 = 'gio-idle-turn-style'

export function 记录空闲回合操作() {
  const 回合 = 状态.当前回合
  if (!Number.isInteger(回合) || 回合 < 0) return

  状态.空闲回合操作集合.add(回合)
  状态.空闲回合集合.delete(回合)
  更新空闲回合UI()
}

export function 结算空闲回合(回合) {
  if (!Number.isInteger(回合) || 回合 < 0) return

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

  const 回合列表 = Array.from(状态.空闲回合集合).sort((左, 右) => 左 - 右)
  const 计数元素 = 面板.querySelector('.gio-idle-turn-count')
  const 列表元素 = 面板.querySelector('.gio-idle-turn-list')
  const 回合文本 = 回合列表.join(',')

  if (面板.dataset.gioIdleTurns === 回合文本) return
  面板.dataset.gioIdleTurns = 回合文本

  if (计数元素) 计数元素.textContent = String(回合列表.length)
  if (!列表元素) return

  列表元素.replaceChildren()
  面板.dataset.gioIdleEmpty = 回合列表.length ? 'false' : 'true'

  if (!回合列表.length) {
    const 空状态 = document.createElement('span')
    空状态.className = 'gio-idle-turn-empty'
    空状态.textContent = '暂无'
    列表元素.appendChild(空状态)
    面板.title = '暂无空闲回合'
    return
  }

  for (const 回合 of 回合列表) {
    const 标签 = document.createElement('span')
    标签.className = 'gio-idle-turn-chip'
    标签.textContent = String(回合)
    列表元素.appendChild(标签)
  }
  面板.title = `空闲回合：${回合列表.join(', ')}`

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
    if (宿主) {
      面板.classList.remove('gio-idle-turn-floating')
      if (面板.parentElement !== 宿主) 宿主.appendChild(面板)
    } else {
      面板.classList.add('gio-idle-turn-floating')
      if (面板.parentElement !== document.body) document.body.appendChild(面板)
    }

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
        文本.includes('Army') &&
        文本.includes('Land') &&
        (文本.includes('Player') ||
          表格.querySelector('[data-gio-battle-player-column="true"]'))
      ) {
        return 表格
      }
    }
    return null
  }
}

function 安装样式() {
  if (!document.documentElement || document.getElementById(样式编号)) return

  const 样式 = document.createElement('style')
  样式.id = 样式编号
  样式.textContent = `
.${面板类名} {
    box-sizing: border-box;
    width: min(240px, 100%);
    margin-top: 8px;
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
    right: 12px;
    bottom: 12px;
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
    flex-wrap: wrap;
    gap: 4px;
    max-height: 144px;
    overflow-y: auto;
    scrollbar-width: thin;
}
.gio-idle-turn-chip,
.gio-idle-turn-empty {
    box-sizing: border-box;
    min-width: 28px;
    padding: 3px 6px;
    border-radius: 5px;
    text-align: center;
    white-space: nowrap;
    font: 800 11px/1 Arial, sans-serif;
}
.gio-idle-turn-chip {
    background: #253044;
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
