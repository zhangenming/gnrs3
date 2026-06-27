// 功能目的:
// 给战场表头和敌方开塔判断提供统一的 1v1 塔数口径。
import { 状态 } from '../状态.js'

export function 统计塔数() {
  const 当前塔数 = 统计当前塔数()
  const 我方开塔数 = 取得我方开塔数()
  const 敌方开塔数 = Math.max(
    状态.敌方开塔确认集合.size,
    Number.isInteger(状态.敌方开塔推断数) ? 状态.敌方开塔推断数 : 0,
    当前塔数.敌方塔数,
    0,
  )
  const 抢塔数 = 当前塔数.我方塔数 - 我方开塔数
  const 敌方塔数 = Math.max(当前塔数.敌方塔数, 敌方开塔数 - 抢塔数, 0)

  return {
    我方开塔数,
    敌方开塔数,
    抢塔数,
    我方塔数: 当前塔数.我方塔数,
    敌方塔数,
  }
}

export function 同步塔数统计() {
  const 塔数 = 统计塔数()
  状态.我方开塔数 = 塔数.我方开塔数
  状态.敌方开塔数 = 塔数.敌方开塔数
  状态.抢塔数 = 塔数.抢塔数
  return 塔数
}

export function 补齐未知开塔归属() {
  状态.已知塔类型.forEach((类型, 塔索引) => {
    if (状态.我方开塔集合.has(塔索引)) return
    if (状态.敌方开塔确认集合.has(塔索引)) return

    if (类型 === '我方塔') {
      状态.我方开塔集合.add(塔索引)
    } else if (类型 === '敌方塔') {
      状态.敌方开塔确认集合.add(塔索引)
    }
  })
}

function 统计当前塔数() {
  let 我方塔数 = 0
  let 敌方塔数 = 0
  状态.已知塔类型.forEach((类型) => {
    if (类型 === '我方塔') 我方塔数 += 1
    if (类型 === '敌方塔') 敌方塔数 += 1
  })

  return {
    我方塔数,
    敌方塔数,
  }
}

function 取得我方开塔数() {
  if (状态.我方开塔集合 instanceof Set) return 状态.我方开塔集合.size
  return Number.isInteger(状态.我方开塔数) ? 状态.我方开塔数 : 0
}
