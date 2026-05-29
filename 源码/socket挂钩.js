// 功能目的:
// 挂钩 generals.io 的 socket，统一接收入站游戏数据和出站操作事件。
//
// 作用范围:
// 只负责 socket 包装、基础本局状态和事件分发；具体功能逻辑由功能注册表里的 socket hook 执行。
import { 读取玩家信息, 尝试从地图读取尺寸 } from './游戏.js'
import { socket功能列表 } from './功能注册.js'
import { 状态 } from './状态.js'
import { 安全执行 } from './工具.js'
import { 更新地图缓存和兵力分布 } from './地图状态.js'
import { 清空覆盖层 } from './覆盖层.js'

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
      const 上下文 = 取得事件上下文(事件名, null)
      上下文.socket = this
      上下文.参数 = 参数
      if (执行阻止出站Hook(上下文)) return this

      执行socketHook('出站', 上下文, 'emit出站操作记录')
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
    if (!使用入站预处理) 预处理入站事件('game_start', 数据包)
    延后执行('game_start', () => {
      const 上下文 = 取得事件上下文('game_start', 数据包)
      重置本局(上下文)
      执行socketHook('game_start', 上下文)
    })
  })

  socket.on('game_update', (数据包) => {
    if (!使用入站预处理) 预处理入站事件('game_update', 数据包)
    延后执行('game_update', () => {
      const 上下文 = 取得事件上下文('game_update', 数据包)
      执行socketHook('game_update前', 上下文)
      尝试从地图读取尺寸(上下文.数据包)
      更新地图缓存和兵力分布(
        上下文.数据包,
        'game_update',
        上下文.已处理我方移动列表,
      )
      执行socketHook('game_update', 上下文)
    })
  })

  function 预处理入站事件(事件名, 数据包) {
    执行socketHook('入站预处理', 取得事件上下文(事件名, 数据包))
  }

  function 重置本局(上下文) {
    const 数据包 = 上下文.数据包
    状态.宽度 = 0
    状态.高度 = 0
    状态.地图数组 = null
    执行socketHook('新局重置', 上下文)

    状态.当前回合 = Number.isInteger(数据包?.turn) ? 数据包.turn : 0
    状态.我方索引 = Number.isInteger(数据包?.playerIndex)
      ? 数据包.playerIndex
      : null
    状态.玩家名列表 = Array.isArray(数据包?.usernames)
      ? 数据包.usernames.slice()
      : null
    状态.队伍 = Array.isArray(数据包?.teams) ? 数据包.teams.slice() : null
    读取玩家信息(数据包)
    尝试从地图读取尺寸(数据包)
    更新地图缓存和兵力分布(数据包, '新局重置')
    执行socketHook('新局重置后', 上下文)
    清空覆盖层()
  }

  function 取得事件上下文(事件名, 数据包) {
    const 安全数据包 = 数据包 ?? {}
    return {
      socket,
      事件名,
      数据包: 安全数据包,
      参数: [],
      请求渲染,
      延后执行,
      我方死亡: 是我方死亡事件(事件名, 安全数据包),
      已处理我方移动列表: [],
      已自动保护: false,
    }
  }

  function 执行阻止出站Hook(上下文) {
    let 已阻止 = false
    for (const 功能 of socket功能列表) {
      const hook = 功能?.阻止出站
      if (typeof hook !== 'function') continue
      安全执行(`${功能.id}阻止出站`, () => {
        if (hook(上下文)) 已阻止 = true
      })
      if (已阻止) return true
    }
    return false
  }

  function 执行socketHook(hook名, 上下文, 标签 = hook名) {
    const 开始时间 = performance.now()
    const 功能耗时 = []
    for (const 功能 of socket功能列表) {
      const hook = 功能?.[hook名]
      if (typeof hook !== 'function') continue
      const 功能开始时间 = performance.now()
      安全执行(`${功能.id}${标签}`, () => {
        hook(上下文)
      })
      功能耗时.push({
        id: 功能.id,
        耗时: Math.round((performance.now() - 功能开始时间) * 100) / 100,
      })
    }
    状态.性能诊断.socketHook = {
      hook名,
      标签,
      耗时: Math.round((performance.now() - 开始时间) * 100) / 100,
      功能数量: 功能耗时.length,
      功能耗时: 功能耗时.filter((记录) => 记录.耗时 > 0),
      事件名: 上下文.事件名,
      回合: Number.isInteger(上下文.数据包?.turn)
        ? 上下文.数据包.turn
        : 状态.当前回合,
      时间: Math.round(开始时间),
    }
  }

  function 延后执行(事件, 函数体) {
    setTimeout(() => 安全执行(事件, 函数体), 0)
  }

  function 是我方死亡事件(事件名, 数据包) {
    if (事件名 === 'game_lost') return true
    if (!Array.isArray(数据包?.scores) || !Number.isInteger(状态.我方索引)) {
      return false
    }
    return 数据包.scores[状态.我方索引]?.dead === true
  }
}
