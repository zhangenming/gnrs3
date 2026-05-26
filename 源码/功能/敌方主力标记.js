import { 地图可读, 是我方或队友, 读取地图地块 } from '../游戏.js'
import { 功能已启用 } from '../功能状态.js'
import { 状态 } from '../状态.js'

export const 功能定义 = {
  id: '敌方主力标记',
  名称: '敌方主力标记',
  分类: '地图覆盖',
  描述: '标记可见敌方最大兵力所在位置',
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭: 重置敌方最强兵力位置,
  关闭后需要清空覆盖层: true,
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置: 重置敌方最强兵力位置,
}

export const 地图更新功能 = {
  id: 功能定义.id,
  地图更新: 更新敌方最强兵力位置,
}

export const 覆盖层功能 = {
  id: 功能定义.id,
  需要绘制() {
    return Boolean(状态.敌方最强兵力位置)
  },
  绘制: 画敌方最强兵力标记,
}

export function 更新敌方最强兵力位置() {
  if (!功能已启用('敌方主力标记')) {
    状态.敌方最强兵力位置 = null
    return
  }
  const 地图数组 = 状态.地图数组
  if (!地图可读(地图数组)) return
  if (!Number.isInteger(状态.我方索引)) return

  const 格子数 = 状态.宽度 * 状态.高度

  let 本次最强 = null
  for (let idx = 0; idx < 格子数; idx += 1) {
    const 地块 = 读取地图地块(地图数组, idx)
    const 兵力 = 地块?.兵力
    const 归属 = 地块?.归属
    if (
      !Number.isInteger(兵力) ||
      兵力 <= 0 ||
      !Number.isInteger(归属) ||
      归属 < 0 ||
      是我方或队友(归属)
    ) {
      continue
    }

    if (
      !本次最强 ||
      兵力 > 本次最强.兵力 ||
      (兵力 === 本次最强.兵力 && idx < 本次最强.索引)
    ) {
      本次最强 = { 索引: idx, 兵力, 归属 }
    }
  }

  if (!本次最强) return

  const 旧记录 = 状态.敌方最强兵力位置
  if (旧记录 && Number.isInteger(旧记录.兵力) && 旧记录.兵力 >= 本次最强.兵力) {
    return
  }

  状态.敌方最强兵力位置 = {
    索引: Number.isInteger(旧记录?.索引) ? 旧记录.索引 : 本次最强.索引,
    兵力: 本次最强.兵力,
    归属: 本次最强.归属,
    回合: Number.isInteger(状态.当前回合) ? 状态.当前回合 : null,
  }
}

export function 重置敌方最强兵力位置() {
  状态.敌方最强兵力位置 = null
}

function 画敌方最强兵力标记({ ctx, 格宽, 格高, 大小 }) {
  const 记录 = 状态.敌方最强兵力位置
  const 格子数 = 状态.宽度 * 状态.高度
  if (!记录 || !Number.isInteger(记录.索引)) return
  if (记录.索引 < 0 || 记录.索引 >= 格子数) return

  const 行 = Math.floor(记录.索引 / 状态.宽度)
  const 列 = 记录.索引 % 状态.宽度
  const 文本 = Number.isInteger(记录.兵力) ? String(记录.兵力) : ''
  const 半径 = Math.max(7, Math.min(14, 大小 * 0.28))
  const 边距 = Math.max(2, 大小 * 0.08)
  const 中心x = 列 * 格宽 + 格宽 - 半径 - 边距
  const 中心y = 行 * 格高 + 格高 - 半径 - 边距

  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.62)'
  ctx.shadowBlur = Math.max(2, 大小 * 0.08)

  ctx.fillStyle = 'rgba(0, 0, 0, 0.84)'
  ctx.beginPath()
  ctx.arc(中心x, 中心y, 半径, 0, Math.PI * 2)
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.lineWidth = Math.max(1.5, 半径 * 0.18)
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()

  ctx.font = `700 ${Math.max(9, 半径 * 0.95)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = Math.max(2, 半径 * 0.2)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)'
  ctx.fillStyle = '#ffd84a'
  ctx.strokeText(文本, 中心x, 中心y + 半径 * 0.04)
  ctx.fillText(文本, 中心x, 中心y + 半径 * 0.04)
  ctx.restore()
}
