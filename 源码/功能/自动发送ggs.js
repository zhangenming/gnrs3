// 功能目的:
// 对手在 1v1 对局聊天里发送 last、last one 或 lst 时，自动回一条 ggs。
import { 状态 } from '../状态.js'
import { 注册功能 } from '../注册中心.js'

let 当前聊天房间 = ''
let 本局已自动发送ggs = false

export const socket功能 = {
  id: '自动发送ggs',
  新局重置({ 数据包 }) {
    当前聊天房间 = typeof 数据包?.chat_room === 'string' ? 数据包.chat_room : ''
    本局已自动发送ggs = false
  },
  入站预处理({ 事件名, 参数, socket }) {
    if (事件名 !== 'chat_message') return
    if (本局已自动发送ggs) return
    if (!socket || typeof socket.emit !== 'function') return

    const [房间, 消息] = 参数
    if (!是当前对局房间(房间)) return
    if (!是对手消息(消息)) return
    if (!是last消息(消息?.text)) return

    本局已自动发送ggs = true
    setTimeout(function () {
      socket.emit('chat_message', 房间, 'ggs')
    }, 2000)
  },
}

function 是当前对局房间(房间) {
  return typeof 房间 === 'string' && 房间.length > 0 && 房间 === 当前聊天房间
}

function 是对手消息(消息) {
  if (!Array.isArray(状态.玩家名列表) || 状态.玩家名列表.length !== 2) {
    return false
  }
  if (!Number.isInteger(状态.我方索引)) return false

  const 玩家名 = typeof 消息?.username === 'string' ? 消息.username.trim() : ''
  if (!玩家名) return false

  const 我方玩家名 = 规范化玩家名(状态.玩家名列表[状态.我方索引])
  const 当前消息玩家名 = 规范化玩家名(玩家名)
  if (!当前消息玩家名 || 当前消息玩家名 === 我方玩家名) return false

  return 状态.玩家名列表.some((候选玩家名, idx) => {
    return idx !== 状态.我方索引 && 规范化玩家名(候选玩家名) === 当前消息玩家名
  })
}

function 是last消息(文本) {
  return /^\s*(?:last(?:\s+one)?|lst)\s*$/i.test(
    typeof 文本 === 'string' ? 文本 : '',
  )
}

function 规范化玩家名(玩家名) {
  return typeof 玩家名 === 'string' ? 玩家名.trim().toLowerCase() : ''
}

注册功能({ socket功能 })
