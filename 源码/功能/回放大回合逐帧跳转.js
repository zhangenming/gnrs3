import { 大回合turn数 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import { 状态 } from '../状态.js'
import { 取得表头行, 取得单元格列表, 取得玩家列索引 } from '../战场DOM工具.js'
import { 读取显示回合 } from './大回合倒计时.js'
import { 取得战场数据表格 } from './战场表格.js'

export const 功能定义 = {
  id: '回放大回合逐帧跳转',
  名称: '回放大回合逐帧跳转',
  分类: '系统',
  描述: '回放 Shift+A/D 时逐帧单步到大回合',
}

export const 主程序功能 = {
  id: 功能定义.id,
  启动: 安装回放大回合逐帧跳转,
}

let 已安装 = false

function 安装回放大回合逐帧跳转() {
  if (已安装) return
  已安装 = true
  let 逐帧跳转令牌 = 0
  let 已自动初始化回放地址 = null
  let 自动初始化中 = false
  const 回放胜负结果表 = new Map()

  window.addEventListener('keydown', 处理回放大回合快捷键, {
    capture: true,
    passive: false,
  })
  请求自动初始化回放()

  function 处理回放大回合快捷键(事件) {
    if (!功能已启用(功能定义.id)) return
    if (!是网页回放中()) return
    if (是Shift按键(事件)) {
      事件.preventDefault()
      事件.stopImmediatePropagation()
      return
    }
    if (!事件.shiftKey) return
    if (事件.ctrlKey || 事件.altKey || 事件.metaKey) return

    const 方向 = 读取跳转方向(事件)
    if (!方向) return
    if (是输入元素(事件.target) && !是回放跳转输入(事件.target)) return

    事件.preventDefault()
    事件.stopImmediatePropagation()
    if (事件.repeat) return

    请求开始逐帧跳转(方向)
  }

  function 请求自动初始化回放() {
    requestAnimationFrame(尝试自动跳转)

    function 尝试自动跳转() {
      const 回放地址 = 取得回放地址()
      if (回放地址 && 回放胜负结果表.has(回放地址)) {
        更新回放胜负表头(回放胜负结果表.get(回放地址))
      }
      if (!回放地址) {
        requestAnimationFrame(尝试自动跳转)
        return
      }
      if (已自动初始化回放地址 === 回放地址 || 自动初始化中) {
        requestAnimationFrame(尝试自动跳转)
        return
      }
      if (!功能已启用(功能定义.id) || !是网页回放中()) {
        requestAnimationFrame(尝试自动跳转)
        return
      }
      if (!回放回合控件已就绪()) {
        requestAnimationFrame(尝试自动跳转)
        return
      }

      const 当前回合 = 读取显示回合()
      if (!Number.isInteger(当前回合)) {
        requestAnimationFrame(尝试自动跳转)
        return
      }

      已自动初始化回放地址 = 回放地址
      自动初始化中 = true
      执行回放初始化流程(回放地址, 当前回合).finally(() => {
        自动初始化中 = false
      })
      requestAnimationFrame(尝试自动跳转)
    }
  }

  async function 执行回放初始化流程(回放地址, 起始回合) {
    const 文件胜负结果 = await 读取回放文件胜负结果(回放地址)
    if (文件胜负结果) {
      回放胜负结果表.set(回放地址, 文件胜负结果)
      更新回放胜负表头(文件胜负结果)
    }

    if (!(await 直接跳转到最后回合())) {
      if (起始回合 < 大回合turn数) 请求开始逐帧跳转(1)
      return
    }

    const 已到最后回合 = await 等待回合变化后稳定(起始回合)
    if (取得回放地址() !== 回放地址) return
    if (!已到最后回合) {
      if (起始回合 < 大回合turn数) 请求开始逐帧跳转(1)
      return
    }

    const 胜负结果 = await 等待读取胜负结果()
    if (取得回放地址() !== 回放地址) return
    if (!文件胜负结果 && 胜负结果) {
      回放胜负结果表.set(回放地址, 胜负结果)
      更新回放胜负表头(胜负结果)
    }

    const 已回到开局 = await 跳回第1回合()
    if (取得回放地址() !== 回放地址) return
    if (!已回到开局) return
    请求开始逐帧跳转(1)
  }

  async function 直接跳转到最后回合() {
    return 直接跳转到回合文本('999999')
  }

  async function 跳回第1回合() {
    if (await 直接跳转到回合文本('0.')) {
      if (await 等待回合满足((回合) => 回合 <= 1, 90)) return true
    }
    if (!(await 直接跳转到回合文本('1'))) return false
    return 等待回合满足((回合) => 回合 <= 2, 90)
  }

  async function 直接跳转到回合文本(文本) {
    const 输入框 = document.getElementById('replay-turn-jump-input')
    if (!(输入框 instanceof HTMLInputElement)) return false

    逐帧跳转令牌 += 1
    输入框.focus()
    输入框.select()
    设置输入框值(输入框, 文本)
    输入框.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        data: 文本,
        inputType: 'insertText',
      }),
    )
    输入框.dispatchEvent(new Event('change', { bubbles: true }))
    await 等待短暂延迟()
    发送按键到目标(输入框, 'keydown', 取得按键('Enter', 'Enter', 13))
    发送按键到目标(输入框, 'keypress', 取得按键('Enter', 'Enter', 13))
    发送按键到目标(输入框, 'keyup', 取得按键('Enter', 'Enter', 13))
    return true

    function 设置输入框值(输入框, 值) {
      const 描述符 = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )
      描述符?.set?.call(输入框, 值)
    }
  }

  function 等待短暂延迟() {
    return new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }

  async function 等待回合变化后稳定(原回合) {
    let 上次回合 = null
    let 稳定帧数 = 0
    let 已变化 = false
    for (let idx = 0; idx < 180; idx += 1) {
      await 等待下一帧()
      const 当前回合 = 读取显示回合()
      if (!Number.isInteger(当前回合)) continue
      if (当前回合 !== 原回合) 已变化 = true
      if (当前回合 === 上次回合) {
        稳定帧数 += 1
      } else {
        稳定帧数 = 0
        上次回合 = 当前回合
      }
      if (已变化 && 稳定帧数 >= 8) return true
    }
    return false
  }

  async function 等待读取胜负结果() {
    for (let idx = 0; idx < 120; idx += 1) {
      const 结果 = 读取回放胜负结果()
      if (结果) return 结果
      await 等待下一帧()
    }
    return null
  }

  async function 等待回合满足(判断, 最大帧数) {
    for (let idx = 0; idx < 最大帧数; idx += 1) {
      await 等待下一帧()
      const 当前回合 = 读取显示回合()
      if (Number.isInteger(当前回合) && 判断(当前回合)) return true
    }
    return false
  }

  function 等待下一帧() {
    return new Promise((resolve) => {
      requestAnimationFrame(resolve)
    })
  }

  function 读取回放胜负结果() {
    const 分数结果 = 读取回放分数胜负结果()
    if (分数结果) return 分数结果

    const 表格结果 = 读取回放表格胜负结果()
    if (表格结果) return 表格结果
    return null
  }

  async function 读取回放文件胜负结果(回放地址) {
    const 回放编号 = 读取回放编号(回放地址)
    if (!回放编号) return null

    try {
      const 响应 = await fetch(取得回放文件地址(回放编号))
      if (!响应.ok) return null

      const 内容 = new Uint8Array(await 响应.arrayBuffer())
      const 回放 = 解析回放文件(内容)
      return 计算回放胜负结果(回放)
    } catch (错误) {
      console.warn('[回放大回合逐帧跳转] 读取回放胜负失败:', 错误)
      return null
    }

    function 读取回放编号(地址) {
      const 匹配 = String(地址 ?? '').match(/\/replays\/([^/?#]+)/)
      return 匹配?.[1] ?? null
    }

    function 取得回放文件地址(编号) {
      return `https://generalsio-replays-na.s3.amazonaws.com/${编号}.gior`
    }
  }

  function 解析回放文件(内容) {
    const 原始列表 = JSON.parse(解压Uint8数组(内容))
    return {
      宽度: 原始列表[2],
      高度: 原始列表[3],
      玩家名列表: 原始列表[4],
      塔列表: 原始列表[6],
      塔兵力列表: 原始列表[7],
      基地列表: 原始列表[8],
      山列表: 原始列表[9],
      移动列表: Array.isArray(原始列表[10])
        ? 原始列表[10].map(function (移动, idx) {
            return {
              idx,
              玩家索引: 移动?.[0],
              起点: 移动?.[1],
              终点: 移动?.[2],
              是否半兵: Boolean(移动?.[3]),
              回合: 移动?.[4],
            }
          })
        : [],
    }
  }

  function 计算回放胜负结果(回放) {
    const 我方索引 = 取得回放我方索引(回放.玩家名列表)
    if (!Number.isInteger(我方索引)) return null

    const 胜方索引 = 计算回放胜方索引(回放)
    if (!Number.isInteger(胜方索引)) return null
    return 胜方索引 === 我方索引 ? '胜' : '负'
  }

  function 计算回放胜方索引(回放) {
    if (!Number.isInteger(回放?.宽度) || !Number.isInteger(回放?.高度)) {
      return null
    }

    const 格子数 = 回放.宽度 * 回放.高度
    if (格子数 <= 0) return null

    const 兵力列表 = new Array(格子数).fill(0)
    const 归属列表 = new Array(格子数).fill(-1)
    const 塔集合 = new Set()
    const 基地集合 = new Set()

    if (Array.isArray(回放.山列表)) {
      for (const 索引 of 回放.山列表) {
        if (是有效索引(索引)) 归属列表[索引] = -2
      }
    }

    if (Array.isArray(回放.塔列表)) {
      for (let idx = 0; idx < 回放.塔列表.length; idx += 1) {
        const 索引 = 回放.塔列表[idx]
        if (!是有效索引(索引)) continue

        塔集合.add(索引)
        兵力列表[索引] = Number.isInteger(回放.塔兵力列表?.[idx])
          ? 回放.塔兵力列表[idx]
          : 40
      }
    }

    if (Array.isArray(回放.基地列表)) {
      for (let 玩家索引 = 0; 玩家索引 < 回放.基地列表.length; 玩家索引 += 1) {
        const 索引 = 回放.基地列表[玩家索引]
        if (!是有效索引(索引)) continue

        基地集合.add(索引)
        兵力列表[索引] = 1
        归属列表[索引] = 玩家索引
      }
    }

    const 移动列表 = 回放.移动列表
      .filter(function (移动) {
        return (
          Number.isInteger(移动.玩家索引) &&
          Number.isInteger(移动.起点) &&
          Number.isInteger(移动.终点) &&
          Number.isInteger(移动.回合) &&
          移动.回合 >= 0
        )
      })
      .sort(function (左, 右) {
        if (左.回合 !== 右.回合) return 左.回合 - 右.回合
        return 左.idx - 右.idx
      })

    let 当前回合 = 0
    for (const 移动 of 移动列表) {
      while (当前回合 < 移动.回合) {
        应用自然增长(当前回合)
        当前回合 += 1
      }

      const 胜方索引 = 应用移动并读取胜方(移动)
      if (Number.isInteger(胜方索引)) return 胜方索引
    }

    return null

    function 应用移动并读取胜方(移动) {
      if (!是有效索引(移动.起点) || !是有效索引(移动.终点)) return null
      if (归属列表[移动.起点] !== 移动.玩家索引) return null

      const 起点兵力 = 兵力列表[移动.起点]
      const 终点兵力 = 兵力列表[移动.终点]
      const 终点归属 = 归属列表[移动.终点]
      if (!Number.isInteger(起点兵力) || 起点兵力 <= 1) return null
      if (!Number.isInteger(终点兵力) || !Number.isInteger(终点归属)) {
        return null
      }

      const 留守兵力 = 移动.是否半兵 ? Math.ceil(起点兵力 / 2) : 1
      const 移动兵力 = Math.max(0, 起点兵力 - 留守兵力)
      if (移动兵力 <= 0) return null

      兵力列表[移动.起点] = 留守兵力
      if (终点归属 === 移动.玩家索引) {
        兵力列表[移动.终点] = 终点兵力 + 移动兵力
        return null
      }

      if (移动兵力 <= 终点兵力) {
        兵力列表[移动.终点] = 终点兵力 - 移动兵力
        return null
      }

      const 吃掉基地 = 基地集合.has(移动.终点) && 终点归属 >= 0
      兵力列表[移动.终点] = 移动兵力 - 终点兵力
      归属列表[移动.终点] = 移动.玩家索引
      if (吃掉基地) return 移动.玩家索引
      return null
    }

    function 应用自然增长(回合) {
      const 基地塔增长 = 取得周期增长次数(回合, 回合 + 1, 2)
      if (基地塔增长 > 0) {
        基地集合.forEach(function (索引) {
          增加兵力(索引, 基地塔增长)
        })
        塔集合.forEach(function (索引) {
          增加兵力(索引, 基地塔增长)
        })
      }

      const 大回合增长 = 取得周期增长次数(回合, 回合 + 1, 大回合turn数)
      if (大回合增长 <= 0) return

      for (let idx = 0; idx < 格子数; idx += 1) {
        增加兵力(idx, 大回合增长)
      }
    }

    function 增加兵力(索引, 增长) {
      if (!是有效索引(索引)) return
      if (!Number.isInteger(归属列表[索引]) || 归属列表[索引] < 0) return
      if (!Number.isInteger(兵力列表[索引])) return
      兵力列表[索引] += 增长
    }

    function 是有效索引(索引) {
      return Number.isInteger(索引) && 索引 >= 0 && 索引 < 格子数
    }
  }

  function 取得周期增长次数(起始回合, 目标回合, 周期) {
    return Math.floor(目标回合 / 周期) - Math.floor(起始回合 / 周期)
  }

  function 解压Uint8数组(压缩数组) {
    if (!压缩数组?.length) return ''

    const 压缩码列表 = []
    for (let idx = 0; idx < 压缩数组.length; idx += 2) {
      压缩码列表.push(压缩数组[idx] * 256 + (压缩数组[idx + 1] ?? 0))
    }
    return 解压压缩码(压缩码列表.length, 32768, function (idx) {
      return 压缩码列表[idx]
    })
  }

  function 解压压缩码(长度, 重置值, 读取值) {
    const 字典 = []
    let 扩容剩余 = 4
    let 字典大小 = 4
    let 位数 = 3
    let 词条 = ''
    let 字符 = ''
    let 旧词条 = ''
    const 结果 = []
    const 数据 = {
      值: 读取值(0),
      位置: 重置值,
      索引: 1,
    }

    for (let idx = 0; idx < 3; idx += 1) 字典[idx] = idx

    const 初始标记 = 读取位(2)
    if (初始标记 === 0) {
      字符 = String.fromCharCode(读取位(8))
    } else if (初始标记 === 1) {
      字符 = String.fromCharCode(读取位(16))
    } else if (初始标记 === 2) {
      return ''
    }

    字典[3] = 字符
    旧词条 = 字符
    结果.push(字符)

    while (true) {
      if (数据.索引 > 长度) return ''

      let 字典索引 = 读取位(位数)
      if (字典索引 === 0) {
        字典[字典大小] = String.fromCharCode(读取位(8))
        字典索引 = 字典大小
        字典大小 += 1
        扩容剩余 -= 1
      } else if (字典索引 === 1) {
        字典[字典大小] = String.fromCharCode(读取位(16))
        字典索引 = 字典大小
        字典大小 += 1
        扩容剩余 -= 1
      } else if (字典索引 === 2) {
        return 结果.join('')
      }

      if (扩容剩余 === 0) {
        扩容剩余 = 2 ** 位数
        位数 += 1
      }

      if (字典[字典索引]) {
        词条 = 字典[字典索引]
      } else if (字典索引 === 字典大小) {
        词条 = 旧词条 + 旧词条.charAt(0)
      } else {
        return ''
      }

      结果.push(词条)
      字典[字典大小] = 旧词条 + 词条.charAt(0)
      字典大小 += 1
      扩容剩余 -= 1
      旧词条 = 词条

      if (扩容剩余 === 0) {
        扩容剩余 = 2 ** 位数
        位数 += 1
      }
    }

    function 读取位(数量) {
      let bits = 0
      let power = 1
      const 最大 = 2 ** 数量
      while (power !== 最大) {
        const resb = 数据.值 & 数据.位置
        数据.位置 >>= 1
        if (数据.位置 === 0) {
          数据.位置 = 重置值
          数据.值 = 读取值(数据.索引)
          数据.索引 += 1
        }
        bits |= (resb > 0 ? 1 : 0) * power
        power <<= 1
      }
      return bits
    }
  }

  function 读取回放分数胜负结果() {
    const 数据包 = 读取网页回放数据包()
    if (!Array.isArray(数据包?.scores)) return null

    const 我方索引 = 取得回放我方索引()
    if (!Number.isInteger(我方索引)) return null

    const 我方分数 = 数据包.scores.find((分数) => 分数?.i === 我方索引)
    const 敌方分数 = 数据包.scores.find((分数) => 分数?.i !== 我方索引)
    if (!我方分数 || !敌方分数) return null

    if (是死亡分数(我方分数)) return '负'
    if (是死亡分数(敌方分数)) return '胜'
    return null

    function 是死亡分数(分数) {
      return (
        分数?.dead === true ||
        Number(分数?.tiles ?? 分数?.land) <= 0 ||
        Number(分数?.total ?? 分数?.army) <= 0
      )
    }
  }

  function 读取回放表格胜负结果() {
    const 表格信息 = 读取回放表格信息()
    if (!表格信息) return null

    const 我方行 = 表格信息.玩家行列表.find((行) => 行.是我方)
    const 敌方行 = 表格信息.玩家行列表.find((行) => !行.是我方) ?? null
    if (!我方行 || !敌方行) return null

    if (我方行.陆地 <= 0 || 我方行.兵力 <= 0) return '负'
    if (敌方行.陆地 <= 0 || 敌方行.兵力 <= 0) return '胜'
    if (表格信息.玩家行列表.length === 2) {
      return 表格信息.玩家行列表[0] === 我方行 ? '胜' : '负'
    }
    return null
  }

  function 更新回放胜负表头(胜负结果) {
    const 表格信息 = 读取回放表格信息()
    const 单元格 = 表格信息?.玩家表头格
    if (!单元格) return
    if (单元格.textContent === 胜负结果) return

    单元格.dataset.gioBattlePlayerColumn = 'true'
    单元格.dataset.gioReplayResult = 胜负结果
    单元格.title = '回放最终胜负'
    单元格.textContent = 胜负结果
  }

  function 读取回放表格信息() {
    const 表格 = 取得战场数据表格()
    if (!表格) return null

    const 表头行 = 取得表头行(表格)
    if (!表头行) return null

    const 表头格列表 = 取得单元格列表(表头行)
    const 玩家列 = 取得玩家列索引(表头格列表)
    const 兵力列 = 取得列索引(表头格列表, 'Army', 'army')
    const 陆地列 = 取得列索引(表头格列表, 'Land', 'land')
    if (玩家列 < 0 || 兵力列 < 0 || 陆地列 < 0) return null

    const 玩家表头格 = 表头格列表[玩家列]
    if (玩家表头格) 玩家表头格.dataset.gioBattlePlayerColumn = 'true'

    const 视角列 = 表头格列表.findIndex((单元格) => {
      if (单元格.dataset.gioReplayTurnCell === 'true') return true
      return (单元格.textContent ?? '').trim() === 'POV'
    })
    const 回放我方索引 = 取得回放我方索引()
    const 玩家行列表 = Array.from(表格.querySelectorAll('tr'))
      .filter((行) => 行 !== 表头行)
      .map((行) => 读取玩家行(行))
      .filter(Boolean)
    if (玩家行列表.length < 2) return null

    if (!玩家行列表.some((行) => 行.是我方)) {
      玩家行列表[0].是我方 = true
    }

    return { 玩家表头格, 玩家行列表 }

    function 读取玩家行(行) {
      const 单元格列表 = 取得单元格列表(行)
      if (单元格列表.length <= 陆地列) return null

      const 玩家名 = (单元格列表[玩家列]?.textContent ?? '').trim()
      if (!玩家名) return null

      const 兵力 = 读取数字(单元格列表[兵力列])
      const 陆地 = 读取数字(单元格列表[陆地列])
      if (!Number.isInteger(兵力) || !Number.isInteger(陆地)) return null

      const 玩家索引 = 状态.玩家名列表?.indexOf(玩家名) ?? -1
      const 是视角行 = 读取POV勾选框(单元格列表[视角列])?.checked === true
      const 是我方 =
        是视角行 ||
        (Number.isInteger(回放我方索引) && 玩家索引 === 回放我方索引)
      return { 行, 玩家名, 兵力, 陆地, 是我方 }
    }

    function 取得列索引(单元格列表, 原文本, 类型) {
      return 单元格列表.findIndex((单元格) => {
        if (单元格.dataset.gioBattleKind === 类型) return true
        return (单元格.textContent ?? '').trim() === 原文本
      })
    }

    function 读取POV勾选框(单元格) {
      const 勾选框列表 = Array.from(
        单元格?.querySelectorAll('input[type="checkbox"]') ?? [],
      )
      return (
        勾选框列表.find((勾选框) => {
          return !勾选框.closest('.perspective-select')
        }) ?? null
      )
    }

    function 读取数字(单元格) {
      const 文本 = (单元格?.textContent ?? '').trim()
      if (/^[+-]\d+$/.test(文本)) return null
      const 数字 = Number.parseInt(文本, 10)
      return Number.isInteger(数字) ? 数字 : null
    }
  }

  function 取得回放我方索引(玩家名列表 = 状态.玩家名列表) {
    const 玩家名 = new URLSearchParams(globalThis.location?.search ?? '')
      .get('p')
      ?.trim()
    if (玩家名 && Array.isArray(玩家名列表)) {
      const 玩家索引 = 玩家名列表.indexOf(玩家名)
      if (玩家索引 >= 0) return 玩家索引
    }

    const POV玩家索引 = 读取回放POV玩家索引(玩家名列表)
    if (Number.isInteger(POV玩家索引)) return POV玩家索引

    const 本地玩家索引 = 读取本地玩家索引(玩家名列表)
    if (Number.isInteger(本地玩家索引)) return 本地玩家索引

    if (Number.isInteger(状态.我方索引)) return 状态.我方索引
    return null
  }

  function 读取回放POV玩家索引(玩家名列表) {
    if (!Array.isArray(玩家名列表)) return null

    const 表格 = 取得战场数据表格()
    const 表头行 = 表格 ? 取得表头行(表格) : null
    if (!表头行) return null

    const 表头格列表 = 取得单元格列表(表头行)
    const 玩家列 = 取得玩家列索引(表头格列表)
    const 视角列 = 表头格列表.findIndex((单元格) => {
      if (单元格.dataset.gioReplayTurnCell === 'true') return true
      return (单元格.textContent ?? '').trim() === 'POV'
    })
    if (玩家列 < 0 || 视角列 < 0) return null

    for (const 行 of 表格.querySelectorAll('tr')) {
      if (行 === 表头行) continue

      const 单元格列表 = 取得单元格列表(行)
      const 勾选框 = 读取POV勾选框(单元格列表[视角列])
      if (勾选框?.checked !== true) continue

      const 玩家名 = (单元格列表[玩家列]?.textContent ?? '').trim()
      const 玩家索引 = 玩家名列表.indexOf(玩家名)
      return 玩家索引 >= 0 ? 玩家索引 : null
    }
    return null

    function 读取POV勾选框(单元格) {
      const 勾选框列表 = Array.from(
        单元格?.querySelectorAll('input[type="checkbox"]') ?? [],
      )
      return (
        勾选框列表.find((勾选框) => {
          return !勾选框.closest('.perspective-select')
        }) ?? null
      )
    }
  }

  function 读取本地玩家索引(玩家名列表) {
    if (!Array.isArray(玩家名列表)) return null

    const 玩家名 = globalThis.localStorage?.GIO_CACHED_USERNAME?.trim()
    if (!玩家名) return null

    const 玩家索引 = 玩家名列表.indexOf(玩家名)
    return 玩家索引 >= 0 ? 玩家索引 : null
  }

  function 读取网页回放数据包() {
    const 起点列表 = [
      document.getElementById('gameMap'),
      document.getElementById('react-container'),
    ]
    for (const 起点 of 起点列表) {
      const 数据包 = 读取节点回放数据包(起点)
      if (数据包) return 数据包
    }
    return null

    function 读取节点回放数据包(节点) {
      const fiber = 读取ReactFiber(节点)
      const 已访问 = new Set()
      for (let 当前 = fiber; 当前 && !已访问.has(当前); 当前 = 当前.return) {
        已访问.add(当前)
        const props = 当前.memoizedProps
        if (props?.isReplay === true && Number.isInteger(props.turn)) {
          return {
            scores: props.scores,
            turn: props.turn,
          }
        }
      }
      return null
    }

    function 读取ReactFiber(节点) {
      if (!节点) return null
      const fiber键 = Object.keys(节点).find((键) => {
        return (
          键.startsWith('__reactFiber$') ||
          键.startsWith('__reactInternalInstance$')
        )
      })
      return fiber键 ? 节点[fiber键] : null
    }
  }

  function 请求开始逐帧跳转(方向) {
    const 当前令牌 = ++逐帧跳转令牌
    let 等待帧数 = 0
    requestAnimationFrame(尝试开始)

    function 尝试开始() {
      if (当前令牌 !== 逐帧跳转令牌) return
      if (回放回合控件已就绪() && 开始逐帧跳转(方向, 当前令牌)) return
      等待帧数 += 1
      if (等待帧数 >= 30) return
      requestAnimationFrame(尝试开始)
    }
  }

  function 开始逐帧跳转(方向, 当前令牌) {
    const 起始回合 = 读取显示回合()
    if (!Number.isInteger(起始回合)) return false

    const 目标回合 = 取得目标大回合(起始回合, 方向)
    if (!Number.isInteger(目标回合) || 目标回合 === 起始回合) return true

    状态.当前回合 = 起始回合
    let 已单步次数 = 0
    const 按键 =
      方向 > 0 ? 取得按键('d', 'KeyD', 68) : 取得按键('a', 'KeyA', 65)
    requestAnimationFrame(逐帧单步)
    return true

    function 逐帧单步() {
      if (当前令牌 !== 逐帧跳转令牌) return

      const 当前回合 = 读取显示回合()
      if (!Number.isInteger(当前回合)) return
      状态.当前回合 = 当前回合
      if (方向 > 0 ? 当前回合 >= 目标回合 : 当前回合 <= 目标回合) return
      if (已单步次数 >= 大回合turn数) return

      已单步次数 += 1
      const 发送前回合 = 当前回合
      发送按键('keydown', 按键)
      等待回合同步后继续(发送前回合)
    }

    function 等待回合同步后继续(发送前回合) {
      let 等待帧数 = 0
      requestAnimationFrame(检查回合同步)

      function 检查回合同步() {
        if (当前令牌 !== 逐帧跳转令牌) return
        等待帧数 += 1

        const 当前回合 = 读取显示回合()
        if (Number.isInteger(当前回合) && 当前回合 !== 发送前回合) {
          状态.当前回合 = 当前回合
          requestAnimationFrame(逐帧单步)
          return
        }
        if (等待帧数 >= 30) return
        requestAnimationFrame(检查回合同步)
      }
    }
  }

  function 取得目标大回合(回合, 方向) {
    if (方向 > 0) {
      return Math.floor(回合 / 大回合turn数) * 大回合turn数 + 大回合turn数
    }
    if (回合 <= 0) return 0
    if (回合 % 大回合turn数 === 0) return 回合 - 大回合turn数
    return Math.floor(回合 / 大回合turn数) * 大回合turn数
  }

  function 读取跳转方向(事件) {
    if (事件.code === 'KeyA' || 事件.key?.toLowerCase() === 'a') return -1
    if (事件.code === 'KeyD' || 事件.key?.toLowerCase() === 'd') return 1
    return 0
  }

  function 是Shift按键(事件) {
    return 事件.key === 'Shift' || 事件.code === 'ShiftLeft'
  }

  function 发送按键(类型, 按键) {
    const 事件 = new KeyboardEvent(类型, {
      bubbles: true,
      cancelable: true,
      key: 按键.key,
      code: 按键.code,
    })
    Object.defineProperties(事件, {
      keyCode: { get: () => 按键.keyCode },
      which: { get: () => 按键.keyCode },
    })
    window.dispatchEvent(事件)
  }

  function 发送按键到目标(目标, 类型, 按键) {
    const 事件 = new KeyboardEvent(类型, {
      bubbles: true,
      cancelable: true,
      key: 按键.key,
      code: 按键.code,
    })
    Object.defineProperties(事件, {
      keyCode: { get: () => 按键.keyCode },
      which: { get: () => 按键.keyCode },
    })
    目标.dispatchEvent(事件)
  }

  function 取得按键(key, code, keyCode) {
    return { key, code, keyCode }
  }

  function 是网页回放中() {
    return Boolean(
      globalThis.location?.pathname?.startsWith('/replays/') ||
      document.getElementById('replay-turn-jump-input'),
    )
  }

  function 取得回放地址() {
    if (!是网页回放中()) return null
    return `${globalThis.location?.pathname ?? ''}${globalThis.location?.search ?? ''}`
  }

  function 回放回合控件已就绪() {
    return Boolean(
      document.getElementById('replay-turn-jump-input') ||
      document.getElementById('turn-counter'),
    )
  }

  function 是输入元素(目标) {
    const 元素 = 目标 instanceof Element ? 目标 : null
    return Boolean(
      元素?.closest?.('input, textarea, select, [contenteditable="true"]'),
    )
  }

  function 是回放跳转输入(目标) {
    const 元素 = 目标 instanceof Element ? 目标 : null
    return 元素?.id === 'replay-turn-jump-input'
  }
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 主程序功能 })
