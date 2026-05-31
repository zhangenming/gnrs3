import { 状态 } from '../状态.js'
import {
  取得地图格子数,
  取得本次塔列表,
  地图可读,
  读取地图归属,
} from '../游戏.js'
import { 是阻挡地形 } from '../游戏工具.js'

export const 功能定义 = {
  id: '障碍物标记',
  名称: '障碍物标记',
  分类: '地图覆盖',
  描述: '补出已知障碍物和未探索黑块标记',
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭后需要清空覆盖层: true,
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置() {
    状态.已知障碍物集合.clear()
    状态.不可达区域集合.clear()
  },
}

export const 地图更新功能 = {
  id: 功能定义.id,
  地图更新({ 数据包 }) {
    记录已知障碍物(数据包)
  },
}

export const 覆盖层功能 = {
  id: 功能定义.id,
  层级: -100,
  需要绘制() {
    return 状态.已知障碍物集合.size > 0
  },
  绘制: 画障碍物底色,
}

const 障碍物文字覆盖层功能 = {
  id: 功能定义.id,
  层级: 100,
  需要绘制() {
    return 状态.已知障碍物集合.size > 0
  },
  绘制: 画障碍物文字,
}

export function 画障碍物底色({ ctx, 格宽, 格高, 大小 }) {
  if (!状态.已知障碍物集合.size) return

  const 格子数 = 状态.宽度 * 状态.高度
  const 地图数组 = 状态.地图数组
  const 边框宽度 = Math.max(2, Math.min(3, 大小 * 0.08))
  const 圆角半径 = 边框宽度 * 1.1
  const 确认山交点集合 = new Set()

  ctx.save()
  ctx.fillStyle = '#000000'
  状态.已知障碍物集合.forEach((障碍物索引) => {
    const 当前地形 = 读取地图归属(地图数组, 障碍物索引)
    const 是不可达区域 = 状态.不可达区域集合.has(障碍物索引)
    if (
      !Number.isInteger(障碍物索引) ||
      障碍物索引 < 0 ||
      障碍物索引 >= 格子数 ||
      状态.已知塔集合.has(障碍物索引)
    ) {
      return
    }
    if (地图可读(地图数组)) {
      if (Number.isInteger(当前地形) && 当前地形 >= -1 && !是不可达区域) return
    }
    const 行 = Math.floor(障碍物索引 / 状态.宽度)
    const 列 = 障碍物索引 % 状态.宽度
    const x = 列 * 格宽
    const y = 行 * 格高
    ctx.fillStyle = '#000000'
    ctx.fillRect(x, y, 格宽, 格高)
    if (是确认山(障碍物索引)) {
      记录确认山交点(行, 列)
      画山边框(障碍物索引, 行, 列, x, y)
    }
  })
  画确认山交点连接()
  ctx.restore()

  function 是确认山(索引) {
    return (
      状态.已知障碍物集合.has(索引) &&
      (状态.已确认视野集合.has(索引) || 状态.不可达区域集合.has(索引)) &&
      !状态.已知塔集合.has(索引)
    )
  }

  function 记录确认山交点(行, 列) {
    确认山交点集合.add(`${行},${列}`)
    确认山交点集合.add(`${行},${列 + 1}`)
    确认山交点集合.add(`${行 + 1},${列}`)
    确认山交点集合.add(`${行 + 1},${列 + 1}`)
  }

  function 画确认山交点连接() {
    ctx.fillStyle = '#ffd84d'
    确认山交点集合.forEach((交点键) => {
      const 分隔位置 = 交点键.indexOf(',')
      const 行 = Number.parseInt(交点键.slice(0, 分隔位置), 10)
      const 列 = Number.parseInt(交点键.slice(分隔位置 + 1), 10)
      if (取得交点周围确认山数量(行, 列) < 2) return
      if (是纯对角山交点(行, 列)) return
      画圆角连接(列 * 格宽, 行 * 格高)
    })
  }

  function 取得交点周围确认山数量(交点行, 交点列) {
    let 数量 = 0
    for (let 行偏移 = -1; 行偏移 <= 0; 行偏移 += 1) {
      const 山行 = 交点行 + 行偏移
      if (山行 < 0 || 山行 >= 状态.高度) continue
      for (let 列偏移 = -1; 列偏移 <= 0; 列偏移 += 1) {
        const 山列 = 交点列 + 列偏移
        if (山列 < 0 || 山列 >= 状态.宽度) continue
        if (是确认山(山行 * 状态.宽度 + 山列)) 数量 += 1
      }
    }
    return 数量
  }

  function 是纯对角山交点(交点行, 交点列) {
    const 左上 = 是交点旁确认山(交点行 - 1, 交点列 - 1)
    const 右上 = 是交点旁确认山(交点行 - 1, 交点列)
    const 左下 = 是交点旁确认山(交点行, 交点列 - 1)
    const 右下 = 是交点旁确认山(交点行, 交点列)
    return (左上 && 右下 && !右上 && !左下) || (右上 && 左下 && !左上 && !右下)
  }

  function 是交点旁确认山(行, 列) {
    if (行 < 0 || 行 >= 状态.高度 || 列 < 0 || 列 >= 状态.宽度) return false
    return 是确认山(行 * 状态.宽度 + 列)
  }

  function 画山边框(索引, 行, 列, x, y) {
    ctx.fillStyle = '#ffd84d'
    const 有上边 = 行 === 0 || !是确认山(索引 - 状态.宽度)
    const 有下边 = 行 === 状态.高度 - 1 || !是确认山(索引 + 状态.宽度)
    const 有左边 = 列 === 0 || !是确认山(索引 - 1)
    const 有右边 = 列 === 状态.宽度 - 1 || !是确认山(索引 + 1)

    if (有上边) {
      ctx.fillRect(x, y, 格宽, 边框宽度)
    }
    if (有下边) {
      ctx.fillRect(x, y + 格高 - 边框宽度, 格宽, 边框宽度)
    }
    if (有左边) {
      ctx.fillRect(x, y, 边框宽度, 格高)
    }
    if (有右边) {
      ctx.fillRect(x + 格宽 - 边框宽度, y, 边框宽度, 格高)
    }

    画对角山连接(索引, 行, 列, x, y)
  }

  function 画圆角连接(x, y) {
    ctx.save()
    ctx.beginPath()
    添加圆角裁剪区域(x, y)
    ctx.clip()
    ctx.beginPath()
    ctx.arc(x, y, 圆角半径, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  function 添加圆角裁剪区域(x, y) {
    const 交点行 = Math.round(y / 格高)
    const 交点列 = Math.round(x / 格宽)
    for (let 行偏移 = -1; 行偏移 <= 0; 行偏移 += 1) {
      const 山行 = 交点行 + 行偏移
      if (山行 < 0 || 山行 >= 状态.高度) continue
      for (let 列偏移 = -1; 列偏移 <= 0; 列偏移 += 1) {
        const 山列 = 交点列 + 列偏移
        if (山列 < 0 || 山列 >= 状态.宽度) continue
        const 山索引 = 山行 * 状态.宽度 + 山列
        if (是确认山(山索引)) {
          ctx.rect(山列 * 格宽, 山行 * 格高, 格宽, 格高)
        }
      }
    }
  }

  function 画对角山连接(索引, 行, 列, x, y) {
    ctx.fillStyle = '#ffd84d'
    if (
      行 < 状态.高度 - 1 &&
      列 < 状态.宽度 - 1 &&
      是确认山(索引 + 状态.宽度 + 1) &&
      !是确认山(索引 + 1) &&
      !是确认山(索引 + 状态.宽度)
    ) {
      画对角顺滑连接(x + 格宽, y + 格高, '左上右下')
    }
    if (
      行 < 状态.高度 - 1 &&
      列 > 0 &&
      是确认山(索引 + 状态.宽度 - 1) &&
      !是确认山(索引 - 1) &&
      !是确认山(索引 + 状态.宽度)
    ) {
      画对角顺滑连接(x, y + 格高, '右上左下')
    }
  }

  function 画对角顺滑连接(x, y, 方向) {
    const 弧长 = Math.max(边框宽度 * 3.8, Math.min(格宽, 格高) * 0.18)
    const 线宽 = 边框宽度 * 1.75
    const 黑线长 = 弧长 * 0.95
    const 黑线宽 = Math.max(1.5, 边框宽度 * 0.9)
    ctx.save()
    ctx.lineWidth = 线宽
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#ffd84d'
    ctx.fillStyle = '#ffd84d'

    ctx.beginPath()
    ctx.arc(x, y, 线宽 * 0.72, 0, Math.PI * 2)
    ctx.fill()

    if (方向 === '左上右下') {
      画弧线(x - 弧长, y, x, y - 弧长, x + 弧长, y + 弧长)
      画弧线(x, y + 弧长, x + 弧长, y, x - 弧长, y - 弧长)
    } else {
      画弧线(x, y - 弧长, x + 弧长, y, x - 弧长, y + 弧长)
      画弧线(x - 弧长, y, x, y + 弧长, x + 弧长, y - 弧长)
    }

    ctx.lineWidth = 黑线宽
    ctx.strokeStyle = '#000000'
    ctx.beginPath()
    if (方向 === '左上右下') {
      ctx.moveTo(x - 黑线长, y - 黑线长)
      ctx.lineTo(x + 黑线长, y + 黑线长)
    } else {
      ctx.moveTo(x + 黑线长, y - 黑线长)
      ctx.lineTo(x - 黑线长, y + 黑线长)
    }
    ctx.stroke()
    ctx.restore()

    function 画弧线(起点x, 起点y, 终点x, 终点y, 控制x, 控制y) {
      ctx.beginPath()
      ctx.moveTo(起点x, 起点y)
      ctx.quadraticCurveTo(控制x, 控制y, 终点x, 终点y)
      ctx.stroke()
    }
  }
}

function 画障碍物文字({ ctx, 格宽, 格高, 大小 }) {
  if (!状态.已知障碍物集合.size) return

  const 格子数 = 状态.宽度 * 状态.高度
  const 地图数组 = 状态.地图数组

  ctx.save()
  状态.已知障碍物集合.forEach((障碍物索引) => {
    const 当前地形 = 读取地图归属(地图数组, 障碍物索引)
    if (
      !Number.isInteger(障碍物索引) ||
      障碍物索引 < 0 ||
      障碍物索引 >= 格子数 ||
      状态.已知塔集合.has(障碍物索引) ||
      状态.不可达区域集合.has(障碍物索引) ||
      状态.已确认视野集合.has(障碍物索引)
    ) {
      return
    }
    if (地图可读(地图数组)) {
      if (Number.isInteger(当前地形) && 当前地形 >= -1) return
    }
    const 行 = Math.floor(障碍物索引 / 状态.宽度)
    const 列 = 障碍物索引 % 状态.宽度
    const x = 列 * 格宽
    const y = 行 * 格高
    画未知阻挡物标记(x, y)
  })
  ctx.restore()

  function 画未知阻挡物标记(x, y) {
    ctx.save()
    const 文本 = '?'
    const 字号 = Math.max(14, Math.min(28, 大小 * 0.58))
    ctx.font = `900 ${字号}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(2, 大小 * 0.075)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'
    ctx.fillStyle = '#ffffff'
    ctx.strokeText(文本, x + 格宽 / 2, y + 格高 / 2)
    ctx.fillText(文本, x + 格宽 / 2, y + 格高 / 2)
    ctx.restore()
  }
}

export function 记录已知障碍物(数据包) {
  const 地图数组 = 状态.地图数组
  if (!地图可读(地图数组)) return

  const 格子数 = 取得地图格子数(地图数组)
  状态.不可达区域集合.forEach((索引) => {
    状态.已知障碍物集合.delete(索引)
  })
  状态.不可达区域集合.clear()

  const 塔索引集合 = new Set(状态.已知塔集合)
  const 当前塔信息 = 取得本次塔列表(数据包)
  if (Array.isArray(当前塔信息?.塔列表)) {
    当前塔信息.塔列表.forEach((塔索引) => {
      if (Number.isInteger(塔索引) && 塔索引 >= 0) 塔索引集合.add(塔索引)
    })
  }
  for (let idx = 0; idx < 格子数; idx += 1) {
    const 地形 = 地图数组[2 + 格子数 + idx]
    if (塔索引集合.has(idx)) {
      状态.已知障碍物集合.delete(idx)
    } else if (是阻挡地形(地形)) {
      状态.已知障碍物集合.add(idx)
    } else if (Number.isInteger(地形) && 地形 >= -1) {
      状态.已知障碍物集合.delete(idx)
    }
  }
  记录不可达区域()

  function 记录不可达区域() {
    const 已访问集合 = new Set()
    for (let idx = 0; idx < 格子数; idx += 1) {
      if (已访问集合.has(idx) || !是可标记不可达格(idx)) continue

      const 区域列表 = []
      const 队列 = [idx]
      let 队列头 = 0
      let 被确认山包围 = true
      已访问集合.add(idx)

      while (队列头 < 队列.length) {
        const 当前索引 = 队列[队列头]
        队列头 += 1
        区域列表.push(当前索引)

        检查相邻(当前索引, -1, 0)
        检查相邻(当前索引, 1, 0)
        检查相邻(当前索引, 0, -1)
        检查相邻(当前索引, 0, 1)
      }

      if (!被确认山包围) continue
      区域列表.forEach((区域索引) => {
        状态.不可达区域集合.add(区域索引)
        状态.已知障碍物集合.add(区域索引)
      })

      function 检查相邻(当前索引, 行偏移, 列偏移) {
        const 相邻索引 = 取得相邻索引(当前索引, 行偏移, 列偏移)
        if (!Number.isInteger(相邻索引)) {
          被确认山包围 = false
          return
        }
        if (是可标记不可达格(相邻索引)) {
          if (!已访问集合.has(相邻索引)) {
            已访问集合.add(相邻索引)
            队列.push(相邻索引)
          }
        } else if (!是确认阻挡山(相邻索引)) {
          被确认山包围 = false
        }
      }
    }
  }

  function 是可标记不可达格(索引) {
    if (状态.已知障碍物集合.has(索引)) return false
    if (塔索引集合.has(索引)) return false
    if (状态.已知基地集合.has(索引)) return false
    if (状态.已知敌方基地集合.has(索引)) return false
    return 读取地图归属(地图数组, 索引) === -1
  }

  function 是确认阻挡山(索引) {
    return (
      状态.已知障碍物集合.has(索引) &&
      状态.已确认视野集合.has(索引) &&
      !塔索引集合.has(索引)
    )
  }

  function 取得相邻索引(索引, 行偏移, 列偏移) {
    const 行 = Math.floor(索引 / 状态.宽度) + 行偏移
    const 列 = (索引 % 状态.宽度) + 列偏移
    if (行 < 0 || 行 >= 状态.高度 || 列 < 0 || 列 >= 状态.宽度) return null
    return 行 * 状态.宽度 + 列
  }
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 功能恢复, socket功能, 覆盖层功能, 地图更新功能 })
注册功能({ 覆盖层功能: 障碍物文字覆盖层功能 })
