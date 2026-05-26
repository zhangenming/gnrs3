// 功能注册中心 — 零依赖模块，各功能文件通过调用 注册功能() 自注册。
// 无任何 import，确保不会产生循环依赖。
const 注册功能列表 = []
const 注册覆盖层功能列表 = []
const 注册主程序功能列表 = []
const 注册功能恢复列表 = []
const 注册socket功能列表 = []
const 注册地图更新功能列表 = []
const 注册功能样式列表 = []

export function 注册功能({
  功能定义,
  主程序功能,
  socket功能,
  覆盖层功能,
  地图更新功能,
  功能恢复,
  功能样式,
} = {}) {
  if (功能定义 && typeof 功能定义.id === 'string') {
    注册功能列表.push(功能定义)
  }
  if (typeof 主程序功能 === 'object' && 主程序功能 != null) {
    注册主程序功能列表.push(主程序功能)
  }
  if (typeof socket功能 === 'object' && socket功能 != null) {
    注册socket功能列表.push(socket功能)
  }
  if (typeof 覆盖层功能 === 'object' && 覆盖层功能 != null) {
    注册覆盖层功能列表.push(覆盖层功能)
  }
  if (typeof 地图更新功能 === 'object' && 地图更新功能 != null) {
    注册地图更新功能列表.push(地图更新功能)
  }
  if (typeof 功能恢复 === 'object' && 功能恢复 != null) {
    注册功能恢复列表.push(功能恢复)
  }
  if (typeof 功能样式 === 'string' && 功能样式.length > 0) {
    注册功能样式列表.push(功能样式)
  }
}

export {
  注册功能列表 as 功能列表,
  注册覆盖层功能列表 as 覆盖层功能列表,
  注册主程序功能列表 as 主程序功能列表,
  注册功能恢复列表 as 功能恢复列表,
  注册socket功能列表 as socket功能列表,
  注册地图更新功能列表 as 地图更新功能列表,
  注册功能样式列表 as 功能样式列表,
}
