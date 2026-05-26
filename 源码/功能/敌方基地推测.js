// 功能目的:
// 在早期首次看见敌方地块时，按已知障碍物反推出敌方基地可能范围。
//
// 作用范围:
// 只使用当前地图缓存、已到达视野、已知障碍物、塔和基地记忆，维护候选格列表供覆盖层过滤红底。
import {
  取得地图格子数,
  地图可读,
  读取地图归属,
} from '../游戏.js'
import { 功能已启用 } from '../功能状态.js'
import { 状态 } from '../状态.js'
import { 取得相邻索引列表, 是敌方格 } from '../游戏工具.js'

export const 功能定义 = {
  id: '敌方基地推测',
  名称: '敌方基地推测',
  分类: '地图覆盖',
  描述: '按接敌位置和障碍物推测敌方基地范围',
}

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

export function 更新敌方基地推测(数据包, 请求渲染) {
  if (!功能已启用('敌方基地推测')) {
    重置敌方基地推测()
    if (typeof 请求渲染 === 'function') 请求渲染()
    return
  }
  const 当前回合 = Number.isInteger(数据包?.turn) ? 数据包.turn : 状态.当前回合
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

  记录首次敌方接触(地图信息, 当前回合)
  状态.敌方基地候选列表 = 取得候选列表(地图信息)
  状态.敌方基地推测调试 = {
    原因: 状态.已知敌方基地集合.size ? '已发现敌方基地' : '已计算',
    当前回合,
    接触数量: 状态.敌方基地接触列表.length,
    候选数量: 状态.敌方基地候选列表.length,
  }

  请求重绘(请求渲染, 旧签名)

  function 记录首次敌方接触(地图信息, 当前回合) {
    if (状态.敌方基地接触列表.length) return

    const 敌方索引列表 = []
    for (let idx = 0; idx < 地图信息.格子数; idx += 1) {
      const 归属 = 读取地图归属(地图信息.地图数组, idx)
      if (是敌方格(归属)) 敌方索引列表.push(idx)
    }

    if (!敌方索引列表.length) return

    状态.敌方基地接触列表 = 敌方索引列表.map((索引) => {
      return { 索引, 回合: 当前回合 }
    })
  }

  function 取得候选列表(地图信息) {
    if (!状态.敌方基地接触列表.length) return []
    if (状态.已知敌方基地集合.size) return []

    const 距离列表 = 状态.敌方基地接触列表
      .map((接触) => 取得距离表(接触, 地图信息))
      .filter(Boolean)
    if (!距离列表.length) return []

    const 候选列表 = []
    for (let idx = 0; idx < 地图信息.格子数; idx += 1) {
      if (!是可作为基地候选(idx, 地图信息)) continue

      let 最短距离 = Infinity
      let 最远距离 = 0
      let 全部可达 = true
      for (const 距离表 of 距离列表) {
        const 距离 = 距离表[idx]
        if (!Number.isInteger(距离) || 距离 < 0) {
          全部可达 = false
          break
        }
        if (距离 < 最短距离) 最短距离 = 距离
        if (距离 > 最远距离) 最远距离 = 距离
      }

      if (!全部可达) continue
      候选列表.push({ 索引: idx, 最短距离, 最远距离 })
    }

    候选列表.sort((左, 右) => {
      if (左.最远距离 !== 右.最远距离) return 左.最远距离 - 右.最远距离
      if (左.最短距离 !== 右.最短距离) return 左.最短距离 - 右.最短距离
      return 左.索引 - 右.索引
    })
    return 候选列表
  }

  function 取得距离表(接触, 地图信息) {
    if (!Number.isInteger(接触?.索引) || !Number.isInteger(接触?.回合)) {
      return null
    }
    if (接触.索引 < 0 || 接触.索引 >= 地图信息.格子数 || 接触.回合 < 0) {
      return null
    }

    const 距离表 = Array(地图信息.格子数).fill(-1)
    const 队列 = [接触.索引]
    let 队列头 = 0
    距离表[接触.索引] = 0

    while (队列头 < 队列.length) {
      const 当前索引 = 队列[队列头]
      队列头 += 1
      const 当前距离 = 距离表[当前索引]
      if (当前距离 >= 接触.回合) continue

      for (const 相邻索引 of 取得相邻索引列表(当前索引)) {
        if (距离表[相邻索引] >= 0) continue
        if (状态.已知障碍物集合.has(相邻索引)) continue
        距离表[相邻索引] = 当前距离 + 1
        队列.push(相邻索引)
      }
    }

    return 距离表
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
        .map((接触) => `${接触.索引}:${接触.回合}`)
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

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 功能恢复, socket功能 })
