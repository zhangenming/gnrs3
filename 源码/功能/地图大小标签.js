import { 功能已启用 } from '../功能状态.js'
import { 状态 } from '../状态.js'

const 地图大小元素编号 = 'gio-tower-memory-style-map-size'
const 地图大小样式编号 = `${地图大小元素编号}-style`

export const 功能定义 = {
  id: '地图大小标签',
  名称: '地图大小标签',
  分类: '系统',
  描述: '在棋盘旁显示地图长宽和总格数',
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭() {
    document.getElementById(地图大小元素编号)?.remove()
  },
}

export function 同步地图大小标签(地图元素) {
  if (!功能已启用('地图大小标签')) {
    document.getElementById(地图大小元素编号)?.remove()
    return
  }
  安装地图大小标签样式()
  const 标签 = 确保地图大小标签()
  if (!标签) return

  if (!状态.宽度 || !状态.高度) {
    标签.style.display = 'none'
    return
  }

  const 长 = 状态.宽度
  const 宽 = 状态.高度
  const 文本 = `地图大小: ${长} * ${宽} = ${长 * 宽}`
  if (标签.textContent !== 文本) 标签.textContent = 文本
  if (标签.style.display !== 'block') 标签.style.display = 'block'

  const 间距 = 8
  const 地图矩形 = 地图元素.getBoundingClientRect()
  const 标签矩形 = 标签.getBoundingClientRect()
  const 右侧x = 地图矩形.right + 间距
  const 内侧x = 地图矩形.right - 标签矩形.width - 间距
  const x = 右侧x + 标签矩形.width + 间距 <= window.innerWidth ? 右侧x : 内侧x
  const y = 地图矩形.top + 间距

  const left = `${Math.max(间距, x)}px`
  const top = `${Math.max(间距, y)}px`
  if (标签.style.left !== left) 标签.style.left = left
  if (标签.style.top !== top) 标签.style.top = top
}

function 确保地图大小标签() {
  const 已有标签 = document.getElementById(地图大小元素编号)
  if (已有标签) return 已有标签
  if (!document.body) return null

  const 标签 = document.createElement('div')
  标签.id = 地图大小元素编号
  document.body.appendChild(标签)
  return 标签
}

function 安装地图大小标签样式() {
  if (!document.documentElement) return
  if (document.getElementById(地图大小样式编号)) return

  const 样式 = document.createElement('style')
  样式.id = 地图大小样式编号
  样式.textContent = `
#${地图大小元素编号} {
    position: fixed !important;
    pointer-events: none !important;
    z-index: 2147483001 !important;
    display: none;
    padding: 5px 8px !important;
    border-radius: 4px !important;
    background: rgba(0, 0, 0, 0.72) !important;
    color: #ffffff !important;
    font: 800 13px/1 Arial, sans-serif !important;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9) !important;
    white-space: nowrap !important;
}
`.trim()
  document.documentElement.appendChild(样式)
}
