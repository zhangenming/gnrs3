// 功能目的:
// 记录玩家通过 socket 发出的移动、撤销和清空操作，用来在地图覆盖层上显示当前行动路线。
//
// 作用范围:
// 只维护本地移动队列，不拦截或改变真实出兵请求。
// 队列变化后会重算兵力分布着色，避免把已经规划为路径的地块继续标成可调用兵力。
import { 状态 } from '../状态.js'
import { 更新地图缓存和兵力分布 } from '../地图状态.js'

export function 记录移动操作(起点, 终点, 是否半兵, 攻击序号, 请求渲染) {
  if (
    !Number.isInteger(起点) ||
    !Number.isInteger(终点) ||
    起点 < 0 ||
    终点 < 0
  ) {
    return
  }

  const 移动 = {
    起点,
    终点,
    是否半兵: Boolean(是否半兵),
    攻击序号: Number.isInteger(攻击序号) ? 攻击序号 : null,
    记录时间: Date.now(),
  }
  状态.移动队列.push(移动)
  if (状态.移动队列.length > 200) 状态.移动队列.shift()
  重算兵力分布着色('记录移动操作')
  请求渲染()
}

export function 撤销移动操作(请求渲染) {
  状态.移动队列.pop()
  重算兵力分布着色('撤销移动操作')
  请求渲染()
}

export function 按攻击序号清理移动队列(攻击序号, 请求渲染) {
  if (!Number.isInteger(攻击序号)) return
  const 原长度 = 状态.移动队列.length
  if (!原长度) return

  状态.移动队列 = 状态.移动队列.filter((移动) => {
    return !Number.isInteger(移动.攻击序号) || 移动.攻击序号 > 攻击序号
  })

  if (状态.移动队列.length !== 原长度) {
    重算兵力分布着色('按攻击序号清理移动队列')
    请求渲染()
  }
}

export function 清空移动队列(来源, 请求渲染) {
  const 原长度 = 状态.移动队列.length
  状态.移动队列 = []
  if (原长度) 重算兵力分布着色(`清空移动队列:${来源 ?? '未知'}`)
  请求渲染()
}

function 重算兵力分布着色(来源事件) {
  if (!Array.isArray(状态.地图数组)) return
  更新地图缓存和兵力分布({ map: 状态.地图数组 }, 来源事件)
}
