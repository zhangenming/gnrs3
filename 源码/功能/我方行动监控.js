// 功能目的:
// 总结每个 turn 我方的行动类型，并在右侧显示已经确认的行动监控。
//
// 作用范围:
// 读取服务器确认的本地移动、当前回合、地图归属差分和塔记忆。
// 只维护本地行动记录与页面面板，真实游戏操作队列由原 socket 流程处理。
import { 大回合turn数, 监控起始回合, 基地自然增长turn数 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import {
  地图可读,
  是我方或队友,
  读取地图地块,
  读取地图归属,
  同步回放玩家索引,
  取得完整地图数组,
} from '../游戏.js'
import { 状态 } from '../状态.js'
import { 是敌方格, 是阻挡地形, 取得周期增长次数 } from '../游戏工具.js'
import {
  读取分数玩家数据,
  读取快照玩家数据,
  读取页面玩家数据,
} from '../战场工具.js'
import { 取得战场数据表格 } from './战场表格.js'
import { 安装样式 as 注入样式 } from '../工具.js'
import { 补齐未知开塔归属, 统计塔数 } from './塔数统计.js'
import { 取得敌方开塔判断 } from './敌方开塔提示.js'

const 面板类名 = 'gio-action-watch-panel'
const 画布类名 = 'gio-action-watch-canvas'
const 样式编号 = 'gio-action-watch-style'
const 敌方开塔行动确认事件名 = 'gio敌方开塔行动确认'
const 每行回合数 = 50
const 我方行动类型列表 = ['空闲', '集兵', '扩地', '偷塔', '吃地(抢塔)']
const 敌方行动类型列表 = ['集兵', '扩地', '吃地', '开塔']
const 我方行动优先级表 = new Map(
  我方行动类型列表.map((行动类型, idx) => [行动类型, idx]),
)
const 敌方行动优先级表 = new Map(
  敌方行动类型列表.map((行动类型, idx) => [行动类型, idx]),
)
const 行动开塔记录版本 = '敌方开塔只用确认集合-v4'
let 我方行动监控数据版本 = 0
let 已请求更新我方行动监控UI = false
let 悬停我方行动监控回合 = null
let 回放行动监控动画帧编号 = null
let 回放行动监控缓存 = null
let 回放行动监控最小已确认回合 = null
let 回放行动监控最大已确认回合 = null
let 行动监控玩家快照 = null
let 已安装敌方开塔行动确认同步 = false

export const 功能定义 = {
  id: '我方行动监控',
  名称: '我方行动监控',
  分类: '战场面板',
  描述: '按回合记录我方和敌方行动类型',
}

export const 主程序功能 = {
  id: 功能定义.id,
  启动: 启动我方行动监控,
  页面同步: 更新我方行动监控UI,
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭() {
    重置我方行动监控()
    更新我方行动监控UI()
  },
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置: 重置我方行动监控,
  新局重置后: 更新我方行动监控UI,
}

export const 地图更新功能 = {
  id: 功能定义.id,
  地图更新({ 旧地图数组, 新地图数组, 数据包, 已处理我方移动列表 }) {
    更新我方行动地图判断(旧地图数组, 新地图数组, 数据包, 已处理我方移动列表)
  },
}

export function 更新我方行动地图判断(
  旧地图数组,
  新地图数组,
  数据包,
  已处理我方移动列表 = [],
) {
  if (!功能已启用('我方行动监控')) return
  确保行动开塔记录版本()
  const 回合 = Number.isInteger(数据包?.turn) ? 数据包.turn - 1 : 状态.当前回合
  if (!Number.isInteger(回合) || 回合 < 取得行动监控起始回合()) return
  if (!地图可读(旧地图数组) || !地图可读(新地图数组)) return

  const 格子数 = 状态.宽度 * 状态.高度
  const 上次玩家快照 = 行动监控玩家快照
  const 当前玩家快照 = 读取行动监控玩家快照(数据包, 回合 + 1)
  if (当前玩家快照) 行动监控玩家快照 = 当前玩家快照

  const 真实行动类型 = 取得已处理移动行动类型()
  if (真实行动类型) {
    设置我方行动类型(回合, 真实行动类型)
  } else {
    const 地图差分行动类型 = 取得地图差分行动类型()
    if (地图差分行动类型) {
      设置我方行动类型(回合, 地图差分行动类型)
    }
  }

  const 敌方行动类型 = 取得敌方行动类型()
  if (敌方行动类型) 设置敌方行动类型(回合, 敌方行动类型)

  function 取得地图差分行动类型() {
    const 我方来源索引集合 = 取得我方来源索引集合()
    let 行动类型 = null

    for (let idx = 0; idx < 格子数; idx += 1) {
      const 旧地块 = 读取地图地块(旧地图数组, idx)
      const 新地块 = 读取地图地块(新地图数组, idx)
      const 旧归属 = 旧地块?.归属
      const 新归属 = 新地块?.归属

      if (旧归属 !== 新归属 && 是我方格(新归属)) {
        if (是敌方格(旧归属)) return '吃地(抢塔)'
        if (是中立或迷雾地(旧归属)) {
          行动类型 = 取得更高我方行动类型(行动类型, 取得我方占中立行动类型(idx))
        }
      }

      if (是我方集兵目标(idx, 旧地块, 新地块)) {
        行动类型 = 取得更高我方行动类型(行动类型, '集兵')
        continue
      }

      if (!是未占领中立目标(idx, 旧地块, 新地块) || !有相邻我方来源(idx)) {
        continue
      }
      行动类型 = 取得更高我方行动类型(行动类型, 取得我方占中立行动类型(idx))
    }

    return 行动类型

    function 取得我方来源索引集合() {
      const 来源索引集合 = new Set()
      for (let idx = 0; idx < 格子数; idx += 1) {
        const 旧地块 = 读取地图地块(旧地图数组, idx)
        const 新地块 = 读取地图地块(新地图数组, idx)
        if (!是我方格(旧地块?.归属) || !是我方格(新地块?.归属)) continue
        if (
          !Number.isInteger(旧地块?.兵力) ||
          !Number.isInteger(新地块?.兵力)
        ) {
          continue
        }
        if (旧地块.兵力 <= 1) continue

        const 预期兵力 = 旧地块.兵力 + 取得自然增长(idx, 新地块.归属)
        if (预期兵力 > 新地块.兵力) 来源索引集合.add(idx)
      }
      return 来源索引集合
    }

    function 是我方集兵目标(idx, 旧地块, 新地块) {
      if (!是我方格(旧地块?.归属) || !是我方格(新地块?.归属)) return false
      if (!Number.isInteger(旧地块?.兵力) || !Number.isInteger(新地块?.兵力)) {
        return false
      }

      return 新地块.兵力 > 旧地块.兵力 + 取得自然增长(idx, 新地块.归属)
    }

    function 是未占领中立目标(idx, 旧地块, 新地块) {
      if (!Number.isInteger(旧地块?.兵力) || !Number.isInteger(新地块?.兵力)) {
        return false
      }
      const 预期兵力 = 旧地块.兵力 + 取得自然增长(idx, 新地块.归属)
      return (
        预期兵力 > 新地块.兵力 &&
        旧地块.归属 === 新地块.归属 &&
        是中立或迷雾地(旧地块.归属)
      )
    }

    function 有相邻我方来源(目标索引) {
      const 行 = Math.floor(目标索引 / 状态.宽度)
      const 列 = 目标索引 % 状态.宽度
      return (
        (行 > 0 && 我方来源索引集合.has(目标索引 - 状态.宽度)) ||
        (行 < 状态.高度 - 1 && 我方来源索引集合.has(目标索引 + 状态.宽度)) ||
        (列 > 0 && 我方来源索引集合.has(目标索引 - 1)) ||
        (列 < 状态.宽度 - 1 && 我方来源索引集合.has(目标索引 + 1))
      )
    }
  }

  function 是我方格(归属) {
    return Number.isInteger(归属) && 归属 >= 0 && 是我方或队友(归属)
  }

  function 是中立或迷雾地(归属) {
    return Number.isInteger(归属) && 归属 < 0 && !是阻挡地形(归属)
  }

  function 取得已处理移动行动类型() {
    if (!Array.isArray(已处理我方移动列表) || !已处理我方移动列表.length) {
      return null
    }

    let 行动类型 = null
    for (const 移动 of 已处理我方移动列表) {
      if (!移动产生实际变化(移动)) continue
      const 移动行动类型 = 取得移动行动类型(移动.终点)
      行动类型 = 取得更高我方行动类型(行动类型, 移动行动类型)
      记录我方移动开塔兵力(移动, 移动行动类型)
    }
    return 行动类型
  }

  function 移动产生实际变化(移动) {
    if (取得可移动兵力(移动) <= 0) return false

    return [移动?.起点, 移动?.终点].some((格子索引) => {
      if (!Number.isInteger(格子索引) || 格子索引 < 0 || 格子索引 >= 格子数) {
        return false
      }

      const 旧地块 = 读取地图地块(旧地图数组, 格子索引)
      const 新地块 = 读取地图地块(新地图数组, 格子索引)
      const 旧兵力 = 旧地块?.兵力
      const 新兵力 = 新地块?.兵力
      const 旧归属 = 旧地块?.归属
      const 新归属 = 新地块?.归属
      if (旧归属 !== 新归属) return true
      if (!Number.isInteger(旧兵力) || !Number.isInteger(新兵力)) {
        return 旧兵力 !== 新兵力
      }

      return 新兵力 - 旧兵力 !== 取得自然增长(格子索引, 新归属)
    })
  }

  function 取得可移动兵力(移动) {
    const 起点 = 移动?.起点
    if (!Number.isInteger(起点) || 起点 < 0 || 起点 >= 格子数) return 0

    const 起点地块 = 读取地图地块(旧地图数组, 起点)
    const 起点兵力 = 起点地块?.兵力
    const 起点归属 = 起点地块?.归属
    if (!Number.isInteger(起点兵力) || !是我方格(起点归属)) return 0

    const 留守兵力 = 移动.是否半兵 ? Math.ceil(起点兵力 / 2) : 1
    return Math.max(0, 起点兵力 - 留守兵力)
  }

  function 取得自然增长(格子索引, 归属) {
    if (!Number.isInteger(归属) || 归属 < 0) return 0

    let 增长 = 0
    if (状态.已知塔集合.has(格子索引) || 状态.已知基地集合.has(格子索引)) {
      增长 += 取得周期增长次数(回合, 回合 + 1, 基地自然增长turn数)
    }
    增长 += 取得周期增长次数(回合, 回合 + 1, 大回合turn数)
    return 增长
  }

  function 取得移动行动类型(目标索引) {
    if (!Number.isInteger(目标索引) || 目标索引 < 0) return '集兵'

    const 塔类型 = 状态.已知塔类型.get(目标索引)
    if (塔类型 === '中立塔') return '偷塔'
    if (塔类型 === '敌方塔') return '吃地(抢塔)'

    if (目标索引 >= 格子数) return '集兵'

    const 旧归属 = 读取地图归属(旧地图数组, 目标索引)
    if (是中立或迷雾地(旧归属)) return 取得我方占中立行动类型(目标索引)
    if (Number.isInteger(旧归属) && 旧归属 >= 0 && !是我方或队友(旧归属)) {
      return '吃地(抢塔)'
    }
    return '集兵'
  }

  function 记录我方移动开塔兵力(移动, 行动类型) {
    if (行动类型 !== '偷塔') return

    const 目标索引 = 移动?.终点
    if (!Number.isInteger(目标索引) || 目标索引 < 0 || 目标索引 >= 格子数)
      return

    const 旧地块 = 读取地图地块(旧地图数组, 目标索引)
    const 新地块 = 读取地图地块(新地图数组, 目标索引)
    if (!Number.isInteger(旧地块?.兵力)) return

    const 开塔兵力 = 是我方格(新地块?.归属)
      ? 旧地块.兵力
      : Number.isInteger(新地块?.兵力)
        ? Math.max(0, 旧地块.兵力 - 新地块.兵力)
        : 0
    设置行动开塔兵力('我方', 回合, 开塔兵力, 是我方格(新地块?.归属))
  }

  function 取得敌方行动类型() {
    const 地图变化 = 取得可见地图归属变化()
    if (地图变化.敌方占中立塔数量 > 0) {
      设置行动开塔兵力('敌方', 回合, 地图变化.敌方占中立塔兵力, true)
      return '开塔'
    }

    const 开塔行动类型 = 取得敌方开塔行动类型(地图变化)
    if (开塔行动类型) return 开塔行动类型

    const 敌方吃我方地块数量 = 取得敌方吃我方地块数量(地图变化)
    const 敌方地块变化 = 取得敌方陆地变化()
    if (Number.isInteger(敌方地块变化)) {
      const 敌方自身新增地块 = 敌方地块变化 + 地图变化.我方吃敌方地块数量
      if (敌方自身新增地块 > 0) {
        return 敌方吃我方地块数量 > 0 ? '吃地' : '扩地'
      }
    }

    if (敌方吃我方地块数量 > 0) return '吃地'
    if (地图变化.敌方占中立地块数量 > 0) return '扩地'
    return '集兵'
  }

  function 取得敌方开塔行动类型(地图变化) {
    if (!上次玩家快照 || !当前玩家快照) return null

    const 新增敌方确认开塔数 = Math.max(
      0,
      读取确认开塔数(当前玩家快照.敌方) - 读取确认开塔数(上次玩家快照.敌方),
    )
    const 敌方自身新增地块 =
      当前玩家快照.敌方.陆地 -
      上次玩家快照.敌方.陆地 +
      地图变化.我方吃敌方地块数量
    const 判断 = 取得敌方开塔判断(上次玩家快照, 当前玩家快照)
    const 是敌方确认开塔 =
      判断.是敌方偷塔攻击 && 敌方自身新增地块 > 0 && 新增敌方确认开塔数 > 0
    if (判断.敌方偷塔耗兵 > 0 && 是敌方确认开塔) {
      设置行动开塔兵力('敌方', 回合, 判断.敌方偷塔耗兵, true)
    }
    if (是敌方确认开塔) return '开塔'

    return null

    function 读取确认开塔数(玩家快照) {
      return Number.isInteger(玩家快照?.确认开塔数) ? 玩家快照.确认开塔数 : 0
    }
  }

  function 取得可见地图归属变化() {
    let 我方吃敌方地块数量 = 0
    let 我方占中立地块数量 = 0
    let 敌方吃我方地块数量 = 0
    let 敌方占中立地块数量 = 0
    let 敌方占中立塔数量 = 0
    let 敌方占中立塔兵力 = 0
    for (let idx = 0; idx < 格子数; idx += 1) {
      const 旧归属 = 读取地图归属(旧地图数组, idx)
      const 新归属 = 读取地图归属(新地图数组, idx)
      if (旧归属 === 新归属) continue

      if (是敌方格(旧归属) && 是我方格(新归属)) {
        我方吃敌方地块数量 += 1
      } else if (是中立或迷雾地(旧归属) && 是我方格(新归属)) {
        我方占中立地块数量 += 1
      } else if (是我方格(旧归属) && 是敌方格(新归属)) {
        敌方吃我方地块数量 += 1
      } else if (旧归属 === -1 && 是敌方格(新归属)) {
        敌方占中立地块数量 += 1
        if (状态.已知塔集合.has(idx) || 状态.已知塔类型.has(idx)) {
          const 兵力 = 旧地块兵力(idx)
          敌方占中立塔数量 += 1
          if (Number.isInteger(兵力)) 敌方占中立塔兵力 += 兵力
        }
      }
    }

    return {
      我方吃敌方地块数量,
      我方占中立地块数量,
      敌方吃我方地块数量,
      敌方占中立地块数量,
      敌方占中立塔数量,
      敌方占中立塔兵力,
    }

    function 旧地块兵力(idx) {
      return 读取地图地块(旧地图数组, idx)?.兵力
    }
  }

  function 取得敌方吃我方地块数量(地图变化) {
    const 可见数量 = 地图变化.敌方吃我方地块数量
    if (!上次玩家快照 || !当前玩家快照) return 可见数量

    const 我方地块变化 = 当前玩家快照.我方.陆地 - 上次玩家快照.我方.陆地
    const 我方自身新增地块 =
      地图变化.我方吃敌方地块数量 + 地图变化.我方占中立地块数量
    return Math.max(可见数量, 我方自身新增地块 - 我方地块变化)
  }

  function 取得敌方陆地变化() {
    if (上次玩家快照 && 当前玩家快照) {
      return 当前玩家快照.敌方.陆地 - 上次玩家快照.敌方.陆地
    }
    return null
  }

  function 取得我方占中立行动类型(目标索引) {
    return 状态.已知塔集合.has(目标索引) || 状态.已知塔类型.has(目标索引)
      ? '偷塔'
      : '扩地'
  }

  function 取得更高我方行动类型(左行动类型, 右行动类型) {
    return 取得更高优先级行动类型(我方行动优先级表, 左行动类型, 右行动类型)
  }
}

export function 结算我方行动回合(回合) {
  if (!功能已启用('我方行动监控')) return
  if (!Number.isInteger(回合) || 回合 < 取得行动监控起始回合()) return

  if (!状态.我方行动类型表.has(回合)) {
    状态.我方行动类型表.set(回合, '空闲')
    我方行动监控数据版本 += 1
  }
  if (!状态.敌方行动类型表.has(回合)) {
    状态.敌方行动类型表.set(回合, '集兵')
    我方行动监控数据版本 += 1
  }
  更新我方行动监控UI()
}

export function 结算当前我方行动回合() {
  if (!功能已启用('我方行动监控')) return
  结算我方行动回合(状态.当前回合)
}

export function 重置我方行动监控() {
  状态.我方行动类型表.clear()
  状态.敌方行动类型表.clear()
  状态.行动开塔兵力表.clear()
  状态.行动开塔成功集合.clear()
  回放行动监控缓存 = null
  回放行动监控最小已确认回合 = null
  回放行动监控最大已确认回合 = null
  行动监控玩家快照 = null
  状态.行动开塔记录版本 = 行动开塔记录版本
  我方行动监控数据版本 += 1
  更新我方行动监控UI()
}

function 启动我方行动监控() {
  安装敌方开塔行动确认同步()
  安装网页回放行动监控同步()
}

function 安装敌方开塔行动确认同步() {
  if (已安装敌方开塔行动确认同步) return

  window.addEventListener(敌方开塔行动确认事件名, (event) => {
    记录敌方开塔行动确认(event.detail)
  })
  已安装敌方开塔行动确认同步 = true
}

function 记录敌方开塔行动确认(详情) {
  if (!功能已启用('我方行动监控')) return
  确保行动开塔记录版本()

  const 回合 = 详情?.回合
  if (!Number.isInteger(回合) || 回合 < 取得行动监控起始回合()) return

  设置敌方行动类型(回合, '开塔')
  设置行动开塔兵力('敌方', 回合, 详情?.开塔兵力, 详情?.开塔成功 === true)
}

function 安装网页回放行动监控同步() {
  if (回放行动监控动画帧编号 !== null) return
  function 同步网页回放行动监控() {
    if (功能已启用('我方行动监控') && 是网页回放中()) {
      同步网页回放行动数据()
    } else {
      回放行动监控缓存 = null
    }
    回放行动监控动画帧编号 = window.requestAnimationFrame(同步网页回放行动监控)
  }
  回放行动监控动画帧编号 = window.requestAnimationFrame(同步网页回放行动监控)

  function 同步网页回放行动数据() {
    确保行动开塔记录版本()
    const 数据包 = 读取网页回放行动数据包()
    const 新地图数组 = 取得完整地图数组(数据包)
    const 新回合 = 数据包?.turn
    if (!新地图数组 || !Number.isInteger(新回合)) return

    同步回放玩家索引(数据包)
    状态.宽度 = 新地图数组[0]
    状态.高度 = 新地图数组[1]
    const 回放键 = [
      globalThis.location?.pathname,
      数据包.replay_id,
      数据包.replayWatcherIndex,
    ].join(':')
    const 旧缓存 = 回放行动监控缓存
    const 是同场回放 = 旧缓存?.回放键 === 回放键
    const 回放回合连续 = 是同场回放 && 旧缓存.回合 + 1 === 新回合
    同步回放自然增长地块(数据包, 新地图数组)

    if (!是同场回放) {
      清空回放行动记录()
      状态.当前回合 = 新回合
      状态.地图数组 = 新地图数组.slice()
      回放行动监控缓存 = {
        回放键,
        回合: 新回合,
        地图数组: 新地图数组.slice(),
      }
      return
    }

    if (新回合 < 旧缓存.回合) {
      裁剪回放行动记录(新回合)
      更新我方行动监控UI()
      状态.当前回合 = 新回合
      状态.地图数组 = 新地图数组.slice()
      回放行动监控缓存 = {
        回放键,
        回合: 新回合,
        地图数组: 新地图数组.slice(),
      }
      return
    }

    if (新回合 === 旧缓存.回合) {
      状态.当前回合 = 新回合
      return
    }

    状态.当前回合 = 新回合
    if (Array.isArray(数据包.executedMoves)) {
      记录回放官方行动(旧缓存.回合, 新回合, 旧缓存.地图数组, 数据包)
    } else if (回放回合连续) {
      更新我方行动地图判断(旧缓存.地图数组, 新地图数组, 数据包)
      结算我方行动回合(新回合 - 1)
      记录回放已确认回合(新回合 - 1)
    }
    状态.地图数组 = 新地图数组.slice()
    回放行动监控缓存 = {
      回放键,
      回合: 新回合,
      地图数组: 新地图数组.slice(),
    }

    function 清空回放行动记录() {
      状态.我方行动类型表.clear()
      状态.敌方行动类型表.clear()
      状态.行动开塔兵力表.clear()
      状态.行动开塔成功集合.clear()
      回放行动监控最小已确认回合 = null
      回放行动监控最大已确认回合 = null
      行动监控玩家快照 = null
      我方行动监控数据版本 += 1
    }

    function 裁剪回放行动记录(起始回合) {
      if (!Number.isInteger(起始回合)) return

      const 旧最小回合 = 回放行动监控最小已确认回合
      const 旧最大回合 = 回放行动监控最大已确认回合
      let 已删除 = false
      状态.我方行动类型表.forEach((_行动类型, 回合) => {
        if (!Number.isInteger(回合) || 回合 < 起始回合) return

        状态.我方行动类型表.delete(回合)
        已删除 = true
      })
      状态.敌方行动类型表.forEach((_行动类型, 回合) => {
        if (!Number.isInteger(回合) || 回合 < 起始回合) return

        状态.敌方行动类型表.delete(回合)
        已删除 = true
      })
      状态.行动开塔兵力表.forEach((_记录, 键) => {
        const 回合 = Number.parseInt(String(键).split(':')[1] ?? '', 10)
        if (!Number.isInteger(回合) || 回合 < 起始回合) return

        状态.行动开塔兵力表.delete(键)
        已删除 = true
      })
      状态.行动开塔成功集合.forEach((键) => {
        const 回合 = Number.parseInt(String(键).split(':')[1] ?? '', 10)
        if (!Number.isInteger(回合) || 回合 < 起始回合) return

        状态.行动开塔成功集合.delete(键)
        已删除 = true
      })
      重算回放已确认范围()
      if (
        !已删除 &&
        旧最小回合 === 回放行动监控最小已确认回合 &&
        旧最大回合 === 回放行动监控最大已确认回合
      ) {
        return
      }
      我方行动监控数据版本 += 1
    }

    function 重算回放已确认范围() {
      回放行动监控最小已确认回合 = null
      回放行动监控最大已确认回合 = null
      状态.我方行动类型表.forEach((_行动类型, 回合) => {
        记录回放已确认回合(回合)
      })
      状态.敌方行动类型表.forEach((_行动类型, 回合) => {
        记录回放已确认回合(回合)
      })
    }

    function 记录回放已确认回合(回合) {
      if (!Number.isInteger(回合) || 回合 < 取得行动监控起始回合()) return
      if (
        !Number.isInteger(回放行动监控最小已确认回合) ||
        回合 < 回放行动监控最小已确认回合
      ) {
        回放行动监控最小已确认回合 = 回合
      }
      if (
        !Number.isInteger(回放行动监控最大已确认回合) ||
        回合 > 回放行动监控最大已确认回合
      ) {
        回放行动监控最大已确认回合 = 回合
      }
    }

    function 读取网页回放行动数据包() {
      const 地图元素 = document.getElementById('gameMap')
      const 起点列表 = [地图元素, document.getElementById('react-container')]
      for (const 起点 of 起点列表) {
        const 数据包 = 读取节点回放数据包(起点)
        if (数据包) return 数据包
      }
      return null

      function 读取节点回放数据包(节点) {
        const fiber = 读取ReactFiber(节点)
        const 已访问 = new Set()
        let 候选数据包 = null
        for (let 当前 = fiber; 当前 && !已访问.has(当前); 当前 = 当前.return) {
          已访问.add(当前)
          const props = 当前.memoizedProps
          if (是回放数据Props(props)) {
            const 数据包 = {
              map: props.map,
              cities: props.cities,
              generals: props.generals,
              turn: props.turn,
              usernames: props.usernames,
              teams: props.teams,
              scores: props.scores,
              playerColors: props.playerColors,
              executedMoves: props.executedMoves,
              replay_id: props.replay_id,
              replayWatcherIndex: props.replayWatcherIndex,
            }
            if (
              Array.isArray(props.scores) &&
              Array.isArray(props.playerColors) &&
              Array.isArray(props.executedMoves)
            ) {
              return 数据包
            }
            候选数据包 ??= 数据包
          }
        }
        return 候选数据包
      }

      function 读取ReactFiber(节点) {
        if (!节点) return null
        const fiber键 = Object.keys(节点).find((键) => {
          return (
            键.startsWith('__reactFiber$') ||
            键.startsWith('__reactInternalInstance$')
          )
        })
        return fiber键 ? 节点[fiber键] : null
      }

      function 是回放数据Props(props) {
        return Boolean(
          props?.isReplay === true &&
          props.map &&
          Array.isArray(props.cities) &&
          Number.isInteger(props.turn),
        )
      }
    }

    function 同步回放自然增长地块(数据包, 地图数组) {
      同步回放基地位置(数据包)
      同步回放塔位置(数据包, 地图数组)
    }

    function 同步回放基地位置(数据包) {
      if (!Array.isArray(数据包?.generals)) return

      状态.已知基地集合.clear()
      for (const 基地索引 of 数据包.generals) {
        if (!Number.isInteger(基地索引) || 基地索引 < 0) continue
        状态.已知基地集合.add(基地索引)
      }

      const 我方基地索引 = 数据包.generals[状态.我方索引]
      if (Number.isInteger(我方基地索引) && 我方基地索引 >= 0) {
        状态.我方基地索引 = 我方基地索引
      }
    }

    function 同步回放塔位置(数据包, 地图数组) {
      if (!Array.isArray(数据包?.cities)) return

      const 旧塔类型表 = new Map(状态.已知塔类型)
      状态.已知塔集合.clear()
      状态.已知塔类型.clear()
      for (const 塔索引 of 数据包.cities) {
        if (!Number.isInteger(塔索引) || 塔索引 < 0) continue

        const 旧类型 = 旧塔类型表.get(塔索引)
        const 新类型 = 取得回放塔类型(塔索引, 地图数组)
        状态.已知塔集合.add(塔索引)
        状态.已知塔类型.set(塔索引, 新类型)
        记录回放开塔归属(塔索引, 旧类型, 新类型, 回放回合连续)
      }
      补齐未知开塔归属()
    }

    function 取得回放塔类型(塔索引, 地图数组) {
      const 归属 = 读取地图归属(地图数组, 塔索引)
      if (!Number.isInteger(归属) || 归属 < 0) return '中立塔'
      return 是我方或队友(归属) ? '我方塔' : '敌方塔'
    }

    function 记录回放开塔归属(塔索引, 旧类型, 新类型, 回合连续) {
      if (!回合连续) return
      if (旧类型 !== '中立塔') return
      if (新类型 === '我方塔') {
        状态.我方开塔集合.add(塔索引)
      }
    }

    function 记录回放官方行动(起始回合, 结束回合, 起始地图数组, 数据包) {
      if (!Number.isInteger(起始回合) || !Number.isInteger(结束回合)) return
      if (结束回合 <= 起始回合) return
      if (!地图可读(起始地图数组)) return

      const 模拟地图数组 = 起始地图数组.slice()
      const 移动列表 = 取得回放官方移动列表(数据包, 起始回合, 结束回合)
      let 移动idx = 0
      for (let 回合 = 起始回合; 回合 < 结束回合; 回合 += 1) {
        let 我方行动类型 = null
        let 敌方行动类型 = null
        状态.我方行动类型表.delete(回合)
        状态.敌方行动类型表.delete(回合)
        删除回合开塔兵力(回合)
        while (移动idx < 移动列表.length && 移动列表[移动idx].回合 === 回合) {
          const 移动 = 移动列表[移动idx]
          if (是我方或队友(移动.玩家索引)) {
            const 移动行动类型 = 取得回放移动行动类型(
              移动,
              模拟地图数组,
              '我方',
            )
            我方行动类型 = 取得更高优先级行动类型(
              我方行动优先级表,
              我方行动类型,
              移动行动类型,
            )
            记录回放开塔兵力(回合, 移动, 模拟地图数组, '我方', 移动行动类型)
          } else {
            const 移动行动类型 = 取得回放移动行动类型(
              移动,
              模拟地图数组,
              '敌方',
            )
            敌方行动类型 = 取得更高优先级行动类型(
              敌方行动优先级表,
              敌方行动类型,
              移动行动类型,
            )
            记录回放开塔兵力(回合, 移动, 模拟地图数组, '敌方', 移动行动类型)
          }
          应用回放移动(模拟地图数组, 移动)
          移动idx += 1
        }
        应用回放自然增长(模拟地图数组, 回合)
        if (我方行动类型) {
          设置我方行动类型(回合, 我方行动类型)
        } else {
          结算我方行动回合(回合)
        }
        设置敌方行动类型(回合, 敌方行动类型 ?? '集兵')
        记录回放已确认回合(回合)
      }

      function 删除回合开塔兵力(回合) {
        删除行动开塔记录('我方', 回合)
        删除行动开塔记录('敌方', 回合)

        function 删除行动开塔记录(阵营, 回合) {
          const 键 = 取得行动开塔兵力键(阵营, 回合)
          状态.行动开塔兵力表.delete(键)
          状态.行动开塔成功集合.delete(键)
        }
      }

      function 记录回放开塔兵力(回合, 移动, 地图数组, 阵营, 行动类型) {
        if (行动类型 !== '偷塔' && 行动类型 !== '开塔') return

        const 开塔记录 = 取得回放开塔记录(移动, 地图数组)
        设置行动开塔兵力(阵营, 回合, 开塔记录.开塔兵力, 开塔记录.开塔成功)
        if (阵营 === '敌方' && 开塔记录.开塔成功) {
          状态.敌方开塔确认集合.add(移动.终点)
        }

        function 取得回放开塔记录(移动, 地图数组) {
          const 起点兵力 = 读取地图兵力值(地图数组, 移动.起点)
          const 终点兵力 = 读取地图兵力值(地图数组, 移动.终点)
          if (!Number.isInteger(起点兵力) || !Number.isInteger(终点兵力)) {
            return { 开塔兵力: 0, 开塔成功: false }
          }

          const 留守兵力 = 移动.是否半兵 ? Math.ceil(起点兵力 / 2) : 1
          const 移动兵力 = Math.max(0, 起点兵力 - 留守兵力)
          return {
            开塔兵力: Math.min(终点兵力, 移动兵力),
            开塔成功: 移动兵力 > 终点兵力,
          }
        }
      }
    }

    function 取得回放官方移动列表(数据包, 起始回合, 结束回合) {
      return 数据包.executedMoves
        .map((移动, idx) => {
          return {
            idx,
            玩家索引: 移动?.index,
            起点: 移动?.start,
            终点: 移动?.end,
            是否半兵: Boolean(移动?.is50),
            回合: 移动?.turn,
          }
        })
        .filter((移动) => {
          return (
            Number.isInteger(移动.玩家索引) &&
            Number.isInteger(移动.起点) &&
            Number.isInteger(移动.终点) &&
            Number.isInteger(移动.回合) &&
            移动.回合 >= 起始回合 &&
            移动.回合 < 结束回合
          )
        })
        .sort((左, 右) => {
          if (左.回合 !== 右.回合) return 左.回合 - 右.回合
          return 左.idx - 右.idx
        })
    }

    function 取得回放移动行动类型(移动, 地图数组, 阵营) {
      const 目标索引 = 移动.终点
      const 格子数 = 状态.宽度 * 状态.高度
      if (!Number.isInteger(目标索引) || 目标索引 < 0 || 目标索引 >= 格子数) {
        return '集兵'
      }

      const 旧归属 = 读取地图归属(地图数组, 目标索引)
      if (状态.已知塔集合.has(目标索引)) {
        if (是对手格(旧归属)) return 阵营 === '我方' ? '吃地(抢塔)' : '吃地'
        if (旧归属 === -1) {
          return 阵营 === '我方' ? '偷塔' : '开塔'
        }
      }
      if (!Number.isInteger(旧归属)) return '集兵'
      if (旧归属 < 0 && !是阻挡地形(旧归属)) {
        return 阵营 === '我方' ? '扩地' : '扩地'
      }
      if (是对手格(旧归属)) return 阵营 === '我方' ? '吃地(抢塔)' : '吃地'
      return '集兵'

      function 是对手格(归属) {
        if (!Number.isInteger(归属) || 归属 < 0) return false
        const 是我方归属 = 是我方或队友(归属)
        return 阵营 === '我方' ? !是我方归属 : 是我方归属
      }
    }

    function 应用回放移动(地图数组, 移动) {
      const 格子数 = 状态.宽度 * 状态.高度
      if (
        !Number.isInteger(移动.起点) ||
        !Number.isInteger(移动.终点) ||
        移动.起点 < 0 ||
        移动.终点 < 0 ||
        移动.起点 >= 格子数 ||
        移动.终点 >= 格子数
      ) {
        return
      }

      const 起点兵力 = 读取地图兵力值(地图数组, 移动.起点)
      const 终点兵力 = 读取地图兵力值(地图数组, 移动.终点)
      const 终点归属 = 读取地图归属(地图数组, 移动.终点)
      if (!Number.isInteger(起点兵力) || 起点兵力 <= 1) return
      if (!Number.isInteger(终点兵力) || !Number.isInteger(终点归属)) return

      const 留守兵力 = 移动.是否半兵 ? Math.ceil(起点兵力 / 2) : 1
      const 移动兵力 = Math.max(0, 起点兵力 - 留守兵力)
      if (移动兵力 <= 0) return

      写入地图兵力值(地图数组, 移动.起点, 留守兵力)
      if (终点归属 === 移动.玩家索引) {
        写入地图兵力值(地图数组, 移动.终点, 终点兵力 + 移动兵力)
        return
      }

      if (移动兵力 > 终点兵力) {
        写入地图兵力值(地图数组, 移动.终点, 移动兵力 - 终点兵力)
        写入地图归属值(地图数组, 移动.终点, 移动.玩家索引)
      } else {
        写入地图兵力值(地图数组, 移动.终点, 终点兵力 - 移动兵力)
      }
    }

    function 应用回放自然增长(地图数组, 回合) {
      const 基地塔增长 = 取得周期增长次数(回合, 回合 + 1, 基地自然增长turn数)
      if (基地塔增长 > 0) {
        for (const 格子索引 of 状态.已知基地集合) {
          增加回放地块兵力(地图数组, 格子索引, 基地塔增长)
        }
        for (const 格子索引 of 状态.已知塔集合) {
          增加回放地块兵力(地图数组, 格子索引, 基地塔增长)
        }
      }

      const 大回合增长 = 取得周期增长次数(回合, 回合 + 1, 大回合turn数)
      if (大回合增长 <= 0) return

      const 格子数 = 状态.宽度 * 状态.高度
      for (let idx = 0; idx < 格子数; idx += 1) {
        增加回放地块兵力(地图数组, idx, 大回合增长)
      }
    }

    function 增加回放地块兵力(地图数组, 格子索引, 增长) {
      const 归属 = 读取地图归属(地图数组, 格子索引)
      const 兵力 = 读取地图兵力值(地图数组, 格子索引)
      if (!Number.isInteger(归属) || 归属 < 0) return
      if (!Number.isInteger(兵力)) return
      写入地图兵力值(地图数组, 格子索引, 兵力 + 增长)
    }

    function 读取地图兵力值(地图数组, 格子索引) {
      const 值 = 地图数组[2 + 格子索引]
      return Number.isInteger(值) ? 值 : null
    }

    function 写入地图兵力值(地图数组, 格子索引, 兵力) {
      地图数组[2 + 格子索引] = Math.max(0, 兵力)
    }

    function 写入地图归属值(地图数组, 格子索引, 归属) {
      const 格子数 = 状态.宽度 * 状态.高度
      地图数组[2 + 格子数 + 格子索引] = 归属
    }
  }
}

export function 更新我方行动监控UI() {
  if (!功能已启用('我方行动监控')) {
    状态.我方行动监控面板?.remove()
    状态.我方行动监控面板 = null
    已请求更新我方行动监控UI = false
    return
  }
  if (已请求更新我方行动监控UI) return
  已请求更新我方行动监控UI = true
  requestAnimationFrame(() => {
    已请求更新我方行动监控UI = false
    同步我方行动监控UI()
  })
}

function 同步我方行动监控UI() {
  if (!功能已启用('我方行动监控')) return
  if (!document.body) return
  确保行动开塔记录版本()
  if (!document.querySelector('#game-page #gameMap')) {
    状态.我方行动监控面板?.remove()
    状态.我方行动监控面板 = null
    return
  }

  安装样式()
  const 面板 = 确保面板()
  if (!面板) return

  const 我方回合状态列表 = 取得回合状态列表('我方')
  const 敌方回合状态列表 = 取得回合状态列表('敌方')
  const 空闲数量 = 我方回合状态列表.filter((回合状态) => {
    return 回合状态.行动类型 === '空闲'
  }).length
  const 空闲率 = 我方回合状态列表.length
    ? (空闲数量 / 我方回合状态列表.length) * 100
    : 0
  const 空闲总数元素 = 面板.querySelector('.gio-action-watch-idle-total')
  if (空闲总数元素) {
    空闲总数元素.textContent = `空闲 ${空闲数量} ${空闲率.toFixed(1)}%`
  }
  const 我方列表元素 = 面板.querySelector(
    '.gio-action-watch-section[data-gio-action-watch-side="self"] .gio-action-watch-list',
  )
  const 敌方列表元素 = 面板.querySelector(
    '.gio-action-watch-section[data-gio-action-watch-side="enemy"] .gio-action-watch-list',
  )
  if (!我方列表元素 || !敌方列表元素) return

  const 我方画布状态 = 确保画布列表(我方列表元素)
  const 敌方画布状态 = 确保画布列表(敌方列表元素)
  const 画布宽 = Math.max(
    取得画布CSS宽(我方列表元素),
    取得画布CSS宽(敌方列表元素),
  )
  const 起始回合 = 取得行动监控起始回合()
  const 最大已确认回合 =
    我方回合状态列表[我方回合状态列表.length - 1]?.回合 ??
    敌方回合状态列表[敌方回合状态列表.length - 1]?.回合 ??
    起始回合 - 1
  const 绘制签名 = `${画布宽}:${最大已确认回合}:${我方行动监控数据版本}`
  const 悬停回合 = 悬停我方行动监控回合

  if (面板.dataset.gioActionWatchTurns === `${绘制签名}:${悬停回合 ?? ''}`)
    return
  面板.dataset.gioActionWatchTurns = `${绘制签名}:${悬停回合 ?? ''}`

  const 有记录 = 我方回合状态列表.length || 敌方回合状态列表.length
  面板.dataset.gioActionWatchEmpty = 有记录 ? 'false' : 'true'

  if (!有记录) {
    我方画布状态.空状态.textContent = '等待回合'
    敌方画布状态.空状态.textContent = '等待回合'
    面板.title = '等待我方行动记录'
    return
  }

  绘制行动监控画布(
    我方画布状态.画布,
    画布宽,
    取得大回合分组(我方回合状态列表),
    悬停回合,
    '我方',
  )
  绘制行动监控画布(
    敌方画布状态.画布,
    画布宽,
    取得大回合分组(敌方回合状态列表),
    悬停回合,
    '敌方',
  )
  面板.title = `我方空闲 ${空闲数量} / 已记录 ${我方回合状态列表.length}`

  function 取得回合状态列表(阵营) {
    const 最小回合 = 取得行动监控起始回合()
    const 最大回合 = 取得最大已确认回合()
    if (!Number.isInteger(最大回合) || 最大回合 < 最小回合) return []
    const 起始回合 = 取得起始已确认回合(最大回合)
    if (!Number.isInteger(起始回合) || 起始回合 > 最大回合) return []

    const 列表 = []
    for (let 回合 = 起始回合; 回合 <= 最大回合; 回合 += 1) {
      列表.push({
        回合,
        大回合内回合: 取得大回合内回合(回合),
        行动类型: 取得回合行动类型(回合, 阵营),
        开塔兵力: 取得行动开塔兵力(阵营, 回合),
        开塔成功: 取得行动开塔成功(阵营, 回合),
      })
    }
    return 列表

    function 取得回合行动类型(回合, 阵营) {
      if (阵营 === '敌方') return 状态.敌方行动类型表.get(回合) ?? '集兵'
      return 状态.我方行动类型表.get(回合) ?? '空闲'
    }

    function 取得行动开塔兵力(阵营, 回合) {
      const 开塔兵力 = 状态.行动开塔兵力表.get(取得行动开塔兵力键(阵营, 回合))
      return Number.isInteger(开塔兵力) && 开塔兵力 > 0 ? 开塔兵力 : null
    }

    function 取得行动开塔成功(阵营, 回合) {
      return 状态.行动开塔成功集合.has(取得行动开塔兵力键(阵营, 回合))
    }
  }

  function 取得最大已确认回合() {
    if (是网页回放中()) return 回放行动监控最大已确认回合

    const 当前已确认回合 = Number.isInteger(状态.当前回合)
      ? 状态.当前回合 - 1
      : null
    let 最大回合 = 当前已确认回合

    状态.我方行动类型表.forEach((_行动类型, 回合) => {
      if (!Number.isInteger(回合) || 回合 < 取得行动监控起始回合()) return
      if (!Number.isInteger(最大回合) || 回合 > 最大回合) 最大回合 = 回合
    })
    状态.敌方行动类型表.forEach((_行动类型, 回合) => {
      if (!Number.isInteger(回合) || 回合 < 取得行动监控起始回合()) return
      if (!Number.isInteger(最大回合) || 回合 > 最大回合) 最大回合 = 回合
    })
    return 最大回合
  }

  function 取得起始已确认回合(最大回合) {
    const 最小回合 = 取得行动监控起始回合()
    if (!是网页回放中()) return 最小回合
    if (!Number.isInteger(回放行动监控最小已确认回合)) return null
    return Math.max(最小回合, 回放行动监控最小已确认回合)
  }

  function 取得大回合分组(回合列表) {
    const 分组表 = new Map()
    for (const 回合状态 of 回合列表) {
      const 大回合序号 = Math.floor(回合状态.回合 / 大回合turn数) + 1
      const 分组 = 分组表.get(大回合序号)
      if (分组) {
        分组.push(回合状态)
      } else {
        分组表.set(大回合序号, [回合状态])
      }
    }
    return 分组表
  }

  function 取得大回合内回合(回合) {
    return (回合 % 大回合turn数) + 1
  }

  function 确保面板() {
    let 面板 = 状态.我方行动监控面板
    if (!面板 || !document.documentElement.contains(面板)) {
      面板 = document.querySelector(`.${面板类名}`)
    }
    if (!面板 || !面板.querySelector('.gio-action-watch-section')) {
      const 旧面板 = 面板
      面板 = document.createElement('section')
      面板.className = 面板类名
      面板.innerHTML =
        '<div class="gio-action-watch-section" data-gio-action-watch-side="self">' +
        '<div class="gio-action-watch-head">' +
        '<div class="gio-action-watch-head-main">' +
        '<span class="gio-action-watch-title">我方行动监控</span>' +
        '<span class="gio-action-watch-idle-total">空闲 0 0.0%</span>' +
        '</div>' +
        '<div class="gio-action-watch-legend">' +
        '<span data-gio-action-watch-kind="idle">空闲</span>' +
        '<span data-gio-action-watch-kind="gather">集兵</span>' +
        '<span data-gio-action-watch-kind="expand">扩地</span>' +
        '<span data-gio-action-watch-kind="tower">偷塔</span>' +
        '<span data-gio-action-watch-kind="fight">吃地(抢塔)</span>' +
        '</div>' +
        '</div>' +
        `<div class="gio-action-watch-list"><canvas class="${画布类名}"></canvas><span class="gio-action-watch-empty">等待回合</span></div>` +
        '</div>' +
        '<div class="gio-action-watch-section" data-gio-action-watch-side="enemy">' +
        '<div class="gio-action-watch-head">' +
        '<div class="gio-action-watch-head-main">' +
        '<span class="gio-action-watch-title">敌方行动监控</span>' +
        '</div>' +
        '<div class="gio-action-watch-legend">' +
        '<span data-gio-action-watch-kind="gather">集兵</span>' +
        '<span data-gio-action-watch-kind="expand">扩地</span>' +
        '<span data-gio-action-watch-kind="fight">吃地</span>' +
        '<span data-gio-action-watch-kind="tower">开塔</span>' +
        '</div>' +
        '</div>' +
        `<div class="gio-action-watch-list"><canvas class="${画布类名}"></canvas><span class="gio-action-watch-empty">等待回合</span></div>` +
        '</div>'
      旧面板?.replaceWith(面板)
    }

    if (
      面板.parentElement &&
      面板.parentElement !== document.body &&
      document.documentElement.contains(面板.parentElement)
    ) {
      状态.我方行动监控面板 = 面板
      return 面板
    }

    const 宿主 = 取得右侧宿主()
    if (!宿主) {
      面板.classList.add('gio-action-watch-floating')
      面板.style.left = ''
      面板.style.top = ''
      面板.style.right = '12px'
      面板.style.bottom = '12px'
      if (面板.parentElement !== document.body) document.body.appendChild(面板)
      状态.我方行动监控面板 = 面板
      return 面板
    }

    面板.classList.remove('gio-action-watch-floating')
    delete 面板.dataset.gioActionWatchPositioned
    面板.style.left = ''
    面板.style.top = ''
    面板.style.right = ''
    面板.style.bottom = ''
    面板.style.width = ''
    if (面板.parentElement !== 宿主) 宿主.appendChild(面板)

    状态.我方行动监控面板 = 面板
    return 面板
  }

  function 取得右侧宿主() {
    const 表格 = 取得战场数据表格()
    if (!表格) return null

    const 标签名 = 表格.tagName?.toLowerCase() ?? ''
    if (标签名 !== 'table') return 表格

    const 宿主 = 表格.parentElement
    if (!宿主 || 宿主 === document.body) return null
    return 宿主
  }

  function 确保画布列表(列表元素) {
    let 画布 = 列表元素.querySelector(`.${画布类名}`)
    let 空状态 = 列表元素.querySelector('.gio-action-watch-empty')
    if (!画布 || !空状态 || 列表元素.children.length > 2) {
      画布 = document.createElement('canvas')
      画布.className = 画布类名
      空状态 = document.createElement('span')
      空状态.className = 'gio-action-watch-empty'
      空状态.textContent = '等待回合'
      列表元素.replaceChildren(画布, 空状态)
    }
    if (!画布.__gioActionWatchHoverInstalled) {
      画布.__gioActionWatchHoverInstalled = true
      画布.addEventListener('mousemove', 更新悬停回合)
      画布.addEventListener('mouseleave', 清空悬停回合)
    }
    return { 画布, 空状态 }

    function 更新悬停回合(event) {
      const rect = 画布.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      const css宽 = Number.parseFloat(画布.style.width) || rect.width
      const css高 = Number.parseFloat(画布.style.height) || rect.height
      const x = ((event.clientX - rect.left) / rect.width) * css宽
      const y = ((event.clientY - rect.top) / rect.height) * css高
      const 命中 = (画布.__gioActionWatchHitBoxes ?? []).find((区域) => {
        return (
          x >= 区域.x &&
          x <= 区域.x + 区域.宽 &&
          y >= 区域.y &&
          y <= 区域.y + 区域.高
        )
      })
      const 新悬停回合 = 命中?.回合 ?? null
      if (悬停我方行动监控回合 === 新悬停回合) return

      悬停我方行动监控回合 = 新悬停回合
      更新我方行动监控UI()
    }

    function 清空悬停回合() {
      if (悬停我方行动监控回合 === null) return

      悬停我方行动监控回合 = null
      更新我方行动监控UI()
    }
  }

  function 取得画布CSS宽(列表元素) {
    return Math.max(716, Math.floor(列表元素.clientWidth || 0))
  }

  function 绘制行动监控画布(画布, css宽, 分组表, 悬停回合, 阵营) {
    const dpr = window.devicePixelRatio ?? 1
    const 单元间距 = 3
    const 组间距 = 6
    const 单元高 = 19
    const 单元宽 = Math.max(
      12,
      (css宽 - 单元间距 * (每行回合数 - 1)) / 每行回合数,
    )
    const 内容宽 = 单元宽 * 每行回合数 + 单元间距 * (每行回合数 - 1)
    const 分组列表 = Array.from(分组表)
    const 组高度列表 = 分组列表.map(([, 分组回合列表]) => {
      const 最大回合 = 分组回合列表.reduce((最大值, 回合状态) => {
        return Math.max(最大值, 回合状态.大回合内回合)
      }, 1)
      const 行数 = Math.max(1, Math.ceil(最大回合 / 每行回合数))
      return 行数 * 单元高 + (行数 - 1) * 单元间距
    })
    const css高 = Math.max(
      单元高,
      组高度列表.reduce((总高, 组高) => 总高 + 组高, 0) +
        Math.max(0, 组高度列表.length - 1) * 组间距,
    )
    const 像素宽 = Math.round(内容宽 * dpr)
    const 像素高 = Math.round(css高 * dpr)

    if (画布.width !== 像素宽) 画布.width = 像素宽
    if (画布.height !== 像素高) 画布.height = 像素高
    画布.style.width = `${内容宽}px`
    画布.style.height = `${css高}px`

    const ctx = 画布.getContext('2d')
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, 内容宽, css高)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.letterSpacing = '0px'
    画布.__gioActionWatchHitBoxes = []

    let y = 0
    for (let idx = 0; idx < 分组列表.length; idx += 1) {
      const [, 分组回合列表] = 分组列表[idx]
      const 组高 = 组高度列表[idx]
      for (const 回合状态 of 分组回合列表) {
        绘制回合单元(回合状态, y)
      }
      y += 组高 + 组间距
    }

    function 绘制回合单元(回合状态, 组Y) {
      const 序号 = Math.max(1, 回合状态.大回合内回合) - 1
      const 行 = Math.floor(序号 / 每行回合数)
      const 列 = 序号 % 每行回合数
      const x = 列 * (单元宽 + 单元间距)
      const y = 组Y + 行 * (单元高 + 单元间距)
      const 样式 = 取得行动样式(回合状态.行动类型, 阵营)
      画布.__gioActionWatchHitBoxes.push({
        回合: 回合状态.回合,
        x,
        y,
        宽: 单元宽,
        高: 单元高,
      })

      if (回合状态.行动类型 === '吃地(抢塔)' || 回合状态.行动类型 === '吃地') {
        绘制五角星(x, y, 单元宽, 单元高, 样式.背景)
      } else {
        ctx.fillStyle = 样式.背景
        ctx.beginPath()
        ctx.roundRect(x, y, 单元宽, 单元高, 4)
        ctx.fill()
      }
      const 是开塔 = 是开塔行动(回合状态)
      if (是开塔 && 回合状态.开塔成功) {
        绘制开塔成功效果(x, y, 单元宽, 单元高, 样式)
      }
      if (是开塔 && 回合状态.开塔兵力 > 0) {
        绘制开塔兵力文本(回合状态.开塔兵力, x, y, 单元宽, 单元高, 样式)
        return
      }
      if (回合状态.回合 !== 悬停回合) return
      ctx.fillStyle = 样式.文字
      ctx.font = '800 11px Arial, sans-serif'
      ctx.fillText(
        String(回合状态.大回合内回合),
        x + 单元宽 / 2,
        y + 单元高 / 2,
      )

      function 是开塔行动(回合状态) {
        return 回合状态.行动类型 === '偷塔' || 回合状态.行动类型 === '开塔'
      }

      function 绘制开塔兵力文本(开塔兵力, x, y, 宽, 高, 样式) {
        const 文本 = String(开塔兵力)
        const 字号 = 文本.length >= 3 ? 9 : 10
        ctx.save()
        ctx.fillStyle = 样式.文字
        ctx.strokeStyle = 'rgba(16, 19, 24, 0.72)'
        ctx.lineWidth = 2
        ctx.lineJoin = 'round'
        ctx.font = `900 ${字号}px Arial, sans-serif`
        ctx.strokeText(文本, x + 宽 / 2, y + 高 / 2)
        ctx.fillText(文本, x + 宽 / 2, y + 高 / 2)
        ctx.restore()
      }

      function 绘制开塔成功效果(x, y, 宽, 高, 样式) {
        ctx.save()
        ctx.strokeStyle = 样式.成功边框
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.roundRect(x + 1, y + 1, 宽 - 2, 高 - 2, 4)
        ctx.stroke()

        ctx.fillStyle = 样式.成功角标
        ctx.beginPath()
        ctx.moveTo(x + 宽 - 5, y + 1.5)
        ctx.lineTo(x + 宽 - 1.5, y + 1.5)
        ctx.lineTo(x + 宽 - 1.5, y + 5)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }
    }

    function 绘制五角星(cx, cy, 宽, 高, 颜色) {
      const 外半径 = Math.min(宽, 高) / 2
      const 内半径 = 外半径 * 0.38
      const 中心x = cx + 宽 / 2
      const 中心y = cy + 高 / 2

      ctx.fillStyle = 颜色
      ctx.beginPath()
      for (let i = 0; i < 5; i += 1) {
        const 外角 = -Math.PI / 2 + (i * 2 * Math.PI) / 5
        const 内角 = 外角 + Math.PI / 5
        if (i === 0) {
          ctx.moveTo(
            中心x + 外半径 * Math.cos(外角),
            中心y + 外半径 * Math.sin(外角),
          )
        } else {
          ctx.lineTo(
            中心x + 外半径 * Math.cos(外角),
            中心y + 外半径 * Math.sin(外角),
          )
        }
        ctx.lineTo(
          中心x + 内半径 * Math.cos(内角),
          中心y + 内半径 * Math.sin(内角),
        )
      }
      ctx.closePath()
      ctx.fill()
    }

    function 取得行动样式(行动类型, 阵营) {
      if (行动类型 === '空闲') {
        return { 背景: '#b4232a', 文字: '#fff7f7' }
      }
      if (行动类型 === '扩地') {
        return { 背景: '#247448', 文字: '#effff5' }
      }
      if (行动类型 === '偷塔' || 行动类型 === '开塔') {
        return {
          背景: 阵营 === '敌方' ? '#d64545' : '#0e8fb8',
          文字: '#f7fbff',
          成功边框: '#ffcf66',
          成功角标: '#ffd76e',
        }
      }
      if (行动类型 === '吃地(抢塔)' || 行动类型 === '吃地') {
        return { 背景: '#d48b13', 文字: '#fff8ee' }
      }
      return {
        背景: 'rgba(124, 148, 176, 0.24)',
        文字: 'rgba(247, 251, 255, 0.82)',
      }
    }
  }
}

function 是网页回放中() {
  return Boolean(
    globalThis.location?.pathname?.startsWith('/replays/') ||
    document.getElementById('replay-turn-jump-input'),
  )
}

function 取得行动监控起始回合() {
  return 监控起始回合
}

function 设置我方行动类型(回合, 行动类型) {
  const 旧行动类型 = 状态.我方行动类型表.get(回合)
  const 旧优先级 = 我方行动优先级表.get(旧行动类型) ?? -1
  const 新优先级 = 我方行动优先级表.get(行动类型) ?? -1
  if (旧行动类型 === 行动类型) return
  if (旧优先级 > 新优先级) return

  状态.我方行动类型表.set(回合, 行动类型)
  我方行动监控数据版本 += 1
  更新我方行动监控UI()
}

function 设置敌方行动类型(回合, 行动类型) {
  const 旧行动类型 = 状态.敌方行动类型表.get(回合)
  const 旧优先级 = 敌方行动优先级表.get(旧行动类型) ?? -1
  const 新优先级 = 敌方行动优先级表.get(行动类型) ?? -1
  if (旧行动类型 === 行动类型) return
  if (旧优先级 > 新优先级) return

  状态.敌方行动类型表.set(回合, 行动类型)
  我方行动监控数据版本 += 1
  更新我方行动监控UI()
}

function 设置行动开塔兵力(阵营, 回合, 开塔兵力, 开塔成功 = false) {
  if (!Number.isInteger(回合) || 回合 < 取得行动监控起始回合()) return
  if (!Number.isInteger(开塔兵力) || 开塔兵力 <= 0) return

  const 键 = 取得行动开塔兵力键(阵营, 回合)
  const 旧兵力 = 状态.行动开塔兵力表.get(键)
  const 已成功 = 状态.行动开塔成功集合.has(键)
  const 新兵力 = Number.isInteger(旧兵力)
    ? Math.max(旧兵力, 开塔兵力)
    : 开塔兵力
  const 新成功 = 已成功 || 开塔成功
  if (旧兵力 === 新兵力 && 已成功 === 新成功) return

  状态.行动开塔兵力表.set(键, 新兵力)
  if (新成功) {
    状态.行动开塔成功集合.add(键)
  } else {
    状态.行动开塔成功集合.delete(键)
  }
  我方行动监控数据版本 += 1
  更新我方行动监控UI()
}

function 取得行动开塔兵力键(阵营, 回合) {
  return `${阵营}:${回合}`
}

function 确保行动开塔记录版本() {
  if (状态.行动开塔记录版本 === 行动开塔记录版本) return

  let 已清理 = false
  状态.敌方行动类型表.forEach((行动类型, 回合) => {
    if (行动类型 !== '开塔') return
    状态.敌方行动类型表.delete(回合)
    已清理 = true
  })
  状态.行动开塔兵力表.forEach((_开塔兵力, 键) => {
    if (!String(键).startsWith('敌方:')) return
    状态.行动开塔兵力表.delete(键)
    已清理 = true
  })
  状态.行动开塔成功集合.forEach((键) => {
    if (!String(键).startsWith('敌方:')) return
    状态.行动开塔成功集合.delete(键)
    已清理 = true
  })
  状态.行动开塔记录版本 = 行动开塔记录版本
  if (已清理) 我方行动监控数据版本 += 1
}

function 读取行动监控玩家快照(数据包, 回合) {
  const 玩家数据 = 是网页回放中()
    ? (读取分数玩家数据(数据包) ?? 读取快照玩家数据() ?? 读取页面玩家数据())
    : 读取分数玩家数据(数据包)
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
      确认开塔数: 状态.敌方开塔确认集合.size,
    },
  }
}

function 取得更高优先级行动类型(优先级表, 左行动类型, 右行动类型) {
  const 左优先级 = 优先级表.get(左行动类型) ?? -1
  const 右优先级 = 优先级表.get(右行动类型) ?? -1
  return 右优先级 > 左优先级 ? 右行动类型 : 左行动类型
}

function 安装样式() {
  注入样式(
    样式编号,
    `
.${面板类名} {
    box-sizing: border-box;
    width: 100%;
    margin-top: 6px;
    padding: 8px;
    border: 1px solid rgba(124, 148, 176, 0.42);
    border-radius: 6px;
    background: rgba(13, 17, 23, 0.94);
    color: #f7fbff;
    font: 700 12px/1.25 Arial, sans-serif;
    text-shadow: none;
    box-shadow: 0 10px 26px rgba(0, 0, 0, 0.34);
}
.${面板类名}.gio-action-watch-floating {
    position: fixed;
    width: min(520px, calc(100vw - 24px));
    z-index: 2147482999;
}
.gio-action-watch-section + .gio-action-watch-section {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(124, 148, 176, 0.22);
}
.gio-action-watch-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
}
.gio-action-watch-title {
    color: #f7fbff;
    font: 800 12px/1 Arial, sans-serif;
}
.gio-action-watch-head-main {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;
}
.gio-action-watch-idle-total {
    box-sizing: border-box;
    min-width: 72px;
    padding: 3px 6px;
    border-radius: 4px;
    background: rgba(180, 35, 42, 0.76);
    color: #fff7f7;
    text-align: center;
    white-space: nowrap;
    font: 900 10px/1 Arial, sans-serif;
}
.gio-action-watch-legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 4px;
}
.gio-action-watch-legend span {
    box-sizing: border-box;
    padding: 3px 5px;
    border-radius: 4px;
    background: rgba(124, 148, 176, 0.16);
    color: rgba(247, 251, 255, 0.78);
    font: 800 10px/1 Arial, sans-serif;
}
.gio-action-watch-legend [data-gio-action-watch-kind="idle"] {
    background: rgba(180, 35, 42, 0.76);
    color: #fff7f7;
}
.gio-action-watch-legend [data-gio-action-watch-kind="gather"] {
    background: rgba(124, 148, 176, 0.28);
    color: rgba(247, 251, 255, 0.86);
}
.gio-action-watch-legend [data-gio-action-watch-kind="expand"] {
    background: rgba(36, 116, 72, 0.82);
    color: #effff5;
}
.gio-action-watch-legend [data-gio-action-watch-kind="tower"] {
    background: rgba(14, 143, 184, 0.82);
    color: #f7fbff;
}
.gio-action-watch-section[data-gio-action-watch-side="enemy"] .gio-action-watch-legend [data-gio-action-watch-kind="tower"] {
    background: rgba(214, 69, 69, 0.84);
}
.gio-action-watch-legend [data-gio-action-watch-kind="fight"] {
    background: rgba(212, 139, 19, 0.82);
    color: #fff8ee;
}
.gio-action-watch-list {
    max-height: 220px;
    overflow: auto;
    scrollbar-width: thin;
}
.${画布类名} {
    display: block;
}
.${面板类名}[data-gio-action-watch-empty="true"] .${画布类名} {
    display: none;
}
.gio-action-watch-empty {
    box-sizing: border-box;
    display: none;
    width: 100%;
    padding: 4px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(247, 251, 255, 0.72);
    text-align: center;
    white-space: nowrap;
    font: 800 11px/1 Arial, sans-serif;
}
.${面板类名}[data-gio-action-watch-empty="true"] .gio-action-watch-empty {
    display: block;
}`,
  )
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 主程序功能, 功能恢复, socket功能, 地图更新功能 })
