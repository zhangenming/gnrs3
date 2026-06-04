// 功能目的:
// 游戏结束后，在结算界面显示本局敌我星星变化。
import { 功能已启用 } from '../功能状态.js'
import { 是我方或队友 } from '../游戏.js'
import { 是游戏结束事件 } from '../游戏工具.js'
import { 注册功能 } from '../注册中心.js'
import { 状态 } from '../状态.js'
import { 取得单元格列表 } from '../战场DOM工具.js'
import { 取得战场数据表格 } from './战场表格.js'

const 面板编号 = 'gio-settlement-star-change'
const 样式编号 = `${面板编号}-style`

let 本局星星数据 = null

export const 功能定义 = {
  id: '结算星星变化',
  名称: '结算星星变化',
  分类: '战场面板',
  描述: '游戏结束后显示本局敌我星星变化',
}

export const 主程序功能 = {
  id: 功能定义.id,
  页面同步: 更新结算星星变化,
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭() {
    移除结算星星变化()
  },
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置({ 数据包 }) {
    本局星星数据 = {
      玩家名列表: Array.isArray(数据包?.usernames)
        ? 数据包.usernames.slice()
        : null,
      赛前星星: 读取星星数组(数据包?.stars),
      赛后星星: null,
      已结束: false,
    }
    setTimeout(记录排行榜赛前星星, 80)
  },
  game_update({ 数据包 }) {
    记录最终星星(数据包)
  },
  入站预处理({ 事件名, 数据包 }) {
    if (事件名 === 'game_update') 记录最终星星(数据包)
    if (是游戏结束事件(事件名) || 包含死亡分数(数据包)) {
      标记游戏结束()
    }
  },
}

export function 更新结算星星变化() {
  if (!功能已启用(功能定义.id)) {
    移除结算星星变化()
    return
  }
  if (!本局星星数据?.已结束) {
    移除结算星星变化()
    return
  }

  const 变化数据 = 计算星星变化()
  if (!变化数据) {
    移除结算星星变化()
    return
  }

  安装样式()
  const 宿主 = 取得结算星星宿主()
  if (!宿主) return

  const 面板 = 确保面板(宿主)
  if (!面板) return
  渲染面板(面板, 变化数据)
}

function 记录最终星星(数据包) {
  const 星星列表 = 读取星星数组(数据包?.stars)
  if (!星星列表) return
  if (!本局星星数据) {
    本局星星数据 = {
      玩家名列表: Array.isArray(状态.玩家名列表)
        ? 状态.玩家名列表.slice()
        : null,
      赛前星星: null,
      赛后星星: null,
      已结束: false,
    }
  }
  本局星星数据.赛后星星 = 星星列表
}

function 标记游戏结束() {
  if (!本局星星数据) return
  本局星星数据.已结束 = true
  setTimeout(更新结算星星变化, 120)
  setTimeout(更新结算星星变化, 600)
}

function 记录排行榜赛前星星() {
  if (!本局星星数据 || 本局星星数据.赛前星星) return

  const 星星列表 = 读取排行榜星星()
  if (星星列表) 本局星星数据.赛前星星 = 星星列表
}

function 读取排行榜星星() {
  const 表格 = 取得战场数据表格()
  if (!表格 || !Array.isArray(状态.玩家名列表)) return null

  const 星星列表 = []
  const 行列表 = Array.from(表格.querySelectorAll('tr'))
  for (const 行 of 行列表) {
    const 单元格列表 = 取得单元格列表(行)
    const 玩家索引 = 读取行玩家索引(单元格列表)
    if (!Number.isInteger(玩家索引)) continue

    const 星星 = 读取行星星(单元格列表)
    if (Number.isFinite(星星)) 星星列表[玩家索引] = 星星
  }

  return 星星列表.filter((星星) => Number.isFinite(星星)).length >= 2
    ? 星星列表
    : null
}

function 计算星星变化() {
  const 赛后星星 = 本局星星数据?.赛后星星
  if (!赛后星星 || !Array.isArray(状态.玩家名列表)) return null

  const 我方索引 = 状态.我方索引
  const 敌方索引 = 状态.玩家名列表.findIndex((玩家名, idx) => {
    return 玩家名 && !是我方或队友(idx)
  })
  if (!Number.isInteger(我方索引) || 敌方索引 < 0) return null

  const 我方 = 读取玩家变化(我方索引, '我方')
  const 敌方 = 读取玩家变化(敌方索引, '敌方')
  return 我方 && 敌方 ? { 我方, 敌方 } : null

  function 读取玩家变化(玩家索引, 标签) {
    const 赛后 = 读取星星值(赛后星星[玩家索引])
    if (!Number.isFinite(赛后)) return null

    const 赛前 = 读取星星值(本局星星数据.赛前星星?.[玩家索引])
    const 变化 = Number.isFinite(赛前) ? 赛后 - 赛前 : null
    const 玩家名 = 状态.玩家名列表[玩家索引] ?? 标签
    return { 标签, 玩家名, 赛前, 赛后, 变化 }
  }
}

function 取得结算星星宿主() {
  const 结算弹窗 = 取得结算弹窗()
  if (结算弹窗) return 结算弹窗

  const 排行榜容器 = document.querySelector('#game-leaderboard-container')
  return 排行榜容器 ?? document.querySelector('#game-page')
}

function 取得结算弹窗() {
  const 候选列表 = document.body?.querySelectorAll(
    '.popup, .modal, .alert, [role="dialog"]',
  )
  for (const 候选 of 候选列表 ?? []) {
    const 文本 = 候选.textContent ?? ''
    if (文本.includes('Exit') && 文本.includes('Watch Replay')) return 候选
    if (文本.includes('退出') && 文本.includes('观看回放')) return 候选
  }
  return null
}

function 确保面板(宿主) {
  let 面板 = document.getElementById(面板编号)
  if (面板 && 面板.parentElement !== 宿主) 面板.remove()
  面板 = document.getElementById(面板编号)
  if (!面板) {
    面板 = document.createElement('div')
    面板.id = 面板编号
    宿主.prepend(面板)
  }
  return 面板
}

function 渲染面板(面板, 变化数据) {
  const 签名 = JSON.stringify(变化数据)
  if (面板.dataset.签名 === 签名) return

  const 标题 = document.createElement('div')
  标题.className = 'gio-settlement-star-change-title'
  标题.textContent = '本局星星变化'

  const 列表 = document.createElement('div')
  列表.className = 'gio-settlement-star-change-list'
  列表.replaceChildren(创建玩家行(变化数据.我方), 创建玩家行(变化数据.敌方))

  面板.replaceChildren(标题, 列表)
  面板.dataset.签名 = 签名
}

function 创建玩家行(玩家) {
  const 行 = document.createElement('div')
  行.className = 'gio-settlement-star-change-row'

  const 名称 = document.createElement('span')
  名称.className = 'gio-settlement-star-change-name'
  名称.textContent = `${玩家.标签} ${玩家.玩家名}`

  const 变化 = document.createElement('span')
  变化.className = 'gio-settlement-star-change-diff'
  const 变化文本 = 格式化变化(玩家.变化)
  变化.textContent = 变化文本
  变化.dataset.state = 读取变化状态(玩家.变化)

  const 总数 = document.createElement('span')
  总数.className = 'gio-settlement-star-change-total'
  总数.textContent = `★ ${格式化星星(玩家.赛后)}`

  行.replaceChildren(名称, 变化, 总数)
  return 行
}

function 移除结算星星变化() {
  document.getElementById(面板编号)?.remove()
}

function 安装样式() {
  if (document.getElementById(样式编号)) return
  const 样式 = document.createElement('style')
  样式.id = 样式编号
  样式.textContent = `
#${面板编号} {
  margin: 8px 0;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  font-size: 13px;
  line-height: 1.35;
}

.gio-settlement-star-change-title {
  margin-bottom: 6px;
  color: #ffd84d;
  font-weight: 700;
}

.gio-settlement-star-change-list {
  display: grid;
  gap: 4px;
}

.gio-settlement-star-change-row {
  display: grid;
  grid-template-columns: minmax(90px, 1fr) minmax(44px, auto) minmax(58px, auto);
  align-items: center;
  gap: 8px;
}

.gio-settlement-star-change-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gio-settlement-star-change-diff,
.gio-settlement-star-change-total {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.gio-settlement-star-change-diff[data-state='up'] {
  color: #35d06f;
}

.gio-settlement-star-change-diff[data-state='down'] {
  color: #ff5a5f;
}

.gio-settlement-star-change-diff[data-state='same'] {
  color: #d5d5d5;
}
`.trim()
  document.documentElement.appendChild(样式)
}

function 读取行玩家索引(单元格列表) {
  for (const 单元格 of 单元格列表) {
    const 文本 = (单元格.textContent ?? '').trim()
    const idx = 状态.玩家名列表.indexOf(文本)
    if (idx >= 0) return idx
  }
  return null
}

function 读取行星星(单元格列表) {
  const 星星单元格 = 单元格列表.find((单元格) => {
    return 单元格.classList.contains('lb-star-col')
  })
  return 读取星星文本(星星单元格?.textContent)
}

function 读取星星数组(星星列表) {
  if (!Array.isArray(星星列表)) return null
  const 输出 = 星星列表.map(读取星星值)
  return 输出.some((星星) => Number.isFinite(星星)) ? 输出 : null
}

function 读取星星值(值) {
  const 数字 = Number(值)
  return Number.isFinite(数字) ? 数字 : null
}

function 读取星星文本(文本) {
  const 匹配 = String(文本 ?? '').match(/-?\d+(?:\.\d+)?/)
  if (!匹配) return null
  const 数字 = Number(匹配[0])
  return Number.isFinite(数字) ? 数字 : null
}

function 格式化变化(变化) {
  if (!Number.isFinite(变化)) return '变化 ?'
  const 文本 = 格式化星星(Math.abs(变化))
  if (变化 > 0) return `+${文本}`
  if (变化 < 0) return `-${文本}`
  return '0'
}

function 格式化星星(星星) {
  if (!Number.isFinite(星星)) return '?'
  return Number.isInteger(星星) ? String(星星) : 星星.toFixed(1)
}

function 读取变化状态(变化) {
  if (!Number.isFinite(变化) || 变化 === 0) return 'same'
  return 变化 > 0 ? 'up' : 'down'
}

function 包含死亡分数(数据包) {
  if (!Array.isArray(数据包?.scores)) return false
  return 数据包.scores.some((分数) => 分数?.dead === true)
}

注册功能({ 功能定义, 主程序功能, 功能恢复, socket功能 })
