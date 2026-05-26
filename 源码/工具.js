import { 大回合turn数 } from './配置.js'

export function 安全执行(事件, 函数体) {
  try {
    return 函数体()
  } catch (错误) {
    console.warn(`[安全执行] ${事件}:`, 错误)
    return null
  }
}

export function 取得大回合倒计时(回合) {
  if (!Number.isInteger(回合) || 回合 < 0) return null
  const 余数 = 回合 % 大回合turn数
  if (回合 > 0 && 余数 === 0) return 0
  return 大回合turn数 - 余数
}
