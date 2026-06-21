// 功能目的:
// 在鼠标左上角显示大回合倒计时，避免战斗中错过全图兵力+1的时机。
//
// 作用范围:
// 只读取当前大回合倒计时并维护一个页面提示，不影响游戏数据和操作队列。
import { 样式编号, 回合结束提示层级 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import { 状态 } from '../状态.js'
import { 安装样式 as 注入样式 } from '../工具.js'

const 回合结束提示元素编号 = 'gio-turn-end-alert'
const 回合结束提示样式编号 = `${样式编号}-turn-end-alert`
const 警告turn数 = 10
const 紧急turn数 = 5
const 鼠标偏移像素 = 14

let 鼠标X = 24
let 鼠标Y = 24
let 已安装鼠标监听 = false
let 鼠标移动处理函数 = null

export const 功能定义 = {
  id: '回合结束提示',
  名称: '回合结束提示',
  分类: '战场面板',
  描述: '在鼠标旁提醒大回合结算临近',
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭: 清除回合结束提示,
}

export function 更新回合结束提示(倒计时) {
  if (!功能已启用('回合结束提示')) {
    清除回合结束提示()
    return
  }
  if (!document.body) return

  if (
    !状态.游戏进行中 ||
    !Number.isInteger(倒计时) ||
    !document.querySelector('#game-page #gameMap')
  ) {
    清除回合结束提示()
    return
  }

  安装样式()
  安装鼠标监听()
  const 元素 = 确保提示元素()
  if (!元素) return

  const 提示级别 = 取得提示级别(倒计时)
  const 签名 = `${倒计时}:${提示级别}`

  if (元素.dataset.gioTurnEndAlert !== 签名) {
    元素.textContent = String(倒计时)
    元素.dataset.gioTurnEndAlert = 签名
  }

  元素.dataset.level = 提示级别
  元素.title =
    倒计时 === 0
      ? '大回合结算：所有位置兵力+1，塔和基地本回合共+2'
      : `距离大回合结算还剩 ${倒计时} turn`
  更新提示位置(元素)

  function 取得提示级别(倒计时) {
    if (倒计时 < 紧急turn数) return 'danger'
    if (倒计时 < 警告turn数) return 'warning'
    return 'normal'
  }

  function 确保提示元素() {
    let 元素 = document.getElementById(回合结束提示元素编号)
    if (!元素) {
      元素 = document.createElement('div')
      元素.id = 回合结束提示元素编号
      document.body.appendChild(元素)
    }
    return 元素
  }

  function 安装鼠标监听() {
    if (已安装鼠标监听) return
    已安装鼠标监听 = true
    鼠标移动处理函数 = (事件) => {
      鼠标X = 事件.clientX
      鼠标Y = 事件.clientY
      const 元素 = document.getElementById(回合结束提示元素编号)
      if (元素) 更新提示位置(元素)
    }
    window.addEventListener('pointermove', 鼠标移动处理函数, { passive: true })
  }

  function 更新提示位置(元素) {
    const 宽 = 元素.offsetWidth || 44
    const 高 = 元素.offsetHeight || 32
    const 左 = Math.max(4, 鼠标X - 宽 - 鼠标偏移像素)
    const 上 = Math.max(4, 鼠标Y - 高 - 鼠标偏移像素)
    元素.style.transform = `translate(${左}px, ${上}px)`
  }

  function 安装样式() {
    注入样式(
      回合结束提示样式编号,
      `
#${回合结束提示元素编号} {
    box-sizing: border-box;
    position: fixed;
    top: 0;
    left: 0;
    z-index: ${回合结束提示层级};
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
    height: 30px;
    padding: 0 8px;
    border: 1px solid rgba(255, 64, 64, 0.95);
    border-radius: 4px;
    background: rgba(16, 18, 22, 0.88);
    color: #ffffff;
    font: 900 18px/1 Arial, sans-serif;
    letter-spacing: 0;
    text-align: center;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.96);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.36);
    pointer-events: none;
    will-change: transform;
}
#${回合结束提示元素编号}[data-level='warning'] {
    background: rgba(214, 163, 0, 0.94);
    color: #fff4a8;
    border-color: rgba(255, 64, 64, 0.95);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.36), 0 0 12px rgba(255, 211, 0, 0.45);
}
#${回合结束提示元素编号}[data-level='danger'] {
    background: rgba(206, 23, 23, 0.96);
    color: #ffffff;
    border-color: rgba(255, 64, 64, 0.95);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4), 0 0 14px rgba(255, 35, 35, 0.58);
}`,
    )
  }
}

export function 清除回合结束提示() {
  document.getElementById(回合结束提示元素编号)?.remove()
  if (已安装鼠标监听 && 鼠标移动处理函数) {
    已安装鼠标监听 = false
    window.removeEventListener('pointermove', 鼠标移动处理函数)
    鼠标移动处理函数 = null
  }
}

window.addEventListener('gio-游戏进行中变化', 处理游戏进行中变化)

function 处理游戏进行中变化(事件) {
  if (事件.detail?.游戏进行中) return
  清除回合结束提示()
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 功能恢复 })
