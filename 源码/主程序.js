import { 状态 } from './状态.js'
import { 安全执行, 安装样式 } from './工具.js'
import { 暴露调试接口 } from './调试接口.js'
import { 清空覆盖层, 渲染 } from './覆盖层.js'
import { 挂钩socket } from './socket挂钩.js'
import { 安装功能控制UI } from './功能控制面板.js'
import { 安装功能恢复 } from './功能恢复.js'
import { 初始化功能开关 } from './功能开关.js'
import { 主程序功能列表, 功能样式列表 } from './功能注册.js'

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
  安装注入成功样式()
  安装功能样式()
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
      const 观察结果 = 取得页面变化同步原因(变动列表)
      记录页面观察(观察结果, 变动列表)
      if (观察结果.需要同步) 请求页面同步(观察结果.原因)
    })
    状态.页面观察器.observe(document.body, {
      childList: true,
      subtree: true,
      zem: true,
    })
    标记注入成功按钮()

    window.addEventListener(
      'resize',
      () => {
        执行主程序Hook('窗口尺寸变化')
        请求渲染()
      },
      { passive: true },
    )

    function 请求页面同步(原因) {
      if (已请求页面同步) return
      已请求页面同步 = true
      requestAnimationFrame(() => {
        const 开始时间 = performance.now()
        已请求页面同步 = false
        状态.页面同步中 = true
        try {
          const 在主页面 = Boolean(document.querySelector('#main-menu'))
          if (在主页面 !== 状态.在主页面) {
            状态.在主页面 = 在主页面
            if (在主页面) {
              document.body.classList.add('gio-离开游戏')
              清理游戏页面状态()
              清空覆盖层()
            } else {
              document.body.classList.remove('gio-离开游戏')
              清除插件内联隐藏()
            }
          }
          if (在主页面) 标记注入成功按钮()
          if (!在主页面) {
            执行主程序Hook('页面同步')
            请求渲染()
          }
        } finally {
          记录页面同步(开始时间, 原因)
          状态.页面同步中 = false
        }
      })
    }

    function 取得页面变化同步原因(变动列表) {
      let 原因 = null
      return 变动列表.some((变动) => {
        const 变动节点列表 = [...变动.addedNodes, ...变动.removedNodes]
        if (变动节点列表.length) {
          if (变动节点列表.some(节点需要同步)) {
            原因 = '节点变化'
            return true
          }
          if (变动节点列表.every(节点属于插件)) return false
        }
        if (节点需要同步(变动.target)) {
          原因 = '目标变化'
          return true
        }
        return false
      })
        ? { 需要同步: true, 原因 }
        : { 需要同步: false, 原因: null }
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
            '#main-menu',
            '.game-map-canvas',
            '#game-leaderboard-container',
            '#game-pass-turn-button',
          ].join(','),
        ),
      )
    }

    function 记录页面观察(观察结果, 变动列表) {
      const 旧记录 = 状态.性能诊断.页面观察
      const 新记录 = 旧记录 ?? {
        回调次数: 0,
        同步请求次数: 0,
        变动总数: 0,
      }
      状态.性能诊断.页面观察 = {
        ...新记录,
        回调次数: 新记录.回调次数 + 1,
        同步请求次数: 新记录.同步请求次数 + (观察结果.需要同步 ? 1 : 0),
        变动总数: 新记录.变动总数 + 变动列表.length,
        最近变动数: 变动列表.length,
        最近需要同步: 观察结果.需要同步,
        最近原因: 观察结果.原因,
        回合: 状态.当前回合,
        时间: Math.round(performance.now()),
      }
    }

    function 记录页面同步(开始时间, 原因) {
      const 旧记录 = 状态.性能诊断.页面同步
      const 次数 = (旧记录?.次数 ?? 0) + 1
      状态.性能诊断.页面同步 = {
        次数,
        原因,
        耗时: Math.round((performance.now() - 开始时间) * 100) / 100,
        回合: 状态.当前回合,
        时间: Math.round(开始时间),
      }
    }
  }
}

function 安装注入成功样式() {
  安装样式(
    'gio-注入成功样式',
    `
    .gio-注入成功按钮 {
      background: #00d5d5 !important;
    }
  `,
  )
}

function 安装功能样式() {
  安装样式('gio-功能样式', 功能样式列表.join('\n'))
}

function 标记注入成功按钮() {
  const 主菜单 = document.querySelector('#main-menu')
  if (!主菜单) return
  for (const 元素 of 主菜单.querySelectorAll('button, input, .button')) {
    const 文本 = 元素.value || 元素.textContent || ''
    if (!['开始游戏', 'Play'].includes(文本.trim())) continue
    元素.classList.add('gio-注入成功按钮')
  }
}

function 清除插件内联隐藏() {
  document.querySelectorAll('[id^="gio-"]').forEach((元素) => {
    if (元素.style.display === 'none') 元素.style.display = ''
  })
}

function 清理游戏页面状态() {
  for (const 类名 of Array.from(document.documentElement.classList)) {
    if (类名.startsWith('gio-')) document.documentElement.classList.remove(类名)
  }
  for (const 类名 of Array.from(document.body.classList)) {
    if (类名.startsWith('gio-') && 类名 !== 'gio-离开游戏') {
      document.body.classList.remove(类名)
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
