// ==UserScript==
// @name         generals.io 塔记忆标记
// @namespace    https://generals.io/
// @version      0.2.0
// @description  记住已发现的塔，并在丢失视野后继续显示标记。
// @author       Codex
// @match        https://generals.io/*
// @match        http://generals.io/*
// @match        https://ws.generals.io/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  var 空地 = -1;
  var 山 = -2;
  var 迷雾 = -3;
  var 障碍迷雾 = -4;

  var 覆盖层类名 = "gio-tower-memory-overlay";
  var 样式元素编号 = "gio-tower-memory-style";
  var 日志前缀 = "[塔记忆]";
  var 详细日志 = true;

  var 状态 = {
    宽度: 0,
    高度: 0,
    上次地图: null,
    上次塔列表: null,
    已知塔: new Map(),
    我方索引: null,
    队伍: null,
    当前局编号: "",
    socket已挂钩: false,
    已请求渲染: false,
    页面观察器: null,
    最近日志: [],
    上次缺少画布日志时间: 0,
    上次缺少尺寸日志时间: 0
  };

  function 记录日志(阶段, 数据) {
    var 条目 = {
      时间: new Date().toISOString(),
      阶段: 阶段,
      数据: 数据 || null
    };
    状态.最近日志.push(条目);
    if (状态.最近日志.length > 300) 状态.最近日志.shift();
    if (详细日志) {
      if (数据 === undefined) console.log(日志前缀, 阶段);
      else console.log(日志前缀, 阶段, 数据);
    }
  }

  function 记录错误(阶段, 错误) {
    var 文本 = 错误 && 错误.stack ? 错误.stack : String(错误);
    状态.最近日志.push({
      时间: new Date().toISOString(),
      阶段: 阶段 + "失败",
      数据: 文本
    });
    if (状态.最近日志.length > 300) 状态.最近日志.shift();
    console.error(日志前缀, 阶段 + "失败", 错误);
  }

  function 安全执行(阶段, 函数体) {
    try {
      return 函数体();
    } catch (错误) {
      记录错误(阶段, 错误);
      return null;
    }
  }

  function 延后处理(阶段, 函数体) {
    setTimeout(function () {
      安全执行(阶段, 函数体);
    }, 0);
  }

  function 复制数组(值) {
    return Array.isArray(值) ? 值.slice() : null;
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

  function 读取完整地图(数据包) {
    if (!数据包) return null;

    var 来源 = "无";
    var 序列化地图 = null;

    if (Array.isArray(数据包.map)) {
      来源 = "map";
      序列化地图 = 复制数组(数据包.map);
    } else if (Array.isArray(数据包.map_diff)) {
      来源 = "map_diff";
      if (!Array.isArray(状态.上次地图)) {
        记录日志("收到map_diff但缺少上次地图", {
          回合: 数据包.turn,
          增量长度: 数据包.map_diff.length
        });
        return null;
      }
      序列化地图 = 应用增量(状态.上次地图, 数据包.map_diff);
    }

    if (!序列化地图 || 序列化地图.length < 2) return null;

    var 宽度 = 序列化地图[0];
    var 高度 = 序列化地图[1];
    var 格子数 = 宽度 * 高度;
    if (!Number.isFinite(宽度) || !Number.isFinite(高度) || 格子数 <= 0) {
      记录日志("地图尺寸无效", { 宽度: 宽度, 高度: 高度, 来源: 来源 });
      return null;
    }
    if (序列化地图.length < 2 + 格子数 * 2) {
      记录日志("地图数组长度不足", {
        来源: 来源,
        长度: 序列化地图.length,
        预期最小长度: 2 + 格子数 * 2
      });
      return null;
    }

    return {
      来源: 来源,
      序列化地图: 序列化地图,
      宽度: 宽度,
      高度: 高度,
      格子数: 格子数,
      兵力偏移: 2,
      地块偏移: 2 + 格子数
    };
  }

  function 读取完整塔列表(数据包) {
    if (!数据包) return null;

    if (Array.isArray(数据包.cities)) {
      return {
        来源: "cities",
        塔列表: 复制数组(数据包.cities)
      };
    }

    if (Array.isArray(数据包.cities_diff)) {
      if (!Array.isArray(状态.上次塔列表)) {
        记录日志("收到cities_diff但缺少上次塔列表", {
          回合: 数据包.turn,
          增量长度: 数据包.cities_diff.length
        });
        return null;
      }
      return {
        来源: "cities_diff",
        塔列表: 应用增量(状态.上次塔列表, 数据包.cities_diff)
      };
    }

    return null;
  }

  function 生成局编号(数据包) {
    return [
      数据包 && 数据包.replay_id || "",
      数据包 && 数据包.chat_room || "",
      数据包 && 数据包.team_chat_room || "",
      Date.now()
    ].join("|");
  }

  function 重置本局(数据包) {
    状态.宽度 = 0;
    状态.高度 = 0;
    状态.上次地图 = null;
    状态.上次塔列表 = null;
    状态.已知塔.clear();
    状态.我方索引 = 数据包 && Number.isInteger(数据包.playerIndex) ? 数据包.playerIndex : null;
    状态.队伍 = 数据包 && Array.isArray(数据包.teams) ? 数据包.teams.slice() : null;
    状态.当前局编号 = 生成局编号(数据包 || {});

    清空覆盖层();
    请求渲染();

    记录日志("新局开始", {
      局编号: 状态.当前局编号,
      我方索引: 状态.我方索引,
      用户名数量: 数据包 && Array.isArray(数据包.usernames) ? 数据包.usernames.length : null,
      数据键: 数据包 ? Object.keys(数据包) : []
    });
  }

  function 是否我方玩家(玩家索引) {
    if (!Number.isInteger(玩家索引) || 玩家索引 < 0) return false;
    if (状态.我方索引 === null) return false;
    if (玩家索引 === 状态.我方索引) return true;
    if (!Array.isArray(状态.队伍)) return false;
    return 状态.队伍[玩家索引] !== undefined && 状态.队伍[玩家索引] === 状态.队伍[状态.我方索引];
  }

  function 判断塔类型(地图信息, 塔索引) {
    if (!地图信息 || !Number.isInteger(塔索引)) return "塔";
    var 地块值 = 地图信息.序列化地图[地图信息.地块偏移 + 塔索引];
    if (Number.isInteger(地块值) && 地块值 >= 0) {
      return 是否我方玩家(地块值) ? "我方塔" : "敌方塔";
    }
    if (地块值 === 迷雾 || 地块值 === 障碍迷雾) return "塔";
    return "无人塔";
  }

  function 记住塔(数据包, 来源标签) {
    var 地图信息 = 读取完整地图(数据包);
    var 塔信息 = 读取完整塔列表(数据包);

    if (地图信息) {
      状态.宽度 = 地图信息.宽度;
      状态.高度 = 地图信息.高度;
      状态.上次地图 = 地图信息.序列化地图.slice();
      if (Array.isArray(数据包.teams)) 状态.队伍 = 数据包.teams.slice();
      if (Number.isInteger(数据包.playerIndex)) 状态.我方索引 = 数据包.playerIndex;
    }

    if (塔信息 && Array.isArray(塔信息.塔列表)) {
      状态.上次塔列表 = 塔信息.塔列表.slice();
    }

    记录日志("处理地图更新", {
      来源标签: 来源标签,
      回合: 数据包 && 数据包.turn,
      地图来源: 地图信息 && 地图信息.来源,
      塔来源: 塔信息 && 塔信息.来源,
      地图尺寸: 地图信息 ? 地图信息.宽度 + "x" + 地图信息.高度 : null,
      本次塔数量: 塔信息 && 塔信息.塔列表 ? 塔信息.塔列表.length : null,
      已知塔数量: 状态.已知塔.size,
      有map: Array.isArray(数据包 && 数据包.map),
      有map_diff: Array.isArray(数据包 && 数据包.map_diff),
      有cities: Array.isArray(数据包 && 数据包.cities),
      有cities_diff: Array.isArray(数据包 && 数据包.cities_diff)
    });

    if (!塔信息 || !Array.isArray(塔信息.塔列表)) {
      请求渲染();
      return;
    }

    var 新发现 = [];
    for (var i = 0; i < 塔信息.塔列表.length; i += 1) {
      var 塔索引 = 塔信息.塔列表[i];
      if (!Number.isInteger(塔索引) || 塔索引 < 0) continue;

      var 塔类型 = 判断塔类型(地图信息, 塔索引);
      var 已有 = 状态.已知塔.get(塔索引);
      if (!已有) {
        已有 = {
          索引: 塔索引,
          类型: 塔类型,
          首次回合: 数据包 && 数据包.turn == null ? null : 数据包.turn,
          最近回合: 数据包 && 数据包.turn == null ? null : 数据包.turn
        };
        状态.已知塔.set(塔索引, 已有);
        新发现.push(已有);
      } else {
        已有.类型 = 塔类型;
        已有.最近回合 = 数据包 && 数据包.turn == null ? 已有.最近回合 : 数据包.turn;
      }
    }

    if (新发现.length > 0) {
      记录日志("发现新塔", {
        数量: 新发现.length,
        新塔: 新发现.map(function (塔) {
          return {
            索引: 塔.索引,
            类型: 塔.类型,
            行: 状态.宽度 ? Math.floor(塔.索引 / 状态.宽度) : null,
            列: 状态.宽度 ? 塔.索引 % 状态.宽度 : null,
            首次回合: 塔.首次回合
          };
        }),
        已知塔总数: 状态.已知塔.size
      });
    }

    请求渲染();
  }

  function 挂钩socket(socket) {
    if (!socket) {
      记录日志("挂钩socket跳过: socket为空");
      return;
    }
    if (socket.__塔记忆已挂钩) return;

    try {
      socket.__塔记忆已挂钩 = true;
    } catch (错误) {
      记录错误("标记socket", 错误);
    }

    状态.socket已挂钩 = true;
    记录日志("socket已挂钩", {
      connected: socket.connected,
      id: socket.id,
      hasOn: typeof socket.on,
      hasEmit: typeof socket.emit
    });

    socket.on("connect", function () {
      记录日志("socket connect", { id: socket.id });
    });

    socket.on("disconnect", function (原因) {
      记录日志("socket disconnect", { 原因: 原因 });
    });

    socket.on("game_start", function (数据包) {
      记录日志("收到game_start", {
        数据键: 数据包 ? Object.keys(数据包) : [],
        有map: Array.isArray(数据包 && 数据包.map),
        有cities: Array.isArray(数据包 && 数据包.cities),
        playerIndex: 数据包 && 数据包.playerIndex
      });
      延后处理("game_start", function () {
        重置本局(数据包 || {});
        记住塔(数据包 || {}, "game_start");
      });
    });

    socket.on("game_update", function (数据包) {
      记录日志("收到game_update", {
        回合: 数据包 && 数据包.turn,
        数据键: 数据包 ? Object.keys(数据包) : [],
        map长度: Array.isArray(数据包 && 数据包.map) ? 数据包.map.length : null,
        map_diff长度: Array.isArray(数据包 && 数据包.map_diff) ? 数据包.map_diff.length : null,
        cities长度: Array.isArray(数据包 && 数据包.cities) ? 数据包.cities.length : null,
        cities_diff长度: Array.isArray(数据包 && 数据包.cities_diff) ? 数据包.cities_diff.length : null
      });
      延后处理("game_update", function () {
        记住塔(数据包 || {}, "game_update");
      });
    });

    socket.on("game_over", function () {
      记录日志("收到game_over");
      请求渲染();
    });
    socket.on("game_lost", function () {
      记录日志("收到game_lost");
      请求渲染();
    });
    socket.on("game_won", function () {
      记录日志("收到game_won");
      请求渲染();
    });
  }

  function 安装socket访问器() {
    var 当前socket = window.socket;
    var 描述符 = null;
    try {
      描述符 = Object.getOwnPropertyDescriptor(window, "socket");
    } catch (错误) {
      记录错误("读取socket描述符", 错误);
    }

    if (!描述符 || 描述符.configurable) {
      try {
        Object.defineProperty(window, "socket", {
          configurable: true,
          enumerable: true,
          get: function () {
            return 当前socket;
          },
          set: function (新socket) {
            当前socket = 新socket;
            记录日志("window.socket被赋值", {
              是否存在: Boolean(新socket),
              connected: 新socket && 新socket.connected,
              id: 新socket && 新socket.id
            });
            延后处理("挂钩新socket", function () {
              挂钩socket(新socket);
            });
          }
        });
        记录日志("socket访问器已安装");
      } catch (错误) {
        记录错误("安装socket访问器", 错误);
      }
    } else {
      记录日志("socket描述符不可配置，改用轮询");
    }

    if (当前socket) 挂钩socket(当前socket);
  }

  function 轮询socket() {
    if (window.socket) 挂钩socket(window.socket);
    setTimeout(轮询socket, 状态.socket已挂钩 ? 2000 : 200);
  }

  function 安装样式() {
    if (!document.documentElement || document.getElementById(样式元素编号)) return;
    var 样式 = document.createElement("style");
    样式.id = 样式元素编号;
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
    记录日志("样式已安装");
  }

  function 取得游戏画布() {
    return document.querySelector(".game-map-canvas");
  }

  function 取得覆盖层宿主(画布) {
    if (!画布) return null;
    return 画布.parentElement ||画布.closest(".relative") ||画布.closest(".game-page");
  }

  function 确保覆盖层() {
    安装样式();
    var 游戏画布 = 取得游戏画布();
    if (!游戏画布) {
      var 现在 = Date.now();
      if (现在 - 状态.上次缺少画布日志时间 > 1500) {
        状态.上次缺少画布日志时间 = 现在;
        记录日志("未找到.game-map-canvas，暂不渲染", {
          页面: location.pathname,
          已知塔数量: 状态.已知塔.size
        });
      }
      return null;
    }

    var 宿主 = 取得覆盖层宿主(游戏画布);
    if (!宿主) return null;
    宿主.classList.add("gio-tower-memory-host");

    var 覆盖层 = 宿主.querySelector("." + 覆盖层类名);
    if (!覆盖层) {
      覆盖层 = document.createElement("canvas");
      覆盖层.className = 覆盖层类名;
      宿主.appendChild(覆盖层);
      记录日志("覆盖层已创建", {
        宿主类名: 宿主.className,
        画布尺寸: 游戏画布.getBoundingClientRect()
      });
    }

    return {
      游戏画布: 游戏画布,
      宿主: 宿主,
      覆盖层: 覆盖层
    };
  }

  function 清空覆盖层() {
    var 覆盖层 = document.querySelector("." + 覆盖层类名);
    if (!覆盖层) return;
    var ctx = 覆盖层.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, 覆盖层.width, 覆盖层.height);
  }

  function 调整覆盖层尺寸(部件) {
    var 画布矩形 = 部件.游戏画布.getBoundingClientRect();
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

    return {
      dpr: dpr,
      css宽: css宽,
      css高: css高,
      像素宽: 像素宽,
      像素高: 像素高
    };
  }

  function 塔颜色(塔) {
    if (!塔 || 塔.类型 === "塔") return "#ffffff";
    if (塔.类型 === "我方塔") return "#5dff92";
    if (塔.类型 === "敌方塔") return "#ff6961";
    return "#ffd84d";
  }

  function 绘制塔标记(ctx, x, y, 大小, 塔) {
    var 边距 = Math.max(2, 大小 * 0.16);
    var 中心x = x + 大小 / 2;
    var 中心y = y + 大小 / 2;
    var 半径 = Math.max(4, 大小 * 0.34);
    var 颜色 = 塔颜色(塔);

    ctx.save();
    ctx.lineWidth = Math.max(2, 大小 * 0.08);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.78)";
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    ctx.beginPath();
    ctx.arc(中心x, 中心y, 半径 + 边距 * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.lineWidth = Math.max(2, 大小 * 0.065);
    ctx.strokeStyle = 颜色;
    ctx.beginPath();
    ctx.arc(中心x, 中心y, 半径, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(中心x, y + 边距);
    ctx.lineTo(x + 大小 - 边距, 中心y);
    ctx.lineTo(中心x, y + 大小 - 边距);
    ctx.lineTo(x + 边距, 中心y);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = 颜色;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(中心x, 中心y, Math.max(2, 大小 * 0.095), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function 渲染覆盖层() {
    状态.已请求渲染 = false;

    if (!状态.宽度 || !状态.高度 || 状态.已知塔.size === 0) {
      清空覆盖层();
      return;
    }

    var 部件 = 确保覆盖层();
    if (!部件) return;

    var 尺寸 = 调整覆盖层尺寸(部件);
    var ctx = 部件.覆盖层.getContext("2d");
    if (!ctx) return;

    if (!尺寸.css宽 || !尺寸.css高) {
      var 现在 = Date.now();
      if (现在 - 状态.上次缺少尺寸日志时间 > 1500) {
        状态.上次缺少尺寸日志时间 = 现在;
        记录日志("覆盖层尺寸无效", 尺寸);
      }
      return;
    }

    ctx.setTransform(尺寸.dpr, 0, 0, 尺寸.dpr, 0, 0);
    ctx.clearRect(0, 0, 尺寸.css宽, 尺寸.css高);

    var 格宽 = 尺寸.css宽 / 状态.宽度;
    var 格高 = 尺寸.css高 / 状态.高度;
    var 格大小 = Math.min(格宽, 格高);

    状态.已知塔.forEach(function (塔, 索引) {
      var 行 = Math.floor(索引 / 状态.宽度);
      var 列 = 索引 % 状态.宽度;
      绘制塔标记(ctx, 列 * 格宽, 行 * 格高, 格大小, 塔);
    });

    记录日志("覆盖层已渲染", {
      已知塔数量: 状态.已知塔.size,
      地图尺寸: 状态.宽度 + "x" + 状态.高度,
      覆盖层尺寸: Math.round(尺寸.css宽) + "x" + Math.round(尺寸.css高)
    });
  }

  function 请求渲染() {
    if (状态.已请求渲染) return;
    状态.已请求渲染 = true;
    requestAnimationFrame(function () {
      安全执行("渲染覆盖层", 渲染覆盖层);
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
    window.addEventListener("scroll", 请求渲染, { passive: true });
    window.addEventListener("wheel", 请求渲染, { passive: true, capture: true });
    window.addEventListener("mousemove", 请求渲染, { passive: true, capture: true });
    window.addEventListener("touchmove", 请求渲染, { passive: true, capture: true });
    window.addEventListener("keydown", 请求渲染, { passive: true, capture: true });

    记录日志("页面观察器已安装", {
      zem: true
    });
  }

  function 暴露调试接口() {
    window.gio塔标记 = {
      版本: "0.2.0",
      日志: function () {
        return 状态.最近日志.slice();
      },
      已知塔: function () {
        return Array.from(状态.已知塔.values()).map(function (塔) {
          return Object.assign({}, 塔, {
            行: 状态.宽度 ? Math.floor(塔.索引 / 状态.宽度) : null,
            列: 状态.宽度 ? 塔.索引 % 状态.宽度 : null
          });
        });
      },
      状态: function () {
        return {
          宽度: 状态.宽度,
          高度: 状态.高度,
          已知塔数量: 状态.已知塔.size,
          socket已挂钩: 状态.socket已挂钩,
          我方索引: 状态.我方索引,
          当前局编号: 状态.当前局编号
        };
      },
      清空: function () {
        状态.已知塔.clear();
        清空覆盖层();
        记录日志("手动清空已知塔");
      },
      重绘: 请求渲染,
      开关日志: function (值) {
        详细日志 = Boolean(值);
        记录日志("日志开关已设置", { 详细日志: 详细日志 });
      }
    };
    window.gioTowerMarker = window.gio塔标记;
    记录日志("调试接口已暴露", {
      中文接口: "window.gio塔标记",
      兼容接口: "window.gioTowerMarker"
    });
  }

  function 启动() {
    记录日志("脚本启动", {
      版本: "0.2.0",
      runAt: "document-start",
      页面: location.href
    });
    暴露调试接口();
    安装socket访问器();
    轮询socket();
    安装页面观察器();
    请求渲染();
  }

  安全执行("启动", 启动);
})();
