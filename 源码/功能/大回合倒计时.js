// 功能目的:
// 记录当前 turn，并在排行榜位置显示距离下一次“大回合全图兵力+1”的倒计时。
//
// 作用范围:
// 根据 50 turn 一个大回合的规则，把当前回合转换成倒计时。
// 只更新页面中的倒计时展示，不影响游戏数据，用于 1v1 中把握全图涨兵节奏。
import { 大回合倒计时元素编号, 大回合倒计时类名 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import { 状态 } from '../状态.js'
import { 取得大回合倒计时 } from '../工具.js'
import { 更新回合结束提示, 清除回合结束提示 } from './回合结束提示.js'
import { 更新我方行动监控UI, 结算我方行动回合 } from './我方行动监控.js'
import { 取得战场数据表格 } from './战场表格.js'

export const 功能定义 = {
  id: '大回合倒计时',
  名称: '大回合倒计时',
  分类: '战场面板',
  描述: '在右侧战场表显示大回合剩余 turn',
}

export const 主程序功能 = {
  id: 功能定义.id,
  页面同步: 更新大回合倒计时,
  窗口尺寸变化: 更新大回合倒计时,
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭() {
    移除大回合倒计时()
    清除回合结束提示()
  },
}

export const socket功能 = {
  id: 功能定义.id,
  入站预处理({ 事件名, 数据包 }) {
    if (事件名 !== 'game_start' && 事件名 !== 'game_update') return
    记录回合(数据包 ?? {})
  },
  新局重置后: 更新大回合倒计时,
}

export const 功能样式 = `
#${大回合倒计时元素编号} {
    display: none !important;
}
.${大回合倒计时类名} {
    text-align: center !important;
    vertical-align: middle !important;
    white-space: nowrap !important;
    min-width: 38px !important;
    padding-left: 2px !important;
    padding-right: 2px !important;
}
.${大回合倒计时类名} .gio-big-turn-main {
    display: inline-block;
    font: 800 18px/1 Arial, sans-serif;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
}
.${大回合倒计时类名} .gio-big-turn-index {
    display: inline-block;
    margin-left: 2px;
    font: 700 10px/1 Arial, sans-serif;
    vertical-align: baseline;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
}
#turn-counter {
    display: none !important;
}
`

export function 记录回合(数据包) {
  if (!Number.isInteger(数据包?.turn)) return
  const 旧回合 = 状态.当前回合
  const 新回合 = 数据包.turn
  if (Number.isInteger(旧回合) && 新回合 !== 旧回合) {
    结算我方行动回合(旧回合)
  }
  状态.当前回合 = 新回合
  更新大回合倒计时()
  更新我方行动监控UI()
}

export function 更新大回合倒计时() {
  if (!功能已启用('大回合倒计时')) {
    移除大回合倒计时()
    清除回合结束提示()
    return
  }
  const 倒计时 = 取得大回合倒计时(状态.当前回合)
  const 总回合 = 状态.当前回合
  更新回合结束提示(倒计时)
  if (倒计时 == null || !Number.isInteger(总回合)) return

  移除左上角倒计时()
  const 文本 = `${String(倒计时)}.${总回合}`
  let 目标元素 = 状态.大回合倒计时元素
  if (!目标元素 || !document.documentElement.contains(目标元素)) {
    目标元素 = 取得大回合倒计时元素()
  }
  if (!目标元素) return

  if (
    状态.上次大回合倒计时文本 !== 文本 ||
    !目标元素.classList.contains(大回合倒计时类名)
  ) {
    目标元素.innerHTML = `<span class="gio-big-turn-main">${倒计时}</span><span class="gio-big-turn-index">${总回合}</span>`
  }
  目标元素.classList.add(大回合倒计时类名)
  if (目标元素.title !== '距离所有兵力+1的大回合；小号数字是总回合') {
    目标元素.title = '距离所有兵力+1的大回合；小号数字是总回合'
  }
  状态.上次大回合倒计时文本 = 文本

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
    const 表格 = 取得战场数据表格()
    if (!表格) return null

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

    return null
  }
}

export function 移除大回合倒计时() {
  状态.大回合倒计时元素?.classList.remove(大回合倒计时类名)
  状态.大回合倒计时元素 = null
  状态.上次大回合倒计时文本 = ''
  const 旧元素 = document.getElementById(大回合倒计时元素编号)
  旧元素?.remove()
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 主程序功能, 功能恢复, socket功能, 功能样式 })
