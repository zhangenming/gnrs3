import { 功能已启用 } from '../功能状态.js'
import { 注册功能 } from '../注册中心.js'
import { 状态 } from '../状态.js'
import { 取得大回合倒计时 } from '../工具.js'

const 最近长任务数量 = 30
const 长任务输出间隔毫秒 = 2000

let 长任务观察器 = null
let 上次长任务输出时间 = 0

export const 功能定义 = {
  id: '长任务诊断',
  名称: '长任务诊断',
  分类: '系统',
  描述: '记录主线程 50ms 以上卡顿时间点',
}

export const 主程序功能 = {
  id: 功能定义.id,
  启动: 同步长任务诊断,
  页面同步: 同步长任务诊断,
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭: 停止长任务诊断,
}

export function 同步长任务诊断() {
  if (!功能已启用(功能定义.id)) {
    停止长任务诊断()
    return
  }
  if (长任务观察器) return

  if (!支持长任务观察()) {
    状态.性能诊断.长任务 = {
      支持: false,
      运行中: false,
      原因: 'PerformanceObserver 不支持 longtask',
      时间: Math.round(performance.now()),
    }
    return
  }

  const 启动时间 = Math.round(performance.now())
  状态.性能诊断.长任务 = {
    ...创建空诊断(),
    ...(状态.性能诊断.长任务 ?? {}),
    支持: true,
    运行中: true,
    启动时间,
  }

  长任务观察器 = new PerformanceObserver((列表) => {
    for (const 记录 of 列表.getEntries()) {
      记录长任务(记录)
    }
  })
  长任务观察器.observe({ type: 'longtask', buffered: true })
}

export function 停止长任务诊断() {
  长任务观察器?.disconnect()
  长任务观察器 = null

  if (!状态.性能诊断.长任务) return
  状态.性能诊断.长任务 = {
    ...状态.性能诊断.长任务,
    运行中: false,
    停止时间: Math.round(performance.now()),
  }
}

function 记录长任务(记录) {
  const 长任务 = 创建长任务记录(记录)
  const 旧诊断 = 状态.性能诊断.长任务 ?? 创建空诊断()
  const 最近列表 = [长任务, ...(旧诊断.最近列表 ?? [])].slice(0, 最近长任务数量)
  const 最长 =
    !旧诊断.最长 || 长任务.耗时 > 旧诊断.最长.耗时 ? 长任务 : 旧诊断.最长
  const 总耗时 = 四舍五入((旧诊断.总耗时 ?? 0) + 长任务.耗时)

  状态.性能诊断.长任务 = {
    ...旧诊断,
    支持: true,
    运行中: Boolean(长任务观察器),
    次数: (旧诊断.次数 ?? 0) + 1,
    总耗时,
    平均耗时: 四舍五入(总耗时 / ((旧诊断.次数 ?? 0) + 1)),
    最近: 长任务,
    最长,
    最近列表,
    最近关联: 长任务.关联诊断,
  }

  输出长任务日志(长任务)
}

function 输出长任务日志(长任务) {
  const 当前时间 = performance.now()
  if (当前时间 - 上次长任务输出时间 < 长任务输出间隔毫秒) return

  上次长任务输出时间 = 当前时间
  console.warn('[长任务诊断] 主线程长任务', 长任务)
}

function 创建长任务记录(记录) {
  const 开始时间 = 四舍五入(记录.startTime)
  const 耗时 = 四舍五入(记录.duration)
  const 结束时间 = 四舍五入(开始时间 + 耗时)
  const 长任务 = {
    开始时间,
    结束时间,
    耗时,
    发生时间: 格式化本地时间(performance.timeOrigin + 开始时间),
    名称: 记录.name,
    回合: 状态.当前回合,
    大回合倒计时: 取得大回合倒计时(状态.当前回合),
    归因: 读取归因(记录),
  }
  长任务.关联诊断 = 读取关联诊断(长任务)
  return 长任务
}

function 读取归因(记录) {
  return Array.from(记录.attribution ?? []).map((归因) => {
    return {
      名称: 归因.name,
      容器类型: 归因.containerType,
      容器编号: 归因.containerId,
      容器名称: 归因.containerName,
      容器地址: 归因.containerSrc,
    }
  })
}

function 读取关联诊断(长任务) {
  return [
    读取关联项('地图更新', 状态.性能诊断.地图更新, 长任务),
    读取关联项('socketHook', 状态.性能诊断.socketHook, 长任务),
    读取关联项('覆盖层渲染', 状态.性能诊断.覆盖层渲染, 长任务),
    读取关联项('页面同步', 状态.性能诊断.页面同步, 长任务),
  ].filter(Boolean)
}

function 读取关联项(名称, 记录, 长任务) {
  if (!记录 || !Number.isFinite(记录.时间)) return null
  const 结束时间 = 记录.时间 + (记录.耗时 ?? 0)
  const 有重叠 =
    记录.时间 <= 长任务.结束时间 + 5 && 结束时间 >= 长任务.开始时间 - 5
  if (!有重叠) return null
  return {
    名称,
    耗时: 记录.耗时,
    回合: 记录.回合,
    时间: 记录.时间,
  }
}

function 支持长任务观察() {
  return PerformanceObserver.supportedEntryTypes?.includes('longtask') === true
}

function 创建空诊断() {
  return {
    支持: true,
    运行中: false,
    次数: 0,
    总耗时: 0,
    平均耗时: 0,
    最近: null,
    最长: null,
    最近列表: [],
    最近关联: [],
  }
}

function 格式化本地时间(时间戳) {
  const 日期 = new Date(时间戳)
  const 毫秒文本 = String(日期.getMilliseconds()).padStart(3, '0')
  return `${日期.toLocaleTimeString('zh-CN', { hour12: false })}.${毫秒文本}`
}

function 四舍五入(数字) {
  return Math.round(数字 * 100) / 100
}

注册功能({ 功能定义, 主程序功能, 功能恢复 })
