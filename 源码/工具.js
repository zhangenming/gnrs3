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

export function 安装样式(样式ID, CSS文本) {
  if (!document.documentElement || document.getElementById(样式ID)) return
  const 样式 = document.createElement('style')
  样式.id = 样式ID
  样式.textContent = CSS文本.trim()
  document.documentElement.appendChild(样式)
}
