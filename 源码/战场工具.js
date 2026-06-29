import { 状态 } from './状态.js'
import { 是我方或队友 } from './游戏.js'
import { 取得表头行, 取得单元格列表, 取得玩家列索引 } from './战场DOM工具.js'
import { 取得战场数据表格 } from './功能/战场表格.js'

export function 读取分数玩家数据(数据包) {
  if (!Array.isArray(数据包?.scores)) return null

  let 我方 = null
  let 敌方 = null
  for (let idx = 0; idx < 数据包.scores.length; idx += 1) {
    const 分数 = 数据包.scores[idx]
    if (!Number.isInteger(分数?.i)) continue

    const 玩家数据 = 读取单个分数(分数)
    if (!玩家数据) continue

    if (是我方或队友(分数.i)) {
      我方 = 玩家数据
    } else {
      敌方 = 玩家数据
    }
  }
  return 我方 && 敌方 ? { 我方, 敌方 } : null
}

export function 读取快照玩家数据() {
  const 快照 = 状态.战场数据快照
  if (!快照 || !Array.isArray(状态.玩家名列表)) return null

  const 我方玩家名 = 状态.玩家名列表[状态.我方索引]
  const 敌方玩家名 = 状态.玩家名列表.find((玩家名, 玩家索引) => {
    return 玩家名 && !是我方或队友(玩家索引)
  })
  if (!我方玩家名 || !敌方玩家名) return null

  const 我方 = 读取快照玩家(快照.get(我方玩家名))
  const 敌方 = 读取快照玩家(快照.get(敌方玩家名))
  return 我方 && 敌方 ? { 我方, 敌方 } : null
}

export function 读取页面玩家数据() {
  const 表格 = 取得战场数据表格()
  if (!表格) return null

  const 表头行 = 取得表头行(表格)
  if (!表头行) return null

  const 表头格列表 = 取得单元格列表(表头行)
  const 玩家列 = 取得玩家列索引(表头格列表)
  const 兵力列 = 取得列索引(表头格列表, 'Army', 'army')
  const 陆地列 = 取得列索引(表头格列表, 'Land', 'land')
  if (玩家列 < 0 || 兵力列 < 0 || 陆地列 < 0) return null

  const 玩家行列表 = Array.from(表格.querySelectorAll('tr')).filter((行) => {
    return 行 !== 表头行 && 取得单元格列表(行).length > 陆地列
  })
  const 我方行 = 取得我方行(玩家行列表)
  const 敌方行 = 取得敌方行(玩家行列表, 我方行)
  if (!我方行 || !敌方行) return null

  const 我方 = 读取页面玩家(我方行)
  const 敌方 = 读取页面玩家(敌方行)
  return 我方 && 敌方 ? { 我方, 敌方 } : null

  function 取得列索引(单元格列表, 原文本, 类型) {
    return 单元格列表.findIndex((单元格) => {
      if (单元格.dataset.gioBattleKind === 类型) return true
      return (单元格.textContent ?? '').trim() === 原文本
    })
  }

  function 取得我方行(玩家行列表) {
    return (
      玩家行列表.find((行) => {
        const 玩家索引 = 取得行玩家索引(行)
        return Number.isInteger(玩家索引) && 是我方或队友(玩家索引)
      }) ??
      玩家行列表.find((行) => {
        return 是我方玩家格(取得单元格列表(行)[玩家列])
      }) ??
      玩家行列表[0] ??
      null
    )
  }

  function 取得敌方行(玩家行列表, 我方行) {
    return (
      玩家行列表.find((行) => {
        const 玩家索引 = 取得行玩家索引(行)
        return Number.isInteger(玩家索引) && !是我方或队友(玩家索引)
      }) ??
      玩家行列表.find((行) => {
        return 是敌方玩家格(取得单元格列表(行)[玩家列])
      }) ??
      玩家行列表.find((行) => 行 !== 我方行) ??
      null
    )
  }

  function 取得行玩家索引(行) {
    const 玩家名 = (取得单元格列表(行)[玩家列]?.textContent ?? '').trim()
    if (!玩家名 || !Array.isArray(状态.玩家名列表)) return null
    const 玩家索引 = 状态.玩家名列表.indexOf(玩家名)
    return 玩家索引 >= 0 ? 玩家索引 : null
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

  function 读取页面玩家(行) {
    const 单元格列表 = 取得单元格列表(行)
    const 兵力 = 读取页面数字(单元格列表[兵力列])
    const 陆地 = 读取页面数字(单元格列表[陆地列])
    if (!Number.isInteger(兵力) || !Number.isInteger(陆地)) return null
    return { 兵力, 陆地 }
  }

  function 读取页面数字(单元格) {
    const 文本 = (单元格?.textContent ?? '').trim()
    if (/^[+-]\d+$/.test(文本)) return null
    const 数字 = Number.parseInt(文本, 10)
    return Number.isInteger(数字) ? 数字 : null
  }
}

export function 读取单个分数(分数) {
  const 兵力 = 读取字段数字(分数, ['total', 'army'])
  const 陆地 = 读取字段数字(分数, ['tiles', 'land'])
  if (!Number.isInteger(兵力) || !Number.isInteger(陆地)) return null
  return { 兵力, 陆地 }
}

export function 读取快照玩家(玩家快照) {
  const 兵力 = 读取文本数字(玩家快照?.兵力文本)
  const 陆地 = 读取文本数字(玩家快照?.陆地文本)
  if (!Number.isInteger(兵力) || !Number.isInteger(陆地)) return null
  return { 兵力, 陆地 }
}

export function 读取字段数字(对象, 字段列表) {
  for (const 字段 of 字段列表) {
    const 数字 = Number(对象?.[字段])
    if (Number.isInteger(数字)) return 数字
  }
  return null
}

export function 读取文本数字(文本) {
  const 数字 = Number.parseInt(String(文本 ?? '').trim(), 10)
  return Number.isInteger(数字) ? 数字 : null
}
