import { 状态 } from './状态.js'
import { 安全执行 } from './工具.js'
import { 暴露调试接口 } from './调试接口.js'
import { 清空覆盖层, 渲染 } from './覆盖层.js'
import { 挂钩socket } from './socket挂钩.js'
import { 安装功能控制UI } from './功能控制面板.js'
import { 安装功能恢复 } from './功能恢复.js'
import { 初始化功能开关 } from './功能开关.js'
import { 主程序功能列表 } from './功能注册.js'

let 已请求页面同步 = false

function 请求渲染() {
  if (状态.已请求渲染) return
  状态.已请求渲染 = true
  requestAnimationFrame(() => {
    安全执行('渲染', 渲染)
  })
}

function 启动() {
  初始化功能开关()
  暴露调试接口(请求渲染, 清空覆盖层)
  安装功能控制UI()
  安装功能恢复()
  执行主程序Hook('启动')
  轮询socket()
  安装页面观察器()

  function 轮询socket() {
    if (window.socket) 挂钩socket(window.socket, 请求渲染)
    setTimeout(轮询socket, 状态.socket已挂钩 ? 2000 : 200)
  }

  function 安装页面观察器() {
    if (状态.页面观察器) return
    if (!document.body) {
      setTimeout(安装页面观察器, 100)
      return
    }
    状态.页面观察器 = new MutationObserver((变动列表) => {
      if (状态.页面同步中) return
      if (页面变化需要同步(变动列表)) 请求页面同步()
    })
    状态.页面观察器.observe(document.body, {
      childList: true,
      subtree: true,
      zem: true,
    })

    window.addEventListener(
      'resize',
      () => {
        执行主程序Hook('窗口尺寸变化')
        请求渲染()
      },
      { passive: true },
    )

    function 请求页面同步() {
      if (已请求页面同步) return
      已请求页面同步 = true
      requestAnimationFrame(() => {
        已请求页面同步 = false
        状态.页面同步中 = true
        try {
          执行主程序Hook('页面同步')
          请求渲染()
        } finally {
          状态.页面同步中 = false
        }
      })
    }

    function 页面变化需要同步(变动列表) {
      return 变动列表.some((变动) => {
        const 变动节点列表 = [...变动.addedNodes, ...变动.removedNodes]
        if (变动节点列表.length) {
          if (变动节点列表.some(节点需要同步)) return true
          if (变动节点列表.every(节点属于插件)) return false
        }
        return 节点需要同步(变动.target)
      })
    }

    function 节点需要同步(节点) {
      const 元素 = 取得元素节点(节点)
      if (!元素 || 是插件节点(元素)) return false
      if (是相关区域节点(元素)) return true
      return Array.from(元素.children ?? []).some((子元素) => {
        return !是插件节点(子元素) && 是相关区域节点(子元素)
      })
    }

    function 取得元素节点(节点) {
      if (节点 instanceof Element) return 节点
      return 节点?.parentElement ?? null
    }

    function 节点属于插件(节点) {
      const 元素 = 取得元素节点(节点)
      return Boolean(元素 && 是插件节点(元素))
    }

    function 是插件节点(元素) {
      if (!元素) return false
      if (typeof 元素.id === 'string' && 元素.id.startsWith('gio-')) return true
      return Array.from(元素.classList ?? []).some((类名) => {
        return 类名.startsWith('gio-')
      })
    }

    function 是相关区域节点(元素) {
      return Boolean(
        元素.matches?.(
          [
            '#game-page',
            '#game-page #gameMap',
            '#gameMap',
            '.game-map-canvas',
            '#game-leaderboard-container',
            '#game-leaderboard',
            '#leaderboard',
            '.leaderboard',
            '#game-pass-turn-button',
          ].join(','),
        ) ||
        元素.closest?.(
          [
            '#game-page',
            '#game-leaderboard-container',
            '#game-leaderboard',
            '#leaderboard',
            '.leaderboard',
          ].join(','),
        ),
      )
    }
  }
}

function 执行主程序Hook(hook名) {
  const 上下文 = { 请求渲染 }
  for (const 功能 of 主程序功能列表) {
    const hook = 功能?.[hook名]
    if (typeof hook !== 'function') continue
    安全执行(`${功能.id}${hook名}`, () => {
      hook(上下文)
    })
  }
}

安全执行('启动', 启动)
