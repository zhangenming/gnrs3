// 功能目的:
// 发现我方可见兵力已经足够吃掉敌方基地时，自动清空当前移动队列并直攻基地。
//
// 作用范围:
// 只处理敌方基地已经可见、且我方兵力能通过短路径打穿到基地的 1v1 收尾场景。
import { 大回合turn数, 基地自然增长turn数 } from '../配置.js'
import { 功能已启用 } from '../功能状态.js'
import {
  地图可读,
  是我方或队友,
  读取地图兵力,
  读取地图地块,
  读取地图归属,
} from '../游戏.js'
import { 状态 } from '../状态.js'
import {
  取得相邻索引列表,
  取得周期增长次数,
  取得回合间增长,
} from '../游戏工具.js'

const 最大集结步数 = 6
const 最大突击步数 = 6

export const 功能定义 = {
  id: '自动吃基地',
  名称: '自动吃基地',
  分类: '自动操作',
  描述: '兵力足够时自动清队列并短路径直吃敌方基地',
}

export const 功能恢复 = {
  id: 功能定义.id,
  关闭: 重置自动吃基地,
}

export const socket功能 = {
  id: 功能定义.id,
  新局重置: 重置自动吃基地,
  game_update({ socket, 请求渲染, 已自动保护 }) {
    if (已自动保护) return
    if (!功能已启用('自动吃基地')) return
    尝试自动吃敌方基地(socket, 请求渲染)
  },
}

export function 尝试自动吃敌方基地(socket, 请求渲染) {
  if (!socket || typeof socket.emit !== 'function') return
  if (globalThis.location?.pathname?.startsWith('/replays/')) return
  if (!地图可读(状态.地图数组)) return
  if (!状态.已知敌方基地集合.size) return
  if (接管冷却中()) return

  const 计划 = 取得吃基地计划()
  if (!计划) return
  let 自动攻击序号 = 取得下个攻击序号()

  状态.自动吃基地接管 = {
    基地索引: 计划.基地索引,
    截止回合: (状态.当前回合 ?? 0) + 计划.攻击列表.length + 2,
  }

  socket.emit('clear_moves')
  for (const 攻击 of 计划.攻击列表) {
    socket.emit('attack', 攻击.起点, 攻击.终点, false, 自动攻击序号)
    自动攻击序号 += 1
  }
  状态.自动吃基地攻击序号 = 自动攻击序号
  请求渲染()

  function 取得吃基地计划() {
    const 格子数 = 状态.宽度 * 状态.高度
    for (const [基地索引, 基地记忆] of 状态.已知敌方基地集合) {
      if (!Number.isInteger(基地索引) || 基地索引 < 0 || 基地索引 >= 格子数) {
        continue
      }

      const 基地兵力 = 取得基地兵力(基地索引)
      const 基地归属 = 读取地图归属(状态.地图数组, 基地索引)
      if (!Number.isInteger(基地兵力) || 基地兵力 < 0) continue
      if (
        Number.isInteger(基地归属)
          ? 是我方或队友(基地归属)
          : !是已知敌方基地(基地记忆)
      ) {
        continue
      }

      const 攻击列表 = 取得攻击列表(
        基地索引,
        取得相邻我方地块(基地索引),
        基地兵力,
      )
      if (攻击列表.length) {
        return { 基地索引, 攻击列表 }
      }
    }
    return null
  }

  function 取得基地兵力(基地索引) {
    const 实时兵力 = 读取地图兵力(状态.地图数组, 基地索引)
    if (Number.isInteger(实时兵力) && 实时兵力 >= 0) return 实时兵力

    const 记忆 = 状态.基地兵力表.get(基地索引)
    if (!记忆 || !Number.isInteger(记忆.兵力) || !Number.isInteger(记忆.回合)) {
      return null
    }
    if (!Number.isInteger(状态.当前回合) || 状态.当前回合 < 记忆.回合) {
      return 记忆.兵力
    }

    const 基地自然增长 = 取得周期增长次数(
      记忆.回合,
      状态.当前回合,
      基地自然增长turn数,
    )
    const 大回合增长 = 取得周期增长次数(记忆.回合, 状态.当前回合, 大回合turn数)
    return 记忆.兵力 + 基地自然增长 + 大回合增长
  }

  function 是已知敌方基地(基地记忆) {
    return (
      基地记忆 &&
      Number.isInteger(基地记忆.玩家索引) &&
      !是我方或队友(基地记忆.玩家索引)
    )
  }

  function 取得相邻我方地块(基地索引) {
    const 格子数 = 状态.宽度 * 状态.高度
    const 相邻索引列表 = 取得相邻索引列表(基地索引)
    const 地块列表 = []
    for (const 索引 of 相邻索引列表) {
      if (索引 < 0 || 索引 >= 格子数) continue
      const 地块 = 读取地图地块(状态.地图数组, 索引)
      const 兵力 = 地块?.兵力
      const 归属 = 地块?.归属
      if (!Number.isInteger(兵力) || 兵力 <= 1) continue
      if (!是我方或队友(归属)) continue
      地块列表.push({
        起点: 索引,
        兵力,
        可出兵: 兵力 - 1,
      })
    }
    地块列表.sort((左, 右) => {
      if (右.可出兵 !== 左.可出兵) return 右.可出兵 - 左.可出兵
      return 左.起点 - 右.起点
    })
    return 地块列表
  }

  function 取得攻击列表(基地索引, 相邻我方地块列表, 基地兵力) {
    let 最佳计划 = null
    for (const 攻击点 of 相邻我方地块列表) {
      const 计划列表 = 取得攻击点计划列表(攻击点.起点)
      for (const 计划 of 计划列表) {
        const 完整计划 = 补充相邻直攻(
          计划,
          攻击点,
          相邻我方地块列表,
          基地索引,
          基地兵力,
        )
        if (!完整计划) continue
        if (!最佳计划 || 完整计划.攻击列表.length < 最佳计划.攻击列表.length) {
          最佳计划 = 完整计划
        }
      }
    }
    if (最佳计划?.攻击列表?.length) return 最佳计划.攻击列表
    return 取得突击攻击列表(基地索引, 基地兵力)

    function 取得攻击点计划列表(攻击点索引) {
      const 队列 = [
        {
          索引: 攻击点索引,
          深度: 0,
        },
      ]
      const 已访问集合 = new Set([攻击点索引])
      const 节点表 = new Map([
        [
          攻击点索引,
          {
            索引: 攻击点索引,
            父级索引: null,
            深度: 0,
            兵力: 读取地图兵力(状态.地图数组, 攻击点索引),
          },
        ],
      ])

      for (let idx = 0; idx < 队列.length; idx += 1) {
        const 当前 = 队列[idx]
        if (当前.深度 >= 最大集结步数) continue

        for (const 相邻索引 of 取得相邻索引列表(当前.索引)) {
          if (已访问集合.has(相邻索引)) continue
          if (相邻索引 === 基地索引) continue
          if (!是我方地块(相邻索引)) continue
          已访问集合.add(相邻索引)
          const 深度 = 当前.深度 + 1
          节点表.set(相邻索引, {
            索引: 相邻索引,
            父级索引: 当前.索引,
            深度,
            兵力: 读取地图兵力(状态.地图数组, 相邻索引),
          })
          队列.push({
            索引: 相邻索引,
            深度,
          })
        }
      }

      const 已选索引集合 = new Set([攻击点索引])
      const 计划列表 = [构建攻击点计划(已选索引集合)]
      const 候选节点列表 = Array.from(节点表.values())
        .filter((节点) => 节点.索引 !== 攻击点索引 && 节点.兵力 > 1)
        .sort((左, 右) => {
          const 左贡献 = 左.兵力 - 1
          const 右贡献 = 右.兵力 - 1
          if (右贡献 !== 左贡献) return 右贡献 - 左贡献
          if (左.深度 !== 右.深度) return 左.深度 - 右.深度
          return 左.索引 - 右.索引
        })

      for (const 节点 of 候选节点列表) {
        添加到根路径(节点.索引, 已选索引集合)
        计划列表.push(构建攻击点计划(已选索引集合))
      }
      return 计划列表

      function 添加到根路径(索引, 已选索引集合) {
        let 当前索引 = 索引
        while (Number.isInteger(当前索引)) {
          已选索引集合.add(当前索引)
          当前索引 = 节点表.get(当前索引)?.父级索引
        }
      }

      function 构建攻击点计划(已选索引集合) {
        const 已选节点列表 = Array.from(已选索引集合)
          .map((索引) => 节点表.get(索引))
          .filter(Boolean)
        const 集结移动列表 = 已选节点列表
          .filter((节点) => 节点.索引 !== 攻击点索引)
          .sort((左, 右) => {
            if (右.深度 !== 左.深度) return 右.深度 - 左.深度
            return 左.索引 - 右.索引
          })
          .map((节点) => ({
            起点: 节点.索引,
            终点: 节点.父级索引,
            伤害: 0,
          }))
        const 伤害 =
          已选节点列表.reduce((合计, 节点) => {
            return 合计 + 节点.兵力
          }, 0) - 已选节点列表.length
        return {
          已选索引集合: new Set(已选索引集合),
          集结移动列表,
          伤害,
        }
      }
    }

    function 补充相邻直攻(计划, 攻击点, 相邻我方地块列表, 基地索引, 基地兵力) {
      const 直攻列表 = []
      let 伤害合计 = 计划.伤害
      const 集结后移动数量 = 计划.集结移动列表.length + 1
      if (足够吃掉基地(伤害合计, 基地兵力, 集结后移动数量)) {
        return {
          攻击列表: [
            ...计划.集结移动列表,
            {
              起点: 攻击点.起点,
              终点: 基地索引,
              伤害: 计划.伤害,
            },
          ],
        }
      }

      for (const 攻击 of 相邻我方地块列表) {
        if (计划.已选索引集合.has(攻击.起点)) continue
        直攻列表.push({
          起点: 攻击.起点,
          终点: 基地索引,
          伤害: 攻击.可出兵,
        })
        伤害合计 += 攻击.可出兵
        const 移动数量 = 直攻列表.length + 计划.集结移动列表.length + 1
        if (足够吃掉基地(伤害合计, 基地兵力, 移动数量)) {
          return {
            攻击列表: [
              ...直攻列表,
              ...计划.集结移动列表,
              {
                起点: 攻击点.起点,
                终点: 基地索引,
                伤害: 计划.伤害,
              },
            ],
          }
        }
      }
      return null
    }

    function 取得突击攻击列表(基地索引, 基地兵力) {
      const 节点表 = 构建突击节点表(基地索引)
      const 候选列表 = []
      for (const 节点 of 节点表.values()) {
        if (节点.索引 === 基地索引) continue

        const 起点地块 = 读取地图地块(状态.地图数组, 节点.索引)
        const 起点兵力 = 起点地块?.兵力
        const 起点归属 = 起点地块?.归属
        if (!Number.isInteger(起点兵力) || 起点兵力 <= 1) continue
        if (!是我方或队友(起点归属)) continue

        const 路径 = 构建突击路径(节点.索引, 节点表, 基地索引)
        const 模拟 = 模拟突击路径(路径, 基地索引)
        if (!模拟) continue

        const 移动数量 = 路径.length - 1
        if (!足够吃掉基地(模拟.伤害, 基地兵力, 移动数量)) continue

        候选列表.push({
          起点: 节点.索引,
          起点兵力,
          移动数量,
          伤害: 模拟.伤害,
          攻击列表: 路径.slice(0, -1).map((起点, idx) => {
            const 是最后一步 = idx === 路径.length - 2
            return {
              起点,
              终点: 路径[idx + 1],
              伤害: 是最后一步 ? 模拟.伤害 : 0,
            }
          }),
        })
      }

      候选列表.sort((左, 右) => {
        if (左.移动数量 !== 右.移动数量) return 左.移动数量 - 右.移动数量
        if (右.伤害 !== 左.伤害) return 右.伤害 - 左.伤害
        if (右.起点兵力 !== 左.起点兵力) return 右.起点兵力 - 左.起点兵力
        return 左.起点 - 右.起点
      })
      return 候选列表[0]?.攻击列表 ?? []

      function 构建突击节点表(基地索引) {
        const 队列 = [
          {
            索引: 基地索引,
            深度: 0,
          },
        ]
        const 节点表 = new Map([
          [
            基地索引,
            {
              索引: 基地索引,
              父级索引: null,
              深度: 0,
            },
          ],
        ])

        for (let idx = 0; idx < 队列.length; idx += 1) {
          const 当前 = 队列[idx]
          if (当前.深度 >= 最大突击步数) continue

          for (const 相邻索引 of 取得相邻索引列表(当前.索引)) {
            if (节点表.has(相邻索引)) continue
            if (!是可突击路径格(相邻索引, 基地索引)) continue

            const 深度 = 当前.深度 + 1
            节点表.set(相邻索引, {
              索引: 相邻索引,
              父级索引: 当前.索引,
              深度,
            })
            队列.push({
              索引: 相邻索引,
              深度,
            })
          }
        }
        return 节点表
      }

      function 构建突击路径(起点索引, 节点表, 基地索引) {
        const 路径 = []
        let 当前索引 = 起点索引
        while (Number.isInteger(当前索引)) {
          路径.push(当前索引)
          if (当前索引 === 基地索引) break
          当前索引 = 节点表.get(当前索引)?.父级索引
        }
        return 路径.at(-1) === 基地索引 ? 路径 : []
      }

      function 模拟突击路径(路径, 基地索引) {
        if (!Array.isArray(路径) || 路径.length < 2) return null

        let 当前兵力 = 读取地图兵力(状态.地图数组, 路径[0])
        if (!Number.isInteger(当前兵力) || 当前兵力 <= 1) return null

        for (let idx = 1; idx < 路径.length; idx += 1) {
          const 目标索引 = 路径[idx]
          const 出兵 = 当前兵力 - 1
          if (出兵 <= 0) return null
          if (目标索引 === 基地索引) return { 伤害: 出兵 }

          const 目标地块 = 读取地图地块(状态.地图数组, 目标索引)
          const 目标兵力 = 目标地块?.兵力
          const 目标归属 = 目标地块?.归属
          if (!Number.isInteger(目标兵力) || 目标兵力 < 0) return null

          if (是我方或队友(目标归属)) {
            当前兵力 = 出兵 + 目标兵力
          } else {
            if (!是可突击路径格(目标索引, 基地索引)) return null
            if (出兵 <= 目标兵力) return null
            当前兵力 = 出兵 - 目标兵力
          }
        }
        return null
      }

      function 是可突击路径格(索引, 基地索引) {
        const 格子数 = 状态.宽度 * 状态.高度
        if (!Number.isInteger(索引) || 索引 < 0 || 索引 >= 格子数) return false
        if (索引 === 基地索引) return true
        if (状态.已知障碍物集合.has(索引)) return false

        const 地块 = 读取地图地块(状态.地图数组, 索引)
        const 归属 = 地块?.归属
        const 兵力 = 地块?.兵力
        return Number.isInteger(归属) && 归属 >= -1 && Number.isInteger(兵力)
      }
    }
  }

  function 足够吃掉基地(伤害合计, 基地兵力, 移动数量) {
    const 基地预估增长 =
      取得回合间增长(状态.当前回合, 状态.当前回合 + 移动数量) ?? Infinity
    return 伤害合计 > 基地兵力 + 基地预估增长
  }

  function 是我方地块(索引) {
    const 地块 = 读取地图地块(状态.地图数组, 索引)
    const 兵力 = 地块?.兵力
    const 归属 = 地块?.归属
    return Number.isInteger(兵力) && 兵力 > 0 && 是我方或队友(归属)
  }

  function 接管冷却中() {
    const 接管 = 状态.自动吃基地接管
    if (!接管) return false
    if (!Number.isInteger(状态.当前回合)) return true
    if (状态.当前回合 <= 接管.截止回合) return true
    状态.自动吃基地接管 = null
    return false
  }

  function 取得下个攻击序号() {
    let 队列最大攻击序号 = 0
    for (const 移动 of 状态.移动队列) {
      if (
        Number.isInteger(移动?.攻击序号) &&
        移动.攻击序号 > 队列最大攻击序号
      ) {
        队列最大攻击序号 = 移动.攻击序号
      }
    }
    return Math.max(
      Number.isInteger(状态.自动吃基地攻击序号) ? 状态.自动吃基地攻击序号 : 1,
      Number.isInteger(状态.自动保护基地攻击序号)
        ? 状态.自动保护基地攻击序号
        : 1,
      队列最大攻击序号 + 1,
    )
  }
}

export function 重置自动吃基地() {
  状态.自动吃基地接管 = null
  状态.自动吃基地攻击序号 = 1
}

import { 注册功能 } from '../注册中心.js'
注册功能({ 功能定义, 功能恢复, socket功能 })
