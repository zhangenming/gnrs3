// 功能目的:
// 游戏开始后根据当前可读地图，推荐一套能在第一大回合走满 25 陆地的开局路线。
//
// 作用范围:
// 只读取地图、基地和塔信息，维护一个棋盘外的顶部提示；不修改真实移动队列。
import { 大回合turn数, 提示层级, 我方蓝色, 中立黄色 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import {
  地图可读,
  取得本次塔列表,
  取得地图格子数,
  读取地图兵力,
  读取地图归属,
} from '../游戏.js'
import { 取得相邻索引列表, 是阻挡地形, 取游戏画布 } from '../游戏工具.js'
import { 状态 } from '../状态.js'

const 提示元素编号 = 'gio-opening-route'
const 目标陆地数 = 25
const 满兵数 = 51
const 普通开局记法 = '13-7(2)-5-3'
const 搜索时间上限毫秒 = 12
const 新地路径候选上限 = 18
const 自有路径候选上限 = 12
let 本局已计算开局路线 = false
const 开局模板列表 = [
  {
    记法: 普通开局记法,
    描述: '3面',
    段列表: [
      { 兵力: 13, 新地数: 12, 自有步数: 0 },
      { 兵力: 7, 新地数: 6, 自有步数: 2 },
      { 兵力: 5, 新地数: 4, 自有步数: 0 },
      { 兵力: 3, 新地数: 2, 自有步数: 0 },
    ],
  },
  {
    记法: '11-6(3)-5(2)-4(1)-3',
    描述: '2面',
    段列表: [
      { 兵力: 11, 新地数: 10, 自有步数: 0 },
      { 兵力: 6, 新地数: 5, 自有步数: 3 },
      { 兵力: 5, 新地数: 4, 自有步数: 2 },
      { 兵力: 4, 新地数: 3, 自有步数: 1 },
      { 兵力: 3, 新地数: 2, 自有步数: 0 },
    ],
  },
  {
    记法: '10-6(4)-6(1)-4-3',
    描述: '窄路',
    段列表: [
      { 兵力: 10, 新地数: 9, 自有步数: 0 },
      { 兵力: 6, 新地数: 5, 自有步数: 4 },
      { 兵力: 6, 新地数: 5, 自有步数: 1 },
      { 兵力: 4, 新地数: 3, 自有步数: 0 },
      { 兵力: 3, 新地数: 2, 自有步数: 0 },
    ],
  },
]

export const 功能定义 = {
  id: '最佳开局路线',
  名称: '最佳开局路线',
  分类: '战场面板',
  描述: '开局推荐第一大回合 25 陆地路线',
}

export const 主程序功能 = {
  id: 功能定义.id,
  页面同步: 同步最佳开局路线提示,
  窗口尺寸变化: 定位最佳开局路线提示,
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭: 清除最佳开局路线,
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置: 清除最佳开局路线,
  game_start({ 数据包 }) {
    尝试首次更新最佳开局路线(数据包 ?? {})
  },
  game_update({ 数据包 }) {
    处理开局路线更新(数据包 ?? {})
  },
}

export const 功能样式 = `
#${提示元素编号} {
    box-sizing: border-box;
    position: fixed;
    top: 8px;
    left: 50%;
    z-index: ${提示层级};
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: center;
    gap: 5px 8px;
    width: max-content;
    max-width: min(780px, calc(100vw - 24px));
    padding: 6px 10px;
    border: 1px solid rgba(255, 216, 77, 0.74);
    border-radius: 4px;
    background: rgba(10, 14, 18, 0.92);
    color: #ffffff;
    font: 700 12px/1.28 Arial, sans-serif;
    letter-spacing: 0;
    text-align: center;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.42);
    pointer-events: none;
}
#${提示元素编号} .gio-opening-route-label {
    color: ${中立黄色};
}
#${提示元素编号} .gio-opening-route-main {
    color: #ffffff;
    font-size: 15px;
    line-height: 1.1;
}
#${提示元素编号} .gio-opening-route-land {
    color: ${我方蓝色};
}
#${提示元素编号} .gio-opening-route-detail {
    flex-basis: 100%;
    overflow: hidden;
    max-width: 100%;
    color: rgba(255, 255, 255, 0.86);
    font-weight: 700;
    white-space: nowrap;
    text-overflow: ellipsis;
}
#${提示元素编号}[data-status='missing'] {
    border-color: rgba(255, 84, 84, 0.78);
}
#${提示元素编号}[data-status='missing'] .gio-opening-route-main {
    color: #ffb0b0;
}
`

export function 尝试首次更新最佳开局路线(数据包) {
  if (!功能已启用(功能定义.id)) {
    清除最佳开局路线()
    return
  }
  if (本局已计算开局路线) {
    同步最佳开局路线提示()
    return
  }

  const 推荐 = 计算最佳开局路线(数据包)
  if (!推荐) return

  本局已计算开局路线 = true
  状态.最佳开局路线 = 推荐
  同步最佳开局路线提示()
}

function 处理开局路线更新(数据包) {
  if (第一大回合后清除提示(数据包)) return
  尝试首次更新最佳开局路线(数据包)
}

function 第一大回合后清除提示(数据包) {
  if (!Number.isInteger(数据包?.turn)) return false
  if (数据包.turn < 大回合turn数) return false
  清除最佳开局路线()
  return true
}

export function 同步最佳开局路线提示() {
  if (!功能已启用(功能定义.id)) {
    清除最佳开局路线()
    return
  }
  if (!document.body) return
  if (!document.querySelector('#game-page #gameMap')) {
    移除最佳开局路线提示()
    return
  }

  const 推荐 = 状态.最佳开局路线
  if (!推荐) return

  const 元素 = 确保提示元素()
  if (!元素) return

  const 签名 = 取得提示签名(推荐)
  if (元素.dataset.gioOpeningRoute !== 签名) {
    元素.dataset.gioOpeningRoute = 签名
    元素.dataset.status = 推荐.已找到 ? 'ok' : 'missing'
    元素.innerHTML = 推荐.已找到 ? 生成路线HTML(推荐) : 生成失败HTML(推荐)
  }
  定位最佳开局路线提示()

  function 确保提示元素() {
    let 元素 = document.getElementById(提示元素编号)
    if (!元素) {
      元素 = document.createElement('div')
      元素.id = 提示元素编号
      document.body.appendChild(元素)
    }
    return 元素
  }
}

export function 定位最佳开局路线提示() {
  const 元素 = document.getElementById(提示元素编号)
  if (!元素) return

  const 画布 = 取游戏画布()
  const 矩形 = 画布?.getBoundingClientRect()
  if (!矩形 || 矩形.width <= 0 || 矩形.height <= 0) {
    元素.style.left = '50%'
    元素.style.top = '8px'
    元素.style.transform = 'translateX(-50%)'
    return
  }

  const 高 = 元素.offsetHeight || 34
  const 上方top = 矩形.top - 高 - 8
  const 下方top = 矩形.bottom + 8
  const 可用top =
    上方top >= 6
      ? 上方top
      : Math.min(window.innerHeight - 高 - 6, Math.max(6, 下方top))

  元素.style.left = `${Math.round(矩形.left + 矩形.width / 2)}px`
  元素.style.top = `${Math.round(可用top)}px`
  元素.style.transform = 'translateX(-50%)'
}

export function 清除最佳开局路线() {
  状态.最佳开局路线 = null
  本局已计算开局路线 = false
  移除最佳开局路线提示()
}

function 移除最佳开局路线提示() {
  document.getElementById(提示元素编号)?.remove()
}

function 计算最佳开局路线(数据包) {
  const 地图数组 = 状态.地图数组
  if (!地图可读(地图数组)) return null

  const 格子数 = 取得地图格子数(地图数组)
  const 基地索引 = 取得我方基地索引(数据包)
  if (!Number.isInteger(格子数) || !是有效索引(基地索引, 格子数)) return null

  const 普通开局 = 搜索模板路线(开局模板列表[0], 取得搜索上下文())
  if (普通开局) {
    return {
      ...普通开局,
      标题: '普通开局',
      兵力数: 满兵数,
    }
  }

  const 上下文 = 取得搜索上下文()
  const 备用模板列表 = 开局模板列表.slice(1)
  const 计划列表 = 备用模板列表
    .map((模板) => 搜索模板路线(模板, 上下文))
    .filter(Boolean)

  if (计划列表.length) {
    计划列表.sort((左, 右) => {
      if (右.评分 !== 左.评分) return 右.评分 - 左.评分
      return 左.模板顺序 - 右.模板顺序
    })
    return {
      ...计划列表[0],
      标题: '最佳开局',
    }
  }

  const 可达陆地数 = 取得可达陆地数(上下文)
  return {
    已找到: false,
    已超时: 上下文.已超时,
    可达陆地数,
  }

  function 取得搜索上下文() {
    return {
      地图数组,
      格子数,
      基地索引,
      塔集合: 取得塔集合(数据包),
      搜索开始时间: performance.now(),
      已超时: false,
    }
  }
}

function 搜索模板路线(模板, 上下文) {
  const 已占集合 = new Set([上下文.基地索引])
  const 结果 = 搜索段(0, 已占集合, [])
  if (!结果) return null

  const 模板顺序 = 开局模板列表.indexOf(模板)
  const 方向数 = 取得开局方向数(结果.最终已占集合, 上下文.基地索引)
  const 回走步数 = 模板.段列表.reduce((合计, 段) => 合计 + 段.自有步数, 0)
  const 评分 =
    结果.最终已占集合.size * 10000 +
    方向数 * 600 -
    回走步数 * 35 -
    模板.段列表.length * 12 -
    模板顺序

  return {
    已找到: true,
    记法: 模板.记法,
    描述: 模板.描述,
    陆地数: 结果.最终已占集合.size,
    段列表: 结果.段列表,
    评分,
    模板顺序,
  }

  function 搜索段(段idx, 当前已占集合, 当前段列表) {
    if (搜索已超时(上下文)) return null
    if (段idx >= 模板.段列表.length) {
      if (当前已占集合.size < 目标陆地数) return null
      return {
        最终已占集合: 当前已占集合,
        段列表: 当前段列表,
      }
    }

    const 段 = 模板.段列表[段idx]
    const 自有路径列表 = 取得自有路径候选(
      上下文.基地索引,
      当前已占集合,
      段.自有步数,
      上下文,
    )
    for (const 自有路径 of 自有路径列表) {
      if (搜索已超时(上下文)) return null
      const 起点 = 自有路径.at(-1)
      const 新地路径列表 = 取得新地路径候选(
        起点,
        当前已占集合,
        段.新地数,
        上下文,
      )
      for (const 新地路径 of 新地路径列表) {
        if (搜索已超时(上下文)) return null
        const 下个已占集合 = new Set(当前已占集合)
        新地路径.forEach((索引) => 下个已占集合.add(索引))

        const 结果 = 搜索段(段idx + 1, 下个已占集合, [
          ...当前段列表,
          {
            ...段,
            自有路径,
            新地路径,
          },
        ])
        if (结果) return 结果
      }
    }
    return null
  }
}

function 取得自有路径候选(起点, 已占集合, 步数, 上下文) {
  if (步数 === 0) return [[起点]]

  const 候选列表 = []
  const 路径 = [起点]
  const 路径集合 = new Set(路径)
  搜索(起点, 步数)
  候选列表.sort((左, 右) => {
    return (
      计算自有路径评分(右, 已占集合, 上下文) -
      计算自有路径评分(左, 已占集合, 上下文)
    )
  })
  return 候选列表

  function 搜索(当前位置, 剩余步数) {
    if (搜索已超时(上下文)) return
    if (候选列表.length >= 自有路径候选上限) return
    if (剩余步数 === 0) {
      候选列表.push(路径.slice())
      return
    }

    const 邻居列表 = 取得相邻索引列表(当前位置)
      .filter((索引) => {
        return 已占集合.has(索引) && !路径集合.has(索引)
      })
      .sort((左, 右) => {
        return (
          计算邻居排序分数(右, 已占集合, 路径集合, 上下文) -
          计算邻居排序分数(左, 已占集合, 路径集合, 上下文)
        )
      })

    for (const 邻居 of 邻居列表) {
      路径.push(邻居)
      路径集合.add(邻居)
      搜索(邻居, 剩余步数 - 1)
      路径集合.delete(邻居)
      路径.pop()
    }
  }
}

function 取得新地路径候选(起点, 已占集合, 新地数, 上下文) {
  const 候选列表 = []
  const 路径 = []
  const 路径集合 = new Set()
  搜索(起点, 新地数)
  候选列表.sort(
    (左, 右) =>
      计算新地路径评分(右, 已占集合, 上下文) -
      计算新地路径评分(左, 已占集合, 上下文),
  )
  return 候选列表

  function 搜索(当前位置, 剩余新地数) {
    if (搜索已超时(上下文)) return
    if (候选列表.length >= 新地路径候选上限) return
    if (剩余新地数 === 0) {
      候选列表.push(路径.slice())
      return
    }

    const 邻居列表 = 取得相邻索引列表(当前位置)
      .filter((索引) => {
        return (
          !已占集合.has(索引) &&
          !路径集合.has(索引) &&
          是开局可走地(索引, 上下文)
        )
      })
      .sort((左, 右) => {
        return (
          计算邻居排序分数(右, 已占集合, 路径集合, 上下文) -
          计算邻居排序分数(左, 已占集合, 路径集合, 上下文)
        )
      })

    for (const 邻居 of 邻居列表) {
      路径.push(邻居)
      路径集合.add(邻居)
      搜索(邻居, 剩余新地数 - 1)
      路径集合.delete(邻居)
      路径.pop()
    }
  }
}

function 是开局可走地(索引, 上下文) {
  if (!是有效索引(索引, 上下文.格子数)) return false
  if (上下文.塔集合.has(索引)) return false

  const 归属 = 读取地图归属(上下文.地图数组, 索引)
  if (是阻挡地形(归属)) return false
  if (Number.isInteger(归属) && 归属 >= 0) return false

  const 兵力 = 读取地图兵力(上下文.地图数组, 索引)
  return !Number.isInteger(兵力) || 兵力 <= 0
}

function 计算邻居排序分数(索引, 已占集合, 路径集合, 上下文) {
  const 开口数 = 取得开口数(索引, 已占集合, 路径集合, 上下文)
  const 距离 = 取得曼哈顿距离(索引, 上下文.基地索引)
  const 方向奖励 = 取得相邻索引列表(上下文.基地索引).includes(索引) ? 8 : 0
  return 开口数 * 12 + 距离 + 方向奖励 - 索引 / 10000
}

function 计算新地路径评分(路径, 已占集合, 上下文) {
  const 合并集合 = new Set(已占集合)
  路径.forEach((索引) => 合并集合.add(索引))
  const 边界数 = 取得边界数(合并集合, 上下文)
  const 方向数 = 取得开局方向数(合并集合, 上下文.基地索引)
  const 端点距离 = 路径.length
    ? 取得曼哈顿距离(路径.at(-1), 上下文.基地索引)
    : 0
  return 方向数 * 900 + 边界数 * 12 + 端点距离
}

function 计算自有路径评分(路径, 已占集合, 上下文) {
  const 终点 = 路径.at(-1)
  return 取得开口数(终点, 已占集合, new Set(路径.slice(0, -1)), 上下文)
}

function 取得开口数(索引, 已占集合, 路径集合, 上下文) {
  let 数量 = 0
  for (const 邻居 of 取得相邻索引列表(索引)) {
    if (已占集合.has(邻居) || 路径集合.has(邻居)) continue
    if (是开局可走地(邻居, 上下文)) 数量 += 1
  }
  return 数量
}

function 取得边界数(已占集合, 上下文) {
  const 边界集合 = new Set()
  for (const 索引 of 已占集合) {
    for (const 邻居 of 取得相邻索引列表(索引)) {
      if (已占集合.has(邻居)) continue
      if (是开局可走地(邻居, 上下文)) 边界集合.add(邻居)
    }
  }
  return 边界集合.size
}

function 取得开局方向数(已占集合, 基地索引) {
  let 数量 = 0
  for (const 邻居 of 取得相邻索引列表(基地索引)) {
    if (已占集合.has(邻居)) 数量 += 1
  }
  return 数量
}

function 取得可达陆地数(上下文) {
  const 队列 = [上下文.基地索引]
  const 已访问集合 = new Set(队列)
  let 队列idx = 0

  while (队列idx < 队列.length) {
    const 当前 = 队列[队列idx]
    队列idx += 1
    for (const 邻居 of 取得相邻索引列表(当前)) {
      if (已访问集合.has(邻居)) continue
      if (!是开局可走地(邻居, 上下文)) continue
      已访问集合.add(邻居)
      队列.push(邻居)
    }
  }
  return 已访问集合.size
}

function 取得塔集合(数据包) {
  const 塔集合 = new Set()
  状态.已知塔集合.forEach((塔索引) => {
    if (Number.isInteger(塔索引)) 塔集合.add(塔索引)
  })

  const 塔列表 = 取得本次塔列表(数据包)?.塔列表
  if (Array.isArray(塔列表)) {
    塔列表.forEach((塔索引) => {
      if (Number.isInteger(塔索引)) 塔集合.add(塔索引)
    })
  }
  return 塔集合
}

function 取得我方基地索引(数据包) {
  const 玩家索引 = Number.isInteger(状态.我方索引)
    ? 状态.我方索引
    : Number.isInteger(数据包?.playerIndex)
      ? 数据包.playerIndex
      : null
  const 基地列表 = Array.isArray(数据包?.generals) ? 数据包.generals : null
  const 数据包基地索引 =
    基地列表 && Number.isInteger(玩家索引) ? 基地列表[玩家索引] : null
  if (Number.isInteger(数据包基地索引) && 数据包基地索引 >= 0) {
    return 数据包基地索引
  }
  return 状态.我方基地索引
}

function 取得提示签名(推荐) {
  if (!推荐.已找到) return `missing:${推荐.可达陆地数}:${推荐.已超时}`
  return `${推荐.记法}:${推荐.陆地数}:${推荐.段列表
    .map((段) => `${段.兵力}/${段.自有路径.join('.')}/${段.新地路径.join('.')}`)
    .join('|')}`
}

function 生成路线HTML(推荐) {
  const 标题 = 推荐.标题 ?? '最佳开局'
  const 结果文本 = Number.isInteger(推荐.兵力数)
    ? `${推荐.兵力数}兵 ${推荐.陆地数}陆地`
    : `${推荐.陆地数}陆地`
  return (
    `<span class="gio-opening-route-label">${标题}</span>` +
    `<span class="gio-opening-route-main">${推荐.记法}</span>` +
    `<span class="gio-opening-route-land">${结果文本}</span>` +
    `<span class="gio-opening-route-label">${推荐.描述}</span>` +
    `<span class="gio-opening-route-detail">${生成路线细节(推荐)}</span>`
  )
}

function 生成失败HTML(推荐) {
  const 可达文本 = 推荐.已超时
    ? '搜索超时'
    : Number.isInteger(推荐.可达陆地数)
      ? `可达 ${推荐.可达陆地数} 陆地`
      : '地图未就绪'
  return (
    `<span class="gio-opening-route-label">最佳开局</span>` +
    `<span class="gio-opening-route-main">未找到25地路线</span>` +
    `<span class="gio-opening-route-detail">${可达文本}</span>`
  )
}

function 生成路线细节(推荐) {
  return 推荐.段列表
    .map((段) => {
      const 段记法 = `${段.兵力}${段.自有步数 ? `(${段.自有步数})` : ''}`
      const 自有方向 = 格式化方向路径(段.自有路径)
      const 新地方向 = 格式化方向路径([段.自有路径.at(-1), ...段.新地路径])
      return 自有方向
        ? `${段记法} ${自有方向}>${新地方向}`
        : `${段记法} ${新地方向}`
    })
    .join(' / ')
}

function 格式化方向路径(路径) {
  if (!Array.isArray(路径) || 路径.length < 2) return ''

  const 段列表 = []
  let 当前方向 = null
  let 当前数量 = 0
  for (let idx = 1; idx < 路径.length; idx += 1) {
    const 方向 = 取得方向文本(路径[idx - 1], 路径[idx])
    if (!方向) continue
    if (方向 === 当前方向) {
      当前数量 += 1
      continue
    }
    推入当前方向()
    当前方向 = 方向
    当前数量 = 1
  }
  推入当前方向()
  return 段列表.join('')

  function 推入当前方向() {
    if (!当前方向) return
    段列表.push(`${当前方向}${当前数量 > 1 ? 当前数量 : ''}`)
  }
}

function 取得方向文本(起点, 终点) {
  if (终点 === 起点 - 状态.宽度) return '上'
  if (终点 === 起点 + 状态.宽度) return '下'
  if (终点 === 起点 - 1) return '左'
  if (终点 === 起点 + 1) return '右'
  return ''
}

function 是有效索引(索引, 格子数) {
  return Number.isInteger(索引) && 索引 >= 0 && 索引 < 格子数
}

function 取得曼哈顿距离(左索引, 右索引) {
  const 左行 = Math.floor(左索引 / 状态.宽度)
  const 左列 = 左索引 % 状态.宽度
  const 右行 = Math.floor(右索引 / 状态.宽度)
  const 右列 = 右索引 % 状态.宽度
  return Math.abs(左行 - 右行) + Math.abs(左列 - 右列)
}

function 搜索已超时(上下文) {
  if (上下文.已超时) return true
  if (performance.now() - 上下文.搜索开始时间 <= 搜索时间上限毫秒) {
    return false
  }
  上下文.已超时 = true
  return true
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 主程序功能, 功能恢复, socket功能, 功能样式 })
