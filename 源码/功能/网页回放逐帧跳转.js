import { 功能已启用 } from '../功能状态.js'

export const 功能定义 = {
  id: '网页回放逐帧跳转',
  名称: '网页回放逐帧跳转',
  分类: '系统',
  描述: 'Shift + 左右键逐帧播放 50 次',
}

export const 主程序功能 = {
  id: 功能定义.id,
  启动: 安装网页回放逐帧跳转,
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭: 移除网页回放逐帧跳转,
}

const 跳转步数 = 50
const 按键配置表 = {
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
}

let 已安装 = false
let 按键处理函数 = null
let 正在逐帧跳转 = false

export function 安装网页回放逐帧跳转() {
  if (已安装) return
  已安装 = true
  按键处理函数 = (事件) => {
    if (!功能已启用('网页回放逐帧跳转')) return
    if (!是网页回放页()) return
    if (事件.defaultPrevented || 是输入中(事件.target)) return
    if (!事件.shiftKey || !按键配置表[事件.key]) return

    事件.preventDefault()
    事件.stopImmediatePropagation()
    if (正在逐帧跳转) return

    void 逐帧模拟按键(事件.key)
  }
  window.addEventListener('keydown', 按键处理函数, {
    capture: true,
    passive: false,
  })

  function 是输入中(元素) {
    const 标签名 = 元素?.tagName?.toLowerCase()
    return (
      标签名 === 'input' ||
      标签名 === 'textarea' ||
      标签名 === 'select' ||
      元素?.isContentEditable === true
    )
  }
}

export function 移除网页回放逐帧跳转() {
  if (!已安装 || !按键处理函数) return
  已安装 = false
  window.removeEventListener('keydown', 按键处理函数, { capture: true })
  按键处理函数 = null
  正在逐帧跳转 = false
}

async function 逐帧模拟按键(key) {
  正在逐帧跳转 = true
  try {
    for (let idx = 0; idx < 跳转步数; idx += 1) {
      await 等待下一帧()
      if (!已安装 || !功能已启用('网页回放逐帧跳转') || !是网页回放页()) {
        return
      }
      派发方向键(key)
    }
  } finally {
    正在逐帧跳转 = false
  }

  function 派发方向键(key) {
    const 配置 = 按键配置表[key]
    const 目标 = 取得按键目标()
    const 事件 = new KeyboardEvent('keydown', {
      key: 配置.key,
      code: 配置.code,
      bubbles: true,
      cancelable: true,
      composed: true,
    })
    Object.defineProperties(事件, {
      keyCode: { value: 配置.keyCode },
      which: { value: 配置.keyCode },
    })
    目标.dispatchEvent(事件)
  }

  function 取得按键目标() {
    if (document.activeElement && document.activeElement !== document.body) {
      return document.activeElement
    }
    return document.body ?? document.documentElement ?? window
  }

  function 等待下一帧() {
    return new Promise((resolve) => {
      requestAnimationFrame(resolve)
    })
  }
}

function 是网页回放页() {
  return Boolean(
    globalThis.location?.pathname?.startsWith('/replays/') ||
    document.getElementById('replay-turn-jump-input'),
  )
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 主程序功能, 功能恢复 })
