import { 样式编号, 控制面板层级 } from './配置.js'
import {
  功能列表,
  监听功能变化,
  功能已启用,
  初始化功能开关,
  读取功能原始状态,
  设置全部功能开启,
  设置功能总开关,
  设置功能开启,
  统计已开启功能数,
  读取功能总开关,
} from './功能开关.js'
import { 状态 } from './状态.js'
import { 安装样式 as 注入样式 } from './工具.js'

const 控制按钮编号 = 'gio-feature-toggle-button'
const 控制面板编号 = 'gio-feature-toggle-panel'
const 控制样式编号 = `${样式编号}-feature-toggle-panel`

let 已安装功能控制 = false
let 已绑定功能变化 = false

export function 安装功能控制UI() {
  初始化功能开关()
  if (!document.body) return

  安装样式()
  确保控制按钮()
  if (状态.功能控制面板?.dataset.gioFeatureOpen === 'true') {
    确保控制面板()
  }

  if (已安装功能控制) return
  已安装功能控制 = true

  window.addEventListener(
    'pointerdown',
    (事件) => {
      const 目标 = 事件.target
      if (!(目标 instanceof Element)) return
      const 面板 = document.getElementById(控制面板编号)
      const 按钮 = document.getElementById(控制按钮编号)
      if (
        !面板?.dataset.gioFeatureOpen ||
        面板.dataset.gioFeatureOpen !== 'true'
      ) {
        return
      }
      if (面板.contains(目标) || 按钮?.contains(目标)) return
      切换控制面板(false)
    },
    { capture: true },
  )

  if (已绑定功能变化) return
  已绑定功能变化 = true
  监听功能变化(() => {
    刷新功能控制UI()
  })
}

export function 刷新功能控制UI() {
  if (!document.body) return
  刷新控制按钮()
  刷新控制面板()
}

function 确保控制按钮() {
  let 按钮 = 状态.功能控制按钮
  if (!按钮 || !document.documentElement.contains(按钮)) {
    按钮 = document.getElementById(控制按钮编号)
  }
  if (!按钮) {
    按钮 = document.createElement('button')
    按钮.id = 控制按钮编号
    按钮.type = 'button'
    按钮.addEventListener('click', () => {
      const 面板 = document.getElementById(控制面板编号)
      切换控制面板(面板?.dataset.gioFeatureOpen !== 'true')
    })
  }
  if (按钮.parentElement !== document.body) {
    document.body.appendChild(按钮)
  }
  状态.功能控制按钮 = 按钮
  刷新控制按钮()
  return 按钮
}

function 确保控制面板() {
  let 面板 = 状态.功能控制面板
  if (!面板 || !document.documentElement.contains(面板)) {
    面板 = document.getElementById(控制面板编号)
  }
  if (!面板) {
    面板 = document.createElement('section')
    面板.id = 控制面板编号
    面板.addEventListener('click', (事件) => {
      const 按钮 = 事件.target?.closest?.('[data-gio-feature-action]')
      if (!(按钮 instanceof HTMLButtonElement)) return

      const 动作 = 按钮.dataset.gioFeatureAction
      if (动作 === '全开') {
        设置功能总开关(true)
        设置全部功能开启(true)
        return
      }
      if (动作 === '全关') {
        设置功能总开关(false)
        return
      }
      if (动作 === '仅总开关') {
        设置功能总开关(!读取功能总开关())
      }
    })
    面板.addEventListener('change', (事件) => {
      const 输入框 = 事件.target
      if (!(输入框 instanceof HTMLInputElement)) return
      const 功能id = 输入框.dataset.gioFeatureId
      if (!功能id) return
      设置功能开启(功能id, 输入框.checked)
      if (!读取功能总开关()) {
        设置功能总开关(true)
      }
    })
  }
  if (面板.parentElement !== document.body) {
    document.body.appendChild(面板)
  }
  状态.功能控制面板 = 面板
  刷新控制面板()
  return 面板
}

function 切换控制面板(是否打开) {
  const 面板 = 确保控制面板()
  if (!面板) return
  面板.dataset.gioFeatureOpen = 是否打开 ? 'true' : 'false'
  刷新功能控制UI()
}

function 刷新控制按钮() {
  const 按钮 = 状态.功能控制按钮 ?? document.getElementById(控制按钮编号)
  if (!按钮) return

  const 已开启数量 = 统计已开启功能数()
  const 总数量 = 功能列表.length
  const 总开关已开 = 读取功能总开关()

  按钮.dataset.gioFeatureEnabled = 总开关已开 ? 'true' : 'false'
  按钮.title = 总开关已开
    ? `功能控制：${已开启数量}/${总数量} 已开启`
    : '功能控制：总开关已关闭'
  按钮.innerHTML =
    '<span class="gio-feature-toggle-badge">功能</span>' +
    `<span class="gio-feature-toggle-count">${总开关已开 ? `${已开启数量}/${总数量}` : '已关闭'}</span>`
}

function 刷新控制面板() {
  const 面板 = 状态.功能控制面板
  if (!面板 || !document.documentElement.contains(面板)) return

  const 分类列表 = 取得分类列表()
  const 总开关已开 = 读取功能总开关()
  const 已开启数量 = 统计已开启功能数()
  const 总数量 = 功能列表.length

  面板.dataset.gioFeatureOpen ??= 'false'
  面板.dataset.gioFeatureEnabled = 总开关已开 ? 'true' : 'false'
  面板.innerHTML =
    '<div class="gio-feature-panel-head">' +
    '<div class="gio-feature-panel-title-wrap">' +
    '<div class="gio-feature-panel-title">功能控制</div>' +
    `<div class="gio-feature-panel-subtitle">${总开关已开 ? `已开启 ${已开启数量} / ${总数量}` : '总开关已关闭'}</div>` +
    '</div>' +
    '<div class="gio-feature-panel-actions">' +
    `<button type="button" data-gio-feature-action="仅总开关">${总开关已开 ? '关闭总开关' : '开启总开关'}</button>` +
    '<button type="button" data-gio-feature-action="全开">全部开启</button>' +
    '<button type="button" data-gio-feature-action="全关">总开关关闭</button>' +
    '</div>' +
    '</div>' +
    '<div class="gio-feature-panel-body">' +
    分类列表
      .map((分类) => {
        return (
          '<section class="gio-feature-group">' +
          `<div class="gio-feature-group-title">${分类.分类}</div>` +
          分类.功能列表
            .map((功能) => {
              const 已开启 = 功能已启用(功能.id)
              const 原始开启 = 读取单项文本(功能.id)
              return (
                '<label class="gio-feature-item">' +
                '<span class="gio-feature-item-main">' +
                `<span class="gio-feature-item-name">${功能.名称}</span>` +
                `<span class="gio-feature-item-desc">${功能.描述}</span>` +
                '</span>' +
                '<span class="gio-feature-item-side">' +
                `<span class="gio-feature-item-state">${已开启 ? '开启' : 总开关已开 ? '关闭' : `${原始开启} / 总关`}</span>` +
                `<input type="checkbox" data-gio-feature-id="${功能.id}" ${读取勾选状态(
                  功能.id,
                )} />` +
                '</span>' +
                '</label>'
              )
            })
            .join('') +
          '</section>'
        )
      })
      .join('') +
    '</div>'

  if (面板.dataset.gioFeatureOpen !== 'true') {
    面板.setAttribute('hidden', 'hidden')
  } else {
    面板.removeAttribute('hidden')
  }

  function 读取勾选状态(功能id) {
    return 读取功能原始状态(功能id) ? 'checked' : ''
  }

  function 读取单项文本(功能id) {
    return 读取功能原始状态(功能id) ? '开启' : '关闭'
  }
}

function 取得分类列表() {
  const 分类表 = new Map()
  for (const 功能 of 功能列表) {
    const 当前列表 = 分类表.get(功能.分类)
    if (当前列表) {
      当前列表.push(功能)
    } else {
      分类表.set(功能.分类, [功能])
    }
  }
  return Array.from(分类表, ([分类, 当前功能列表]) => {
    return {
      分类,
      功能列表: 当前功能列表,
    }
  })
}

function 安装样式() {
  注入样式(
    控制样式编号,
    `
body.gio-离开游戏 [id^="gio-"]:not(#gio-feature-toggle-button),
body.gio-离开游戏 [class^="gio-"]:not(.gio-feature-toggle-badge):not(.gio-feature-toggle-count) {
    display: none !important;
}
#${控制按钮编号} {
    position: fixed;
    right: 12px;
    bottom: 12px;
    z-index: ${控制面板层级};
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    padding: 0 12px;
    border: 1px solid rgba(160, 183, 208, 0.5);
    border-radius: 999px;
    background: rgba(10, 16, 24, 0.92);
    color: #f6fbff;
    font: 900 12px/1 Arial, sans-serif;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.34);
    cursor: pointer;
}
#${控制按钮编号}[data-gio-feature-enabled='false'] {
    border-color: rgba(255, 116, 116, 0.62);
    background: rgba(44, 10, 10, 0.94);
}
.gio-feature-toggle-badge {
    color: #8ecbff;
}
.gio-feature-toggle-count {
    padding: 4px 8px;
    border-radius: 999px;
    background: rgba(142, 203, 255, 0.12);
    color: #ffffff;
}
#${控制面板编号} {
    position: fixed;
    right: 12px;
    bottom: 56px;
    z-index: ${控制面板层级};
    box-sizing: border-box;
    width: min(380px, calc(100vw - 24px));
    max-height: min(78vh, 920px);
    overflow: auto;
    padding: 12px;
    border: 1px solid rgba(127, 154, 185, 0.42);
    border-radius: 14px;
    background:
      linear-gradient(180deg, rgba(15, 23, 35, 0.98), rgba(8, 12, 19, 0.98));
    color: #f6fbff;
    font: 700 12px/1.35 Arial, sans-serif;
    box-shadow: 0 24px 56px rgba(0, 0, 0, 0.42);
    backdrop-filter: blur(10px);
}
#${控制面板编号}[data-gio-feature-enabled='false'] {
    border-color: rgba(255, 116, 116, 0.5);
}
.gio-feature-panel-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
}
.gio-feature-panel-title {
    color: #ffffff;
    font: 900 16px/1 Arial, sans-serif;
}
.gio-feature-panel-subtitle {
    margin-top: 5px;
    color: rgba(220, 233, 247, 0.72);
    font: 700 11px/1.2 Arial, sans-serif;
}
.gio-feature-panel-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
}
.gio-feature-panel-actions button {
    min-height: 28px;
    padding: 0 9px;
    border: 1px solid rgba(127, 154, 185, 0.36);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    color: #f6fbff;
    font: 800 11px/1 Arial, sans-serif;
    cursor: pointer;
}
.gio-feature-panel-body {
    display: grid;
    gap: 10px;
}
.gio-feature-group {
    padding: 10px;
    border: 1px solid rgba(127, 154, 185, 0.18);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
}
.gio-feature-group-title {
    margin-bottom: 8px;
    color: #8ecbff;
    font: 900 12px/1 Arial, sans-serif;
}
.gio-feature-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 0;
    border-top: 1px solid rgba(127, 154, 185, 0.12);
    cursor: pointer;
}
.gio-feature-item:first-of-type {
    border-top: 0;
    padding-top: 0;
}
.gio-feature-item:last-of-type {
    padding-bottom: 0;
}
.gio-feature-item-main {
    display: grid;
    gap: 4px;
    min-width: 0;
}
.gio-feature-item-name {
    color: #ffffff;
    font: 800 12px/1.2 Arial, sans-serif;
}
.gio-feature-item-desc {
    color: rgba(220, 233, 247, 0.64);
    font: 700 11px/1.35 Arial, sans-serif;
}
.gio-feature-item-side {
    display: grid;
    justify-items: end;
    gap: 6px;
    flex: 0 0 auto;
}
.gio-feature-item-state {
    color: rgba(220, 233, 247, 0.72);
    font: 800 10px/1 Arial, sans-serif;
}
.gio-feature-item-side input {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: #28a7ff;
    cursor: pointer;
}`,
  )
}
