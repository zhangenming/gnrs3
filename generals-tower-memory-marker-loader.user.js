// ==UserScript==
// @name         generals.io 塔记忆标记本地加载器
// @namespace    https://generals.io/
// @version      0.2.0
// @description  每次刷新动态读取本地 generals-tower-memory-marker.user.js，方便直接使用最新代码。
// @author       Codex
// @match        https://generals.io/*
// @match        http://generals.io/*
// @match        https://ws.generals.io/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  var 日志前缀 = "[塔记忆加载器]";
  var 本地服务地址列表 = [
    "http://127.0.0.1:7777/generals-tower-memory-marker.user.js",
    "http://localhost:7777/generals-tower-memory-marker.user.js"
  ];

  function 记日志(事件, 数据) {
    if (数据 === undefined) console.log(日志前缀, 事件);
    else console.log(日志前缀, 事件, 数据);
  }

  function 记错误(事件, 错误) {
    console.error(日志前缀, 事件, 错误);
  }

  function 运行脚本(源码, 地址) {
    if (!源码 || !源码.trim()) {
      记错误("脚本内容为空", 地址);
      return;
    }

    记日志("读取成功，准备执行", {
      地址: 地址,
      字符数: 源码.length
    });
    try {
      unsafeWindow.Function(源码 + "\n//# sourceURL=" + 地址)();
      记日志("已在页面上下文执行");
    } catch (错误) {
      记错误("页面上下文执行失败，改用 script 注入", 错误);
      var 脚本 = document.createElement("script");
      脚本.textContent = 源码 + "\n//# sourceURL=" + 地址;
      (document.documentElement || document.head || document.body).appendChild(脚本);
      脚本.remove();
      记日志("已注入页面");
    }
  }

  function 请求脚本(地址, 成功回调, 失败回调) {
    GM_xmlhttpRequest({
      method: "GET",
      url: 地址 + "?t=" + Date.now(),
      nocache: true,
      onload: function (响应) {
        if (响应.status >= 200 && 响应.status < 300) {
          成功回调(响应.responseText, 地址);
          return;
        }
        失败回调(new Error("HTTP " + 响应.status + " " + 响应.statusText));
      },
      onerror: 失败回调,
      ontimeout: 失败回调
    });
  }

  function 依次尝试加载(下标) {
    if (下标 >= 本地服务地址列表.length) {
      记错误(
        "没有加载到本地脚本。请运行 C:\\Users\\Administrator\\Desktop\\gnrs_gpt\\启动本地脚本服务.js 对应的 node 服务，然后刷新页面。",
        本地服务地址列表
      );
      return;
    }

    var 地址 = 本地服务地址列表[下标];
    记日志("尝试读取", 地址);
    请求脚本(
      地址,
      运行脚本,
      function (错误) {
        记错误("读取失败: " + 地址, 错误);
        依次尝试加载(下标 + 1);
      }
    );
  }

  记日志("已启动");
  依次尝试加载(0);
})();
