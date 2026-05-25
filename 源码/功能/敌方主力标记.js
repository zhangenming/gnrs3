import { 是我方或队友 } from '../游戏.js'
import { 状态 } from '../状态.js'

export function 更新敌方最强兵力位置() {
  const 地图数组 = 状态.地图数组
  if (!Array.isArray(地图数组) || !状态.宽度 || !状态.高度) return
  if (!Number.isInteger(状态.我方索引)) return

  const 格子数 = 状态.宽度 * 状态.高度
  if (地图数组.length < 2 + 格子数 * 2) return

  const 归属偏移 = 2 + 格子数
  let 本次最强 = null
  for (let idx = 0; idx < 格子数; idx += 1) {
    const 兵力 = 地图数组[2 + idx]
    const 归属 = 地图数组[归属偏移 + idx]
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
