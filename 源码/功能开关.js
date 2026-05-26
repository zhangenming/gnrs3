import { 功能列表 } from './功能注册.js'
import { 状态 } from './状态.js'

export const 功能配置存储键 = 'gio功能控制配置'
export { 功能列表 } from './功能注册.js'

const 功能定义表 = new Map(
  功能列表.map((功能) => {
    return [功能.id, 功能]
  }),
)
const 功能变化监听集合 = new Set()

let 已初始化 = false

export function 初始化功能开关() {
  if (已初始化) return
  已初始化 = true

  const 配置 = 读取功能配置()
  状态.功能总开关 = 配置.总开关
  状态.功能开关 = 配置.功能开关
  保存功能配置()
}

export function 读取功能原始状态(功能id) {
  初始化功能开关()
  if (!功能定义表.has(功能id)) return true
  return 状态.功能开关[功能id] !== false
}

export function 功能已启用(功能id) {
  初始化功能开关()
  if (!状态.功能总开关) return false
  return 读取功能原始状态(功能id)
}

export function 任一功能已启用(...功能id列表) {
  return 功能id列表.some((功能id) => 功能已启用(功能id))
}

export function 读取功能总开关() {
  初始化功能开关()
  return 状态.功能总开关
}

export function 设置功能总开关(是否开启, 来源 = 'ui') {
  初始化功能开关()
  const 开启状态 = Boolean(是否开启)
  if (状态.功能总开关 === 开启状态) return

  状态.功能总开关 = 开启状态
  保存功能配置()
  通知功能变化({
    类型: '总开关',
    是否开启: 开启状态,
    来源,
  })
}

export function 设置功能开启(功能id, 是否开启, 来源 = 'ui') {
  初始化功能开关()
  if (!功能定义表.has(功能id)) return

  const 开启状态 = Boolean(是否开启)
  if (读取功能原始状态(功能id) === 开启状态) return

  状态.功能开关[功能id] = 开启状态
  保存功能配置()
  通知功能变化({
    类型: '单项',
    id: 功能id,
    是否开启: 开启状态,
    来源,
  })
}

export function 设置全部功能开启(是否开启, 来源 = 'ui') {
  初始化功能开关()
  const 开启状态 = Boolean(是否开启)
  let 有变化 = false

  for (const 功能 of 功能列表) {
    if (读取功能原始状态(功能.id) === 开启状态) continue
    状态.功能开关[功能.id] = 开启状态
    有变化 = true
  }

  if (!有变化) return

  保存功能配置()
  通知功能变化({
    类型: '批量',
    是否开启: 开启状态,
    来源,
  })
}

export function 监听功能变化(监听器) {
  功能变化监听集合.add(监听器)
  return function 取消监听() {
    功能变化监听集合.delete(监听器)
  }
}

export function 统计已开启功能数() {
  初始化功能开关()
  if (!状态.功能总开关) return 0
  return 功能列表.filter((功能) => 功能已启用(功能.id)).length
}

function 读取功能配置() {
  const 默认功能开关 = Object.fromEntries(
    功能列表.map((功能) => {
      return [功能.id, 取得默认开启状态(功能)]
    }),
  )

  try {
    const 原文 = globalThis.localStorage?.getItem(功能配置存储键)
    if (!原文) {
      return {
        总开关: true,
        功能开关: 默认功能开关,
      }
    }

    const 原配置 = JSON.parse(原文)
    const 原功能开关 =
      原配置 && typeof 原配置 === 'object' ? 原配置.功能开关 : null
    const 已迁移自动操作默认关闭 = 原配置?.自动操作默认关闭已迁移 === true
    return {
      总开关: 原配置?.总开关 !== false,
      功能开关: Object.fromEntries(
        功能列表.map((功能) => {
          if (!已迁移自动操作默认关闭 && 是自动操作功能(功能)) {
            return [功能.id, false]
          }
          return [
            功能.id,
            Object.hasOwn(原功能开关 ?? {}, 功能.id)
              ? 原功能开关[功能.id] !== false
              : 取得默认开启状态(功能),
          ]
        }),
      ),
    }
  } catch {
    return {
      总开关: true,
      功能开关: 默认功能开关,
    }
  }
}

function 取得默认开启状态(功能) {
  return !是自动操作功能(功能)
}

function 是自动操作功能(功能) {
  return 功能?.分类 === '自动操作'
}

function 保存功能配置() {
  try {
    globalThis.localStorage?.setItem(
      功能配置存储键,
      JSON.stringify({
        总开关: 状态.功能总开关,
        功能开关: 状态.功能开关,
        自动操作默认关闭已迁移: true,
      }),
    )
  } catch {}
}

function 通知功能变化(变更) {
  功能变化监听集合.forEach((监听器) => {
    try {
      监听器(变更)
    } catch {}
  })
}
