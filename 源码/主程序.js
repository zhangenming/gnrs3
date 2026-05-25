import { 状态 } from './状态.js'
import { 安全执行 } from './工具.js'
import { 更新战场塔信息 } from './功能/战场塔信息.js'
import { 更新战场数据差 } from './功能/战场数据差.js'
import { 暴露调试接口 } from './调试接口.js'
import { 安装原始兵力文本捕获 } from './功能/原始兵力文本.js'
import { 清空覆盖层, 同步自适应棋盘, 渲染 } from './覆盖层.js'
import { 更新大回合倒计时 } from './功能/大回合倒计时.js'
import { 挂钩socket } from './socket挂钩.js'
import { 安装回放快捷键, 同步回放元素 } from './功能/回放系统.js'
import { 更新我方行动监控UI } from './功能/我方行动监控.js'
import { 更新游戏数据进展图表 } from './功能/游戏数据进展图表.js'

let 已请求页面同步 = false

function 请求渲染() {
  if (状态.已请求渲染) return
  状态.已请求渲染 = true
  requestAnimationFrame(() => {
    安全执行('渲染', 渲染)
  })
}

function 启动() {
  暴露调试接口(请求渲染, 清空覆盖层)
  安装回放快捷键(请求渲染)
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
        状态.自适应棋盘待同步 = true
        同步自适应棋盘()
        请求渲染()
      },
      { passive: true },
    )
    window.addEventListener('wheel', 禁止滚轮缩放, {
      passive: false,
      capture: true,
    })
    window.addEventListener('resize', 更新大回合倒计时, { passive: true })
    window.addEventListener('resize', 更新游戏数据进展图表, { passive: true })
    window.addEventListener('resize', 同步回放元素, { passive: true })

    function 禁止滚轮缩放(事件) {
      if (!document.querySelector('#game-page #gameMap')) return
      事件.preventDefault()
      事件.stopImmediatePropagation()
      请求渲染()
    }

    function 请求页面同步() {
      if (已请求页面同步) return
      已请求页面同步 = true
      requestAnimationFrame(() => {
        已请求页面同步 = false
        状态.页面同步中 = true
        try {
          状态.自适应棋盘待同步 = true
          更新大回合倒计时()
          更新我方行动监控UI()
          更新战场塔信息()
          更新战场数据差()
          更新游戏数据进展图表()
          同步回放元素()
          同步自适应棋盘()
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

安全执行('启动', 启动)
安全执行('原始兵力文本捕获', () => {
  安装原始兵力文本捕获(请求渲染)
})
