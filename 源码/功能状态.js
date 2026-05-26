import { 状态 } from './状态.js'

export function 功能已启用(功能id) {
  if (!状态.功能总开关) return false
  return 状态.功能开关[功能id] !== false
}

export function 任一功能已启用(...功能id列表) {
  return 功能id列表.some((功能id) => 功能已启用(功能id))
}
