// 功能目的:
// 通过 Army/Land 变化推断敌方正在进攻中立塔，并在排行榜附近给出短提示。
//
// 实现原理:
// 记录敌我双方 Army、Land、塔数快照；下一次快照到来时扣除确定性自然增长：
// 每 2 turn 的基地/塔增长，以及每 50 turn 的全地块增长。
// 扣除后敌方单侧出现明显兵力净损失，且我方陆地稳定，就判定为敌方开塔信号。
//
// 作用范围:
// 只读取战场数据快照、scores、当前塔记忆和回合数，只维护一个页面提示。
import { 敌方红色, 样式编号 } from '../配置.js'
import { 同步我方玩家索引, 是我方或队友 } from '../游戏.js'
import { 状态 } from '../状态.js'

const 敌方开塔提示元素编号 = 'gio-enemy-open-tower-alert'
const 敌方开塔提示样式编号 = `${样式编号}-enemy-open-tower`
const 敌方开塔提示持续毫秒 = 1800
const 开塔最小净损失 = 3
const 最早记录回合 = 50

export function 更新敌方开塔提示(数据包) {
  同步敌方开塔提示元素()
  if (状态.战场数据已冻结) return
  const 回合 = Number.isInteger(数据包?.turn) ? 数据包.turn : 状态.当前回合
  if (!Number.isInteger(回合) || 回合 < 最早记录回合) {
    状态.敌方开塔战场快照 = null
    状态.敌方开塔调试 = null
    return
  }

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
    是敌方开塔: 判断.是敌方开塔,
  }
  if (!判断.是敌方开塔) return

  状态.敌方开塔提示 = {
    回合: 当前快照.回合,
    记录时间: performance.now(),
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
  const 提示 = 状态.敌方开塔提示
  if (!提示?.记录时间) return

  if (performance.now() - 提示.记录时间 < 敌方开塔提示持续毫秒) return

  状态.敌方开塔提示 = null
  document.getElementById(敌方开塔提示元素编号)?.remove()
}

function 取得敌方开塔判断(上次快照, 当前快照) {
  const 二回合增长次数 =
    Math.floor(当前快照.回合 / 2) - Math.floor(上次快照.回合 / 2)
  const 大回合增长次数 =
    Math.floor(当前快照.回合 / 50) - Math.floor(上次快照.回合 / 50)
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
  const 是敌方开塔 =
    敌方变化.净损失 >= 开塔最小净损失 &&
    我方变化.净损失 < 开塔最小净损失 &&
    我方变化.陆地变化 >= 0 &&
    敌方变化.陆地变化 >= 0

  return {
    是敌方开塔,
    我方变化,
    敌方变化,
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
  const 回合 = Number.isInteger(数据包?.turn) ? 数据包.turn : 状态.当前回合
  if (!Number.isInteger(回合)) return null

  const 玩家数据 = 读取快照玩家数据() ?? 读取分数玩家数据(数据包)
  if (!玩家数据) return null

  const 塔数 = 统计塔数()
  return {
    回合,
    我方: {
      ...玩家数据.我方,
      塔数: 塔数.我方塔数,
    },
    敌方: {
      ...玩家数据.敌方,
      塔数: 塔数.敌方塔数,
    },
  }
}

function 读取分数玩家数据(数据包) {
  if (!Array.isArray(数据包?.scores)) return null

  let 我方 = null
  let 敌方 = null
  for (let idx = 0; idx < 数据包.scores.length; idx += 1) {
    const 分数 = 数据包.scores[idx]
    if (!Number.isInteger(分数?.i)) continue
    const 玩家索引 = 分数.i
    const 玩家数据 = 读取单个分数(分数)
    if (!玩家数据) continue

    if (是我方或队友(玩家索引)) {
      我方 = 玩家数据
    } else {
      敌方 = 玩家数据
    }
  }
  return 我方 && 敌方 ? { 我方, 敌方 } : null
}

function 读取快照玩家数据() {
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

function 统计塔数() {
  const 塔索引集合 = new Set()
  if (Array.isArray(状态.塔列表)) {
    状态.塔列表.forEach((塔索引) => {
      if (Number.isInteger(塔索引) && 塔索引 >= 0) 塔索引集合.add(塔索引)
    })
  }
  状态.已知塔集合.forEach((塔索引) => {
    if (Number.isInteger(塔索引) && 塔索引 >= 0) 塔索引集合.add(塔索引)
  })

  let 我方塔数 = 0
  let 敌方塔数 = 0
  for (const 塔索引 of 塔索引集合) {
    const 归属 = 读取当前地图归属(塔索引)
    if (Number.isInteger(归属)) {
      if (归属 >= 0) {
        if (是我方或队友(归属)) {
          我方塔数 += 1
        } else {
          敌方塔数 += 1
        }
        continue
      }
      if (归属 === -1) continue
    }

    const 塔类型 = 状态.已知塔类型.get(塔索引)
    if (塔类型 === '我方塔') 我方塔数 += 1
    if (塔类型 === '敌方塔') 敌方塔数 += 1
  }
  return { 我方塔数, 敌方塔数 }
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

function 读取单个分数(分数) {
  const 兵力 = 读取字段数字(分数, ['total', 'army'])
  const 陆地 = 读取字段数字(分数, ['tiles', 'land'])
  if (!Number.isInteger(兵力) || !Number.isInteger(陆地)) return null
  return { 兵力, 陆地 }
}

function 读取快照玩家(玩家快照) {
  const 兵力 = 读取文本数字(玩家快照?.兵力文本)
  const 陆地 = 读取文本数字(玩家快照?.陆地文本)
  if (!Number.isInteger(兵力) || !Number.isInteger(陆地)) return null
  return { 兵力, 陆地 }
}

function 读取字段数字(对象, 字段列表) {
  for (const 字段 of 字段列表) {
    const 数字 = Number(对象?.[字段])
    if (Number.isInteger(数字)) return 数字
  }
  return null
}

function 读取文本数字(文本) {
  const 数字 = Number.parseInt(String(文本 ?? '').trim(), 10)
  return Number.isInteger(数字) ? 数字 : null
}

function 读取当前地图归属(格子索引) {
  const 地图数组 = 状态.地图数组
  if (!Array.isArray(地图数组) || !Number.isInteger(格子索引)) return null

  const 宽度 = 地图数组[0]
  const 高度 = 地图数组[1]
  const 格子数 = 宽度 * 高度
  if (!Number.isFinite(格子数) || 格子索引 < 0 || 格子索引 >= 格子数)
    return null
  if (地图数组.length < 2 + 格子数 * 2) return null

  const 归属 = 地图数组[2 + 格子数 + 格子索引]
  return Number.isInteger(归属) ? 归属 : null
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
