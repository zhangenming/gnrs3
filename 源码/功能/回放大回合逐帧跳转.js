import { 大回合turn数 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import { 状态 } from '../状态.js'
import { 读取显示回合 } from './大回合倒计时.js'

export const 功能定义 = {
  id: '回放大回合逐帧跳转',
  名称: '回放大回合逐帧跳转',
  分类: '系统',
  描述: '回放 Shift+A/D 时逐帧单步到大回合',
}

export const 主程序功能 = {
  id: 功能定义.id,
  启动: 安装回放大回合逐帧跳转,
}

let 已安装 = false

function 安装回放大回合逐帧跳转() {
  if (已安装) return
  已安装 = true
  let 逐帧跳转令牌 = 0

  window.addEventListener('keydown', 处理回放大回合快捷键, {
    capture: true,
    passive: false,
  })

  function 处理回放大回合快捷键(事件) {
    if (!功能已启用(功能定义.id)) return
    if (!是网页回放中()) return
    if (是Shift按键(事件)) {
      事件.preventDefault()
      事件.stopImmediatePropagation()
      return
    }
    if (!事件.shiftKey) return
    if (事件.ctrlKey || 事件.altKey || 事件.metaKey) return

    const 方向 = 读取跳转方向(事件)
    if (!方向) return
    if (是输入元素(事件.target) && !是回放跳转输入(事件.target)) return

    事件.preventDefault()
    事件.stopImmediatePropagation()
    if (事件.repeat) return

    请求开始逐帧跳转(方向)
  }

  function 请求开始逐帧跳转(方向) {
    const 当前令牌 = ++逐帧跳转令牌
    let 等待帧数 = 0
    requestAnimationFrame(尝试开始)

    function 尝试开始() {
      if (当前令牌 !== 逐帧跳转令牌) return
      if (回放回合控件已就绪() && 开始逐帧跳转(方向, 当前令牌)) return
      等待帧数 += 1
      if (等待帧数 >= 30) return
      requestAnimationFrame(尝试开始)
    }
  }

  function 开始逐帧跳转(方向, 当前令牌) {
    const 起始回合 = 读取显示回合()
    if (!Number.isInteger(起始回合)) return false

    const 目标回合 = 取得目标大回合(起始回合, 方向)
    if (!Number.isInteger(目标回合) || 目标回合 === 起始回合) return true

    状态.当前回合 = 起始回合
    let 已单步次数 = 0
    const 按键 =
      方向 > 0 ? 取得按键('d', 'KeyD', 68) : 取得按键('a', 'KeyA', 65)
    requestAnimationFrame(逐帧单步)
    return true

    function 逐帧单步() {
      if (当前令牌 !== 逐帧跳转令牌) return

      const 当前回合 = 读取显示回合()
      if (!Number.isInteger(当前回合)) return
      状态.当前回合 = 当前回合
      if (方向 > 0 ? 当前回合 >= 目标回合 : 当前回合 <= 目标回合) return
      if (已单步次数 >= 大回合turn数) return

      已单步次数 += 1
      const 发送前回合 = 当前回合
      发送按键('keydown', 按键)
      等待回合同步后继续(发送前回合)
    }

    function 等待回合同步后继续(发送前回合) {
      let 等待帧数 = 0
      requestAnimationFrame(检查回合同步)

      function 检查回合同步() {
        if (当前令牌 !== 逐帧跳转令牌) return
        等待帧数 += 1

        const 当前回合 = 读取显示回合()
        if (Number.isInteger(当前回合) && 当前回合 !== 发送前回合) {
          状态.当前回合 = 当前回合
          requestAnimationFrame(逐帧单步)
          return
        }
        if (等待帧数 >= 30) return
        requestAnimationFrame(检查回合同步)
      }
    }
  }

  function 取得目标大回合(回合, 方向) {
    if (方向 > 0) {
      return Math.floor(回合 / 大回合turn数) * 大回合turn数 + 大回合turn数
    }
    if (回合 <= 0) return 0
    if (回合 % 大回合turn数 === 0) return 回合 - 大回合turn数
    return Math.floor(回合 / 大回合turn数) * 大回合turn数
  }

  function 读取跳转方向(事件) {
    if (事件.code === 'KeyA' || 事件.key?.toLowerCase() === 'a') return -1
    if (事件.code === 'KeyD' || 事件.key?.toLowerCase() === 'd') return 1
    return 0
  }

  function 是Shift按键(事件) {
    return 事件.key === 'Shift' || 事件.code === 'ShiftLeft'
  }

  function 发送按键(类型, 按键) {
    const 事件 = new KeyboardEvent(类型, {
      bubbles: true,
      cancelable: true,
      key: 按键.key,
      code: 按键.code,
    })
    Object.defineProperties(事件, {
      keyCode: { get: () => 按键.keyCode },
      which: { get: () => 按键.keyCode },
    })
    window.dispatchEvent(事件)
  }

  function 取得按键(key, code, keyCode) {
    return { key, code, keyCode }
  }

  function 是网页回放中() {
    return Boolean(
      globalThis.location?.pathname?.startsWith('/replays/') ||
      document.getElementById('replay-turn-jump-input'),
    )
  }

  function 回放回合控件已就绪() {
    return Boolean(
      document.getElementById('replay-turn-jump-input') ||
      document.getElementById('turn-counter'),
    )
  }

  function 是输入元素(目标) {
    const 元素 = 目标 instanceof Element ? 目标 : null
    return Boolean(
      元素?.closest?.('input, textarea, select, [contenteditable="true"]'),
    )
  }

  function 是回放跳转输入(目标) {
    const 元素 = 目标 instanceof Element ? 目标 : null
    return 元素?.id === 'replay-turn-jump-input'
  }
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 主程序功能 })
