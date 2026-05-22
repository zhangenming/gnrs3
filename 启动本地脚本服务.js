const http = require("http");
const fs = require("fs");
const path = require("path");

const 根目录 = __dirname;
const 端口 = 7777;
const 主机 = "127.0.0.1";

function 响应(响应对象, 状态码, 内容, 类型) {
  响应对象.writeHead(状态码, {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
    "Content-Type": 类型 || "text/plain; charset=utf-8"
  });
  响应对象.end(内容);
}

http.createServer(function (请求, 响应对象) {
  var 路径名 = decodeURIComponent(new URL(请求.url, "http://" + 主机).pathname);
  var 文件名 = 路径名.replace(/^\/+/, "") || "generals-tower-memory-marker.user.js";
  var 文件路径 = path.resolve(根目录, 文件名);

  if (!文件路径.startsWith(根目录 + path.sep)) {
    响应(响应对象, 403, "forbidden");
    return;
  }

  fs.readFile(文件路径, function (错误, 内容) {
    if (错误) {
      响应(响应对象, 404, "not found");
      return;
    }

    响应(响应对象, 200, 内容, "application/javascript; charset=utf-8");
  });
}).listen(端口, 主机, function () {
  console.log("本地脚本服务已启动: http://" + 主机 + ":" + 端口 + "/generals-tower-memory-marker.user.js");
});
