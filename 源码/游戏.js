import { 状态 } from './状态.js'
import { 取得单元格列表 } from './战场DOM工具.js'

export function 是我方或队友(玩家索引) {
  if (!Number.isInteger(玩家索引) || 玩家索引 < 0) return false
  if (!Number.isInteger(状态.我方索引)) return false
  if (玩家索引 === 状态.我方索引) return true
  if (!Array.isArray(状态.队伍)) return false
  const 我方队伍 = 状态.队伍[状态.我方索引]
  const 对方队伍 = 状态.队伍[玩家索引]
  return 我方队伍 != null && 对方队伍 === 我方队伍
}

export function 读取玩家信息(数据包) {
  if (!数据包) return
  if (Array.isArray(数据包.usernames)) {
    状态.玩家名列表 = 数据包.usernames.slice()
  }

  if (!Number.isInteger(状态.我方索引)) {
    const 本地玩家索引 = 取得本地玩家索引()
    if (Number.isInteger(本地玩家索引)) {
      状态.我方索引 = 本地玩家索引
    } else if (Number.isInteger(数据包.playerIndex)) {
      状态.我方索引 = 数据包.playerIndex
    }
  }

  if (Array.isArray(数据包.teams)) {
    状态.队伍 = 数据包.teams.slice()
  }
}

export function 同步我方玩家索引() {
  const 本地玩家索引 = 取得本地玩家索引()
  if (Number.isInteger(本地玩家索引)) {
    状态.我方索引 = 本地玩家索引
    return 状态.我方索引
  }

  const 回放POV玩家索引 = 读取回放POV玩家索引()
  if (Number.isInteger(回放POV玩家索引)) {
    状态.我方索引 = 回放POV玩家索引
  }
  return 状态.我方索引

  function 读取回放POV玩家索引() {
    if (!document.body || !Array.isArray(状态.玩家名列表)) return null

    const 表格列表 = document.body.querySelectorAll(
      'table, .leaderboard, #leaderboard',
    )
    for (const 表格 of 表格列表) {
      const 表头行 = 取得表头行(表格)
      if (!表头行) continue

      const 表头格列表 = 取得单元格列表(表头行)
      const 视角列 = 表头格列表.findIndex((单元格) => {
        if (单元格.dataset.gioReplayTurnCell === 'true') return true
        return (单元格.textContent ?? '').trim() === 'POV'
      })
      const 玩家列 = 表头格列表.findIndex((单元格) => {
        if (单元格.dataset.gioBattlePlayerColumn === 'true') return true
        return (单元格.textContent ?? '').trim() === 'Player'
      })
      if (视角列 < 0 || 玩家列 < 0) continue

      const 数据行列表 = Array.from(表格.querySelectorAll('tr')).filter(
        (行) => {
          return 行 !== 表头行
        },
      )
      for (const 行 of 数据行列表) {
        const 单元格列表 = 取得单元格列表(行)
        const 视角格 = 单元格列表[视角列]
        const 勾选框 = 读取POV勾选框(视角格)
        if (!勾选框?.checked) continue

        const 玩家名 = (单元格列表[玩家列]?.textContent ?? '').trim()
        if (!玩家名) continue

        const 玩家索引 = 状态.玩家名列表.indexOf(玩家名)
        if (玩家索引 >= 0) return 玩家索引
      }
    }

    return null
  }

  function 读取POV勾选框(单元格) {
    const 勾选框列表 = Array.from(
      单元格?.querySelectorAll('input[type="checkbox"]') ?? [],
    )
    return (
      勾选框列表.find((勾选框) => {
        return !勾选框.closest('.perspective-select')
      }) ?? null
    )
  }

  function 取得表头行(表格) {
    const 行列表 = 表格.querySelectorAll('tr')
    for (const 行 of 行列表) {
      const 文本列表 = 取得单元格列表(行).map((单元格) => {
        return (单元格.textContent ?? '').trim()
      })
      if (行.querySelector('[data-gio-replay-turn-cell="true"]')) return 行
      if (文本列表.includes('POV')) return 行
    }
    return null
  }
}

function 取得本地玩家索引(玩家名列表 = 状态.玩家名列表) {
  const 本地玩家名 = 读取本地玩家名()
  if (!本地玩家名 || !Array.isArray(玩家名列表)) return null

  const 精确索引 = 玩家名列表.indexOf(本地玩家名)
  if (精确索引 >= 0) return 精确索引

  const 本地玩家名小写 = 本地玩家名.toLowerCase()
  const 忽略大小写索引 = 玩家名列表.findIndex((玩家名) => {
    return (
      typeof 玩家名 === 'string' &&
      玩家名.trim().toLowerCase() === 本地玩家名小写
    )
  })
  return 忽略大小写索引 >= 0 ? 忽略大小写索引 : null
}

function 读取本地玩家名() {
  const 玩家名 = globalThis.localStorage?.GIO_CACHED_USERNAME
  return typeof 玩家名 === 'string' ? 玩家名.trim() : ''
}

export function 尝试从地图读取尺寸(数据包) {
  if (状态.宽度 > 0 && 状态.高度 > 0) return

  const 地图数组 = 取得完整地图数组(数据包)
  if (!地图数组) return

  状态.宽度 = 地图数组[0]
  状态.高度 = 地图数组[1]
}

export function 取得本次塔列表(数据包) {
  if (Array.isArray(数据包?.cities)) {
    return { 来源: 'cities', 塔列表: 数据包.cities.slice() }
  }

  if (Array.isArray(数据包?.cities_diff)) {
    if (Array.isArray(状态.塔列表)) {
      return {
        来源: 'cities_diff',
        塔列表: 应用增量(状态.塔列表, 数据包.cities_diff),
      }
    }

    if (数据包.cities_diff[0] === 0 && 数据包.cities_diff.length > 1) {
      return {
        来源: '首个cities_diff',
        塔列表: 应用增量([], 数据包.cities_diff),
      }
    }
  }

  return null
}

export function 读取可见地块归属(数据包, 格子索引) {
  return 读取可见地图值(数据包, 格子索引, '归属')
}

export function 读取可见地块兵力(数据包, 格子索引) {
  return 读取可见地图值(数据包, 格子索引, '兵力')
}

export function 读取地图兵力(地图数组, 格子索引) {
  const 格子数 = 取得地图格子数(地图数组)
  if (格子数 == null || !Number.isInteger(格子索引)) return null
  if (格子索引 < 0 || 格子索引 >= 格子数) return null

  const 兵力 = 地图数组[2 + 格子索引]
  return Number.isInteger(兵力) ? 兵力 : null
}

export function 读取地图归属(地图数组, 格子索引) {
  const 格子数 = 取得地图格子数(地图数组)
  if (格子数 == null || !Number.isInteger(格子索引)) return null
  if (格子索引 < 0 || 格子索引 >= 格子数) return null

  const 归属 = 地图数组[2 + 格子数 + 格子索引]
  return Number.isInteger(归属) ? 归属 : null
}

export function 读取地图地块(地图数组, 格子索引) {
  const 格子数 = 取得地图格子数(地图数组)
  if (格子数 == null || !Number.isInteger(格子索引)) return null
  if (格子索引 < 0 || 格子索引 >= 格子数) return null

  const 兵力 = 地图数组[2 + 格子索引]
  const 归属 = 地图数组[2 + 格子数 + 格子索引]
  return {
    兵力: Number.isInteger(兵力) ? 兵力 : null,
    归属: Number.isInteger(归属) ? 归属 : null,
  }
}

export function 地图可读(地图数组) {
  return 取得地图格子数(地图数组) != null
}

export function 取得地图格子数(地图数组) {
  if (!Array.isArray(地图数组) || 地图数组.length < 2) return null
  const 宽度 = 地图数组[0]
  const 高度 = 地图数组[1]
  const 格子数 = 宽度 * 高度
  if (!Number.isFinite(宽度) || !Number.isFinite(高度) || 格子数 <= 0) {
    return null
  }
  if (地图数组.length < 2 + 格子数 * 2) return null
  return 格子数
}

function 读取可见地图值(数据包, 格子索引, 类型) {
  const 地图数组 = 取得完整地图数组(数据包)
  if (地图数组) {
    const 地块 = 读取地图地块(地图数组, 格子索引)
    return 地块?.[类型] ?? null
  }

  if (!Array.isArray(数据包?.map_diff)) return null
  if (!状态.宽度 || !状态.高度 || !Number.isInteger(格子索引)) return null

  const 格子数 = 状态.宽度 * 状态.高度
  if (格子索引 < 0 || 格子索引 >= 格子数) return null

  const 目标位置 = 类型 === '归属' ? 2 + 格子数 + 格子索引 : 2 + 格子索引
  return 读取增量位置值(数据包.map_diff, 目标位置)
}

function 读取增量位置值(增量, 目标位置) {
  if (!Array.isArray(增量) || !Number.isInteger(目标位置)) return null
  let 输出位置 = 0
  for (let idx = 0; idx < 增量.length; ) {
    const 保留数量 = 增量[idx] ?? 0
    if (目标位置 >= 输出位置 && 目标位置 < 输出位置 + 保留数量) return null
    输出位置 += 保留数量

    idx += 1
    if (idx < 增量.length) {
      const 插入数量 = 增量[idx] ?? 0
      if (目标位置 >= 输出位置 && 目标位置 < 输出位置 + 插入数量) {
        const 增量值 = 增量[idx + 1 + (目标位置 - 输出位置)]
        return Number.isInteger(增量值) ? 增量值 : null
      }
      输出位置 += 插入数量
      idx += 插入数量
    }

    idx += 1
  }

  return null
}

export function 取得完整地图数组(数据包) {
  let 地图数组 = null
  if (Array.isArray(数据包?.map)) {
    地图数组 = 数据包.map
  } else if (
    Array.isArray(数据包?.map_diff) &&
    数据包.map_diff[0] === 0 &&
    数据包.map_diff.length > 4
  ) {
    地图数组 = 应用增量([], 数据包.map_diff)
  }

  return 地图可读(地图数组) ? 地图数组 : null
}

export function 应用增量(旧数组, 增量) {
  if (!Array.isArray(增量)) return null
  if (!Array.isArray(旧数组)) 旧数组 = []

  const 新数组 = []
  for (let idx = 0; idx < 增量.length; ) {
    const 保留数量 = 增量[idx] ?? 0
    if (保留数量 > 0) {
      const 起点 = 新数组.length
      for (let 保留idx = 0; 保留idx < 保留数量; 保留idx += 1) {
        新数组[起点 + 保留idx] = 旧数组[起点 + 保留idx]
      }
    }

    idx += 1
    if (idx < 增量.length) {
      const 插入数量 = 增量[idx] ?? 0
      if (插入数量 > 0) {
        const 起点 = 新数组.length
        for (let 插入idx = 0; 插入idx < 插入数量; 插入idx += 1) {
          新数组[起点 + 插入idx] = 增量[idx + 1 + 插入idx]
        }
        idx += 插入数量
      }
    }

    idx += 1
  }
  return 新数组
}
