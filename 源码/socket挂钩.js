// 功能目的:
// 挂钩 generals.io 的 socket，统一接收入站游戏数据和出站操作事件。
//
// 作用范围:
// 入站侧负责驱动回合记录、颜色重构、塔/基地记忆、地图缓存、基地危险和战场数据差更新。
// 出站侧只记录本地移动队列用于覆盖层显示，真实 socket 调用仍交回原函数执行。
import { 读取玩家信息, 尝试从地图读取尺寸 } from './游戏.js'
import { 功能已启用 } from './功能开关.js'
import { 状态 } from './状态.js'
import { 安全执行 } from './工具.js'
import { 更新战场塔信息 } from './功能/战场塔信息.js'
import { 更新战场数据差 } from './功能/战场数据差.js'
import { 处理基地位置 } from './功能/基地记忆.js'
import { 处理死亡时基地危险状态, 更新基地危险状态 } from './功能/基地危险.js'
import { 更新地图缓存和兵力分布 } from './地图状态.js'
import {
  按攻击序号清理移动队列,
  撤销移动操作,
  记录移动操作,
  清空移动队列,
} from './功能/移动队列.js'
import { 清空覆盖层, 重置自适应棋盘尺寸 } from './覆盖层.js'
import { 重构玩家颜色 } from './功能/玩家颜色.js'
import { 记录回合, 更新大回合倒计时 } from './功能/大回合倒计时.js'
import { 处理塔位置 } from './功能/塔记忆.js'
import {
  处理战场数据冻结事件,
  是战场数据冻结事件,
  重置战场数据冻结,
} from './功能/战场数据冻结.js'
import { 记录回放帧, 结束回放, 重置回放 } from './功能/回放系统.js'
import { 尝试自动吃敌方基地, 重置自动吃基地 } from './功能/自动吃基地.js'
import { 尝试自动保护基地, 重置自动保护基地 } from './功能/自动保护基地.js'
import { 清除抢塔提示 } from './功能/抢塔提示.js'
import { 更新敌方开塔提示, 清除敌方开塔提示 } from './功能/敌方开塔提示.js'
import { 更新敌方基地推测, 重置敌方基地推测 } from './功能/敌方基地推测.js'
import { 重置敌方最强兵力位置 } from './功能/敌方主力标记.js'
import {
  结算当前我方行动回合,
  重置我方行动监控,
  更新我方行动监控UI,
} from './功能/我方行动监控.js'
import {
  记录游戏数据进展,
  重置游戏数据进展,
  更新游戏数据进展图表,
} from './功能/游戏数据进展图表.js'

export function 挂钩socket(socket, 请求渲染) {
  if (!socket || socket.__塔记忆已挂钩) return
  socket.__塔记忆已挂钩 = true
  状态.socket已挂钩 = true
  const 使用emitEvent预处理 = typeof socket.emitEvent === 'function'
  const 使用入站预处理 =
    使用emitEvent预处理 || typeof socket.onevent === 'function'

  if (typeof socket.emit === 'function' && !socket.__塔记忆emit已挂钩) {
    const 原emit = socket.emit
    socket.__塔记忆emit已挂钩 = true
    socket.emit = function (事件名, ...参数) {
      if (功能已启用('回放系统') && 状态.回放已结束 && 是移动操作事件(事件名)) {
        return this
      }
      安全执行('emit出站操作记录', () => {
        if (事件名 === 'attack') {
          记录移动操作(参数[0], 参数[1], 参数[2], 参数[3], 请求渲染)
        } else if (事件名 === 'undo_move') {
          撤销移动操作(请求渲染)
        } else if (事件名 === 'clear_moves') {
          清空移动队列('clear_moves', 请求渲染)
        }
      })
      return 原emit.call(this, 事件名, ...参数)
    }
  }

  if (
    !使用emitEvent预处理 &&
    typeof socket.onevent === 'function' &&
    !socket.__塔记忆onevent已挂钩
  ) {
    const 原onevent = socket.onevent
    socket.__塔记忆onevent已挂钩 = true
    socket.onevent = function (包) {
      安全执行('onevent入站预处理', () => {
        const 数据 = Array.isArray(包?.data) ? 包.data : null
        if (数据) 预处理入站事件(数据[0], 数据[1])
      })
      return 原onevent.call(this, 包)
    }
  }

  if (使用emitEvent预处理 && !socket.__塔记忆emitEvent已挂钩) {
    const 原emitEvent = socket.emitEvent
    socket.__塔记忆emitEvent已挂钩 = true
    socket.emitEvent = function (参数列表) {
      安全执行('emitEvent入站预处理', () => {
        if (Array.isArray(参数列表)) 预处理入站事件(参数列表[0], 参数列表[1])
      })
      return 原emitEvent.call(this, 参数列表)
    }
  }

  socket.on('game_start', (数据包) => {
    if (!使用入站预处理) {
      安全执行('game_start回合倒计时', () => {
        记录回合(数据包 ?? {})
      })
      安全执行('game_start颜色重构', () => {
        重构玩家颜色(数据包 ?? {})
      })
    }
    延后执行('game_start', () => {
      重置本局(数据包 ?? {})
      处理塔位置(数据包 ?? {}, 请求渲染)
      处理基地位置(数据包 ?? {}, 请求渲染)
      if (功能已启用('回放系统')) {
        记录回放帧('game_start', 数据包 ?? {})
      }
    })
  })

  socket.on('game_update', (数据包) => {
    if (!使用入站预处理) {
      安全执行('game_update回合倒计时', () => {
        记录回合(数据包 ?? {})
      })
      安全执行('game_update颜色重构', () => {
        重构玩家颜色(数据包 ?? {})
      })
    }
    延后执行('game_update', () => {
      const 已处理我方移动列表 = 按攻击序号清理移动队列(
        数据包?.attackIndex,
        请求渲染,
      )
      尝试从地图读取尺寸(数据包 ?? {})
      更新地图缓存和兵力分布(数据包 ?? {}, 'game_update', 已处理我方移动列表)
      处理塔位置(数据包 ?? {}, 请求渲染)
      处理基地位置(数据包 ?? {}, 请求渲染)
      更新敌方基地推测(数据包 ?? {}, 请求渲染)
      更新基地危险状态()
      if (是我方死亡事件('game_update', 数据包 ?? {})) {
        处理死亡时基地危险状态()
      }
      更新战场塔信息()
      更新战场数据差()
      记录游戏数据进展(数据包 ?? {})
      更新敌方开塔提示(数据包 ?? {})
      const 已自动保护 = 功能已启用('自动保护基地')
        ? 尝试自动保护基地(socket, 请求渲染)
        : false
      if (!已自动保护 && 功能已启用('自动吃基地')) {
        尝试自动吃敌方基地(socket, 请求渲染)
      }
      if (功能已启用('回放系统')) {
        记录回放帧('game_update', 数据包 ?? {})
      }
      if (
        功能已启用('回放系统') &&
        是战场数据冻结事件('game_update', 数据包 ?? {})
      ) {
        结束回放('game_update', 数据包 ?? {}, 请求渲染)
      }
    })
  })

  function 延后执行(事件, 函数体) {
    setTimeout(() => 安全执行(事件, 函数体), 0)
  }

  function 是移动操作事件(事件名) {
    return (
      事件名 === 'attack' || 事件名 === 'undo_move' || 事件名 === 'clear_moves'
    )
  }

  function 预处理入站事件(事件名, 数据包) {
    处理战场数据冻结事件(事件名, 数据包)
    if (是我方死亡事件(事件名, 数据包)) {
      处理死亡时基地危险状态()
    }
    if (事件名 === 'game_start' || 事件名 === 'game_update') {
      记录回合(数据包 ?? {})
      重构玩家颜色(数据包 ?? {})
    }
    if (功能已启用('回放系统') && 是战场数据冻结事件(事件名, 数据包)) {
      结算当前我方行动回合()
      if (事件名 !== 'game_update' && 事件名 !== 'game_start') {
        延后执行(`${事件名}回放结束`, () => {
          结束回放(事件名, 数据包, 请求渲染)
        })
      }
    }
  }

  function 重置本局(数据包) {
    状态.宽度 = 0
    状态.高度 = 0
    状态.塔列表 = null
    状态.已知塔集合.clear()
    状态.已知塔类型.clear()
    状态.中立塔兵力表.clear()
    状态.中立塔开塔成本表.clear()
    状态.我方开塔增长表.clear()
    状态.敌方推断开塔数 = 0
    状态.敌方开塔确认集合.clear()
    状态.已知基地集合.clear()
    状态.已知敌方基地集合.clear()
    状态.基地兵力表.clear()
    状态.我方基地索引 = null
    状态.基地被敌发现 = false
    状态.基地被敌发现回合 = null
    状态.基地危险背景豁免 = false
    清除抢塔提示()
    清除敌方开塔提示()
    状态.已到达视野集合.clear()
    状态.已知障碍物集合.clear()
    状态.地图数组 = null
    状态.原始兵力文本.clear()
    状态.兵力分布着色列表 = []
    状态.兵力分布调试 = null
    状态.敌方移动高亮列表 = []
    重置敌方最强兵力位置()
    重置敌方基地推测()
    状态.抢塔提示列表 = []
    重置自动保护基地()
    重置自动吃基地()
    重置我方行动监控()
    重置游戏数据进展()
    清空移动队列('新局重置', 请求渲染)
    状态.当前回合 = Number.isInteger(数据包?.turn) ? 数据包.turn : 0
    重置战场数据冻结()
    重置回放()
    重置自适应棋盘尺寸()
    状态.我方索引 = Number.isInteger(数据包?.playerIndex)
      ? 数据包.playerIndex
      : null
    状态.玩家名列表 = Array.isArray(数据包?.usernames)
      ? 数据包.usernames.slice()
      : null
    状态.队伍 = Array.isArray(数据包?.teams) ? 数据包.teams.slice() : null
    读取玩家信息(数据包 ?? {})
    尝试从地图读取尺寸(数据包 ?? {})
    更新地图缓存和兵力分布(数据包 ?? {}, '新局重置')
    更新敌方基地推测(数据包 ?? {}, 请求渲染)
    更新基地危险状态()
    更新大回合倒计时()
    更新我方行动监控UI()
    更新游戏数据进展图表()
    更新战场塔信息()
    更新战场数据差()
    清空覆盖层()
  }

  function 是我方死亡事件(事件名, 数据包) {
    if (事件名 === 'game_lost') return true
    if (!Array.isArray(数据包?.scores) || !Number.isInteger(状态.我方索引)) {
      return false
    }
    return 数据包.scores[状态.我方索引]?.dead === true
  }
}
