import {
  大回合turn数,
  大回合倒计时元素编号,
  大回合倒计时类名,
} from '../config.js'
import { 状态 } from '../state.js'
import { 取得大回合倒计时 } from '../utils.js'

export function 记录回合(数据包) {
  if (!Number.isInteger(数据包?.turn)) return
  状态.当前回合 = 数据包.turn
  更新大回合倒计时()
}

export function 更新大回合倒计时() {
  const 倒计时 = 取得大回合倒计时(状态.当前回合)
  const 大回合序号 = 取得大回合序号(状态.当前回合)
  if (倒计时 == null) return

  移除左上角倒计时()
  const 文本 = `${String(倒计时)}.${大回合序号}`
  let 目标元素 = 状态.大回合倒计时元素
  if (!目标元素 || !document.documentElement.contains(目标元素)) {
    目标元素 = 取得大回合倒计时元素()
  }
  if (!目标元素) return

  if (
    状态.上次大回合倒计时文本 !== 文本 ||
    !目标元素.classList.contains(大回合倒计时类名)
  ) {
    目标元素.innerHTML = `<span class="gio-big-turn-main">${倒计时}</span><span class="gio-big-turn-index">${大回合序号}</span>`
  }
  目标元素.classList.add(大回合倒计时类名)
  if (目标元素.title !== '距离所有兵力+1的大回合；小号数字是当前大回合') {
    目标元素.title = '距离所有兵力+1的大回合；小号数字是当前大回合'
  }
  状态.上次大回合倒计时文本 = 文本

  function 取得大回合序号(回合) {
    if (!Number.isInteger(回合) || 回合 < 0) return null
    return Math.floor(回合 / 大回合turn数) + 1
  }

  function 取得大回合倒计时元素() {
    const 排行榜标识元素 = 取得排行榜标识元素()
    if (排行榜标识元素) {
      状态.大回合倒计时元素 = 排行榜标识元素
      return 排行榜标识元素
    }
    return null
  }

  function 移除左上角倒计时() {
    if (!document.body) return
    const 旧元素 = document.getElementById(大回合倒计时元素编号)
    旧元素?.remove()
  }

  function 取得排行榜标识元素() {
    if (!document.body) return null
    const 表格列表 = document.body.querySelectorAll(
      'table, .leaderboard, #leaderboard',
    )

    for (const 表格 of 表格列表) {
      const 表格文本 = (表格.textContent ?? '').trim()
      if (
        !表格文本.includes('Player') &&
        !表格文本.includes('Army') &&
        !表格文本.includes('Land')
      )
        continue

      const 行列表 = 表格.querySelectorAll('tr')
      for (const 行 of 行列表) {
        const 单元格列表 = Array.from(行.children).filter((单元格) => {
          const 标签名 = 单元格.tagName?.toLowerCase() ?? ''
          return 标签名 === 'td' || 标签名 === 'th'
        })
        if (单元格列表.length >= 2) {
          const 第一格文本 = (单元格列表[0].textContent ?? '').trim()
          const 第二格文本 = (单元格列表[1].textContent ?? '').trim()
          if (
            第一格文本 === '★' ||
            第一格文本 === '*' ||
            第二格文本 === 'Player' ||
            单元格列表[0].querySelector('.star, .icon, svg')
          ) {
            return 单元格列表[0]
          }
        }
      }
    }

    return null
  }
}
