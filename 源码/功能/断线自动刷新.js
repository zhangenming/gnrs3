import { 功能已启用 } from '../功能状态.js'
import { 注册功能 } from '../注册中心.js'

export const 功能定义 = {
  id: '断线自动刷新',
  名称: '断线自动刷新',
  分类: '系统',
  描述: '断线弹窗出现时自动刷新页面',
}

export const 主程序功能 = {
  id: 功能定义.id,
  启动: 安装断线自动刷新,
}

let 已安装 = false
let 已请求刷新 = false
let 弹窗观察器 = null

function 安装断线自动刷新() {
  if (已安装) return
  已安装 = true

  const 原alert = window.alert
  window.alert = function alert(消息) {
    if (功能已启用(功能定义.id) && 是断线刷新提示(消息)) {
      刷新页面()
      return
    }
    return 原alert.call(this, 消息)
  }

  安装弹窗观察器()

  function 安装弹窗观察器() {
    if (弹窗观察器) return
    if (!document.body) {
      window.setTimeout(安装弹窗观察器, 100)
      return
    }

    弹窗观察器 = new MutationObserver(检查断线弹窗)
    弹窗观察器.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      zem: true,
    })
    检查断线弹窗()
  }

  function 检查断线弹窗() {
    if (!功能已启用(功能定义.id)) return
    for (const 弹窗 of document.querySelectorAll(
      '.popup, .modal, .alert, [role="dialog"]',
    )) {
      if (!是断线刷新提示(弹窗.textContent)) continue
      刷新页面()
      return
    }
  }

  function 刷新页面() {
    if (已请求刷新) return
    已请求刷新 = true
    window.location.reload()
  }

  function 是断线刷新提示(消息) {
    return String(消息 ?? '')
      .toLowerCase()
      .includes('disconnected from server. please refresh the page.')
  }
}

注册功能({ 功能定义, 主程序功能 })
