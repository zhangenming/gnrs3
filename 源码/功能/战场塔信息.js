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
import { 同步我方玩家索引 } from '../游戏.js'
import { 读取冻结战场塔信息, 记录战场塔信息快照 } from './战场数据冻结.js'
import { 统计塔数 } from './塔数统计.js'

export function 更新战场塔信息() {
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

  function 取得战场数据表格() {
    const 表格列表 = document.body.querySelectorAll(
      'table, .leaderboard, #leaderboard',
    )
    for (const 当前表格 of 表格列表) {
      const 文本 = 当前表格.textContent ?? ''
      if (
        (文本.includes('Player') ||
          当前表格.querySelector('[data-gio-battle-player-column="true"]')) &&
        是战场数据表格(当前表格)
      ) {
        return 当前表格
      }
    }
    return null
  }

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

  function 是战场数据表格(表格元素) {
    const 文本 = 表格元素.textContent ?? ''
    if (文本.includes('Army') && 文本.includes('Land')) return true
    return Boolean(
      表格元素.querySelector(
        '[data-gio-battle-kind="army"], [data-gio-battle-kind="land"]',
      ),
    )
  }
}
