// 功能目的:
// 按塔记忆确认敌方开塔，并在排行榜附近给出短提示。
//
// 实现原理:
// 记录敌我双方 Army、Land、当前塔数和开塔数快照。
// 敌方开塔数由塔记忆维护，提示只在敌方开塔数增长时显示。
// Army/Land 变化仅作为调试信息，避免普通扩地和战斗误写开塔计数。
//
// 作用范围:
// 只读取战场数据快照、scores、当前塔记忆和回合数，只维护一个页面提示。
import { 敌方红色, 样式编号 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import { 同步我方玩家索引 } from '../游戏.js'
import { 状态 } from '../状态.js'
import { 读取分数玩家数据, 读取快照玩家数据 } from '../战场工具.js'
import { 取得周期增长次数, 读取当前回合 } from '../游戏工具.js'
import { 统计塔数 } from './塔数统计.js'

const 敌方开塔提示元素编号 = 'gio-enemy-open-tower-alert'
const 敌方开塔提示样式编号 = `${样式编号}-enemy-open-tower`
const 敌方开塔提示持续毫秒 = 1800

export const 功能定义 = {
  id: '敌方开塔提示',
  名称: '敌方开塔提示',
  分类: '战场面板',
  描述: '检测到敌方开塔时给出短提示',
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭: 清除敌方开塔提示,
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置() {
    清除敌方开塔提示()
  },
  game_update({ 数据包 }) {
    更新敌方开塔提示(数据包 ?? {})
  },
}

export function 更新敌方开塔提示(数据包) {
  if (!功能已启用('敌方开塔提示')) {
    清除敌方开塔提示()
    return
  }
  同步敌方开塔提示元素()
  if (状态.战场数据已冻结) return

  const 当前快照 = 读取战场快照(数据包)
  if (!当前快照) return

  const 上次快照 = 状态.敌方开塔战场快照
  状态.敌方开塔战场快照 = 当前快照
  if (!上次快照 || 当前快照.回合 <= 上次快照.回合) return

  const 判断 = 取得敌方开塔判断(上次快照, 当前快照)
  状态.敌方开塔调试 = {
    回合: 当前快照.回合,
    上次回合: 上次快照.回合,
    我方变化: 判断.我方变化,
    敌方变化: 判断.敌方变化,
    我方开塔变化: 判断.我方开塔变化,
    敌方开塔变化: 判断.敌方开塔变化,
    是敌方开塔: 判断.是敌方开塔,
  }
  if (!判断.是敌方开塔) return

  状态.敌方开塔提示 = {
    回合: 当前快照.回合,
    记录时间: performance.now(),
    新增开塔数: 判断.敌方开塔变化,
    敌方净损失: 判断.敌方变化.净损失,
    敌方陆地变化: 判断.敌方变化.陆地变化,
    敌方塔数变化: 判断.敌方变化.塔数变化,
  }
  显示敌方开塔提示()
}

export function 清除敌方开塔提示() {
  状态.敌方开塔提示 = null
  状态.敌方开塔战场快照 = null
  状态.敌方开塔调试 = null
  document.getElementById(敌方开塔提示元素编号)?.remove()
}

export function 同步敌方开塔提示元素() {
  if (!功能已启用('敌方开塔提示')) {
    document.getElementById(敌方开塔提示元素编号)?.remove()
    状态.敌方开塔提示 = null
    return
  }
  const 提示 = 状态.敌方开塔提示
  if (!提示?.记录时间) return

  if (performance.now() - 提示.记录时间 < 敌方开塔提示持续毫秒) return

  状态.敌方开塔提示 = null
  document.getElementById(敌方开塔提示元素编号)?.remove()
}

function 取得敌方开塔判断(上次快照, 当前快照) {
  const 二回合增长次数 = 取得周期增长次数(上次快照.回合, 当前快照.回合, 2)
  const 大回合增长次数 = 取得周期增长次数(上次快照.回合, 当前快照.回合, 50)
  const 我方变化 = 取得玩家变化(
    上次快照.我方,
    当前快照.我方,
    二回合增长次数,
    大回合增长次数,
  )
  const 敌方变化 = 取得玩家变化(
    上次快照.敌方,
    当前快照.敌方,
    二回合增长次数,
    大回合增长次数,
  )
  const 我方开塔变化 = 当前快照.我方.开塔数 - 上次快照.我方.开塔数
  const 敌方开塔变化 = 当前快照.敌方.开塔数 - 上次快照.敌方.开塔数
  const 是敌方开塔 = 敌方开塔变化 > 0

  return {
    是敌方开塔,
    我方变化,
    敌方变化,
    我方开塔变化,
    敌方开塔变化,
  }

  function 取得玩家变化(上次玩家, 当前玩家, 二回合次数, 大回合次数) {
    const 预期增长 =
      二回合次数 * (1 + 上次玩家.塔数) + 大回合次数 * 上次玩家.陆地
    const 实际变化 = 当前玩家.兵力 - 上次玩家.兵力
    const 净损失 = Math.max(0, 预期增长 - 实际变化)
    return {
      预期增长,
      实际变化,
      净损失,
      陆地变化: 当前玩家.陆地 - 上次玩家.陆地,
      塔数变化: 当前玩家.塔数 - 上次玩家.塔数,
    }
  }
}

function 读取战场快照(数据包) {
  同步我方玩家索引()
  const 回合 = 读取当前回合(数据包)
  if (!Number.isInteger(回合)) return null

  const 玩家数据 = 读取快照玩家数据() ?? 读取分数玩家数据(数据包)
  if (!玩家数据) return null

  const 塔数 = 统计塔数()
  return {
    回合,
    我方: {
      ...玩家数据.我方,
      塔数: 塔数.我方塔数,
      开塔数: 塔数.我方开塔数,
    },
    敌方: {
      ...玩家数据.敌方,
      塔数: 塔数.敌方塔数,
      开塔数: 塔数.敌方开塔数,
    },
  }
}

function 显示敌方开塔提示() {
  安装敌方开塔提示样式()

  const { 宿主, 参考元素 } = 取得提示位置()
  let 元素 = document.getElementById(敌方开塔提示元素编号)
  if (!元素) {
    元素 = document.createElement('div')
    元素.id = 敌方开塔提示元素编号
  }
  if (!元素 || !宿主) return

  if (参考元素 && 元素.parentElement !== 宿主) {
    宿主.insertBefore(元素, 参考元素)
  } else if (!参考元素 && 元素.parentElement !== 宿主) {
    宿主.appendChild(元素)
  }

  元素.textContent = '敌方开塔'
  元素.classList.toggle(
    'gio-enemy-open-tower-alert-floating',
    宿主 === document.body,
  )
  元素.classList.remove('gio-enemy-open-tower-alert-show')
  void 元素.offsetWidth
  元素.classList.add('gio-enemy-open-tower-alert-show')

  window.setTimeout(同步敌方开塔提示元素, 敌方开塔提示持续毫秒 + 40)
}

function 取得提示位置() {
  if (!document.body) return { 宿主: null, 参考元素: null }

  const 参考元素 = document.body.querySelector(
    '#leaderboard, .leaderboard, table',
  )
  return {
    宿主: 参考元素?.parentElement ?? document.body,
    参考元素,
  }
}

function 安装敌方开塔提示样式() {
  if (!document.documentElement) return
  if (document.getElementById(敌方开塔提示样式编号)) return

  const 样式 = document.createElement('style')
  样式.id = 敌方开塔提示样式编号
  样式.textContent = `
#${敌方开塔提示元素编号} {
    box-sizing: border-box;
    width: 100%;
    margin: 0 0 4px;
    padding: 8px 12px;
    border: 2px solid #ffffff;
    border-radius: 8px;
    background: ${敌方红色};
    color: #ffffff;
    font: 900 18px/1.1 Arial, sans-serif;
    letter-spacing: 0;
    text-align: center;
    text-shadow: 0 2px 3px rgba(0, 0, 0, 0.82);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.34), 0 0 16px rgba(255, 0, 0, 0.66);
    opacity: 0;
    pointer-events: none;
}
#${敌方开塔提示元素编号}.gio-enemy-open-tower-alert-floating {
    position: fixed;
    right: 16px;
    top: 16px;
    z-index: 2147483200;
    width: auto;
    min-width: 132px;
}
#${敌方开塔提示元素编号}.gio-enemy-open-tower-alert-show {
    animation: gio-enemy-open-tower-alert ${敌方开塔提示持续毫秒}ms ease-out forwards;
}
@keyframes gio-enemy-open-tower-alert {
    0% { opacity: 0; transform: translateY(-8px) scale(0.96); }
    12% { opacity: 1; transform: translateY(0) scale(1.05); }
    24% { opacity: 1; transform: translateY(0) scale(1); }
    82% { opacity: 1; transform: translateY(0) scale(1); }
    100% { opacity: 0; transform: translateY(-6px) scale(0.98); }
}
`.trim()
  document.documentElement.appendChild(样式)
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 功能恢复, socket功能 })
