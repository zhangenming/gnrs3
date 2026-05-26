import { 状态 } from './状态.js'

export function 记录原始战场节点(节点) {
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

export function 恢复原始战场节点(节点) {
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

export function 取得表头行(表格元素) {
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

export function 是战场数据行(行) {
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

export function 取得单元格列表(行) {
  return Array.from(行.children).filter((单元格) => {
    const 标签名 = 单元格.tagName?.toLowerCase() ?? ''
    return 标签名 === 'td' || 标签名 === 'th'
  })
}

export function 取得玩家列索引(单元格列表) {
  return 单元格列表.findIndex((单元格) => {
    if (单元格.dataset.gioBattlePlayerColumn === 'true') return true
    return (单元格.textContent ?? '').trim() === 'Player'
  })
}
