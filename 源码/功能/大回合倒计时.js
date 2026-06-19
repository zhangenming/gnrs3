// 功能目的:
// 记录当前 turn，并在排行榜位置显示距离下一次“大回合全图兵力+1”的倒计时。
//
// 作用范围:
// 根据 50 turn 一个大回合的规则，把当前回合转换成倒计时。
// 只更新页面中的倒计时展示，不影响游戏数据，用于 1v1 中把握全图涨兵节奏。
import { 功能已启用 } from '../功能状态.js'
import { 状态 } from '../状态.js'
import { 取得大回合倒计时 } from '../工具.js'
import { 取得单元格列表 } from '../战场DOM工具.js'
import { 更新回合结束提示, 清除回合结束提示 } from './回合结束提示.js'
import { 更新我方行动监控UI, 结算我方行动回合 } from './我方行动监控.js'
import { 取得战场数据表格 } from './战场表格.js'

let 已请求更新大回合倒计时 = false
let 回放回合动画帧编号 = null

export const 功能定义 = {
  id: '大回合倒计时',
  名称: '大回合倒计时',
  分类: '战场面板',
  描述: '在右侧战场表显示大回合剩余 turn',
}

export const 主程序功能 = {
  id: 功能定义.id,
  启动: 安装回放回合动画同步,
  页面同步: 更新大回合倒计时,
  窗口尺寸变化: 更新大回合倒计时,
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭() {
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
  请求更新大回合倒计时()
  更新我方行动监控UI()
}

function 请求更新大回合倒计时() {
  if (已请求更新大回合倒计时) return
  已请求更新大回合倒计时 = true
  requestAnimationFrame(() => {
    已请求更新大回合倒计时 = false
    更新大回合倒计时()
  })
}

function 安装回放回合动画同步() {
  if (回放回合动画帧编号 !== null) return
  function 同步回放回合() {
    if (功能已启用('大回合倒计时') && 是网页回放中()) {
      更新大回合倒计时()
    }
    回放回合动画帧编号 = window.requestAnimationFrame(同步回放回合)
  }
  回放回合动画帧编号 = window.requestAnimationFrame(同步回放回合)
}

export function 更新大回合倒计时() {
  if (!功能已启用('大回合倒计时')) {
    清除回合结束提示()
    清除回放POV回合()
    return
  }
  const 总回合 = 读取显示回合()
  const 倒计时 = 取得大回合倒计时(总回合)
  更新回合结束提示(倒计时)
  更新回放POV回合(总回合)
  if (倒计时 == null || !Number.isInteger(总回合)) return
}

export function 读取显示回合() {
  const 页面回合 = 读取页面回合()
  if (Number.isInteger(页面回合)) return 页面回合
  if (Number.isInteger(状态.当前回合)) return 状态.当前回合
  return null

  function 读取页面回合() {
    const 文本 = (document.getElementById('turn-counter')?.textContent ?? '')
      .trim()
      .replace(/\s+/g, ' ')
    const 左上角回合 = 解析页面回合文本(文本.replace(/^Turn\s+/i, ''))
    if (Number.isInteger(左上角回合)) return 左上角回合

    return 读取回放跳转输入回合()
  }

  function 读取回放跳转输入回合() {
    const 文本 =
      document.getElementById('replay-turn-jump-input')?.placeholder ?? ''
    return 解析页面回合文本(文本)
  }

  function 解析页面回合文本(文本) {
    const 匹配 = String(文本)
      .trim()
      .match(/^(\d+)(\.)?/)
    if (!匹配) return null

    const 回合 = Number.parseInt(匹配[1], 10)
    if (!Number.isInteger(回合)) return null
    return 回合 * 2 + (匹配[2] ? 1 : 0)
  }
}

function 是网页回放中() {
  return Boolean(
    globalThis.location?.pathname?.startsWith('/replays/') ||
    document.getElementById('replay-turn-jump-input'),
  )
}

function 更新回放POV回合(总回合) {
  if (!是网页回放中() || !Number.isInteger(总回合)) {
    清除回放POV回合()
    return
  }

  const 单元格 = 取得POV表头格()
  if (!单元格) return
  if (!单元格.dataset.gioReplayTurnOriginalText) {
    单元格.dataset.gioReplayTurnOriginalText = (单元格.textContent ?? '').trim()
  }
  单元格.dataset.gioReplayTurnCell = 'true'
  单元格.textContent = String(总回合)

  function 取得POV表头格() {
    const 表格 = 取得战场数据表格()
    const 行列表 = 表格?.querySelectorAll('tr') ?? []
    for (const 行 of 行列表) {
      const 单元格列表 = 取得单元格列表(行)
      const 已标记格 = 单元格列表.find((单元格) => {
        return 单元格.dataset.gioReplayTurnCell === 'true'
      })
      if (已标记格) return 已标记格

      const POV格 = 单元格列表.find((单元格) => {
        return (单元格.textContent ?? '').trim() === 'POV'
      })
      if (POV格) return POV格
    }
    return null
  }
}

function 清除回放POV回合() {
  document
    .querySelectorAll('[data-gio-replay-turn-cell="true"]')
    .forEach((单元格) => {
      const 原始文本 = 单元格.dataset.gioReplayTurnOriginalText
      if (原始文本) 单元格.textContent = 原始文本
      delete 单元格.dataset.gioReplayTurnCell
      delete 单元格.dataset.gioReplayTurnOriginalText
    })
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 主程序功能, 功能恢复, socket功能, 功能样式 })
