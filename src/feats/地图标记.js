const 样式编号 = 'gio-map-marker-style'
const 标记层类名 = 'gio-map-marker-layer'
const 塔图片路径 = '/city.png'
const 未知障碍物 = -4
const 山 = -2

const 状态 = {
  宽度: 0,
  高度: 0,
  地图数组: null,
  塔列表: null,
  已知标记: new Map(),
  已请求渲染: false,
  socket已挂钩: false,
  页面观察器: null,
  塔图片: null,
}

export function 启动地图标记() {
  安装样式()
  加载塔图片()
  轮询socket()
  安装页面观察器()
  window.addEventListener('resize', 请求渲染, { passive: true })

  function 轮询socket() {
    if (window.socket) 挂钩socket(window.socket)
    setTimeout(轮询socket, 状态.socket已挂钩 ? 2000 : 200)
  }

  function 挂钩socket(socket) {
    if (!socket || socket.__地图标记已挂钩) return
    socket.__地图标记已挂钩 = true
    状态.socket已挂钩 = true

    if (typeof socket.on === 'function') {
      socket.on('game_start', 处理游戏开始)
      socket.on('game_update', 处理游戏更新)
      return
    }

    if (typeof socket.onevent === 'function') {
      const 原onevent = socket.onevent
      socket.onevent = function (包) {
        const 数据 = Array.isArray(包?.data) ? 包.data : null
        if (数据) 预处理入站事件(数据[0], 数据[1])
        return 原onevent.call(this, 包)
      }
    }

    function 处理游戏开始(数据包) {
      重置本局()
      处理数据包(数据包)
    }

    function 处理游戏更新(数据包) {
      处理数据包(数据包)
    }

    function 预处理入站事件(事件名, 数据包) {
      if (事件名 === 'game_start') {
        处理游戏开始(数据包)
      } else if (事件名 === 'game_update') {
        处理游戏更新(数据包)
      }
    }
  }

  function 安装样式() {
    if (document.getElementById(样式编号)) return

    const 样式 = document.createElement('style')
    样式.id = 样式编号
    样式.textContent = `
      .${标记层类名} {
        position: absolute;
        pointer-events: none;
        z-index: 20;
        image-rendering: pixelated;
      }
    `
    document.documentElement.appendChild(样式)
  }

  function 加载塔图片() {
    if (状态.塔图片) return

    const 图片 = new Image()
    图片.decoding = 'async'
    图片.src = 塔图片路径
    图片.addEventListener('load', 请求渲染)
    状态.塔图片 = 图片
  }

  function 安装页面观察器() {
    if (状态.页面观察器) return
    if (!document.body) {
      setTimeout(安装页面观察器, 100)
      return
    }

    状态.页面观察器 = new MutationObserver(请求渲染)
    状态.页面观察器.observe(document.body, {
      childList: true,
      subtree: true,
      zem: true,
    })
  }
}

function 重置本局() {
  状态.宽度 = 0
  状态.高度 = 0
  状态.地图数组 = null
  状态.塔列表 = null
  状态.已知标记.clear()
  请求渲染()
}

function 处理数据包(数据包) {
  if (!数据包 || typeof 数据包 !== 'object') return

  更新地图数组()
  更新塔列表()
  记录地图标记()
  记录可见塔()
  请求渲染()

  function 更新地图数组() {
    const 完整地图数组 = 取得完整地图数组()
    if (完整地图数组) {
      状态.地图数组 = 完整地图数组.slice()
    } else if (Array.isArray(数据包.map_diff) && Array.isArray(状态.地图数组)) {
      const 新地图数组 = 应用增量(状态.地图数组, 数据包.map_diff)
      if (Array.isArray(新地图数组)) 状态.地图数组 = 新地图数组
    }

    if (Array.isArray(状态.地图数组) && 状态.地图数组.length >= 2) {
      状态.宽度 = 状态.地图数组[0]
      状态.高度 = 状态.地图数组[1]
    }
  }

  function 更新塔列表() {
    if (Array.isArray(数据包.cities)) {
      状态.塔列表 = 数据包.cities.slice()
    } else if (Array.isArray(数据包.cities_diff)) {
      const 旧塔列表 = Array.isArray(状态.塔列表) ? 状态.塔列表 : []
      状态.塔列表 = 应用增量(旧塔列表, 数据包.cities_diff)
    }
  }

  function 记录地图标记() {
    if (!地图可读()) return

    const 格子数 = 状态.宽度 * 状态.高度
    for (let idx = 0; idx < 格子数; idx += 1) {
      const 地形 = 读取地形(idx)
      const 当前标记 = 状态.已知标记.get(idx)

      if (地形 === 山) {
        状态.已知标记.set(idx, '山')
      } else if (地形 === 未知障碍物 && !当前标记) {
        状态.已知标记.set(idx, '未知')
      } else if (Number.isInteger(地形) && 地形 >= -1 && 当前标记 !== '塔') {
        状态.已知标记.delete(idx)
      }
    }
  }

  function 记录可见塔() {
    if (!地图可读() || !Array.isArray(状态.塔列表)) return

    for (const 塔索引 of 状态.塔列表) {
      if (!Number.isInteger(塔索引) || 塔索引 < 0) continue
      if (地块可见(塔索引)) 状态.已知标记.set(塔索引, '塔')
    }
  }

  function 地块可见(格子索引) {
    const 地形 = 读取地形(格子索引)
    return Number.isInteger(地形) && 地形 >= -1
  }

  function 读取地形(格子索引) {
    if (!地图可读()) return null
    const 格子数 = 状态.宽度 * 状态.高度
    if (格子索引 < 0 || 格子索引 >= 格子数) return null
    return 状态.地图数组[2 + 格子数 + 格子索引]
  }

  function 取得完整地图数组() {
    let 地图数组 = null
    if (Array.isArray(数据包.map)) {
      地图数组 = 数据包.map
    } else if (Array.isArray(数据包.map_diff) && 数据包.map_diff[0] === 0) {
      地图数组 = 应用增量([], 数据包.map_diff)
    }

    if (!Array.isArray(地图数组) || 地图数组.length < 2) return null
    const 宽度 = 地图数组[0]
    const 高度 = 地图数组[1]
    const 格子数 = 宽度 * 高度
    if (!Number.isFinite(宽度) || !Number.isFinite(高度) || 格子数 <= 0) {
      return null
    }
    if (地图数组.length < 2 + 格子数 * 2) return null
    return 地图数组
  }

  function 应用增量(旧数组, 增量) {
    if (!Array.isArray(增量)) return []
    const 新数组 = []

    for (let idx = 0; idx < 增量.length; ) {
      const 保留数量 = 增量[idx] ?? 0
      if (保留数量 > 0) {
        新数组.push(...旧数组.slice(新数组.length, 新数组.length + 保留数量))
      }

      idx += 1
      if (idx < 增量.length) {
        const 插入数量 = 增量[idx] ?? 0
        if (插入数量 > 0) {
          新数组.push(...增量.slice(idx + 1, idx + 1 + 插入数量))
          idx += 插入数量
        }
      }

      idx += 1
    }

    return 新数组
  }
}

function 请求渲染() {
  if (状态.已请求渲染) return
  状态.已请求渲染 = true
  requestAnimationFrame(渲染)
}

function 渲染() {
  状态.已请求渲染 = false

  const 部件 = 取得渲染部件()
  if (!部件 || !地图可读() || 状态.已知标记.size === 0) {
    清空标记层()
    return
  }

  const 尺寸 = 调整标记层(部件)
  if (!尺寸) return

  const ctx = 部件.标记层.getContext('2d')
  if (!ctx) return

  ctx.setTransform(尺寸.dpr, 0, 0, 尺寸.dpr, 0, 0)
  ctx.clearRect(0, 0, 尺寸.宽, 尺寸.高)

  const 格宽 = 尺寸.宽 / 状态.宽度
  const 格高 = 尺寸.高 / 状态.高度
  const 大小 = Math.min(格宽, 格高)
  const 格子数 = 状态.宽度 * 状态.高度

  for (const [idx, 类型] of 状态.已知标记) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= 格子数) continue

    const 行 = Math.floor(idx / 状态.宽度)
    const 列 = idx % 状态.宽度
    const x = 列 * 格宽
    const y = 行 * 格高

    if (类型 === '未知') {
      画未知障碍物(ctx, x, y, 格宽, 格高, 大小)
    } else if (类型 === '山') {
      画山(ctx, x, y, 格宽, 格高, 大小)
    } else if (类型 === '塔') {
      画塔(ctx, x, y, 格宽, 格高, 大小)
    }
  }

  function 取得渲染部件() {
    const 地图元素 = document.querySelector('#game-page #gameMap, #gameMap')
    if (!地图元素) return null

    const 游戏画布 = Array.from(地图元素.querySelectorAll('canvas')).find(
      function (画布) {
        return !画布.classList.contains(标记层类名)
      },
    )
    if (!游戏画布) return null

    const 标记层 = 确保标记层(地图元素)
    return { 地图元素, 游戏画布, 标记层 }
  }

  function 确保标记层(地图元素) {
    const 定位 = getComputedStyle(地图元素).position
    if (定位 === 'static') 地图元素.style.position = 'relative'

    let 标记层 = 地图元素.querySelector(`.${标记层类名}`)
    if (标记层) return 标记层

    标记层 = document.createElement('canvas')
    标记层.className = 标记层类名
    标记层.setAttribute('aria-hidden', 'true')
    地图元素.appendChild(标记层)
    return 标记层
  }

  function 调整标记层(部件) {
    const 地图矩形 = 部件.地图元素.getBoundingClientRect()
    const 画布矩形 = 部件.游戏画布.getBoundingClientRect()
    if (画布矩形.width <= 0 || 画布矩形.height <= 0) return null

    const dpr = window.devicePixelRatio || 1
    const 宽 = 画布矩形.width
    const 高 = 画布矩形.height
    部件.标记层.style.left = `${画布矩形.left - 地图矩形.left}px`
    部件.标记层.style.top = `${画布矩形.top - 地图矩形.top}px`
    部件.标记层.style.width = `${宽}px`
    部件.标记层.style.height = `${高}px`
    部件.标记层.style.display = 'block'

    const 设备宽 = Math.max(1, Math.round(宽 * dpr))
    const 设备高 = Math.max(1, Math.round(高 * dpr))
    if (部件.标记层.width !== 设备宽) 部件.标记层.width = 设备宽
    if (部件.标记层.height !== 设备高) 部件.标记层.height = 设备高

    return { 宽, 高, dpr }
  }

  function 清空标记层() {
    const 标记层 = document.querySelector(`.${标记层类名}`)
    if (!标记层) return

    const ctx = 标记层.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, 标记层.width, 标记层.height)
    标记层.style.display = 'none'
  }

  function 画未知障碍物(ctx, x, y, 格宽, 格高, 大小) {
    ctx.save()
    ctx.fillStyle = '#050505'
    ctx.fillRect(x, y, 格宽, 格高)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'
    ctx.lineWidth = Math.max(1, 大小 * 0.04)
    ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, 格宽, 格高)

    const 字号 = Math.max(12, Math.min(28, 大小 * 0.58))
    ctx.font = `900 ${字号}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(2, 大小 * 0.08)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)'
    ctx.fillStyle = '#ffffff'
    ctx.strokeText('?', x + 格宽 / 2, y + 格高 / 2)
    ctx.fillText('?', x + 格宽 / 2, y + 格高 / 2)
    ctx.restore()
  }

  function 画山(ctx, x, y, 格宽, 格高) {
    ctx.save()
    ctx.fillStyle = '#000000'
    ctx.fillRect(x, y, 格宽, 格高)
    ctx.restore()
  }

  function 画塔(ctx, x, y, 格宽, 格高) {
    const 图片 = 状态.塔图片
    if (!图片?.complete || 图片.naturalWidth <= 0 || 图片.naturalHeight <= 0) {
      return
    }

    ctx.save()
    ctx.drawImage(图片, x, y, 格宽, 格高)
    ctx.restore()
  }
}

function 地图可读() {
  if (!Array.isArray(状态.地图数组)) return false
  if (!状态.宽度 || !状态.高度) return false
  return 状态.地图数组.length >= 2 + 状态.宽度 * 状态.高度 * 2
}
