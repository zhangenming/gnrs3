import { 功能已启用 } from '../功能状态.js'
import { 注册功能 } from '../注册中心.js'

export const 功能定义 = {
  id: '自动隐藏回放控制',
  名称: '自动隐藏回放控制',
  分类: '系统',
  描述: '进入回放时自动隐藏控制和广告',
}

export const 主程序功能 = {
  id: 功能定义.id,
  启动: 安装自动隐藏回放控制,
}

let 回放隐藏观察器 = null
let 已隐藏控制回放键 = ''
let 已请求隐藏检查 = false

function 安装自动隐藏回放控制() {
  if (回放隐藏观察器) return
  if (!document.body) {
    window.setTimeout(安装自动隐藏回放控制, 100)
    return
  }

  回放隐藏观察器 = new MutationObserver(请求隐藏检查)
  回放隐藏观察器.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    zem: true,
  })
  请求隐藏检查()

  function 请求隐藏检查() {
    if (已请求隐藏检查) return
    已请求隐藏检查 = true
    window.requestAnimationFrame(() => {
      已请求隐藏检查 = false
      尝试隐藏回放控制()
    })
  }

  function 尝试隐藏回放控制() {
    if (!功能已启用(功能定义.id)) return
    if (!是网页回放中()) {
      已隐藏控制回放键 = ''
      return
    }

    自动隐藏控制按钮()
    自动隐藏广告按钮()

    function 自动隐藏控制按钮() {
      const 回放键 = 读取回放键()
      if (已隐藏控制回放键 === 回放键) return

      const 按钮 = document.getElementById('hide-controls-button')
      if (!(按钮 instanceof HTMLButtonElement)) return
      if (按钮.textContent?.trim() !== 'Hide') {
        已隐藏控制回放键 = 回放键
        return
      }

      已隐藏控制回放键 = 回放键
      按钮.click()
    }

    function 自动隐藏广告按钮() {
      for (const 按钮 of document.querySelectorAll('button')) {
        if (!(按钮 instanceof HTMLButtonElement)) continue
        if (按钮.textContent?.trim() !== 'Hide ad') continue
        按钮.click()
      }
    }

    function 读取回放键() {
      return `${globalThis.location?.pathname ?? ''}${globalThis.location?.search ?? ''}`
    }

    function 是网页回放中() {
      return Boolean(
        globalThis.location?.pathname?.startsWith('/replays/') ||
        document.getElementById('replay-turn-jump-input'),
      )
    }
  }
}

注册功能({ 功能定义, 主程序功能 })
