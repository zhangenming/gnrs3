// 功能目的:
// 重写数据包里的玩家颜色，让 1v1 视角下我方/队友统一显示为蓝色，敌方统一显示为红色。
//
// 作用范围:
// 只处理带 playerColors 的入站数据包，并用 WeakSet 避免同一对象重复处理。
// 颜色统一后，排行榜识别、地图显示和战场数据差功能都能用稳定的敌我颜色规则。
import { 敌方红色索引, 我方蓝色索引 } from '../配置.js'
import { 读取玩家信息, 是我方或队友 } from '../游戏.js'
import { 功能已启用 } from '../功能状态.js'
import { 状态 } from '../状态.js'

export const 功能定义 = {
  id: '玩家颜色统一',
  名称: '玩家颜色统一',
  分类: '系统',
  描述: '把我方固定成蓝色，敌方固定成红色',
}

export const 功能样式 = `
:root {
    --map-rgb-p1: 255,0,0;
    --map-color-p1: #ff0000;
    --map-rgb-p2: 39,146,255;
    --map-color-p2: #2792ff;
}
.red, .selected-red, .leaderboard .red, #leaderboard .red {
    background-color: #ff0000 !important;
    fill: #ff0000 !important;
}
.lightblue, .selected-lightblue, .leaderboard .lightblue, #leaderboard .lightblue {
    background-color: #2792ff !important;
    fill: #2792ff !important;
}
.blue, .selected-blue, .leaderboard .blue, #leaderboard .blue {
    background-color: #2792ff !important;
    fill: #2792ff !important;
}
`

export const socket功能 = {
  id: 功能定义.id,
  入站预处理({ 事件名, 数据包 }) {
    if (事件名 !== 'game_start' && 事件名 !== 'game_update') return
    重构玩家颜色(数据包 ?? {})
  },
  新局重置() {
    状态.已处理颜色数据包 = new WeakSet()
  },
}

export function 重构玩家颜色(数据包) {
  if (!功能已启用('玩家颜色统一')) return
  if (!数据包) return
  if (typeof 数据包 === 'object' && 状态.已处理颜色数据包) {
    if (状态.已处理颜色数据包.has(数据包)) return
    状态.已处理颜色数据包.add(数据包)
  }

  读取玩家信息(数据包)

  if (!Array.isArray(数据包.playerColors)) {
    return
  }

  if (!Number.isInteger(状态.我方索引)) {
    return
  }

  for (let 玩家索引 = 0; 玩家索引 < 数据包.playerColors.length; 玩家索引 += 1) {
    if (是我方或队友(玩家索引)) {
      数据包.playerColors[玩家索引] = 我方蓝色索引
    } else {
      数据包.playerColors[玩家索引] = 敌方红色索引
    }
  }
}
