// 功能目的:
// 当敌方把我方塔直接打成敌方塔时，给整个页面叠加一次持续 2 秒的红色闪烁提示。
//
// 实现原理:
// 地图缓存更新时会同时拿到旧地图数组和新地图数组；地图数组的前 2 位是宽高，
// 后半段是每个格子的归属值。偷塔提示只遍历已知塔列表、当前数据包塔列表和塔记忆集合的并集，
// 对每个塔格读取旧归属和新归属：旧归属属于我方或队友，新归属属于敌方，就判定为敌方偷塔。
// 触发后给 html 与 body 写入固定类名，并动态安装一个独立 style 节点；CSS 用 fixed 伪元素覆盖全视口，
// 通过 2 秒 keyframes 闪烁红色背景层。再次触发会先移除类名并强制重排，保证动画从头播放；
// 模块级计时器会在 2 秒后移除类名，开新局时也会主动清理，避免提示状态残留到下一局。
//
// 作用范围:
// 只读取地图归属、塔列表和玩家归属关系，只更新页面根节点/body 的提示类名与本功能的 style 标签。
// 它不修改游戏地图、塔记忆、移动队列或覆盖层绘制数据。
import { 偷塔提示持续毫秒, 偷塔提示样式编号, 偷塔提示类名 } from '../配置.js'
import { 取得本次塔列表, 是我方或队友 } from '../游戏.js'
import { 状态 } from '../状态.js'

let 偷塔提示计时器 = null

export function 更新偷塔提示(旧地图数组, 新地图数组, 数据包) {
  if (!发现敌方偷塔()) return
  触发偷塔提示()

  function 发现敌方偷塔() {
    if (!Array.isArray(旧地图数组) || !Array.isArray(新地图数组)) return false
    if (!状态.宽度 || !状态.高度) return false

    const 格子数 = 状态.宽度 * 状态.高度
    if (
      旧地图数组.length < 2 + 格子数 * 2 ||
      新地图数组.length < 2 + 格子数 * 2
    ) {
      return false
    }

    const 塔索引集合 = 取得塔索引集合()
    for (const 塔索引 of 塔索引集合) {
      if (塔索引 < 0 || 塔索引 >= 格子数) continue

      const 旧归属 = 旧地图数组[2 + 格子数 + 塔索引]
      const 新归属 = 新地图数组[2 + 格子数 + 塔索引]
      if (是我方格(旧归属) && 是敌方格(新归属)) return true
    }
    return false

    function 取得塔索引集合() {
      const 塔索引集合 = new Set()
      添加塔列表(状态.塔列表)
      添加塔列表(取得本次塔列表(数据包)?.塔列表)
      状态.已知塔集合.forEach((塔索引) => {
        if (Number.isInteger(塔索引)) 塔索引集合.add(塔索引)
      })
      return 塔索引集合

      function 添加塔列表(塔列表) {
        if (!Array.isArray(塔列表)) return
        塔列表.forEach((塔索引) => {
          if (Number.isInteger(塔索引)) 塔索引集合.add(塔索引)
        })
      }
    }

    function 是我方格(归属) {
      return Number.isInteger(归属) && 归属 >= 0 && 是我方或队友(归属)
    }

    function 是敌方格(归属) {
      return Number.isInteger(归属) && 归属 >= 0 && !是我方或队友(归属)
    }
  }

  function 触发偷塔提示() {
    确保偷塔提示样式()
    清除偷塔提示()
    void document.documentElement?.offsetWidth
    document.documentElement?.classList.add(偷塔提示类名)
    document.body?.classList.add(偷塔提示类名)
    偷塔提示计时器 = setTimeout(清除偷塔提示, 偷塔提示持续毫秒)

    function 确保偷塔提示样式() {
      if (
        !document.documentElement ||
        document.getElementById(偷塔提示样式编号)
      ) {
        return
      }

      const 样式 = document.createElement('style')
      样式.id = 偷塔提示样式编号
      样式.textContent = `
html.${偷塔提示类名},
body.${偷塔提示类名} {
    animation: gio-tower-theft-page-background ${偷塔提示持续毫秒}ms linear both !important;
}
html.${偷塔提示类名}::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 2147483646;
    background: rgba(255, 0, 0, 0);
    animation: gio-tower-theft-page-flash ${偷塔提示持续毫秒}ms linear both !important;
}
@keyframes gio-tower-theft-page-background {
    0%, 100% { background-color: inherit; }
    12%, 36%, 60%, 84% { background-color: #520000; }
    24%, 48%, 72% { background-color: #160000; }
}
@keyframes gio-tower-theft-page-flash {
    0%, 100% { background: rgba(255, 0, 0, 0); }
    12%, 36%, 60%, 84% { background: rgba(255, 0, 0, 0.34); }
    24%, 48%, 72% { background: rgba(255, 0, 0, 0.08); }
}
`.trim()
      document.documentElement.appendChild(样式)
    }
  }
}

export function 清除偷塔提示() {
  if (偷塔提示计时器 != null) {
    clearTimeout(偷塔提示计时器)
    偷塔提示计时器 = null
  }
  document.documentElement?.classList.remove(偷塔提示类名)
  document.body?.classList.remove(偷塔提示类名)
}
