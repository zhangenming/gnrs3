// 功能目的:
// 在 generals.io 右侧战场数据表的 Player 列位置显示敌我双方塔数和塔差。
//
// 实现原理:
// 先定位排行榜表头里的 Player 列，再把该表头格替换成独立的塔信息节点。
// 可见塔直接遍历当前盘面里的塔位置，并读取地图数组中的归属值统计，保证和当前可见盘面一致。
// 迷雾中的敌方塔继续复用已维护的塔归属记忆；差值段通过数据属性标记优劣，样式层据此给塔差着蓝色或红色。
//
// 作用范围:
// 只改写排行榜/战场数据表的 Player 表头格内容和样式，不参与地图状态计算。
import { 战场塔信息类名 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import { 同步我方玩家索引 } from '../游戏.js'
import { 状态 } from '../状态.js'
import { 读取冻结战场塔信息, 记录战场塔信息快照 } from './战场数据冻结.js'
import { 取得战场数据表格 } from './战场表格.js'
import { 统计塔数 } from './塔数统计.js'

export const 功能定义 = {
  id: '战场塔信息',
  名称: '战场塔信息',
  分类: '战场面板',
  描述: '在 Player 列显示敌我塔数和塔差',
}

export const 主程序功能 = {
  id: 功能定义.id,
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
    gap: 5px;
    margin: 0 auto;
    padding: 2px 7px;
    border-radius: 999px;
    background-color: #d8d8d8;
    color: #000000 !important;
    font: 700 10px/1.05 Arial, sans-serif;
    text-shadow: none !important;
}
.${战场塔信息类名} .gio-battle-tower-side {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    min-width: 20px;
    color: #000000 !important;
}
.${战场塔信息类名} .gio-battle-tower-item {
    color: #000000 !important;
}
.${战场塔信息类名} .gio-battle-tower-total,
.${战场塔信息类名} .gio-battle-tower-open {
    display: block;
    color: #000000 !important;
    line-height: 1;
}
.${战场塔信息类名} .gio-battle-tower-open {
    font-size: 9px;
    font-weight: 700;
}
.${战场塔信息类名} .gio-battle-tower-diff {
    color: #000000 !important;
}
.${战场塔信息类名}[data-gio-tower-diff="advantage"] .gio-battle-tower-diff {
    color: #2792ff;
}
.${战场塔信息类名}[data-gio-tower-diff="disadvantage"] .gio-battle-tower-diff {
    color: #ff0000;
}
`

export function 更新战场塔信息() {
  if (!功能已启用('战场塔信息')) {
    恢复战场塔信息()
    return
  }
  if (!document.body) return
  同步我方玩家索引()

  const 表格 = 取得战场数据表格()
  if (!表格) return

  const 表头行 = 取得表头行(表格)
  if (!表头行) return

  const 表头格列表 = 取得单元格列表(表头行)
  const 玩家列 = 取得玩家列索引(表头格列表)
  if (玩家列 < 0) return

  const 玩家表头格 = 表头格列表[玩家列]
  if (!玩家表头格) return
  if (读取冻结战场塔信息(玩家表头格)) return

  const { 我方塔数, 敌方塔数, 我方开塔数, 敌方开塔数 } = 统计塔数()
  const 塔差 = 我方塔数 - 敌方塔数
  const 差值状态 = 塔差 > 0 ? 'advantage' : 塔差 < 0 ? 'disadvantage' : 'even'
  const 差值文本 = 塔差 > 0 ? `+${塔差}` : String(塔差)
  const 文本 = `敌${敌方塔数}/${敌方开塔数} 我${我方塔数}/${我方开塔数} 差${差值文本}`

  if (
    玩家表头格.classList.contains(战场塔信息类名) &&
    玩家表头格.dataset.gioTowerSummary === 文本 &&
    玩家表头格.dataset.gioTowerDiff === 差值状态
  )
    return

  记录原始战场节点(玩家表头格)
  玩家表头格.classList.add(战场塔信息类名)
  玩家表头格.dataset.gioBattlePlayerColumn = 'true'
  玩家表头格.dataset.gioTowerSummary = 文本
  玩家表头格.dataset.gioTowerDiff = 差值状态
  玩家表头格.title = '敌方总塔数/开塔数、我方总塔数/开塔数、塔差（我方减敌方）'
  玩家表头格.innerHTML =
    `<span class="gio-battle-tower-pill">` +
    `<span class="gio-battle-tower-side">` +
    `<span class="gio-battle-tower-total">敌${敌方塔数}</span>` +
    `<span class="gio-battle-tower-open">开${敌方开塔数}</span>` +
    `</span>` +
    `<span class="gio-battle-tower-side">` +
    `<span class="gio-battle-tower-total">我${我方塔数}</span>` +
    `<span class="gio-battle-tower-open">开${我方开塔数}</span>` +
    `</span>` +
    `<span class="gio-battle-tower-item">差</span>` +
    `<span class="gio-battle-tower-diff">${差值文本}</span>` +
    `</span>`
  记录战场塔信息快照(玩家表头格, 文本, 差值状态)

  function 取得表头行(表格元素) {
    const 行列表 = 表格元素.querySelectorAll('tr')
    for (const 行 of 行列表) {
      if (
        行.querySelector('[data-gio-battle-player-column="true"]') &&
        是战场数据行(行)
      ) {
        return 行
      }

      const 文本列表 = 取得单元格列表(行).map((单元格) =>
        (单元格.textContent ?? '').trim(),
      )
      if (文本列表.includes('Player') && 是战场数据行(行)) {
        return 行
      }
    }
    return null
  }

  function 是战场数据行(行) {
    const 文本列表 = 取得单元格列表(行).map((单元格) =>
      (单元格.textContent ?? '').trim(),
    )
    if (文本列表.includes('Army') && 文本列表.includes('Land')) return true
    return Boolean(
      行.querySelector(
        '[data-gio-battle-kind="army"], [data-gio-battle-kind="land"]',
      ),
    )
  }

  function 取得单元格列表(行) {
    return Array.from(行.children).filter((单元格) => {
      const 标签名 = 单元格.tagName?.toLowerCase() ?? ''
      return 标签名 === 'td' || 标签名 === 'th'
    })
  }

  function 取得玩家列索引(单元格列表) {
    return 单元格列表.findIndex((单元格) => {
      if (单元格.dataset.gioBattlePlayerColumn === 'true') return true
      return (单元格.textContent ?? '').trim() === 'Player'
    })
  }
}

export function 恢复战场塔信息() {
  document.querySelectorAll(`.${战场塔信息类名}`).forEach((单元格) => {
    恢复原始战场节点(单元格)
    单元格.classList.remove(战场塔信息类名)
    delete 单元格.dataset.gioTowerSummary
    delete 单元格.dataset.gioTowerDiff
  })
}

function 记录原始战场节点(节点) {
  if (!节点 || 状态.原始战场节点快照.has(节点)) return
  状态.原始战场节点快照.set(节点, {
    innerHTML: 节点.innerHTML,
    title: 节点.title,
    backgroundColor: 节点.style.backgroundColor,
    color: 节点.style.color,
    fontWeight: 节点.style.fontWeight,
    textShadow: 节点.style.textShadow,
  })
}

function 恢复原始战场节点(节点) {
  const 快照 = 状态.原始战场节点快照.get(节点)
  if (!快照) return
  节点.innerHTML = 快照.innerHTML
  节点.title = 快照.title
  节点.style.backgroundColor = 快照.backgroundColor
  节点.style.color = 快照.color
  节点.style.fontWeight = 快照.fontWeight
  节点.style.textShadow = 快照.textShadow
  状态.原始战场节点快照.delete(节点)
}
