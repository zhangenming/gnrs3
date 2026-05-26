import { 功能已启用 } from '../功能状态.js'

export const 功能定义 = {
  id: '禁止滚轮缩放',
  名称: '禁止滚轮缩放',
  分类: '系统',
  描述: '锁住滚轮缩放，避免战斗中误触地图',
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭: 移除禁止滚轮缩放,
}

export const 主程序功能 = {
  id: 功能定义.id,
  启动({ 请求渲染 }) {
    安装禁止滚轮缩放(请求渲染)
  },
}

let 已安装 = false
let 滚轮处理函数 = null

export function 安装禁止滚轮缩放(请求渲染) {
  if (已安装) return
  已安装 = true
  滚轮处理函数 = (事件) => {
    if (!功能已启用('禁止滚轮缩放')) return
    if (!document.querySelector('#game-page #gameMap')) return
    事件.preventDefault()
    事件.stopImmediatePropagation()
    请求渲染()
  }
  window.addEventListener('wheel', 滚轮处理函数, {
    passive: false,
    capture: true,
  })
}

export function 移除禁止滚轮缩放() {
  if (!已安装 || !滚轮处理函数) return
  已安装 = false
  window.removeEventListener('wheel', 滚轮处理函数, { capture: true })
  滚轮处理函数 = null
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 功能恢复, 主程序功能 })
