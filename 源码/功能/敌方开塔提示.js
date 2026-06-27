// 功能目的:
// 按塔记忆确认敌方开塔，并在排行榜附近给出短提示。
//
// 实现原理:
// 记录敌我双方 Army、Land、当前塔数和开塔数快照。
// 敌方开塔数由塔记忆和兵力差推断共同维护。
// 兵力差使用“我方 - 敌方”口径，先排除大回合地差、塔差增长和我方开塔耗兵，
// 剩下的不明原因变多才判断为敌方偷塔耗兵。
//
// 作用范围:
// 只读取战场数据快照、scores、当前塔记忆和回合数，只维护一个页面提示。
import { 敌方红色, 样式编号 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import {
  读取地图地块,
  地图可读,
  是我方或队友,
  同步我方玩家索引,
} from '../游戏.js'
import { 状态 } from '../状态.js'
import {
  读取分数玩家数据,
  读取快照玩家数据,
  读取页面玩家数据,
} from '../战场工具.js'
import { 取得周期增长次数, 读取当前回合 } from '../游戏工具.js'
import { 统计塔数, 同步塔数统计 } from './塔数统计.js'

const 敌方开塔提示元素编号 = 'gio-enemy-open-tower-alert'
const 敌方开塔提示样式编号 = `${样式编号}-enemy-open-tower`
const 敌方开塔提示持续毫秒 = 1800
const 敌方开塔日志最大数量 = 80
const 敌方偷塔候选最小耗兵 = 2
const 敌方偷塔候选最大间隔 = 4
const 敌方偷塔候选最大年龄 = 16
let 回放敌方开塔动画帧编号 = null

export const 功能定义 = {
  id: '敌方开塔提示',
  名称: '敌方开塔提示',
  分类: '战场面板',
  描述: '检测到敌方开塔时给出短提示',
}

export const 主程序功能 = {
  id: 功能定义.id,
  启动: 安装网页回放敌方开塔同步,
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

export const 地图更新功能 = {
  id: 功能定义.id,
  地图更新({ 旧地图数组, 新地图数组, 数据包, 已处理我方移动列表 }) {
    记录我方中立塔耗兵(旧地图数组, 新地图数组, 数据包, 已处理我方移动列表)
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
  const 候选结果 = 更新敌方开塔候选(当前快照, 判断)
  const 推断结果 = 应用敌方成功开塔推断(上次快照, 当前快照, 候选结果)
  const 新增推断开塔数 = 推断结果.新增推断开塔数
  const 新增开塔数 = Math.max(0, 当前快照.敌方.开塔数 - 上次快照.敌方.开塔数)
  状态.敌方开塔调试 = {
    回合: 当前快照.回合,
    上次回合: 上次快照.回合,
    我方变化: 判断.我方变化,
    敌方变化: 判断.敌方变化,
    兵力差变化: 判断.兵力差变化,
    自然兵力差变化: 判断.自然兵力差变化,
    我方开塔耗兵: 判断.我方开塔耗兵,
    修正后兵力差变化: 判断.修正后兵力差变化,
    敌方偷塔耗兵: 判断.敌方偷塔耗兵,
    候选结果,
    成功开塔数: 候选结果.成功开塔数,
    新增推断开塔数,
    新增开塔数,
    推断结果,
    是敌方偷塔攻击: 判断.是敌方偷塔攻击,
    是敌方成功开塔: 候选结果.是敌方成功开塔,
  }
  记录敌方开塔日志({
    上次快照,
    当前快照,
    判断,
    候选结果,
    推断结果,
    新增开塔数,
  })
  if (!候选结果.是敌方成功开塔 && 新增开塔数 <= 0) return

  播放敌方开塔语音({
    敌方偷塔耗兵: 判断.敌方偷塔耗兵,
    是敌方成功开塔: 候选结果.是敌方成功开塔,
    敌方塔数: 当前快照.敌方.塔数,
    我方塔数: 当前快照.我方.塔数,
  })

  状态.敌方开塔提示 = {
    回合: 当前快照.回合,
    记录时间: performance.now(),
    新增开塔数,
    敌方偷塔耗兵: 判断.敌方偷塔耗兵,
    敌方净损失: 判断.敌方变化.净损失,
    敌方陆地变化: 判断.敌方变化.陆地变化,
    敌方塔数变化: 判断.敌方变化.塔数变化,
  }
  显示敌方开塔提示()
}

export function 清除敌方开塔提示() {
  状态.敌方开塔提示 = null
  状态.敌方开塔战场快照 = null
  状态.敌方开塔候选 = null
  状态.敌方开塔调试 = null
  状态.敌方开塔日志列表 = []
  状态.我方开塔耗兵记录列表 = []
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

function 安装网页回放敌方开塔同步() {
  if (回放敌方开塔动画帧编号 !== null) return
  function 同步网页回放敌方开塔() {
    if (功能已启用('敌方开塔提示') && 是网页回放中()) {
      更新敌方开塔提示({})
    }
    回放敌方开塔动画帧编号 = window.requestAnimationFrame(同步网页回放敌方开塔)
  }
  回放敌方开塔动画帧编号 = window.requestAnimationFrame(同步网页回放敌方开塔)
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
  const 上次兵力差 = 上次快照.我方.兵力 - 上次快照.敌方.兵力
  const 当前兵力差 = 当前快照.我方.兵力 - 当前快照.敌方.兵力
  const 兵力差变化 = 当前兵力差 - 上次兵力差
  const 上次地差 = 上次快照.我方.陆地 - 上次快照.敌方.陆地
  const 上次塔差 = 上次快照.我方.塔数 - 上次快照.敌方.塔数
  const 大回合兵力差变化 = 大回合增长次数 * 上次地差
  const 二回合塔差变化 = 二回合增长次数 * 上次塔差
  const 自然兵力差变化 = 大回合兵力差变化 + 二回合塔差变化
  const 我方开塔耗兵 = 取得我方开塔耗兵(上次快照.回合, 当前快照.回合)
  const 修正后兵力差变化 = 兵力差变化 - 自然兵力差变化 + 我方开塔耗兵
  const 敌方偷塔耗兵 = Math.max(0, 修正后兵力差变化)
  const 是敌方偷塔攻击 = 敌方偷塔耗兵 >= 敌方偷塔候选最小耗兵

  return {
    是敌方偷塔攻击,
    我方变化,
    敌方变化,
    二回合增长次数,
    大回合增长次数,
    上次兵力差,
    当前兵力差,
    兵力差变化,
    上次地差,
    上次塔差,
    大回合兵力差变化,
    二回合塔差变化,
    自然兵力差变化,
    我方开塔耗兵,
    修正后兵力差变化,
    敌方偷塔耗兵,
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

  function 取得我方开塔耗兵(上次回合, 当前回合) {
    if (!Number.isInteger(上次回合) || !Number.isInteger(当前回合)) return 0

    let 总耗兵 = 0
    for (const 记录 of 状态.我方开塔耗兵记录列表) {
      const 回合 = 记录?.回合
      const 开塔耗兵 = 记录?.开塔耗兵
      if (!Number.isInteger(回合) || 回合 <= 上次回合 || 回合 > 当前回合) {
        continue
      }
      if (Number.isInteger(开塔耗兵) && 开塔耗兵 > 0) 总耗兵 += 开塔耗兵
    }
    状态.我方开塔增长表.forEach((记忆, 塔索引) => {
      const 回合 = 记忆?.回合
      const 开塔耗兵 = 记忆?.开塔耗兵
      if (!Number.isInteger(回合) || 回合 <= 上次回合 || 回合 > 当前回合) {
        return
      }
      if (已记录我方开塔耗兵(回合, 塔索引, 开塔耗兵)) return
      if (Number.isInteger(开塔耗兵) && 开塔耗兵 > 0) 总耗兵 += 开塔耗兵
    })
    return 总耗兵

    function 已记录我方开塔耗兵(回合, 塔索引, 开塔耗兵) {
      return 状态.我方开塔耗兵记录列表.some((记录) => {
        return (
          记录?.回合 === 回合 &&
          记录?.塔索引 === 塔索引 &&
          记录?.开塔耗兵 === 开塔耗兵
        )
      })
    }
  }
}

function 更新敌方开塔候选(当前快照, 判断) {
  const 旧候选 = 取得有效敌方开塔候选(当前快照.回合)
  const 本次候选 = 判断.是敌方偷塔攻击
    ? 合并敌方开塔候选(旧候选, 当前快照, 判断)
    : 旧候选
  const 是敌方成功开塔 =
    Boolean(本次候选) && 判断.是敌方偷塔攻击 && 判断.敌方变化.陆地变化 > 0
  const 成功开塔数 = 是敌方成功开塔
    ? Math.max(1, Math.min(判断.敌方变化.陆地变化, 本次候选.攻击次数))
    : 0
  const 当前候选 = 是敌方成功开塔 ? null : 本次候选

  状态.敌方开塔候选 = 当前候选

  return {
    是敌方成功开塔,
    成功开塔数,
    旧候选,
    本次候选,
    当前候选,
    本次进入候选: !是敌方成功开塔 && 判断.是敌方偷塔攻击,
  }
}

function 取得有效敌方开塔候选(当前回合) {
  const 候选 = 状态.敌方开塔候选
  if (!候选) return null
  if (!Number.isInteger(候选.开始回合) || !Number.isInteger(候选.最后回合)) {
    return null
  }

  const 间隔 = 当前回合 - 候选.最后回合
  const 年龄 = 当前回合 - 候选.开始回合
  if (间隔 > 敌方偷塔候选最大间隔 || 年龄 > 敌方偷塔候选最大年龄) {
    return null
  }

  return { ...候选 }
}

function 合并敌方开塔候选(旧候选, 当前快照, 判断) {
  if (!旧候选) {
    return {
      开始回合: 当前快照.回合,
      最后回合: 当前快照.回合,
      累计耗兵: 判断.敌方偷塔耗兵,
      攻击次数: 1,
      首次兵力差变化: 判断.修正后兵力差变化,
      最近兵力差变化: 判断.修正后兵力差变化,
    }
  }

  return {
    ...旧候选,
    最后回合: 当前快照.回合,
    累计耗兵: 旧候选.累计耗兵 + 判断.敌方偷塔耗兵,
    攻击次数: 旧候选.攻击次数 + 1,
    最近兵力差变化: 判断.修正后兵力差变化,
  }
}

function 应用敌方成功开塔推断(上次快照, 当前快照, 候选结果) {
  const 当前塔数 = 统计塔数()
  if (!候选结果.是敌方成功开塔 || 候选结果.成功开塔数 <= 0) {
    return {
      新增推断开塔数: 0,
      推断前塔数: 当前塔数,
      跳过原因: '未满足成功开塔条件',
    }
  }

  const 目标敌方开塔数 = 上次快照.敌方.开塔数 + 候选结果.成功开塔数
  if (当前塔数.敌方开塔数 >= 目标敌方开塔数) {
    return {
      新增推断开塔数: 0,
      推断前塔数: 当前塔数,
      目标敌方开塔数,
      跳过原因: '当前敌方开塔数已达到目标',
    }
  }

  状态.敌方开塔推断数 = Math.max(状态.敌方开塔推断数, 目标敌方开塔数)
  const 更新后塔数 = 同步塔数统计()
  当前快照.敌方.开塔数 = 更新后塔数.敌方开塔数
  当前快照.敌方.塔数 = 更新后塔数.敌方塔数
  return {
    新增推断开塔数: 更新后塔数.敌方开塔数 - 当前塔数.敌方开塔数,
    推断前塔数: 当前塔数,
    推断后塔数: 更新后塔数,
    目标敌方开塔数,
  }
}

function 记录敌方开塔日志({
  上次快照,
  当前快照,
  判断,
  候选结果,
  推断结果,
  新增开塔数,
}) {
  const 需要输出日志 = 候选结果.是敌方成功开塔 || 新增开塔数 > 0
  if (!需要输出日志) return

  const 日志 = {
    回合: 当前快照.回合,
    上次回合: 上次快照.回合,
    时间: Math.round(performance.now()),
    结论: {
      是敌方偷塔攻击: 判断.是敌方偷塔攻击,
      是敌方成功开塔: 候选结果.是敌方成功开塔,
      新增开塔数,
      新增推断开塔数: 推断结果.新增推断开塔数,
    },
    快照: {
      上次: 复制日志值(上次快照),
      当前: 复制日志值(当前快照),
    },
    兵力差: {
      上次兵力差: 判断.上次兵力差,
      当前兵力差: 判断.当前兵力差,
      兵力差变化: 判断.兵力差变化,
      修正后兵力差变化: 判断.修正后兵力差变化,
      敌方偷塔耗兵: 判断.敌方偷塔耗兵,
    },
    修正项: {
      二回合增长次数: 判断.二回合增长次数,
      大回合增长次数: 判断.大回合增长次数,
      上次地差: 判断.上次地差,
      上次塔差: 判断.上次塔差,
      大回合兵力差变化: 判断.大回合兵力差变化,
      二回合塔差变化: 判断.二回合塔差变化,
      自然兵力差变化: 判断.自然兵力差变化,
      我方开塔耗兵: 判断.我方开塔耗兵,
    },
    玩家变化: {
      我方: 复制日志值(判断.我方变化),
      敌方: 复制日志值(判断.敌方变化),
    },
    候选结果: 复制日志值(候选结果),
    推断结果: 复制日志值(推断结果),
  }

  状态.敌方开塔日志列表.push(日志)
  if (状态.敌方开塔日志列表.length > 敌方开塔日志最大数量) {
    状态.敌方开塔日志列表 = 状态.敌方开塔日志列表.slice(-敌方开塔日志最大数量)
  }

  const 标签 =
    `[gio敌方开塔] 回合 ${上次快照.回合}->${当前快照.回合}` +
    ` 差:${判断.上次兵力差}->${判断.当前兵力差}` +
    ` 修正后:${判断.修正后兵力差变化}` +
    ` 耗兵:${判断.敌方偷塔耗兵}` +
    ` 陆地:${判断.敌方变化.陆地变化}` +
    ` 成功:${候选结果.是敌方成功开塔}`

  const 控制台 = globalThis.console
  if (typeof 控制台?.groupCollapsed === 'function') {
    控制台.groupCollapsed(标签)
    控制台.log('结论', 日志.结论)
    控制台.log('兵力差', 日志.兵力差)
    控制台.log('修正项', 日志.修正项)
    控制台.log('玩家变化', 日志.玩家变化)
    控制台.log('候选结果', 日志.候选结果)
    控制台.log('快照', 日志.快照)
    控制台.log('推断结果', 日志.推断结果)
    控制台.groupEnd()
  } else {
    控制台?.log(标签, 日志)
  }
}

function 复制日志值(值) {
  try {
    return structuredClone(值)
  } catch {
    try {
      return JSON.parse(JSON.stringify(值))
    } catch {
      return 值
    }
  }
}

function 读取战场快照(数据包) {
  同步我方玩家索引()
  const 回合 = 读取当前回合(数据包)
  if (!Number.isInteger(回合)) return null

  const 玩家数据 = 是网页回放中()
    ? (读取页面玩家数据() ?? 读取快照玩家数据() ?? 读取分数玩家数据(数据包))
    : (读取快照玩家数据() ?? 读取分数玩家数据(数据包) ?? 读取页面玩家数据())
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

function 记录我方中立塔耗兵(
  旧地图数组,
  新地图数组,
  数据包,
  已处理我方移动列表,
) {
  const 当前回合 = Number.isInteger(数据包?.turn) ? 数据包.turn : 状态.当前回合
  if (!Number.isInteger(当前回合)) return
  if (!地图可读(旧地图数组) || !地图可读(新地图数组)) return
  if (!Array.isArray(已处理我方移动列表) || !已处理我方移动列表.length) return

  const 新记录列表 = []
  for (const 移动 of 已处理我方移动列表) {
    const 终点 = 移动?.终点
    if (!Number.isInteger(终点) || !状态.已知塔集合.has(终点)) continue

    const 旧地块 = 读取地图地块(旧地图数组, 终点)
    const 新地块 = 读取地图地块(新地图数组, 终点)
    if (!是中立地块(旧地块) || !Number.isInteger(新地块?.兵力)) continue

    const 旧兵力 = 旧地块.兵力
    const 新归属 = 新地块.归属
    const 开塔耗兵 = 是我方或队友(新归属)
      ? 旧兵力
      : Math.max(0, 旧兵力 - 新地块.兵力)
    if (开塔耗兵 <= 0) continue

    新记录列表.push({
      回合: 当前回合,
      塔索引: 终点,
      开塔耗兵,
    })
  }
  if (!新记录列表.length) return

  const 保留起始回合 = 当前回合 - 敌方偷塔候选最大年龄 - 4
  状态.我方开塔耗兵记录列表 = [
    ...状态.我方开塔耗兵记录列表.filter((记录) => {
      return Number.isInteger(记录?.回合) && 记录.回合 >= 保留起始回合
    }),
    ...新记录列表,
  ]

  function 是中立地块(地块) {
    return (
      Number.isInteger(地块?.兵力) &&
      Number.isInteger(地块?.归属) &&
      地块.归属 < 0
    )
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

function 播放敌方开塔语音({
  敌方偷塔耗兵,
  是敌方成功开塔,
  敌方塔数,
  我方塔数,
}) {
  if (!Number.isInteger(敌方偷塔耗兵) || 敌方偷塔耗兵 < 0) return

  const 语音 = globalThis.speechSynthesis
  const 语句类型 = globalThis.SpeechSynthesisUtterance
  if (!语音 || typeof 语句类型 !== 'function') return

  const 前缀 = 敌方塔数 > 我方塔数 ? '敌方偷塔' : '敌方跟塔'
  const 文本 = `${前缀}${敌方偷塔耗兵}${是敌方成功开塔 ? '成功' : ''}`
  const 语句 = new 语句类型(文本)
  语句.lang = 'zh-CN'

  语音.cancel()
  语音.speak(语句)
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

function 是网页回放中() {
  return Boolean(
    globalThis.location?.pathname?.startsWith('/replays/') ||
    document.getElementById('replay-turn-jump-input'),
  )
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 主程序功能, 功能恢复, socket功能, 地图更新功能 })
