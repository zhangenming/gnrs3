export function 画兵力文本(ctx, x, y, 大小, 文本, 颜色) {
  const 字号比例 = 文本.length >= 3 ? 0.46 : 文本.length >= 2 ? 0.54 : 0.64
  const 字号 = Math.max(12, Math.min(24, 大小 * 字号比例))
  const 中心x = x + 大小 / 2
  const 中心y = y + 大小 / 2

  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.font = `900 ${字号}px Arial, sans-serif`
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.92)'
  ctx.lineWidth = Math.max(2, 大小 * 0.12)
  ctx.fillStyle = 颜色
  ctx.strokeText(文本, 中心x, 中心y)
  ctx.fillText(文本, 中心x, 中心y)
  ctx.restore()
}

export function 画旋转框(ctx, x, y, 大小, 动画时间, 动画周期, 颜色) {
  const 中心X = x + 大小 / 2
  const 中心Y = y + 大小 / 2
  const 框大小 = Math.max(1, 大小 * 0.62)
  const 角长 = Math.max(5, 大小 * 0.2)
  const 线宽 = Math.max(2, 大小 * 0.06)
  const 左 = 中心X - 框大小 / 2
  const 上 = 中心Y - 框大小 / 2
  const 右 = 左 + 框大小
  const 下 = 上 + 框大小
  const 角度 = (动画时间 / 动画周期) * Math.PI * 2

  ctx.save()
  ctx.translate(中心X, 中心Y)
  ctx.rotate(角度)
  ctx.translate(-中心X, -中心Y)
  ctx.lineWidth = 线宽
  ctx.strokeStyle = 颜色
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
  ctx.shadowBlur = Math.max(2, 大小 * 0.08)
  ctx.beginPath()
  ctx.moveTo(左, 上 + 角长)
  ctx.lineTo(左, 上)
  ctx.lineTo(左 + 角长, 上)
  ctx.moveTo(右 - 角长, 上)
  ctx.lineTo(右, 上)
  ctx.lineTo(右, 上 + 角长)
  ctx.moveTo(右, 下 - 角长)
  ctx.lineTo(右, 下)
  ctx.lineTo(右 - 角长, 下)
  ctx.moveTo(左 + 角长, 下)
  ctx.lineTo(左, 下)
  ctx.lineTo(左, 下 - 角长)
  ctx.stroke()
  ctx.restore()
}
