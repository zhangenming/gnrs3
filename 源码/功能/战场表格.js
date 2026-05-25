import { 状态 } from '../状态.js'

export function 取得战场数据表格() {
  const 缓存表格 = 状态.战场表格缓存
  if (缓存表格 && document.documentElement?.contains(缓存表格)) {
    if (是战场数据表格(缓存表格)) return 缓存表格
  }

  if (!document.body) return null

  const 表格列表 = document.body.querySelectorAll(
    'table, .leaderboard, #leaderboard',
  )
  for (const 表格 of 表格列表) {
    if (!是战场数据表格(表格)) continue
    状态.战场表格缓存 = 表格
    return 表格
  }

  状态.战场表格缓存 = null
  return null
}

function 是战场数据表格(表格) {
  const 文本 = 表格.textContent ?? ''
  if (
    !(
      文本.includes('Player') ||
      表格.querySelector('[data-gio-battle-player-column="true"]')
    )
  ) {
    return false
  }
  if (文本.includes('Army') && 文本.includes('Land')) return true
  return Boolean(
    表格.querySelector(
      '[data-gio-battle-kind="army"], [data-gio-battle-kind="land"]',
    ),
  )
}
