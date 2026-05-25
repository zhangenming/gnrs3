const fs = require('fs')
const http = require('http')
const path = require('path')

const 端口 = 48291
const 根目录 = __dirname
const 类型表 = {
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
}

http
  .createServer((请求, 响应) => {
    const 网址 = new URL(请求.url, `http://127.0.0.1:${端口}`)
    const 相对路径 = decodeURIComponent(网址.pathname).replace(/^\/+/, '')
    const 文件路径 = path.resolve(根目录, 相对路径)

    响应.setHeader('Access-Control-Allow-Origin', '*')
    响应.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    响应.setHeader('Access-Control-Allow-Headers', '*')
    响应.setHeader('Cache-Control', 'no-store')

    if (请求.method === 'OPTIONS') {
      响应.writeHead(204)
      响应.end()
      return
    }

    if (!文件路径.startsWith(根目录 + path.sep)) {
      响应.writeHead(403)
      响应.end('Forbidden')
      return
    }

    fs.readFile(文件路径, (错误, 内容) => {
      if (错误) {
        响应.writeHead(404)
        响应.end('Not found')
        return
      }

      响应.writeHead(200, {
        'Content-Type':
          类型表[path.extname(文件路径)] ?? 'text/plain; charset=utf-8',
      })
      响应.end(内容)
    })
  })
  .listen(端口, '127.0.0.1', () => {})
