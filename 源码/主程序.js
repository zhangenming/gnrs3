import { 状态 } from './状态.js'
import { 安全执行 } from './工具.js'
import { 更新战场塔信息 } from './功能/战场塔信息.js'
import { 更新战场数据差 } from './功能/战场数据差.js'
import { 暴露调试接口 } from './调试接口.js'
import { 安装原始兵力文本捕获 } from './功能/原始兵力文本.js'
import { 清空覆盖层, 同步自适应棋盘, 渲染 } from './覆盖层.js'
import { 更新大回合倒计时 } from './功能/大回合倒计时.js'
import { 挂钩socket } from './socket挂钩.js'
import { 安装结算回放快捷键, 同步结算回放元素 } from './功能/结算回放.js'
import { 更新空闲回合UI } from './功能/空闲回合.js'

function 请求渲染() {
  if (状态.已请求渲染) return
  状态.已请求渲染 = true
  requestAnimationFrame(() => {
    安全执行('渲染', 渲染)
  })
}

function 启动() {
  暴露调试接口(请求渲染, 清空覆盖层)
  安装结算回放快捷键()
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
    状态.页面观察器 = new MutationObserver(() => {
      更新大回合倒计时()
      更新空闲回合UI()
      更新战场塔信息()
      更新战场数据差()
      同步结算回放元素()
      同步自适应棋盘()
      请求渲染()
    })
    状态.页面观察器.observe(document.body, {
      childList: true,
      subtree: true,
      zem: true,
    })

    window.addEventListener(
      'resize',
      () => {
        同步自适应棋盘()
        请求渲染()
      },
      { passive: true },
    )
    window.addEventListener('wheel', 请求渲染, {
      passive: true,
      capture: true,
    })
    window.addEventListener('mousemove', 请求渲染, {
      passive: true,
      capture: true,
    })
    window.addEventListener('keydown', 请求渲染, {
      passive: true,
      capture: true,
    })
    window.addEventListener('resize', 更新大回合倒计时, { passive: true })
    window.addEventListener('resize', 同步结算回放元素, { passive: true })
  }
}

安全执行('启动', 启动)
安全执行('原始兵力文本捕获', () => {
  安装原始兵力文本捕获(请求渲染)
})
