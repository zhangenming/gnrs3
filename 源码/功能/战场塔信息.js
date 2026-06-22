// 功能目的:
// 在 generals.io 右侧战场数据表的 Player 列位置显示敌我双方塔数和塔差。
//
// 实现原理:
// 先定位排行榜表头里的 Player 列，再把左侧相邻表头格替换成独立的塔信息节点。
// 可见塔直接遍历当前盘面里的塔位置，并读取地图数组中的归属值统计，保证和当前可见盘面一致。
// 迷雾中的敌方塔继续复用已维护的塔归属记忆；差值段通过数据属性标记优劣，样式层据此给塔差着蓝色或红色。
//
// 作用范围:
// 只改写排行榜/战场数据表的 Player 左侧相邻表头格内容和样式；回放页会同步当前地图缓存，供覆盖层读取同一帧塔兵力。
import { 战场塔信息类名 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import {
  取得完整地图数组,
  同步回放玩家索引,
  同步我方玩家索引,
} from '../游戏.js'
import { 状态 } from '../状态.js'
import {
  记录原始战场节点,
  恢复原始战场节点,
  取得表头行,
  取得单元格列表,
  取得玩家列索引,
} from '../战场DOM工具.js'
import { 读取冻结战场塔信息, 记录战场塔信息快照 } from './战场数据冻结.js'
import { 取得战场数据表格 } from './战场表格.js'
import { 处理塔位置 } from './塔记忆.js'
import { 统计塔数 } from './塔数统计.js'

export const 功能定义 = {
  id: '战场塔信息',
  名称: '战场塔信息',
  分类: '战场面板',
  描述: '在 Player 列显示敌我塔数和塔差',
}

export const 主程序功能 = {
  id: 功能定义.id,
  启动: 安装网页回放塔信息同步,
  页面同步: 更新战场塔信息,
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭: 恢复战场塔信息,
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置后: 更新战场塔信息,
  game_update: 更新战场塔信息,
}

export const 功能样式 = `
.${战场塔信息类名} {
    text-align: center !important;
    white-space: nowrap !important;
    color: #000000 !important;
}
.${战场塔信息类名} .gio-battle-tower-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
    width: auto;
    max-width: 100%;
    padding: 3px 2px;
    border-radius: 4px;
    background-color: #d8d8d8;
    color: #000000 !important;
    font: 700 12px/1.15 Arial, sans-serif;
    text-shadow: none !important;
    white-space: nowrap !important;
}
.${战场塔信息类名}[data-gio-tower-diff="advantage"] .gio-battle-tower-pill {
    background-color: #2792ff;
}
.${战场塔信息类名}[data-gio-tower-diff="disadvantage"] .gio-battle-tower-pill {
    background-color: #ff0000;
}
.${战场塔信息类名}[data-gio-tower-diff="even"] .gio-battle-tower-pill {
    background-color: #000000;
}
.${战场塔信息类名} .gio-battle-tower-group {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 4px;
    color: #ffffff !important;
}
.${战场塔信息类名} .gio-battle-tower-item {
    flex: 0 0 auto;
    color: #ffffff !important;
    opacity: 0.92;
}
.${战场塔信息类名} .gio-battle-tower-value {
    display: inline-block;
    color: #ffffff !important;
}
.${战场塔信息类名} .gio-battle-tower-value {
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.15px;
}
[data-gio-battle-compact="true"] .${战场塔信息类名} {
    padding: 0 !important;
}
[data-gio-battle-compact="true"] .${战场塔信息类名} .gio-battle-tower-pill {
    width: 100%;
    height: 100%;
    min-height: 32px;
    padding: 0 4px;
    border-radius: 0;
}
`

let 回放塔信息动画帧编号 = null
let 请求回放塔信息渲染 = null

function 安装网页回放塔信息同步({ 请求渲染 } = {}) {
  if (typeof 请求渲染 === 'function') 请求回放塔信息渲染 = 请求渲染
  if (回放塔信息动画帧编号 !== null) return
  function 同步网页回放塔信息() {
    if (功能已启用('战场塔信息') && 是网页回放中()) {
      更新战场塔信息()
    }
    回放塔信息动画帧编号 = window.requestAnimationFrame(同步网页回放塔信息)
  }
  回放塔信息动画帧编号 = window.requestAnimationFrame(同步网页回放塔信息)
}

export function 更新战场塔信息() {
  if (!功能已启用('战场塔信息')) {
    恢复战场塔信息()
    return
  }
  if (!document.body) return
  同步我方玩家索引()
  同步网页回放塔数据()

  const 表格 = 取得战场数据表格()
  if (!表格) return

  const 表头行 = 取得表头行(表格)
  if (!表头行) return

  const 表头格列表 = 取得单元格列表(表头行)
  const 玩家列 = 取得玩家列索引(表头格列表)
  if (玩家列 < 0) return

  const 玩家表头格 = 表头格列表[玩家列]
  if (!玩家表头格) return
  const 塔信息表头格 = 表头格列表[玩家列 - 1]
  if (!塔信息表头格) return
  if (读取冻结战场塔信息(塔信息表头格)) return

  const { 我方塔数, 敌方塔数, 我方开塔数, 敌方开塔数 } = 统计塔数()
  const 开塔差 = 我方开塔数 - 敌方开塔数
  const 当前塔差 = 我方塔数 - 敌方塔数
  const 差值状态 =
    当前塔差 > 0 ? 'advantage' : 当前塔差 < 0 ? 'disadvantage' : 'even'
  const 开塔差文本 = 取得差值文本(开塔差)
  const 开塔文本 = `${开塔差文本} [${我方开塔数} ${敌方开塔数}]`
  const 文本 = 开塔文本

  if (
    塔信息表头格.classList.contains(战场塔信息类名) &&
    塔信息表头格.dataset.gioTowerSummary === 文本 &&
    塔信息表头格.dataset.gioTowerDiff === 差值状态
  )
    return

  记录原始战场节点(塔信息表头格)
  塔信息表头格.classList.add(战场塔信息类名)
  玩家表头格.dataset.gioBattlePlayerColumn = 'true'
  塔信息表头格.dataset.gioTowerSummary = 文本
  塔信息表头格.dataset.gioTowerDiff = 差值状态
  塔信息表头格.title = '我方开塔数、敌方开塔数、开塔差（我方减敌方）'
  塔信息表头格.innerHTML =
    `<span class="gio-battle-tower-pill">` +
    `<span class="gio-battle-tower-group">` +
    `<span class="gio-battle-tower-value">${开塔文本}</span>` +
    `</span>` +
    `</span>`
  记录战场塔信息快照(塔信息表头格, 文本, 差值状态)
}

export function 恢复战场塔信息() {
  document.querySelectorAll(`.${战场塔信息类名}`).forEach((单元格) => {
    恢复原始战场节点(单元格)
    单元格.classList.remove(战场塔信息类名)
    delete 单元格.dataset.gioTowerSummary
    delete 单元格.dataset.gioTowerDiff
  })
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 主程序功能, 功能恢复, socket功能, 功能样式 })

function 取得差值文本(差值) {
  return 差值 >= 0 ? `+${差值}` : String(差值)
}

function 同步网页回放塔数据() {
  if (!是网页回放中()) return

  const 回放数据包 = 读取网页回放数据包()
  if (!回放数据包) return

  const 回放地图数组 = 取得完整地图数组(回放数据包)
  if (!回放地图数组) return

  const 签名 = [
    globalThis.location?.href,
    回放数据包.replay_id,
    回放数据包.turn,
    回放数据包.replayWatcherIndex,
    取得回放塔地图签名(回放地图数组, 回放数据包.cities),
  ].join(':')
  if (状态.战场塔信息回放签名 === 签名) return
  状态.战场塔信息回放签名 = 签名

  同步回放玩家索引(回放数据包)
  if (Number.isInteger(回放数据包.turn)) 状态.当前回合 = 回放数据包.turn
  状态.宽度 = 回放地图数组[0]
  状态.高度 = 回放地图数组[1]
  状态.地图数组 = 回放地图数组.slice()
  清空回放塔数据()
  处理塔位置(回放数据包, 请求回放塔重绘)

  function 读取网页回放数据包() {
    const 地图元素 = document.getElementById('gameMap')
    const 起点列表 = [地图元素, document.getElementById('react-container')]
    for (const 起点 of 起点列表) {
      const 数据包 = 读取节点回放数据包(起点)
      if (数据包) return 数据包
    }
    return null
  }

  function 读取节点回放数据包(节点) {
    const fiber = 读取ReactFiber(节点)
    const 已访问 = new Set()
    for (let 当前 = fiber; 当前 && !已访问.has(当前); 当前 = 当前.return) {
      已访问.add(当前)
      const props = 当前.memoizedProps
      if (是回放数据Props(props)) {
        return {
          map: props.map,
          cities: props.cities,
          turn: props.turn,
          usernames: props.usernames,
          teams: props.teams,
          replay_id: props.replay_id,
          replayWatcherIndex: props.replayWatcherIndex,
        }
      }
    }
    return null
  }

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

  function 是回放数据Props(props) {
    return Boolean(
      props?.isReplay === true &&
      props.map &&
      Array.isArray(props.cities) &&
      Number.isInteger(props.turn),
    )
  }

  function 清空回放塔数据() {
    状态.塔列表 = null
    状态.已知塔集合.clear()
    状态.已知塔类型.clear()
    状态.中立塔兵力表.clear()
    状态.中立塔开塔成本表.clear()
    状态.我方开塔增长表.clear()
    状态.我方开塔集合.clear()
    状态.我方开塔数 = 0
    状态.敌方开塔数 = 0
    状态.敌方开塔推断数 = 0
    状态.抢塔数 = 0
    状态.敌方开塔确认集合.clear()
  }

  function 取得回放塔地图签名(地图数组, 塔列表) {
    if (!Array.isArray(塔列表)) return ''

    const 宽度 = 地图数组[0]
    const 高度 = 地图数组[1]
    const 格子数 = 宽度 * 高度
    return 塔列表
      .map((塔索引) => {
        if (!Number.isInteger(塔索引) || 塔索引 < 0 || 塔索引 >= 格子数) {
          return ''
        }
        const 兵力 = 地图数组[2 + 塔索引]
        const 归属 = 地图数组[2 + 格子数 + 塔索引]
        return `${塔索引},${兵力},${归属}`
      })
      .join('|')
  }

  function 请求回放塔重绘() {
    if (typeof 请求回放塔信息渲染 === 'function') 请求回放塔信息渲染()
  }
}

function 是网页回放中() {
  return Boolean(
    globalThis.location?.pathname?.startsWith('/replays/') ||
    document.getElementById('replay-turn-jump-input'),
  )
}
