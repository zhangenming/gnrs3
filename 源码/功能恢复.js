import { 监听功能变化 } from './功能开关.js'
import { 功能恢复列表 } from './功能注册.js'
import { 清空覆盖层, 请求覆盖层重绘 } from './覆盖层.js'

const 功能恢复表 = new Map(
  功能恢复列表.map((功能) => {
    return [功能.id, 功能]
  }),
)

let 已安装功能恢复 = false

export function 安装功能恢复() {
  if (已安装功能恢复) return
  已安装功能恢复 = true

  监听功能变化((变更) => {
    if (变更.类型 === '单项') {
      处理单项变化(变更.id, 变更.是否开启)
    } else if (变更.类型 === '总开关') {
      处理总开关变化(变更.是否开启)
    } else if (变更.类型 === '批量') {
      处理批量变化(变更.是否开启)
    }
  })
}

function 处理总开关变化(是否开启) {
  if (是否开启) {
    请求刷新()
    return
  }

  执行全部功能关闭恢复()
  清除覆盖层并刷新()
}

function 处理批量变化(是否开启) {
  if (是否开启) {
    请求刷新()
    return
  }

  执行全部功能关闭恢复()
  清除覆盖层并刷新()
}

function 处理单项变化(功能id, 是否开启) {
  if (是否开启) {
    请求刷新()
    return
  }

  const 功能 = 功能恢复表.get(功能id)
  if (!功能) return

  执行功能关闭恢复(功能)
  if (功能.关闭后需要清空覆盖层) {
    清除覆盖层并刷新()
  }
}

function 执行全部功能关闭恢复() {
  for (const 功能 of 功能恢复列表) {
    执行功能关闭恢复(功能)
  }
}

function 执行功能关闭恢复(功能) {
  if (typeof 功能?.关闭 === 'function') 功能.关闭()
}

function 清除覆盖层并刷新() {
  清空覆盖层()
  请求刷新()
}

function 请求刷新() {
  请求覆盖层重绘()
}
