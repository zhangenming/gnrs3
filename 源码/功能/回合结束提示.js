// 功能目的:
// 在大回合快结束时显示醒目的固定提示，避免战斗中错过全图兵力+1的时机。
//
// 作用范围:
// 只读取当前大回合倒计时并维护一个页面提示，不影响游戏数据和操作队列。
import { 样式编号 } from '../配置.js'

const 回合结束提示元素编号 = 'gio-turn-end-alert'
const 回合结束提示样式编号 = `${样式编号}-turn-end-alert`
const 提前提示turn数 = 20
const 紧急提示turn数 = 6

export function 更新回合结束提示(倒计时) {
  if (!document.body) return

  if (
    !Number.isInteger(倒计时) ||
    倒计时 >= 提前提示turn数 ||
    !document.querySelector('#game-page #gameMap')
  ) {
    清除回合结束提示()
    return
  }

  安装样式()
  const 元素 = 确保提示元素()
  if (!元素) return

  const 是结算回合 = 倒计时 === 0
  const 是紧急 = 倒计时 <= 紧急提示turn数
  const 主文本 = 是结算回合 ? '大回合结算' : '大回合快结束'
  const 数字文本 = 是结算回合 ? '+1' : 格式化剩余回合(倒计时)
  const 单位文本 = 是结算回合 ? '全图' : '回合'
  const 签名 = `${主文本}:${数字文本}:${单位文本}:${是紧急}`

  if (元素.dataset.gioTurnEndAlert !== 签名) {
    元素.innerHTML =
      `<span class="gio-turn-end-alert-label">${主文本}</span>` +
      `<span class="gio-turn-end-alert-count">${数字文本}</span>` +
      `<span class="gio-turn-end-alert-unit">${单位文本}</span>`
    元素.dataset.gioTurnEndAlert = 签名
  }

  元素.classList.toggle('gio-turn-end-alert-urgent', 是紧急)
  元素.title = 是结算回合
    ? '大回合结算：所有位置兵力+1，塔和基地本回合共+2'
    : `距离大回合结算还剩 ${数字文本} 回合（${倒计时} turn）`

  function 格式化剩余回合(倒计时) {
    const 剩余回合 = 倒计时 / 2
    return Number.isInteger(剩余回合) ? String(剩余回合) : 剩余回合.toFixed(1)
  }

  function 清除回合结束提示() {
    document.getElementById(回合结束提示元素编号)?.remove()
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

  function 安装样式() {
    if (!document.documentElement) return
    if (document.getElementById(回合结束提示样式编号)) return

    const 样式 = document.createElement('style')
    样式.id = 回合结束提示样式编号
    样式.textContent = `
#${回合结束提示元素编号} {
    box-sizing: border-box;
    position: fixed;
    top: 10px;
    right: 12px;
    z-index: 2147483201;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: min(340px, calc(100vw - 24px));
    min-height: 44px;
    padding: 6px 12px;
    border: 2px solid rgba(255, 255, 255, 0.96);
    border-radius: 6px;
    background: linear-gradient(90deg, #8f3200, #d86c00 52%, #ffbd3a);
    color: #ffffff;
    font: 900 16px/1 Arial, sans-serif;
    letter-spacing: 0;
    text-align: center;
    text-shadow: 0 2px 3px rgba(0, 0, 0, 0.88);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.42), 0 0 18px rgba(255, 135, 0, 0.72);
    pointer-events: none;
    animation: gio-turn-end-alert-pulse 820ms ease-in-out infinite;
}
body:has(#game-page #gameMap.gio-adaptive-map) #${回合结束提示元素编号} {
    top: max(8px, calc(var(--gio-battle-panel-top, 64px) - 50px));
    right: auto;
    left: var(--gio-battle-panel-left, 12px);
    width: min(340px, max(220px, var(--gio-battle-panel-width, 340px)));
    max-width: calc(100vw - var(--gio-battle-panel-left, 12px) - 8px);
}
#${回合结束提示元素编号}.gio-turn-end-alert-urgent {
    background: linear-gradient(90deg, #7f0000, #e00000 54%, #ff4a2c);
    box-shadow: 0 8px 26px rgba(0, 0, 0, 0.48), 0 0 24px rgba(255, 0, 0, 0.86);
    animation-duration: 460ms;
}
.gio-turn-end-alert-label,
.gio-turn-end-alert-unit {
    flex: 0 1 auto;
    min-width: 0;
    white-space: nowrap;
}
.gio-turn-end-alert-count {
    flex: 0 0 auto;
    min-width: 42px;
    font: 900 30px/0.9 Arial, sans-serif;
}
.gio-turn-end-alert-unit {
    font-size: 13px;
}
@keyframes gio-turn-end-alert-pulse {
    0%, 100% { transform: scale(1); filter: brightness(1); }
    50% { transform: scale(1.045); filter: brightness(1.16); }
}
`.trim()
    document.documentElement.appendChild(样式)
  }
}
