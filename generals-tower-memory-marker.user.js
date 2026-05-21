// ==UserScript==
// @name         generals.io 塔记忆标记
// @namespace    https://generals.io/
// @version      0.3.1
// @description  发现塔后固定标记该位置，丢失视野后仍保留标记。
// @author       Codex
// @match        https://generals.io/*
// @match        http://generals.io/*
// @match        https://ws.generals.io/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  var 覆盖层类名 = "gio-tower-memory-overlay";
  var 样式编号 = "gio-tower-memory-style";
  var 日志前缀 = "[塔记忆]";
  var 详细日志 = true;

  var 状态 = {
    宽度: 0,
    高度: 0,
    塔列表: null,
    已知塔集合: new Set(),
    已请求渲染: false,
    socket已挂钩: false,
    页面观察器: null,
    最近日志: [],
    上次无尺寸日志: 0,
    上次无画布日志: 0
  };

  function 记日志(事件, 数据) {
    var 条目 = { 时间: new Date().toISOString(), 事件: 事件, 数据: 数据 || null };
    状态.最近日志.push(条目);
    if (状态.最近日志.length > 300) 状态.最近日志.shift();
    if (详细日志) {
      if (数据 === undefined) console.log(日志前缀, 事件);
      else console.log(日志前缀, 事件, 数据);
    }
  }

  function 记错误(事件, 错误) {
    var 文本 = 错误 && 错误.stack ? 错误.stack : String(错误);
    状态.最近日志.push({ 时间: new Date().toISOString(), 事件: 事件 + "失败", 数据: 文本 });
    if (状态.最近日志.length > 300) 状态.最近日志.shift();
    console.error(日志前缀, 事件 + "失败", 错误);
  }

  function 安全执行(事件, 函数体) {
    try {
      return 函数体();
    } catch (错误) {
      记错误(事件, 错误);
      return null;
    }
  }

  function 延后执行(事件, 函数体) {
    setTimeout(function () {
      安全执行(事件, 函数体);
    }, 0);
  }

  function 应用增量(旧数组, 增量) {
    if (!Array.isArray(增量)) return null;
    if (!Array.isArray(旧数组)) 旧数组 = [];

    var 新数组 = [];
    for (var i = 0; i < 增量.length;) {
      var 保留数量 = 增量[i] || 0;
      if (保留数量 > 0) {
        Array.prototype.push.apply(新数组, 旧数组.slice(新数组.length, 新数组.length + 保留数量));
      }

      i += 1;
      if (i < 增量.length) {
        var 插入数量 = 增量[i] || 0;
        if (插入数量 > 0) {
          Array.prototype.push.apply(新数组, 增量.slice(i + 1, i + 1 + 插入数量));
          i += 插入数量;
        }
      }

      i += 1;
    }
    return 新数组;
  }

  function 尝试从地图读取尺寸(数据包) {
    if (状态.宽度 > 0 && 状态.高度 > 0) return;

    var 地图数组 = null;
    var 来源 = null;
    if (Array.isArray(数据包 && 数据包.map)) {
      地图数组 = 数据包.map;
      来源 = "map";
    } else if (Array.isArray(数据包 && 数据包.map_diff) && 数据包.map_diff[0] === 0 && 数据包.map_diff.length > 4) {
      地图数组 = 应用增量([], 数据包.map_diff);
      来源 = "首个map_diff";
    }

    if (!Array.isArray(地图数组) || 地图数组.length < 2) return;
    var 宽度 = 地图数组[0];
    var 高度 = 地图数组[1];
    var 格子数 = 宽度 * 高度;
    if (!Number.isFinite(宽度) || !Number.isFinite(高度) || 格子数 <= 0) return;
    if (地图数组.length < 2 + 格子数 * 2) return;

    状态.宽度 = 宽度;
    状态.高度 = 高度;
    记日志("已读取地图尺寸", { 来源: 来源, 宽度: 宽度, 高度: 高度 });
  }

  function 取得本次塔列表(数据包) {
    if (Array.isArray(数据包 && 数据包.cities)) {
      return { 来源: "cities", 塔列表: 数据包.cities.slice() };
    }

    if (Array.isArray(数据包 && 数据包.cities_diff)) {
      if (Array.isArray(状态.塔列表)) {
        return { 来源: "cities_diff", 塔列表: 应用增量(状态.塔列表, 数据包.cities_diff) };
      }

      if (数据包.cities_diff[0] === 0 && 数据包.cities_diff.length > 1) {
        return { 来源: "首个cities_diff", 塔列表: 应用增量([], 数据包.cities_diff) };
      }

      记日志("收到塔增量但还没有塔基准，等待首包", {
        回合: 数据包 && 数据包.turn,
        cities_diff: 数据包.cities_diff.slice(0, 20),
        增量长度: 数据包.cities_diff.length
      });
    }

    return null;
  }

  function 处理塔位置(数据包, 来源事件) {
    尝试从地图读取尺寸(数据包);

    var 塔信息 = 取得本次塔列表(数据包);
    记日志("处理塔位置", {
      来源事件: 来源事件,
      回合: 数据包 && 数据包.turn,
      塔来源: 塔信息 && 塔信息.来源,
      当前塔列表长度: 塔信息 && 塔信息.塔列表 ? 塔信息.塔列表.length : null,
      已知塔数量: 状态.已知塔集合.size,
      地图尺寸: 状态.宽度 && 状态.高度 ? 状态.宽度 + "x" + 状态.高度 : null
    });

    if (!塔信息 || !Array.isArray(塔信息.塔列表)) {
      请求渲染();
      return;
    }

    状态.塔列表 = 塔信息.塔列表.slice();

    var 新塔 = [];
    for (var i = 0; i < 状态.塔列表.length; i += 1) {
      var 塔索引 = 状态.塔列表[i];
      if (!Number.isInteger(塔索引) || 塔索引 < 0) continue;
      if (!状态.已知塔集合.has(塔索引)) {
        状态.已知塔集合.add(塔索引);
        新塔.push(塔索引);
      }
    }

    if (新塔.length > 0) {
      记日志("发现塔并固定标记", {
        回合: 数据包 && 数据包.turn,
        新塔数量: 新塔.length,
        新塔: 新塔.map(function (索引) {
          return {
            索引: 索引,
            行: 状态.宽度 ? Math.floor(索引 / 状态.宽度) : null,
            列: 状态.宽度 ? 索引 % 状态.宽度 : null
          };
        }),
        已知塔总数: 状态.已知塔集合.size
      });
    }

    请求渲染();
  }

  function 重置本局(数据包) {
    状态.宽度 = 0;
    状态.高度 = 0;
    状态.塔列表 = null;
    状态.已知塔集合.clear();
    清空覆盖层();
    记日志("新局重置", {
      数据键: 数据包 ? Object.keys(数据包) : [],
      有map: Array.isArray(数据包 && 数据包.map),
      有map_diff: Array.isArray(数据包 && 数据包.map_diff),
      有cities: Array.isArray(数据包 && 数据包.cities),
      有cities_diff: Array.isArray(数据包 && 数据包.cities_diff)
    });
  }

  function 挂钩socket(socket) {
    if (!socket || socket.__塔记忆已挂钩) return;
    socket.__塔记忆已挂钩 = true;
    状态.socket已挂钩 = true;

    记日志("socket已挂钩", {
      connected: socket.connected,
      id: socket.id,
      on: typeof socket.on,
      emit: typeof socket.emit
    });

    socket.on("game_start", function (数据包) {
      记日志("收到game_start", {
        数据键: 数据包 ? Object.keys(数据包) : [],
        有map: Array.isArray(数据包 && 数据包.map),
        有map_diff: Array.isArray(数据包 && 数据包.map_diff),
        有cities: Array.isArray(数据包 && 数据包.cities),
        有cities_diff: Array.isArray(数据包 && 数据包.cities_diff)
      });
      延后执行("game_start", function () {
        重置本局(数据包 || {});
        处理塔位置(数据包 || {}, "game_start");
      });
    });

    socket.on("game_update", function (数据包) {
      记日志("收到game_update", {
        回合: 数据包 && 数据包.turn,
        cities长度: Array.isArray(数据包 && 数据包.cities) ? 数据包.cities.length : null,
        cities_diff长度: Array.isArray(数据包 && 数据包.cities_diff) ? 数据包.cities_diff.length : null,
        cities_diff前20项: Array.isArray(数据包 && 数据包.cities_diff) ? 数据包.cities_diff.slice(0, 20) : null,
        有map: Array.isArray(数据包 && 数据包.map),
        map_diff长度: Array.isArray(数据包 && 数据包.map_diff) ? 数据包.map_diff.length : null
      });
      延后执行("game_update", function () {
        处理塔位置(数据包 || {}, "game_update");
      });
    });
  }

  function 安装socket访问器() {
    var 当前socket = window.socket;
    try {
      var 描述符 = Object.getOwnPropertyDescriptor(window, "socket");
      if (!描述符 || 描述符.configurable) {
        Object.defineProperty(window, "socket", {
          configurable: true,
          enumerable: true,
          get: function () {
            return 当前socket;
          },
          set: function (新socket) {
            当前socket = 新socket;
            记日志("window.socket被赋值", {
              存在: Boolean(新socket),
              connected: 新socket && 新socket.connected,
              id: 新socket && 新socket.id
            });
            延后执行("挂钩socket", function () {
              挂钩socket(新socket);
            });
          }
        });
        记日志("socket访问器已安装");
      }
    } catch (错误) {
      记错误("安装socket访问器", 错误);
    }

    if (当前socket) 挂钩socket(当前socket);
  }

  function 轮询socket() {
    if (window.socket) 挂钩socket(window.socket);
    setTimeout(轮询socket, 状态.socket已挂钩 ? 2000 : 200);
  }

  function 安装样式() {
    if (!document.documentElement || document.getElementById(样式编号)) return;
    var 样式 = document.createElement("style");
    样式.id = 样式编号;
    样式.textContent = [
      "." + 覆盖层类名 + " {",
      "  position: absolute;",
      "  left: 0;",
      "  top: 0;",
      "  pointer-events: none;",
      "  z-index: 28;",
      "}",
      ".gio-tower-memory-host {",
      "  position: relative !important;",
      "}"
    ].join("\n");
    document.documentElement.appendChild(样式);
  }

  function 取画布() {
    return document.querySelector(".game-map-canvas");
  }

  function 取宿主(画布) {
    if (!画布) return null;
    return 画布.parentElement || 画布.closest(".relative") || 画布.closest(".game-page");
  }

  function 确保覆盖层() {
    安装样式();
    var 画布 = 取画布();
    if (!画布) {
      var 现在 = Date.now();
      if (现在 - 状态.上次无画布日志 > 2000) {
        状态.上次无画布日志 = 现在;
        记日志("未找到棋盘画布", { 已知塔数量: 状态.已知塔集合.size, 页面: location.pathname });
      }
      return null;
    }

    var 宿主 = 取宿主(画布);
    if (!宿主) return null;
    宿主.classList.add("gio-tower-memory-host");

    var 覆盖层 = 宿主.querySelector("." + 覆盖层类名);
    if (!覆盖层) {
      覆盖层 = document.createElement("canvas");
      覆盖层.className = 覆盖层类名;
      宿主.appendChild(覆盖层);
      记日志("覆盖层已创建", { 宿主类名: 宿主.className });
    }

    return { 画布: 画布, 宿主: 宿主, 覆盖层: 覆盖层 };
  }

  function 清空覆盖层() {
    var 覆盖层 = document.querySelector("." + 覆盖层类名);
    if (!覆盖层) return;
    var ctx = 覆盖层.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, 覆盖层.width, 覆盖层.height);
  }

  function 调整覆盖层(部件) {
    var 画布矩形 = 部件.画布.getBoundingClientRect();
    var 宿主矩形 = 部件.宿主.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var css宽 = Math.max(1, 画布矩形.width);
    var css高 = Math.max(1, 画布矩形.height);
    var 像素宽 = Math.round(css宽 * dpr);
    var 像素高 = Math.round(css高 * dpr);

    if (部件.覆盖层.width !== 像素宽) 部件.覆盖层.width = 像素宽;
    if (部件.覆盖层.height !== 像素高) 部件.覆盖层.height = 像素高;
    部件.覆盖层.style.width = css宽 + "px";
    部件.覆盖层.style.height = css高 + "px";
    部件.覆盖层.style.left = 画布矩形.left - 宿主矩形.left + "px";
    部件.覆盖层.style.top = 画布矩形.top - 宿主矩形.top + "px";

    return { dpr: dpr, css宽: css宽, css高: css高 };
  }

  function 画塔标记(ctx, x, y, 大小) {
    var 外线宽 = Math.max(2, 大小 * 0.09);
    var 内线宽 = Math.max(1.5, 大小 * 0.045);
    var 外偏移 = 外线宽 / 2 + 1;
    var 内偏移 = 外偏移 + 外线宽 / 2 + 内线宽 / 2;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.lineWidth = 外线宽;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.88)";
    ctx.strokeRect(
      x + 外偏移,
      y + 外偏移,
      Math.max(1, 大小 - 外偏移 * 2),
      Math.max(1, 大小 - 外偏移 * 2)
    );

    ctx.lineWidth = 内线宽;
    ctx.strokeStyle = "#ffd84d";
    ctx.strokeRect(
      x + 内偏移,
      y + 内偏移,
      Math.max(1, 大小 - 内偏移 * 2),
      Math.max(1, 大小 - 内偏移 * 2)
    );

    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(1, 内线宽 * 0.75);
    ctx.strokeStyle = "#fff4a8";
    ctx.strokeRect(
      x + 内偏移 + 内线宽 * 1.5,
      y + 内偏移 + 内线宽 * 1.5,
      Math.max(1, 大小 - (内偏移 + 内线宽 * 1.5) * 2),
      Math.max(1, 大小 - (内偏移 + 内线宽 * 1.5) * 2)
    );
    ctx.restore();
  }

  function 渲染() {
    状态.已请求渲染 = false;

    if (!状态.已知塔集合.size) {
      清空覆盖层();
      return;
    }

    if (!状态.宽度 || !状态.高度) {
      var 现在 = Date.now();
      if (现在 - 状态.上次无尺寸日志 > 2000) {
        状态.上次无尺寸日志 = 现在;
        记日志("已有塔位置但缺少地图宽高，无法换算坐标", {
          已知塔数量: 状态.已知塔集合.size,
          已知塔: Array.from(状态.已知塔集合).slice(0, 20)
        });
      }
      return;
    }

    var 部件 = 确保覆盖层();
    if (!部件) return;

    var 尺寸 = 调整覆盖层(部件);
    var ctx = 部件.覆盖层.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(尺寸.dpr, 0, 0, 尺寸.dpr, 0, 0);
    ctx.clearRect(0, 0, 尺寸.css宽, 尺寸.css高);

    var 格宽 = 尺寸.css宽 / 状态.宽度;
    var 格高 = 尺寸.css高 / 状态.高度;
    var 大小 = Math.min(格宽, 格高);

    状态.已知塔集合.forEach(function (索引) {
      var 行 = Math.floor(索引 / 状态.宽度);
      var 列 = 索引 % 状态.宽度;
      画塔标记(ctx, 列 * 格宽, 行 * 格高, 大小);
    });

    记日志("固定塔标记已渲染", {
      已知塔数量: 状态.已知塔集合.size,
      地图尺寸: 状态.宽度 + "x" + 状态.高度,
      覆盖层尺寸: Math.round(尺寸.css宽) + "x" + Math.round(尺寸.css高)
    });
  }

  function 请求渲染() {
    if (状态.已请求渲染) return;
    状态.已请求渲染 = true;
    requestAnimationFrame(function () {
      安全执行("渲染", 渲染);
    });
  }

  function 安装页面观察器() {
    if (状态.页面观察器) return;
    if (!document.body) {
      setTimeout(安装页面观察器, 100);
      return;
    }
    状态.页面观察器 = new MutationObserver(function () {
      请求渲染();
    });
    状态.页面观察器.observe(document.body, {
      childList: true,
      subtree: true,
      zem: true
    });

    window.addEventListener("resize", 请求渲染, { passive: true });
    window.addEventListener("wheel", 请求渲染, { passive: true, capture: true });
    window.addEventListener("mousemove", 请求渲染, { passive: true, capture: true });
    window.addEventListener("keydown", 请求渲染, { passive: true, capture: true });
    记日志("页面观察器已安装", { zem: true });
  }

  function 暴露调试接口() {
    window.gio塔标记 = {
      版本: "0.3.1",
      日志: function () {
        return 状态.最近日志.slice();
      },
      状态: function () {
        return {
          宽度: 状态.宽度,
          高度: 状态.高度,
          塔列表长度: 状态.塔列表 ? 状态.塔列表.length : null,
          已知塔数量: 状态.已知塔集合.size,
          socket已挂钩: 状态.socket已挂钩
        };
      },
      已知塔: function () {
        return Array.from(状态.已知塔集合).map(function (索引) {
          return {
            索引: 索引,
            行: 状态.宽度 ? Math.floor(索引 / 状态.宽度) : null,
            列: 状态.宽度 ? 索引 % 状态.宽度 : null
          };
        });
      },
      手动加塔: function (索引) {
        if (Number.isInteger(索引) && 索引 >= 0) {
          状态.已知塔集合.add(索引);
          记日志("手动加塔", { 索引: 索引 });
          请求渲染();
        }
      },
      手动尺寸: function (宽度, 高度) {
        状态.宽度 = 宽度;
        状态.高度 = 高度;
        记日志("手动设置地图尺寸", { 宽度: 宽度, 高度: 高度 });
        请求渲染();
      },
      清空: function () {
        状态.已知塔集合.clear();
        状态.塔列表 = null;
        清空覆盖层();
        记日志("手动清空");
      },
      重绘: 请求渲染,
      开关日志: function (值) {
        详细日志 = Boolean(值);
        记日志("日志开关", { 详细日志: 详细日志 });
      }
    };
    window.gioTowerMarker = window.gio塔标记;
  }

  function 启动() {
    记日志("脚本启动", { 版本: "0.3.1", 页面: location.href });
    暴露调试接口();
    安装socket访问器();
    轮询socket();
    安装页面观察器();
  }

  安全执行("启动", 启动);
})();
