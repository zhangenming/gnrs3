// ==UserScript==
// @name         generals.io 塔记忆标记
// @namespace    https://generals.io/
// @version      0.6.0
// @description  发现塔和敌方基地后固定标记该位置，丢失视野后仍保留标记。
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
  var 我方蓝色索引 = 10;
  var 敌方红色索引 = 0;

  var 状态 = {
    宽度: 0,
    高度: 0,
    塔列表: null,
    已知塔集合: new Set(),
    已知塔类型: new Map(),
    已知敌方基地集合: new Map(),
    我方索引: null,
    队伍: null,
    已请求渲染: false,
    socket已挂钩: false,
    页面观察器: null,
    最近日志: [],
    已处理颜色数据包: typeof WeakSet === "function" ? new WeakSet() : null,
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

  function 取得完整地图数组(数据包) {
    var 地图数组 = null;
    if (Array.isArray(数据包 && 数据包.map)) {
      地图数组 = 数据包.map;
    } else if (Array.isArray(数据包 && 数据包.map_diff) && 数据包.map_diff[0] === 0 && 数据包.map_diff.length > 4) {
      地图数组 = 应用增量([], 数据包.map_diff);
    }

    if (!Array.isArray(地图数组) || 地图数组.length < 2) return null;
    var 宽度 = 地图数组[0];
    var 高度 = 地图数组[1];
    var 格子数 = 宽度 * 高度;
    if (!Number.isFinite(宽度) || !Number.isFinite(高度) || 格子数 <= 0) return null;
    if (地图数组.length < 2 + 格子数 * 2) return null;
    return 地图数组;
  }

  function 尝试从地图读取尺寸(数据包) {
    if (状态.宽度 > 0 && 状态.高度 > 0) return;

    var 地图数组 = 取得完整地图数组(数据包);
    if (!地图数组) return;

    状态.宽度 = 地图数组[0];
    状态.高度 = 地图数组[1];
    记日志("已读取地图尺寸", {
      来源: Array.isArray(数据包 && 数据包.map) ? "map" : "首个map_diff",
      宽度: 状态.宽度,
      高度: 状态.高度
    });
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

  function 读取玩家信息(数据包) {
    if (!数据包) return;
    if (Number.isInteger(数据包.playerIndex)) {
      状态.我方索引 = 数据包.playerIndex;
    }
    if (Array.isArray(数据包.teams)) {
      状态.队伍 = 数据包.teams.slice();
    }
  }

  function 是我方或队友(玩家索引) {
    if (!Number.isInteger(玩家索引) || 玩家索引 < 0) return false;
    if (!Number.isInteger(状态.我方索引)) return false;
    if (玩家索引 === 状态.我方索引) return true;
    if (!Array.isArray(状态.队伍)) return false;
    var 我方队伍 = 状态.队伍[状态.我方索引];
    var 对方队伍 = 状态.队伍[玩家索引];
    return 我方队伍 !== undefined && 我方队伍 !== null && 对方队伍 === 我方队伍;
  }

  function 读取可见地块归属(数据包, 索引) {
    var 地图数组 = 取得完整地图数组(数据包);
    if (地图数组 && Number.isInteger(索引)) {
      var 宽度 = 地图数组[0];
      var 高度 = 地图数组[1];
      var 格子数 = 宽度 * 高度;
      if (索引 >= 0 && 索引 < 格子数) {
        var 地块值 = 地图数组[2 + 格子数 + 索引];
        return Number.isInteger(地块值) ? 地块值 : null;
      }
    }

    if (!Array.isArray(数据包 && 数据包.map_diff)) return null;
    if (!状态.宽度 || !状态.高度 || !Number.isInteger(索引)) return null;

    var 目标位置 = 2 + 状态.宽度 * 状态.高度 + 索引;
    var 输出位置 = 0;
    for (var i = 0; i < 数据包.map_diff.length;) {
      var 保留数量 = 数据包.map_diff[i] || 0;
      if (目标位置 >= 输出位置 && 目标位置 < 输出位置 + 保留数量) return null;
      输出位置 += 保留数量;

      i += 1;
      if (i < 数据包.map_diff.length) {
        var 插入数量 = 数据包.map_diff[i] || 0;
        if (目标位置 >= 输出位置 && 目标位置 < 输出位置 + 插入数量) {
          var 地块增量值 = 数据包.map_diff[i + 1 + (目标位置 - 输出位置)];
          return Number.isInteger(地块增量值) ? 地块增量值 : null;
        }
        输出位置 += 插入数量;
        i += 插入数量;
      }

      i += 1;
    }

    return null;
  }

  function 更新塔类型(数据包, 塔索引) {
    if (!Number.isInteger(塔索引) || 塔索引 < 0) return;
    if (!状态.已知塔类型.has(塔索引)) {
      状态.已知塔类型.set(塔索引, "塔");
    }

    var 地块归属 = 读取可见地块归属(数据包, 塔索引);
    if (!Number.isInteger(地块归属) || 地块归属 < 0) return;

    var 新类型 = 是我方或队友(地块归属) ? "我方塔" : "敌方塔";
    var 旧类型 = 状态.已知塔类型.get(塔索引);
    if (旧类型 !== 新类型) {
      状态.已知塔类型.set(塔索引, 新类型);
      记日志("塔类型更新", {
        索引: 塔索引,
        旧类型: 旧类型,
        新类型: 新类型,
        地块归属: 地块归属
      });
    }
  }

  function 重构玩家颜色(数据包, 来源事件) {
    if (!数据包) return;
    if (typeof 数据包 === "object" && 状态.已处理颜色数据包) {
      if (状态.已处理颜色数据包.has(数据包)) return;
      状态.已处理颜色数据包.add(数据包);
    }

    读取玩家信息(数据包);

    if (!Array.isArray(数据包.playerColors)) {
      记日志("颜色重构跳过: 缺少playerColors", {
        来源事件: 来源事件,
        回合: 数据包.turn,
        数据键: Object.keys(数据包)
      });
      return;
    }

    if (!Number.isInteger(状态.我方索引)) {
      记日志("颜色重构跳过: 缺少我方索引", {
        来源事件: 来源事件,
        回合: 数据包.turn,
        playerColors: 数据包.playerColors.slice()
      });
      return;
    }

    var 原颜色 = 数据包.playerColors.slice();
    for (var 玩家索引 = 0; 玩家索引 < 数据包.playerColors.length; 玩家索引 += 1) {
      if (是我方或队友(玩家索引)) {
        数据包.playerColors[玩家索引] = 我方蓝色索引;
      } else {
        数据包.playerColors[玩家索引] = 敌方红色索引;
      }
    }

    记日志("已重构玩家颜色", {
      来源事件: 来源事件,
      回合: 数据包.turn,
      我方索引: 状态.我方索引,
      队伍: 状态.队伍,
      原颜色: 原颜色,
      新颜色: 数据包.playerColors.slice(),
      规则: "我方/队友=blue(10), 敌方=red(0)"
    });
  }

  function 预处理入站事件(事件名, 数据包) {
    if (事件名 !== "game_start" && 事件名 !== "game_update") return;
    重构玩家颜色(数据包 || {}, 事件名 + ":预处理");
  }

  function 处理塔位置(数据包, 来源事件) {
    读取玩家信息(数据包);
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
        状态.已知塔类型.set(塔索引, "塔");
        新塔.push(塔索引);
      }
      更新塔类型(数据包, 塔索引);
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

  function 处理基地位置(数据包, 来源事件) {
    读取玩家信息(数据包);
    尝试从地图读取尺寸(数据包);

    var 基地列表 = Array.isArray(数据包 && 数据包.generals) ? 数据包.generals : null;
    记日志("处理基地位置", {
      来源事件: 来源事件,
      回合: 数据包 && 数据包.turn,
      我方索引: 状态.我方索引,
      队伍: 状态.队伍,
      基地列表长度: 基地列表 ? 基地列表.length : null,
      已知敌方基地数量: 状态.已知敌方基地集合.size,
      地图尺寸: 状态.宽度 && 状态.高度 ? 状态.宽度 + "x" + 状态.高度 : null
    });

    if (!基地列表) {
      请求渲染();
      return;
    }

    if (!Number.isInteger(状态.我方索引)) {
      记日志("缺少我方索引，暂不标记基地", {
        来源事件: 来源事件,
        基地列表: 基地列表
      });
      请求渲染();
      return;
    }

    var 新敌方基地 = [];
    for (var 玩家索引 = 0; 玩家索引 < 基地列表.length; 玩家索引 += 1) {
      var 基地索引 = 基地列表[玩家索引];
      if (!Number.isInteger(基地索引) || 基地索引 < 0) continue;
      if (是我方或队友(玩家索引)) continue;
      if (!状态.已知敌方基地集合.has(基地索引)) {
        状态.已知敌方基地集合.set(基地索引, {
          索引: 基地索引,
          玩家索引: 玩家索引,
          首次回合: 数据包 && 数据包.turn == null ? null : 数据包.turn
        });
        新敌方基地.push({ 索引: 基地索引, 玩家索引: 玩家索引 });
      }
    }

    if (新敌方基地.length > 0) {
      记日志("发现敌方基地并固定标记", {
        回合: 数据包 && 数据包.turn,
        新敌方基地数量: 新敌方基地.length,
        新敌方基地: 新敌方基地.map(function (基地) {
          return {
            索引: 基地.索引,
            玩家索引: 基地.玩家索引,
            行: 状态.宽度 ? Math.floor(基地.索引 / 状态.宽度) : null,
            列: 状态.宽度 ? 基地.索引 % 状态.宽度 : null
          };
        }),
        已知敌方基地总数: 状态.已知敌方基地集合.size
      });
    }

    请求渲染();
  }

  function 重置本局(数据包) {
    状态.宽度 = 0;
    状态.高度 = 0;
    状态.塔列表 = null;
    状态.已知塔集合.clear();
    状态.已知塔类型.clear();
    状态.已知敌方基地集合.clear();
    状态.我方索引 = Number.isInteger(数据包 && 数据包.playerIndex) ? 数据包.playerIndex : null;
    状态.队伍 = Array.isArray(数据包 && 数据包.teams) ? 数据包.teams.slice() : null;
    清空覆盖层();
    记日志("新局重置", {
      数据键: 数据包 ? Object.keys(数据包) : [],
      有map: Array.isArray(数据包 && 数据包.map),
      有map_diff: Array.isArray(数据包 && 数据包.map_diff),
      有cities: Array.isArray(数据包 && 数据包.cities),
      有cities_diff: Array.isArray(数据包 && 数据包.cities_diff),
      有generals: Array.isArray(数据包 && 数据包.generals),
      我方索引: 状态.我方索引,
      队伍: 状态.队伍
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

    if (typeof socket.onevent === "function" && !socket.__塔记忆onevent已挂钩) {
      var 原onevent = socket.onevent;
      socket.__塔记忆onevent已挂钩 = true;
      socket.onevent = function (包) {
        安全执行("onevent入站预处理", function () {
          var 数据 = 包 && Array.isArray(包.data) ? 包.data : null;
          if (数据) 预处理入站事件(数据[0], 数据[1]);
        });
        return 原onevent.apply(this, arguments);
      };
      记日志("socket.onevent预处理已安装");
    }

    if (typeof socket.emitEvent === "function" && !socket.__塔记忆emitEvent已挂钩) {
      var 原emitEvent = socket.emitEvent;
      socket.__塔记忆emitEvent已挂钩 = true;
      socket.emitEvent = function (参数列表) {
        安全执行("emitEvent入站预处理", function () {
          if (Array.isArray(参数列表)) 预处理入站事件(参数列表[0], 参数列表[1]);
        });
        return 原emitEvent.apply(this, arguments);
      };
      记日志("socket.emitEvent预处理已安装");
    }

    socket.on("game_start", function (数据包) {
      安全执行("game_start颜色重构", function () {
        重构玩家颜色(数据包 || {}, "game_start");
      });
      记日志("收到game_start", {
        数据键: 数据包 ? Object.keys(数据包) : [],
        有map: Array.isArray(数据包 && 数据包.map),
        有map_diff: Array.isArray(数据包 && 数据包.map_diff),
        有cities: Array.isArray(数据包 && 数据包.cities),
        有cities_diff: Array.isArray(数据包 && 数据包.cities_diff),
        generals长度: Array.isArray(数据包 && 数据包.generals) ? 数据包.generals.length : null,
        playerIndex: 数据包 && 数据包.playerIndex,
        teams: 数据包 && 数据包.teams
      });
      延后执行("game_start", function () {
        重置本局(数据包 || {});
        处理塔位置(数据包 || {}, "game_start");
        处理基地位置(数据包 || {}, "game_start");
      });
    });

    socket.on("game_update", function (数据包) {
      安全执行("game_update颜色重构", function () {
        重构玩家颜色(数据包 || {}, "game_update");
      });
      记日志("收到game_update", {
        回合: 数据包 && 数据包.turn,
        cities长度: Array.isArray(数据包 && 数据包.cities) ? 数据包.cities.length : null,
        cities_diff长度: Array.isArray(数据包 && 数据包.cities_diff) ? 数据包.cities_diff.length : null,
        cities_diff前20项: Array.isArray(数据包 && 数据包.cities_diff) ? 数据包.cities_diff.slice(0, 20) : null,
        有map: Array.isArray(数据包 && 数据包.map),
        map_diff长度: Array.isArray(数据包 && 数据包.map_diff) ? 数据包.map_diff.length : null,
        generals长度: Array.isArray(数据包 && 数据包.generals) ? 数据包.generals.length : null,
        generals: Array.isArray(数据包 && 数据包.generals) ? 数据包.generals : null
      });
      延后执行("game_update", function () {
        处理塔位置(数据包 || {}, "game_update");
        处理基地位置(数据包 || {}, "game_update");
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
            安全执行("挂钩socket", function () {
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

  function 画塔标记(ctx, x, y, 大小, 类型) {
    var 是敌方塔 = 类型 === "敌方塔";
    var 外线宽 = Math.max(2, 大小 * 0.09);
    var 内线宽 = Math.max(1.5, 大小 * (是敌方塔 ? 0.065 : 0.045));
    var 外偏移 = 外线宽 / 2 + 1;
    var 内偏移 = 外偏移 + 外线宽 / 2 + 内线宽 / 2;
    var 主色 = 是敌方塔 ? "#ff5aa5" : "#ffd84d";
    var 高光色 = 是敌方塔 ? "#ffd1e6" : "#fff4a8";

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
    ctx.strokeStyle = 主色;
    ctx.strokeRect(
      x + 内偏移,
      y + 内偏移,
      Math.max(1, 大小 - 内偏移 * 2),
      Math.max(1, 大小 - 内偏移 * 2)
    );

    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(1, 内线宽 * 0.75);
    ctx.strokeStyle = 高光色;
    ctx.strokeRect(
      x + 内偏移 + 内线宽 * 1.5,
      y + 内偏移 + 内线宽 * 1.5,
      Math.max(1, 大小 - (内偏移 + 内线宽 * 1.5) * 2),
      Math.max(1, 大小 - (内偏移 + 内线宽 * 1.5) * 2)
    );

    if (是敌方塔) {
      var 角长 = Math.max(5, 大小 * 0.24);
      var 角偏移 = Math.max(3, 大小 * 0.12);
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(2, 大小 * 0.055);
      ctx.strokeStyle = "#ffb000";
      ctx.beginPath();
      ctx.moveTo(x + 角偏移, y + 角偏移 + 角长);
      ctx.lineTo(x + 角偏移, y + 角偏移);
      ctx.lineTo(x + 角偏移 + 角长, y + 角偏移);
      ctx.moveTo(x + 大小 - 角偏移 - 角长, y + 角偏移);
      ctx.lineTo(x + 大小 - 角偏移, y + 角偏移);
      ctx.lineTo(x + 大小 - 角偏移, y + 角偏移 + 角长);
      ctx.moveTo(x + 大小 - 角偏移, y + 大小 - 角偏移 - 角长);
      ctx.lineTo(x + 大小 - 角偏移, y + 大小 - 角偏移);
      ctx.lineTo(x + 大小 - 角偏移 - 角长, y + 大小 - 角偏移);
      ctx.moveTo(x + 角偏移 + 角长, y + 大小 - 角偏移);
      ctx.lineTo(x + 角偏移, y + 大小 - 角偏移);
      ctx.lineTo(x + 角偏移, y + 大小 - 角偏移 - 角长);
      ctx.stroke();
    }

    ctx.restore();
  }

  function 画敌方基地标记(ctx, x, y, 大小) {
    var 外线宽 = Math.max(3, 大小 * 0.13);
    var 内线宽 = Math.max(2, 大小 * 0.06);
    var 外偏移 = 外线宽 / 2 + 1;
    var 内偏移 = 外偏移 + 外线宽 / 2 + 内线宽 / 2;
    var 角长 = Math.max(6, 大小 * 0.34);
    var 角偏移 = Math.max(2, 大小 * 0.08);

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.lineWidth = 外线宽;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.92)";
    ctx.strokeRect(
      x + 外偏移,
      y + 外偏移,
      Math.max(1, 大小 - 外偏移 * 2),
      Math.max(1, 大小 - 外偏移 * 2)
    );

    ctx.lineWidth = 内线宽;
    ctx.strokeStyle = "#ff3030";
    ctx.strokeRect(
      x + 内偏移,
      y + 内偏移,
      Math.max(1, 大小 - 内偏移 * 2),
      Math.max(1, 大小 - 内偏移 * 2)
    );

    ctx.lineWidth = Math.max(2, 大小 * 0.075);
    ctx.strokeStyle = "#fff2f2";
    ctx.beginPath();
    ctx.moveTo(x + 角偏移, y + 角偏移 + 角长);
    ctx.lineTo(x + 角偏移, y + 角偏移);
    ctx.lineTo(x + 角偏移 + 角长, y + 角偏移);

    ctx.moveTo(x + 大小 - 角偏移 - 角长, y + 角偏移);
    ctx.lineTo(x + 大小 - 角偏移, y + 角偏移);
    ctx.lineTo(x + 大小 - 角偏移, y + 角偏移 + 角长);

    ctx.moveTo(x + 大小 - 角偏移, y + 大小 - 角偏移 - 角长);
    ctx.lineTo(x + 大小 - 角偏移, y + 大小 - 角偏移);
    ctx.lineTo(x + 大小 - 角偏移 - 角长, y + 大小 - 角偏移);

    ctx.moveTo(x + 角偏移 + 角长, y + 大小 - 角偏移);
    ctx.lineTo(x + 角偏移, y + 大小 - 角偏移);
    ctx.lineTo(x + 角偏移, y + 大小 - 角偏移 - 角长);
    ctx.stroke();

    ctx.restore();
  }

  function 渲染() {
    状态.已请求渲染 = false;

    if (!状态.已知塔集合.size && !状态.已知敌方基地集合.size) {
      清空覆盖层();
      return;
    }

    if (!状态.宽度 || !状态.高度) {
      var 现在 = Date.now();
      if (现在 - 状态.上次无尺寸日志 > 2000) {
        状态.上次无尺寸日志 = 现在;
        记日志("已有标记位置但缺少地图宽高，无法换算坐标", {
          已知塔数量: 状态.已知塔集合.size,
          已知敌方基地数量: 状态.已知敌方基地集合.size,
          已知塔: Array.from(状态.已知塔集合).slice(0, 20),
          已知敌方基地: Array.from(状态.已知敌方基地集合.values()).slice(0, 20)
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
      画塔标记(ctx, 列 * 格宽, 行 * 格高, 大小, 状态.已知塔类型.get(索引));
    });

    状态.已知敌方基地集合.forEach(function (基地, 索引) {
      var 行 = Math.floor(索引 / 状态.宽度);
      var 列 = 索引 % 状态.宽度;
      画敌方基地标记(ctx, 列 * 格宽, 行 * 格高, 大小);
    });

    记日志("固定标记已渲染", {
      已知塔数量: 状态.已知塔集合.size,
      敌方塔数量: Array.from(状态.已知塔类型.values()).filter(function (类型) { return 类型 === "敌方塔"; }).length,
      已知敌方基地数量: 状态.已知敌方基地集合.size,
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
      版本: "0.6.0",
      日志: function () {
        return 状态.最近日志.slice();
      },
      状态: function () {
        return {
          宽度: 状态.宽度,
          高度: 状态.高度,
          塔列表长度: 状态.塔列表 ? 状态.塔列表.length : null,
          已知塔数量: 状态.已知塔集合.size,
          敌方塔数量: Array.from(状态.已知塔类型.values()).filter(function (类型) { return 类型 === "敌方塔"; }).length,
          已知敌方基地数量: 状态.已知敌方基地集合.size,
          我方索引: 状态.我方索引,
          队伍: 状态.队伍,
          颜色规则: {
            我方蓝色索引: 我方蓝色索引,
            敌方红色索引: 敌方红色索引
          },
          socket已挂钩: 状态.socket已挂钩
        };
      },
      已知塔: function () {
        return Array.from(状态.已知塔集合).map(function (索引) {
          return {
            索引: 索引,
            类型: 状态.已知塔类型.get(索引) || "塔",
            行: 状态.宽度 ? Math.floor(索引 / 状态.宽度) : null,
            列: 状态.宽度 ? 索引 % 状态.宽度 : null
          };
        });
      },
      已知敌方基地: function () {
        return Array.from(状态.已知敌方基地集合.values()).map(function (基地) {
          return Object.assign({}, 基地, {
            行: 状态.宽度 ? Math.floor(基地.索引 / 状态.宽度) : null,
            列: 状态.宽度 ? 基地.索引 % 状态.宽度 : null
          });
        });
      },
      手动加塔: function (索引) {
        if (Number.isInteger(索引) && 索引 >= 0) {
          状态.已知塔集合.add(索引);
          if (!状态.已知塔类型.has(索引)) 状态.已知塔类型.set(索引, "塔");
          记日志("手动加塔", { 索引: 索引 });
          请求渲染();
        }
      },
      手动设敌方塔: function (索引) {
        if (Number.isInteger(索引) && 索引 >= 0) {
          状态.已知塔集合.add(索引);
          状态.已知塔类型.set(索引, "敌方塔");
          记日志("手动设敌方塔", { 索引: 索引 });
          请求渲染();
        }
      },
      手动加敌方基地: function (索引, 玩家索引) {
        if (Number.isInteger(索引) && 索引 >= 0) {
          状态.已知敌方基地集合.set(索引, {
            索引: 索引,
            玩家索引: Number.isInteger(玩家索引) ? 玩家索引 : null,
            首次回合: null
          });
          记日志("手动加敌方基地", { 索引: 索引, 玩家索引: 玩家索引 });
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
        状态.已知塔类型.clear();
        状态.已知敌方基地集合.clear();
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
    记日志("脚本启动", { 版本: "0.6.0", 页面: location.href });
    暴露调试接口();
    安装socket访问器();
    轮询socket();
    安装页面观察器();
  }

  安全执行("启动", 启动);
})();
