// 功能目的:
// 在早期首次看见敌方地块时，按已知障碍物和敌方陆地数反推出敌方基地可能范围。
//
// 作用范围:
// 只使用当前地图缓存、已到达视野、已知障碍物、塔和基地记忆，维护候选格列表并额外绘制显眼标记。
import { 取得地图格子数, 地图可读, 读取地图归属 } from '../游戏.js'
import { 功能已启用 } from '../功能状态.js'
import { 状态 } from '../状态.js'
import { 是敌方格, 读取当前回合 } from '../游戏工具.js'
import { 读取分数玩家数据, 读取快照玩家数据 } from '../战场工具.js'

export const 功能定义 = {
  id: '敌方基地推测',
  名称: '敌方基地推测',
  分类: '地图覆盖',
  描述: '按接敌位置和障碍物推测敌方基地范围',
}

const 最大反推敌方陆地数 = 13

export const 功能恢复 = {
  id: 功能定义.id,
  关闭: 重置敌方基地推测,
  关闭后需要清空覆盖层: true,
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置: 重置敌方基地推测,
  新局重置后({ 数据包, 请求渲染 }) {
    更新敌方基地推测(数据包 ?? {}, 请求渲染)
  },
  game_update({ 数据包, 请求渲染 }) {
    更新敌方基地推测(数据包 ?? {}, 请求渲染)
  },
}

export const 覆盖层功能 = {
  id: 功能定义.id,
  层级: 10,
  需要绘制() {
    return 状态.敌方基地候选列表.length > 0 && 状态.已知敌方基地集合.size === 0
  },
  绘制: 画敌方基地候选标记,
}

export function 更新敌方基地推测(数据包, 请求渲染) {
  if (!功能已启用('敌方基地推测')) {
    重置敌方基地推测()
    if (typeof 请求渲染 === 'function') 请求渲染()
    return
  }
  const 当前回合 = 读取当前回合(数据包)
  const 旧签名 = 取得签名()

  if (!Number.isInteger(当前回合) || 当前回合 < 0) {
    清空推测('缺少回合', 请求渲染, 旧签名)
    return
  }
  if (!Number.isInteger(状态.我方索引)) {
    清空推测('缺少我方索引', 请求渲染, 旧签名)
    return
  }

  const 地图信息 = 取得地图信息()
  if (!地图信息) {
    清空推测('缺少地图', 请求渲染, 旧签名)
    return
  }

  记录首次敌方接触(地图信息, 当前回合, 数据包)
  状态.敌方基地候选列表 = 取得候选列表(地图信息)
  状态.敌方基地推测调试 = 取得推测调试(当前回合)

  请求重绘(请求渲染, 旧签名)

  function 记录首次敌方接触(地图信息, 当前回合, 数据包) {
    const 敌方陆地 = 读取敌方陆地(数据包)
    if (状态.敌方基地接触列表.length) return

    const 敌方索引列表 = []
    for (let idx = 0; idx < 地图信息.格子数; idx += 1) {
      const 归属 = 读取地图归属(地图信息.地图数组, idx)
      if (是敌方格(归属)) 敌方索引列表.push(idx)
    }

    if (!敌方索引列表.length) return

    状态.敌方基地接触列表 = 敌方索引列表.map((索引) => {
      return { 索引, 回合: 当前回合, 敌方陆地 }
    })
  }

  function 取得候选列表(地图信息) {
    if (!状态.敌方基地接触列表.length) return []
    if (状态.已知敌方基地集合.size) return []
    const 目标距离 = 取得目标距离()
    if (!Number.isInteger(目标距离) || 目标距离 < 0) return []

    const 距离列表 = 状态.敌方基地接触列表
      .map((接触) => 取得距离表(接触, 地图信息, 目标距离))
      .filter(Boolean)
    if (!距离列表.length) return []

    const 候选列表 = []
    for (let idx = 0; idx < 地图信息.格子数; idx += 1) {
      if (!是可作为基地候选(idx, 地图信息)) continue

      let 最短距离 = Infinity
      let 最远距离 = 0
      let 全部可达 = true
      let 命中目标距离 = false
      for (const 距离表 of 距离列表) {
        const 距离 = 距离表[idx]
        if (!Number.isInteger(距离) || 距离 < 0) {
          全部可达 = false
          break
        }
        if (距离 < 最短距离) 最短距离 = 距离
        if (距离 > 最远距离) 最远距离 = 距离
        if (距离 === 目标距离) 命中目标距离 = true
      }

      if (!全部可达 || !命中目标距离) continue
      候选列表.push({ 索引: idx, 最短距离, 最远距离, 目标距离 })
    }

    候选列表.sort((左, 右) => {
      if (左.最短距离 !== 右.最短距离) return 左.最短距离 - 右.最短距离
      if (左.最远距离 !== 右.最远距离) return 左.最远距离 - 右.最远距离
      return 左.索引 - 右.索引
    })
    return 候选列表
  }

  function 取得距离表(接触, 地图信息, 最大距离) {
    if (!Number.isInteger(接触?.索引) || !Number.isInteger(接触?.回合)) {
      return null
    }
    if (接触.索引 < 0 || 接触.索引 >= 地图信息.格子数 || 接触.回合 < 0) {
      return null
    }

    const 距离表 = new Int32Array(地图信息.格子数)
    距离表.fill(-1)
    const 队列 = [接触.索引]
    let 队列头 = 0
    距离表[接触.索引] = 0

    while (队列头 < 队列.length) {
      const 当前索引 = 队列[队列头]
      队列头 += 1
      const 当前距离 = 距离表[当前索引]
      if (当前距离 >= 最大距离) continue

      尝试加入相邻(当前索引 - 状态.宽度, 当前距离, 当前索引 >= 状态.宽度)
      尝试加入相邻(
        当前索引 + 状态.宽度,
        当前距离,
        当前索引 < 地图信息.格子数 - 状态.宽度,
      )
      尝试加入相邻(当前索引 - 1, 当前距离, 当前索引 % 状态.宽度 > 0)
      尝试加入相邻(当前索引 + 1, 当前距离, 当前索引 % 状态.宽度 < 状态.宽度 - 1)
    }

    return 距离表

    function 尝试加入相邻(相邻索引, 当前距离, 在地图内) {
      if (!在地图内) return
      if (距离表[相邻索引] >= 0) return
      if (状态.已知障碍物集合.has(相邻索引)) return
      距离表[相邻索引] = 当前距离 + 1
      队列.push(相邻索引)
    }
  }

  function 是可作为基地候选(idx, 地图信息) {
    if (状态.已到达视野集合.has(idx)) return false
    if (状态.已知障碍物集合.has(idx)) return false
    if (状态.已知塔集合.has(idx)) return false
    if (状态.已知基地集合.has(idx)) return false
    if (状态.已知敌方基地集合.has(idx)) return false

    const 地形 = 读取地图归属(地图信息.地图数组, idx)
    return 地形 !== -2 && 地形 !== -4
  }

  function 取得推测调试(当前回合) {
    const 首次接敌敌方陆地 = 取得首次接敌敌方陆地()
    const 目标距离 = 取得目标距离()
    return {
      原因: 取得调试原因(首次接敌敌方陆地),
      当前回合,
      接触数量: 状态.敌方基地接触列表.length,
      候选数量: 状态.敌方基地候选列表.length,
      首次接敌敌方陆地,
      目标距离,
      最大反推敌方陆地数,
    }
  }

  function 取得调试原因(首次接敌敌方陆地) {
    if (状态.已知敌方基地集合.size) return '已发现敌方基地'
    if (!状态.敌方基地接触列表.length) return '尚未接敌'
    if (!Number.isInteger(首次接敌敌方陆地)) return '缺少敌方陆地'
    if (首次接敌敌方陆地 > 最大反推敌方陆地数) {
      return '首次接敌敌方陆地超过13'
    }
    if (!状态.敌方基地候选列表.length) return '无精确候选'
    return '已计算'
  }

  function 取得目标距离() {
    const 首次接敌敌方陆地 = 取得首次接敌敌方陆地()
    if (!Number.isInteger(首次接敌敌方陆地)) return null
    if (首次接敌敌方陆地 < 1 || 首次接敌敌方陆地 > 最大反推敌方陆地数) {
      return null
    }
    return 首次接敌敌方陆地 - 1
  }

  function 取得首次接敌敌方陆地() {
    const 首次接触 = 状态.敌方基地接触列表[0]
    return Number.isInteger(首次接触?.敌方陆地) ? 首次接触.敌方陆地 : null
  }

  function 读取敌方陆地(数据包) {
    const 玩家数据 = 读取分数玩家数据(数据包) ?? 读取快照玩家数据()
    const 敌方陆地 = 玩家数据?.敌方?.陆地
    return Number.isInteger(敌方陆地) ? 敌方陆地 : null
  }

  function 取得地图信息() {
    const 地图数组 = 状态.地图数组
    if (!地图可读(地图数组)) return null

    return {
      地图数组,
      格子数: 取得地图格子数(地图数组),
    }
  }

  function 清空推测(原因, 请求渲染, 旧签名) {
    重置敌方基地推测()
    状态.敌方基地推测调试 = { 原因 }
    请求重绘(请求渲染, 旧签名)
  }

  function 请求重绘(请求渲染, 旧签名) {
    if (取得签名() === 旧签名) return
    if (typeof 请求渲染 === 'function') 请求渲染()
  }

  function 取得签名() {
    return [
      状态.敌方基地接触列表
        .map((接触) => `${接触.索引}:${接触.回合}:${接触.敌方陆地 ?? ''}`)
        .join(','),
      状态.敌方基地候选列表.map((候选) => 候选.索引).join(','),
    ].join('|')
  }
}

export function 重置敌方基地推测() {
  状态.敌方基地接触列表 = []
  状态.敌方基地候选列表 = []
  状态.敌方基地推测调试 = null
}

function 画敌方基地候选标记({ ctx, 格宽, 格高, 大小 }) {
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  状态.敌方基地候选列表.forEach((候选) => {
    const 行 = Math.floor(候选.索引 / 状态.宽度)
    const 列 = 候选.索引 % 状态.宽度
    const x = 列 * 格宽
    const y = 行 * 格高
    const 外缩 = Math.max(2, 大小 * 0.08)
    const 内缩 = Math.max(5, 大小 * 0.22)
    const 角长 = Math.max(6, 大小 * 0.22)

    ctx.globalAlpha = 0.96
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.92)'
    ctx.lineWidth = Math.max(3, 大小 * 0.11)
    ctx.strokeRect(
      x + 外缩,
      y + 外缩,
      Math.max(1, 格宽 - 外缩 * 2),
      Math.max(1, 格高 - 外缩 * 2),
    )

    ctx.strokeStyle = 'rgba(255, 232, 74, 0.98)'
    ctx.lineWidth = Math.max(2, 大小 * 0.05)
    ctx.strokeRect(
      x + 外缩,
      y + 外缩,
      Math.max(1, 格宽 - 外缩 * 2),
      Math.max(1, 格高 - 外缩 * 2),
    )

    ctx.globalAlpha = 0.28
    ctx.fillStyle = 'rgba(255, 232, 74, 0.92)'
    ctx.fillRect(
      x + 内缩,
      y + 内缩,
      Math.max(1, 格宽 - 内缩 * 2),
      Math.max(1, 格高 - 内缩 * 2),
    )

    ctx.globalAlpha = 1
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)'
    ctx.lineWidth = Math.max(2, 大小 * 0.04)
    画角标(x, y, 格宽, 格高, 外缩, 角长)
  })

  ctx.restore()

  function 画角标(x, y, 格宽, 格高, 外缩, 角长) {
    const 左 = x + 外缩
    const 右 = x + 格宽 - 外缩
    const 上 = y + 外缩
    const 下 = y + 格高 - 外缩

    ctx.beginPath()
    ctx.moveTo(左, 上 + 角长)
    ctx.lineTo(左, 上)
    ctx.lineTo(左 + 角长, 上)

    ctx.moveTo(右 - 角长, 上)
    ctx.lineTo(右, 上)
    ctx.lineTo(右, 上 + 角长)

    ctx.moveTo(左, 下 - 角长)
    ctx.lineTo(左, 下)
    ctx.lineTo(左 + 角长, 下)

    ctx.moveTo(右 - 角长, 下)
    ctx.lineTo(右, 下)
    ctx.lineTo(右, 下 - 角长)
    ctx.stroke()
  }
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 功能恢复, socket功能, 覆盖层功能 })
