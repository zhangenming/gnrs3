// 功能目的:
// 在 generals.io 右侧战场数据表中，把我方与敌方的 Army、Land 显示为差值。
//
// 实现原理:
// 先定位排行榜表头和敌我双方数据行，再读取 Army、Land 两列文本计算差值。
//
// 作用范围:
// 只改写排行榜/战场数据表的表头格内容和样式，不参与地图状态计算。
// 会优先根据玩家索引和用户名识别我方与敌方行，并给差值格写入数据属性，供样式层区分优势和劣势。
import { 我方蓝色, 战场数据差类名, 敌方红色 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import { 同步我方玩家索引, 是我方或队友 } from '../游戏.js'
import { 状态 } from '../状态.js'
import { 应用战场数据冻结 } from './战场数据冻结.js'
import { 取得战场数据表格 } from './战场表格.js'

export const 功能定义 = {
  id: '战场数据差',
  名称: '战场数据差',
  分类: '战场面板',
  描述: '把 Army 和 Land 改写成敌我差值',
}

export const 主程序功能 = {
  id: 功能定义.id,
  页面同步: 更新战场数据差,
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭: 恢复战场数据差,
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置后: 更新战场数据差,
  game_update: 更新战场数据差,
}

export const 功能样式 = `
.${战场数据差类名} {
    color: #ffffff !important;
    font-weight: 800 !important;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85) !important;
}
.${战场数据差类名}[data-gio-battle-diff="advantage"] {
    background-color: ${我方蓝色} !important;
}
.${战场数据差类名}[data-gio-battle-diff="disadvantage"] {
    background-color: ${敌方红色} !important;
}
`

export function 更新战场数据差() {
  if (!功能已启用('战场数据差')) {
    恢复战场数据差()
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
  const 兵力列 = 取得列索引(表头格列表, 'Army', 'army')
  const 陆地列 = 取得列索引(表头格列表, 'Land', 'land')
  if (玩家列 < 0 || 兵力列 < 0 || 陆地列 < 0) return

  const 数据行列表 = Array.from(表格.querySelectorAll('tr')).filter(
    (行) => 行 !== 表头行 && 取得单元格列表(行).length > 陆地列,
  )
  const 玩家行列表 = 数据行列表.filter((行) => {
    return (取得单元格列表(行)[玩家列]?.textContent ?? '').trim()
  })
  let 我方行 = 取得玩家行(状态.我方索引, 玩家行列表)
  let 敌方行 = 玩家行列表.find((行) => {
    const 玩家索引 = 取得行玩家索引(行)
    return Number.isInteger(玩家索引) && !是我方或队友(玩家索引)
  })
  我方行 ??= 数据行列表.find((行) => 是我方玩家格(取得单元格列表(行)[玩家列]))
  敌方行 ??= 数据行列表.find((行) => 是敌方玩家格(取得单元格列表(行)[玩家列]))
  if (!我方行 || !敌方行) {
    我方行 ??= 玩家行列表[0] ?? null
    敌方行 ??= 玩家行列表.find((行) => 行 !== 我方行) ?? null
  }
  if (!我方行 || !敌方行) return

  const 我方格列表 = 取得单元格列表(我方行)
  const 敌方格列表 = 取得单元格列表(敌方行)
  应用战场数据冻结({
    玩家行列表,
    玩家列,
    兵力列,
    陆地列,
    取得单元格列表,
  })
  更新差值格(
    表头格列表[兵力列],
    读取数字(我方格列表[兵力列]) - 读取数字(敌方格列表[兵力列]),
    'army',
  )
  更新差值格(
    表头格列表[陆地列],
    读取数字(我方格列表[陆地列]) - 读取数字(敌方格列表[陆地列]),
    'land',
  )

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
        `[data-gio-battle-kind="army"], [data-gio-battle-kind="land"]`,
      ),
    )
  }

  function 取得单元格列表(行) {
    return Array.from(行.children).filter((单元格) => {
      const 标签名 = 单元格.tagName?.toLowerCase() ?? ''
      return 标签名 === 'td' || 标签名 === 'th'
    })
  }

  function 取得列索引(单元格列表, 原文本, 类型) {
    return 单元格列表.findIndex((单元格) => {
      if (单元格.dataset.gioBattleKind === 类型) return true
      return (单元格.textContent ?? '').trim() === 原文本
    })
  }

  function 取得玩家列索引(单元格列表) {
    return 单元格列表.findIndex((单元格) => {
      if (单元格.dataset.gioBattlePlayerColumn === 'true') return true
      return (单元格.textContent ?? '').trim() === 'Player'
    })
  }

  function 取得玩家行(玩家索引, 玩家行列表) {
    const 玩家名 = 状态.玩家名列表?.[玩家索引]
    if (!玩家名) return null
    return (
      玩家行列表.find((行) => {
        return 取得玩家名(行) === 玩家名
      }) ?? null
    )
  }

  function 取得行玩家索引(行) {
    const 玩家名 = 取得玩家名(行)
    if (!玩家名 || !Array.isArray(状态.玩家名列表)) return null
    const 玩家索引 = 状态.玩家名列表.indexOf(玩家名)
    return 玩家索引 >= 0 ? 玩家索引 : null
  }

  function 取得玩家名(行) {
    return (取得单元格列表(行)[玩家列]?.textContent ?? '').trim()
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

  function 读取数字(单元格) {
    const 数字 = Number.parseInt((单元格?.textContent ?? '').trim(), 10)
    return Number.isFinite(数字) ? 数字 : 0
  }

  function 更新差值格(单元格, 差值, 类型) {
    if (!单元格 || !Number.isFinite(差值)) return
    记录原始战场节点(单元格)
    const 文本 = 差值 > 0 ? `+${差值}` : String(差值)
    const 差值状态 = 差值 >= 0 ? 'advantage' : 'disadvantage'
    if (
      单元格.textContent === 文本 &&
      单元格.classList.contains(战场数据差类名) &&
      单元格.dataset.gioBattleKind === 类型 &&
      单元格.dataset.gioBattleDiff === 差值状态
    )
      return

    const 背景色 = 差值 >= 0 ? 我方蓝色 : 敌方红色
    单元格.style.backgroundColor = 背景色
    单元格.style.color = '#ffffff'
    单元格.style.fontWeight = '800'
    单元格.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.85)'
    单元格.textContent = 文本
    单元格.classList.add(战场数据差类名)
    单元格.dataset.gioBattleKind = 类型
    单元格.dataset.gioBattleDiff = 差值状态
  }
}

export function 恢复战场数据差() {
  document.querySelectorAll(`.${战场数据差类名}`).forEach((单元格) => {
    恢复原始战场节点(单元格)
    单元格.classList.remove(战场数据差类名)
    delete 单元格.dataset.gioBattleKind
    delete 单元格.dataset.gioBattleDiff
    单元格.style.backgroundColor = ''
    单元格.style.color = ''
    单元格.style.fontWeight = ''
    单元格.style.textShadow = ''
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
