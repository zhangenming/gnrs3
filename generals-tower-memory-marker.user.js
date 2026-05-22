// ==UserScript==
// @name         generals.io 塔记忆标记
// @namespace    https://generals.io/
// @version      0.8.2
// @description  发现塔和敌方基地后固定标记该位置，丢失视野后仍保留标记。
// @author       Codex
// @match        https://generals.io/*
// @match        http://generals.io/*
// @match        https://ws.generals.io/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
  "use strict";

  const 脚本版本 = "0.8.2";
  const 覆盖层类名 = "gio-tower-memory-overlay";
  const 样式编号 = "gio-tower-memory-style";
  const 日志前缀 = "[塔记忆]";
  let 详细日志 = false;
  const 我方蓝色索引 = 1;
  const 敌方红色索引 = 0;
  const 大回合turn数 = 50;
  const 大回合倒计时元素编号 = "gio-big-turn-countdown";
  const 大回合倒计时类名 = "gio-big-turn-cell";
  const 兵力着色最小兵力 = 3;
  const 兵力着色最多数量 = 30;

  const 状态 = {
    宽度: 0,
    高度: 0,
    塔列表: null,
    已知塔集合: new Set(),
    已知塔类型: new Map(),
    已知敌方基地集合: new Map(),
    地图数组: null,
    兵力分布着色列表: [],
    移动队列: [],
    当前回合: null,
    大回合倒计时元素: null,
    上次大回合倒计时文本: "",
    我方索引: null,
    队伍: null,
    已请求渲染: false,
    socket已挂钩: false,
    页面观察器: null,
    最近日志: [],
    已处理颜色数据包: new WeakSet(),
    上次无尺寸日志: 0,
    上次无画布日志: 0,
    上次兵力分布着色签名: "",
    上次操作轨迹渲染签名: "",
    上次固定标记渲染签名: ""
  };

  function 记日志(事件, 数据) {
    const 条目 = { 时间: new Date().toISOString(), 事件, 数据: 数据 ?? null };
    状态.最近日志.push(条目);
    if (状态.最近日志.length > 300) 状态.最近日志.shift();
    if (详细日志) {
      if (数据 === undefined) console.log(日志前缀, 事件);
      else console.log(日志前缀, 事件, 数据);
    }
  }

  function 记错误(事件, 错误) {
    const 文本 = 错误?.stack || String(错误);
    状态.最近日志.push({ 时间: new Date().toISOString(), 事件: `${事件}失败`, 数据: 文本 });
    if (状态.最近日志.length > 300) 状态.最近日志.shift();
    console.error(日志前缀, `${事件}失败`, 错误);
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
    setTimeout(() => 安全执行(事件, 函数体), 0);
  }

  function 应用增量(旧数组, 增量) {
    if (!Array.isArray(增量)) return null;
    if (!Array.isArray(旧数组)) 旧数组 = [];

    const 新数组 = [];
    for (let i = 0; i < 增量.length;) {
      const 保留数量 = 增量[i] || 0;
      if (保留数量 > 0) {
        新数组.push(...旧数组.slice(新数组.length, 新数组.length + 保留数量));
      }

      i += 1;
      if (i < 增量.length) {
        const 插入数量 = 增量[i] || 0;
        if (插入数量 > 0) {
          新数组.push(...增量.slice(i + 1, i + 1 + 插入数量));
          i += 插入数量;
        }
      }

      i += 1;
    }
    return 新数组;
  }

  function 取得完整地图数组(数据包) {
    let 地图数组 = null;
    if (Array.isArray(数据包?.map)) {
      地图数组 = 数据包.map;
    } else if (Array.isArray(数据包?.map_diff) && 数据包.map_diff[0] === 0 && 数据包.map_diff.length > 4) {
      地图数组 = 应用增量([], 数据包.map_diff);
    }

    if (!Array.isArray(地图数组) || 地图数组.length < 2) return null;
    const 宽度 = 地图数组[0];
    const 高度 = 地图数组[1];
    const 格子数 = 宽度 * 高度;
    if (!Number.isFinite(宽度) || !Number.isFinite(高度) || 格子数 <= 0) return null;
    if (地图数组.length < 2 + 格子数 * 2) return null;
    return 地图数组;
  }

  function 更新地图缓存和兵力分布(数据包, 来源事件) {
    function 取得兵力分布着色列表() {
      const 地图数组 = 状态.地图数组;
      if (!Array.isArray(地图数组) || !状态.宽度 || !状态.高度) return [];

      const 格子数 = 状态.宽度 * 状态.高度;
      if (地图数组.length < 2 + 格子数 * 2) return [];

      const 地块列表 = [];
      for (let 索引 = 0; 索引 < 格子数; 索引 += 1) {
        const 兵力 = 地图数组[2 + 索引];
        const 地形 = 地图数组[2 + 格子数 + 索引];
        if (!Number.isInteger(兵力) || 兵力 < 兵力着色最小兵力) continue;
        if (!Number.isInteger(地形) || 地形 < -1) continue;
        地块列表.push({ 索引, 兵力 });
      }

      地块列表.sort((左, 右) => {
        if (右.兵力 !== 左.兵力) return 右.兵力 - 左.兵力;
        return 左.索引 - 右.索引;
      });
      return 地块列表.slice(0, 兵力着色最多数量);
    }

    const 完整地图数组 = 取得完整地图数组(数据包);
    if (完整地图数组) {
      状态.地图数组 = 完整地图数组.slice();
    } else if (Array.isArray(数据包 && 数据包.map_diff) && Array.isArray(状态.地图数组)) {
      const 新地图数组 = 应用增量(状态.地图数组, 数据包.map_diff);
      if (Array.isArray(新地图数组) && 新地图数组.length >= 状态.地图数组.length) {
        状态.地图数组 = 新地图数组;
      }
    }

    状态.兵力分布着色列表 = 取得兵力分布着色列表();
    if (状态.兵力分布着色列表.length) {
      const 签名 = 状态.兵力分布着色列表.map(地块 => {
        return `${地块.索引}:${地块.兵力}`;
      }).join("|");
      if (签名 !== 状态.上次兵力分布着色签名) {
        状态.上次兵力分布着色签名 = 签名;
        记日志("兵力分布着色已更新", {
          来源事件,
          着色数量: 状态.兵力分布着色列表.length,
          最高兵力: 状态.兵力分布着色列表[0].兵力,
          最低兵力: 状态.兵力分布着色列表[状态.兵力分布着色列表.length - 1].兵力
        });
      }
    } else if (状态.上次兵力分布着色签名) {
      状态.上次兵力分布着色签名 = "";
      记日志("兵力分布着色已清空", { 来源事件 });
    }
  }

  function 尝试从地图读取尺寸(数据包) {
    if (状态.宽度 > 0 && 状态.高度 > 0) return;

    const 地图数组 = 取得完整地图数组(数据包);
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
    const 我方队伍 = 状态.队伍[状态.我方索引];
    const 对方队伍 = 状态.队伍[玩家索引];
    return 我方队伍 !== undefined && 我方队伍 !== null && 对方队伍 === 我方队伍;
  }

  function 取得大回合倒计时(回合) {
    if (!Number.isInteger(回合) || 回合 < 0) return null;
    const 余数 = 回合 % 大回合turn数;
    if (回合 > 0 && 余数 === 0) return 0;
    return 大回合turn数 - 余数;
  }

  function 取得大回合序号(回合) {
    if (!Number.isInteger(回合) || 回合 < 0) return null;
    return Math.floor(回合 / 大回合turn数) + 1;
  }

  function 记录回合(数据包, 来源事件) {
    if (!Number.isInteger(数据包 && 数据包.turn)) return;
    const 原回合 = 状态.当前回合;
    状态.当前回合 = 数据包.turn;
    更新大回合倒计时();
    if (原回合 !== 状态.当前回合) {
      记日志("大回合倒计时更新", {
        来源事件,
        回合: 状态.当前回合,
        倒计时: 取得大回合倒计时(状态.当前回合)
      });
    }
  }

  function 读取可见地块归属(数据包, 索引) {
    const 地图数组 = 取得完整地图数组(数据包);
    if (地图数组 && Number.isInteger(索引)) {
      const 宽度 = 地图数组[0];
      const 高度 = 地图数组[1];
      const 格子数 = 宽度 * 高度;
      if (索引 >= 0 && 索引 < 格子数) {
        const 地块值 = 地图数组[2 + 格子数 + 索引];
        return Number.isInteger(地块值) ? 地块值 : null;
      }
    }

    if (!Array.isArray(数据包 && 数据包.map_diff)) return null;
    if (!状态.宽度 || !状态.高度 || !Number.isInteger(索引)) return null;

    const 目标位置 = 2 + 状态.宽度 * 状态.高度 + 索引;
    let 输出位置 = 0;
    for (let i = 0; i < 数据包.map_diff.length;) {
      const 保留数量 = 数据包.map_diff[i] || 0;
      if (目标位置 >= 输出位置 && 目标位置 < 输出位置 + 保留数量) return null;
      输出位置 += 保留数量;

      i += 1;
      if (i < 数据包.map_diff.length) {
        const 插入数量 = 数据包.map_diff[i] || 0;
        if (目标位置 >= 输出位置 && 目标位置 < 输出位置 + 插入数量) {
          const 地块增量值 = 数据包.map_diff[i + 1 + (目标位置 - 输出位置)];
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

    const 地块归属 = 读取可见地块归属(数据包, 塔索引);
    if (!Number.isInteger(地块归属) || 地块归属 < 0) return;

    const 新类型 = 是我方或队友(地块归属) ? "我方塔" : "敌方塔";
    const 旧类型 = 状态.已知塔类型.get(塔索引);
    if (旧类型 !== 新类型) {
      状态.已知塔类型.set(塔索引, 新类型);
      记日志("塔类型更新", {
        索引: 塔索引,
        旧类型,
        新类型,
        地块归属
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
        来源事件,
        回合: 数据包.turn,
        数据键: Object.keys(数据包)
      });
      return;
    }

    if (!Number.isInteger(状态.我方索引)) {
      记日志("颜色重构跳过: 缺少我方索引", {
        来源事件,
        回合: 数据包.turn,
        playerColors: 数据包.playerColors.slice()
      });
      return;
    }

    const 原颜色 = 数据包.playerColors.slice();
    for (let 玩家索引 = 0; 玩家索引 < 数据包.playerColors.length; 玩家索引 += 1) {
      if (是我方或队友(玩家索引)) {
        数据包.playerColors[玩家索引] = 我方蓝色索引;
      } else {
        数据包.playerColors[玩家索引] = 敌方红色索引;
      }
    }

    记日志("已重构玩家颜色", {
      来源事件,
      回合: 数据包.turn,
      我方索引: 状态.我方索引,
      队伍: 状态.队伍,
      原颜色,
      新颜色: 数据包.playerColors.slice(),
      规则: "我方/队友=lightblue(1, --map-color-p2 #2792ff), 敌方=red(0)"
    });
  }

  function 预处理入站事件(事件名, 数据包) {
    if (事件名 !== "game_start" && 事件名 !== "game_update") return;
    记录回合(数据包 || {}, `${事件名}:预处理`);
    重构玩家颜色(数据包 || {}, `${事件名}:预处理`);
  }

  function 处理塔位置(数据包, 来源事件) {
    读取玩家信息(数据包);
    尝试从地图读取尺寸(数据包);

    const 塔信息 = 取得本次塔列表(数据包);
    记日志("处理塔位置", {
      来源事件,
      回合: 数据包 && 数据包.turn,
      塔来源: 塔信息 && 塔信息.来源,
      当前塔列表长度: 塔信息 && 塔信息.塔列表 ? 塔信息.塔列表.length : null,
      已知塔数量: 状态.已知塔集合.size,
      地图尺寸: 状态.宽度 && 状态.高度 ? `${状态.宽度}x${状态.高度}` : null
    });

    if (!塔信息 || !Array.isArray(塔信息.塔列表)) {
      请求渲染();
      return;
    }

    状态.塔列表 = 塔信息.塔列表.slice();

    const 新塔 = [];

    for (const 塔索引 of 状态.塔列表) {
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
        新塔: 新塔.map(索引 => {
          return {
            索引,
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

    const 基地列表 = Array.isArray(数据包 && 数据包.generals) ? 数据包.generals : null;
    记日志("处理基地位置", {
      来源事件,
      回合: 数据包 && 数据包.turn,
      我方索引: 状态.我方索引,
      队伍: 状态.队伍,
      基地列表长度: 基地列表 ? 基地列表.length : null,
      已知敌方基地数量: 状态.已知敌方基地集合.size,
      地图尺寸: 状态.宽度 && 状态.高度 ? `${状态.宽度}x${状态.高度}` : null
    });

    if (!基地列表) {
      请求渲染();
      return;
    }

    if (!Number.isInteger(状态.我方索引)) {
      记日志("缺少我方索引，暂不标记基地", {
        来源事件,
        基地列表
      });
      请求渲染();
      return;
    }

    const 新敌方基地 = [];
    for (let 玩家索引 = 0; 玩家索引 < 基地列表.length; 玩家索引 += 1) {
      const 基地索引 = 基地列表[玩家索引];
      if (!Number.isInteger(基地索引) || 基地索引 < 0) continue;
      if (是我方或队友(玩家索引)) continue;
      if (!状态.已知敌方基地集合.has(基地索引)) {
        状态.已知敌方基地集合.set(基地索引, {
          索引: 基地索引,
          玩家索引,
          首次回合: 数据包 && 数据包.turn == null ? null : 数据包.turn
        });
        新敌方基地.push({ 索引: 基地索引, 玩家索引 });
      }
    }

    if (新敌方基地.length > 0) {
      记日志("发现敌方基地并固定标记", {
        回合: 数据包 && 数据包.turn,
        新敌方基地数量: 新敌方基地.length,
        新敌方基地: 新敌方基地.map(基地 => {
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

  function 取得移动摘要(移动) {
    return {
      起点: 移动.起点,
      终点: 移动.终点,
      是否半兵: 移动.是否半兵,
      攻击序号: 移动.攻击序号,
      起点行: 状态.宽度 ? Math.floor(移动.起点 / 状态.宽度) : null,
      起点列: 状态.宽度 ? 移动.起点 % 状态.宽度 : null,
      终点行: 状态.宽度 ? Math.floor(移动.终点 / 状态.宽度) : null,
      终点列: 状态.宽度 ? 移动.终点 % 状态.宽度 : null
    };
  }

  function 记录移动操作(起点, 终点, 是否半兵, 攻击序号) {
    if (!Number.isInteger(起点) || !Number.isInteger(终点) || 起点 < 0 || 终点 < 0) {
      记日志("记录移动操作跳过: 参数无效", {
        起点,
        终点,
        是否半兵,
        攻击序号
      });
      return;
    }

    const 移动 = {
      起点,
      终点,
      是否半兵: Boolean(是否半兵),
      攻击序号: Number.isInteger(攻击序号) ? 攻击序号 : null,
      记录时间: Date.now()
    };
    状态.移动队列.push(移动);
    if (状态.移动队列.length > 200) 状态.移动队列.shift();
    记日志("记录移动操作", {
      移动: 取得移动摘要(移动),
      移动队列长度: 状态.移动队列.length
    });
    请求渲染();
  }

  function 撤销移动操作() {
    const 移动 = 状态.移动队列.pop();
    记日志("撤销移动操作", {
      已撤销: 移动 ? 取得移动摘要(移动) : null,
      移动队列长度: 状态.移动队列.length
    });
    请求渲染();
  }

  function 清空移动队列(来源) {
    const 原长度 = 状态.移动队列.length;
    状态.移动队列 = [];
    状态.上次操作轨迹渲染签名 = "";
    记日志("清空移动队列", {
      来源: 来源 || "未知",
      原移动队列长度: 原长度
    });
    请求渲染();
  }

  function 按攻击序号清理移动队列(攻击序号) {
    if (!Number.isInteger(攻击序号)) return;
    const 原长度 = 状态.移动队列.length;
    if (!原长度) return;

    状态.移动队列 = 状态.移动队列.filter(移动 => {
      return !Number.isInteger(移动.攻击序号) || 移动.攻击序号 > 攻击序号;
    });

    if (状态.移动队列.length !== 原长度) {
      状态.上次操作轨迹渲染签名 = "";
      记日志("按攻击序号清理移动队列", {
        攻击序号,
        原移动队列长度: 原长度,
        新移动队列长度: 状态.移动队列.length
      });
      请求渲染();
    }
  }

  function 重置本局(数据包) {
    状态.宽度 = 0;
    状态.高度 = 0;
    状态.塔列表 = null;
    状态.已知塔集合.clear();
    状态.已知塔类型.clear();
    状态.已知敌方基地集合.clear();
    状态.地图数组 = null;
    状态.兵力分布着色列表 = [];
    状态.上次兵力分布着色签名 = "";
    清空移动队列("新局重置");
    状态.当前回合 = Number.isInteger(数据包 && 数据包.turn) ? 数据包.turn : 0;
    状态.我方索引 = Number.isInteger(数据包 && 数据包.playerIndex) ? 数据包.playerIndex : null;
    状态.队伍 = Array.isArray(数据包 && 数据包.teams) ? 数据包.teams.slice() : null;
    尝试从地图读取尺寸(数据包 || {});
    更新地图缓存和兵力分布(数据包 || {}, "新局重置");
    更新大回合倒计时();
    清空覆盖层();
    记日志("新局重置", {
      数据键: 数据包 ? Object.keys(数据包) : [],
      有map: Array.isArray(数据包 && 数据包.map),
      有map_diff: Array.isArray(数据包 && 数据包.map_diff),
      有cities: Array.isArray(数据包 && 数据包.cities),
      有cities_diff: Array.isArray(数据包 && 数据包.cities_diff),
      有generals: Array.isArray(数据包 && 数据包.generals),
      回合: 状态.当前回合,
      大回合倒计时: 取得大回合倒计时(状态.当前回合),
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

    if (typeof socket.emit === "function" && !socket.__塔记忆emit已挂钩) {
      const 原emit = socket.emit;
      socket.__塔记忆emit已挂钩 = true;
      socket.emit = function (事件名, ...参数) {
        安全执行("emit出站操作记录", () => {
          if (事件名 === "attack") {
            记录移动操作(参数[0], 参数[1], 参数[2], 参数[3]);
          } else if (事件名 === "undo_move") {
            撤销移动操作();
          } else if (事件名 === "clear_moves") {
            清空移动队列("clear_moves");
          }
        });
        return 原emit.call(this, 事件名, ...参数);
      };
      记日志("socket.emit出站操作记录已安装");
    }

    if (typeof socket.onevent === "function" && !socket.__塔记忆onevent已挂钩) {
      const 原onevent = socket.onevent;
      socket.__塔记忆onevent已挂钩 = true;
      socket.onevent = function (包) {
        安全执行("onevent入站预处理", () => {
          const 数据 = Array.isArray(包?.data) ? 包.data : null;
          if (数据) 预处理入站事件(数据[0], 数据[1]);
        });
        return 原onevent.call(this, 包);
      };
      记日志("socket.onevent预处理已安装");
    }

    if (typeof socket.emitEvent === "function" && !socket.__塔记忆emitEvent已挂钩) {
      const 原emitEvent = socket.emitEvent;
      socket.__塔记忆emitEvent已挂钩 = true;
      socket.emitEvent = function (参数列表) {
        安全执行("emitEvent入站预处理", () => {
          if (Array.isArray(参数列表)) 预处理入站事件(参数列表[0], 参数列表[1]);
        });
        return 原emitEvent.call(this, 参数列表);
      };
      记日志("socket.emitEvent预处理已安装");
    }

    socket.on("game_start", 数据包 => {
      安全执行("game_start回合倒计时", () => {
        记录回合(数据包 || {}, "game_start");
      });
      安全执行("game_start颜色重构", () => {
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
      延后执行("game_start", () => {
        重置本局(数据包 || {});
        处理塔位置(数据包 || {}, "game_start");
        处理基地位置(数据包 || {}, "game_start");
      });
    });

    socket.on("game_update", 数据包 => {
      安全执行("game_update回合倒计时", () => {
        记录回合(数据包 || {}, "game_update");
      });
      安全执行("game_update颜色重构", () => {
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
      延后执行("game_update", () => {
        按攻击序号清理移动队列(数据包 && 数据包.attackIndex);
        尝试从地图读取尺寸(数据包 || {});
        更新地图缓存和兵力分布(数据包 || {}, "game_update");
        处理塔位置(数据包 || {}, "game_update");
        处理基地位置(数据包 || {}, "game_update");
      });
    });
  }

  function 安装socket访问器() {
    let 当前socket = window.socket;
    try {
      const 描述符 = Object.getOwnPropertyDescriptor(window, "socket");
      if (!描述符 || 描述符.configurable) {
        Object.defineProperty(window, "socket", {
          configurable: true,
          enumerable: true,
          get() {
            return 当前socket;
          },
          set(新socket) {
            当前socket = 新socket;
            记日志("window.socket被赋值", {
              存在: Boolean(新socket),
              connected: 新socket && 新socket.connected,
              id: 新socket && 新socket.id
            });
            安全执行("挂钩socket", () => {
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

  function 更新大回合倒计时() {
    const 倒计时 = 取得大回合倒计时(状态.当前回合);
    const 大回合序号 = 取得大回合序号(状态.当前回合);
    if (倒计时 == null) return;

    移除左上角倒计时();
    const 文本 = `${String(倒计时)}.${大回合序号}`;
    let 目标元素 = 状态.大回合倒计时元素;
    if (!目标元素 || !document.documentElement.contains(目标元素)) {
      目标元素 = 取得大回合倒计时元素();
    }
    if (!目标元素) return;

    if (状态.上次大回合倒计时文本 !== 文本 || !目标元素.classList.contains(大回合倒计时类名)) {
      目标元素.innerHTML = `<span class="gio-big-turn-main">${倒计时}</span><span class="gio-big-turn-index">${大回合序号}</span>`;
    }
    目标元素.classList.add(大回合倒计时类名);
    if (目标元素.title !== "距离所有兵力+1的大回合；小号数字是当前大回合") {
      目标元素.title = "距离所有兵力+1的大回合；小号数字是当前大回合";
    }
    状态.上次大回合倒计时文本 = 文本;
  }

  function 取得大回合倒计时元素() {
    const 排行榜标识元素 = 取得排行榜标识元素();
    if (排行榜标识元素) {
      状态.大回合倒计时元素 = 排行榜标识元素;
      return 排行榜标识元素;
    }
    return null;
  }

  function 移除左上角倒计时() {
    if (!document.body) return;
    const 旧元素 = document.getElementById(大回合倒计时元素编号);
    if (旧元素 && 旧元素.parentNode) 旧元素.parentNode.removeChild(旧元素);
  }

  function 取得排行榜标识元素() {
    if (!document.body) return null;
    const 表格列表 = document.body.querySelectorAll("table, .leaderboard, #leaderboard");

    for (const 表格 of 表格列表) {
      const 文本 = (表格.textContent || "").trim();
      if (文本.indexOf("Player") < 0 && 文本.indexOf("Army") < 0 && 文本.indexOf("Land") < 0) continue;

      const 行列表 = 表格.querySelectorAll("tr");
      for (const 行 of 行列表) {
        const 单元格列表 = Array.from(行.children).filter(单元格 => {
          const 标签 = 单元格.tagName?.toLowerCase() || "";
          return 标签 === "td" || 标签 === "th";
        });
        if (单元格列表.length >= 2) {
          const 第一格文本 = (单元格列表[0].textContent || "").trim();
          const 第二格文本 = (单元格列表[1].textContent || "").trim();
          if (第一格文本 === "★" || 第一格文本 === "*" || 第二格文本 === "Player" || 单元格列表[0].querySelector(".star, .icon, svg")) {
            return 单元格列表[0];
          }
        }
      }
    }

    return null;
  }

  function 安装样式() {
    if (!document.documentElement || document.getElementById(样式编号)) return;
    const 样式 = document.createElement("style");
    样式.id = 样式编号;
    样式.textContent = `
.${覆盖层类名} {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  z-index: 28;
}
#${大回合倒计时元素编号} {
  display: none !important;
}
.${大回合倒计时类名} {
  text-align: center !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
  min-width: 38px !important;
  padding-left: 2px !important;
  padding-right: 2px !important;
}
.${大回合倒计时类名} .gio-big-turn-main {
  display: inline-block;
  color: #ffffff;
  font: 800 18px/1 Arial, sans-serif;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
}
.${大回合倒计时类名} .gio-big-turn-index {
  display: inline-block;
  margin-left: 2px;
  color: rgba(255, 255, 255, 0.82);
  font: 700 10px/1 Arial, sans-serif;
  vertical-align: baseline;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
}
@keyframes gio-current-move-pulse {
  0% { box-shadow: inset 0 0 0 2px #00eaff, 0 0 0 2px rgba(0, 0, 0, 0.95), 0 0 7px rgba(0, 234, 255, 0.85) !important; }
  50% { box-shadow: inset 0 0 0 3px #ffffff, 0 0 0 2px rgba(0, 0, 0, 0.95), 0 0 14px rgba(0, 234, 255, 1) !important; }
  100% { box-shadow: inset 0 0 0 2px #00eaff, 0 0 0 2px rgba(0, 0, 0, 0.95), 0 0 7px rgba(0, 234, 255, 0.85) !important; }
}
#gameMap td.selected, #gameMap td.selected50, #gameMap td[class*='selected-'],
.tiles-canvas-preview td.selected, .tiles-canvas-preview td.selected50, .tiles-canvas-preview td[class*='selected-'] {
  border-color: #ffffff !important;
  outline: 2px solid #00eaff !important;
  outline-offset: -3px !important;
  animation: gio-current-move-pulse 0.9s infinite !important;
}
.lightblue, .selected-lightblue, .leaderboard .lightblue, #leaderboard .lightblue {
  background-color: #2792ff !important;
  fill: #2792ff !important;
}
.blue, .selected-blue, .leaderboard .blue, #leaderboard .blue {
  background-color: #2792ff !important;
  fill: #2792ff !important;
}`.trim();
    document.documentElement.appendChild(样式);
  }

  function 取画布() {
    return document.querySelector(".game-map-canvas");
  }

  function 取宿主(画布) {
    if (!画布) return null;
    const 候选宿主 = 画布.parentElement || 画布.closest(".relative") || 画布.closest(".game-page");
    if (!候选宿主) return null;
    const 样式 = window.getComputedStyle ? window.getComputedStyle(候选宿主) : null;
    if (样式 && 样式.position === "static") return document.body || 候选宿主;
    return 候选宿主;
  }

  function 确保覆盖层() {
    安装样式();
    const 画布 = 取画布();
    if (!画布) {
      const 现在 = Date.now();
      if (现在 - 状态.上次无画布日志 > 2000) {
        状态.上次无画布日志 = 现在;
        记日志("未找到棋盘画布", { 已知塔数量: 状态.已知塔集合.size, 页面: location.pathname });
      }
      return null;
    }

    const 宿主 = 取宿主(画布);
    if (!宿主) return null;

    let 覆盖层 = 宿主.querySelector(`.${覆盖层类名}`);
    if (!覆盖层) {
      覆盖层 = document.createElement("canvas");
      覆盖层.className = 覆盖层类名;
      宿主.appendChild(覆盖层);
      记日志("覆盖层已创建", { 宿主类名: 宿主.className });
    }

    return { 画布, 宿主, 覆盖层 };
  }

  function 清空覆盖层() {
    const 覆盖层 = document.querySelector(`.${覆盖层类名}`);
    if (!覆盖层) return;
    const ctx = 覆盖层.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, 覆盖层.width, 覆盖层.height);
  }

  function 调整覆盖层(部件) {
    const 画布矩形 = 部件.画布.getBoundingClientRect();
    const 宿主矩形 = 部件.宿主.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const css宽 = Math.max(1, 画布矩形.width);
    const css高 = Math.max(1, 画布矩形.height);
    const 像素宽 = Math.round(css宽 * dpr);
    const 像素高 = Math.round(css高 * dpr);

    if (部件.覆盖层.width !== 像素宽) 部件.覆盖层.width = 像素宽;
    if (部件.覆盖层.height !== 像素高) 部件.覆盖层.height = 像素高;
    部件.覆盖层.style.width = `${css宽}px`;
    部件.覆盖层.style.height = `${css高}px`;
    部件.覆盖层.style.left = `${画布矩形.left - 宿主矩形.left}px`;
    部件.覆盖层.style.top = `${画布矩形.top - 宿主矩形.top}px`;

    return { dpr, css宽, css高 };
  }

  function 画塔标记(ctx, x, y, 大小, 类型) {
    const 是敌方塔 = 类型 === "敌方塔";
    const 外线宽 = Math.max(2, 大小 * 0.09);
    const 内线宽 = Math.max(1.5, 大小 * (是敌方塔 ? 0.065 : 0.045));
    const 外偏移 = 外线宽 / 2 + 1;
    const 内偏移 = 外偏移 + 外线宽 / 2 + 内线宽 / 2;
    const 主色 = 是敌方塔 ? "#ff5aa5" : "#ffd84d";
    const 高光色 = 是敌方塔 ? "#ffd1e6" : "#fff4a8";

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
      const 角长 = Math.max(5, 大小 * 0.24);
      const 角偏移 = Math.max(3, 大小 * 0.12);
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
    const 外线宽 = Math.max(3, 大小 * 0.13);
    const 内线宽 = Math.max(2, 大小 * 0.06);
    const 外偏移 = 外线宽 / 2 + 1;
    const 内偏移 = 外偏移 + 外线宽 / 2 + 内线宽 / 2;
    const 角长 = Math.max(6, 大小 * 0.34);
    const 角偏移 = Math.max(2, 大小 * 0.08);

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

  function 取得格子中心(索引, 格宽, 格高) {
    const 行 = Math.floor(索引 / 状态.宽度);
    const 列 = 索引 % 状态.宽度;
    return {
      x: 列 * 格宽 + 格宽 / 2,
      y: 行 * 格高 + 格高 / 2,
      行,
      列
    };
  }

  function 画箭头线(ctx, 起点, 终点, 线宽, 半兵) {
    const dx = 终点.x - 起点.x;
    const dy = 终点.y - 起点.y;
    const 距离 = Math.hypot(dx, dy);
    if (!Number.isFinite(距离) || 距离 < 1) return;

    const 缩进 = Math.max(4, 线宽 * 2.2);
    const 起x = 起点.x + dx / 距离 * 缩进;
    const 起y = 起点.y + dy / 距离 * 缩进;
    const 终x = 终点.x - dx / 距离 * 缩进;
    const 终y = 终点.y - dy / 距离 * 缩进;
    const 角度 = Math.atan2(终y - 起y, 终x - 起x);
    const 箭头长 = Math.max(5, Math.min(10, 线宽 * 3.1));
    const 箭头角 = Math.PI / 6;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.globalAlpha = 0.62;
    ctx.lineWidth = 线宽 + Math.max(1.5, 线宽 * 0.75);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.72)";
    ctx.setLineDash(半兵 ? [Math.max(4, 线宽 * 2.2), Math.max(3, 线宽 * 1.4)] : []);
    ctx.beginPath();
    ctx.moveTo(起x, 起y);
    ctx.lineTo(终x, 终y);
    ctx.stroke();

    ctx.globalAlpha = 0.78;
    ctx.lineWidth = 线宽;
    ctx.strokeStyle = 半兵 ? "#d7fbff" : "#25f1ff";
    ctx.beginPath();
    ctx.moveTo(起x, 起y);
    ctx.lineTo(终x, 终y);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.globalAlpha = 0.68;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.76)";
    ctx.lineWidth = 线宽 + Math.max(1.5, 线宽 * 0.6);
    ctx.beginPath();
    ctx.moveTo(终x, 终y);
    ctx.lineTo(终x - 箭头长 * Math.cos(角度 - 箭头角), 终y - 箭头长 * Math.sin(角度 - 箭头角));
    ctx.moveTo(终x, 终y);
    ctx.lineTo(终x - 箭头长 * Math.cos(角度 + 箭头角), 终y - 箭头长 * Math.sin(角度 + 箭头角));
    ctx.stroke();

    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = 半兵 ? "#d7fbff" : "#25f1ff";
    ctx.lineWidth = 线宽;
    ctx.beginPath();
    ctx.moveTo(终x, 终y);
    ctx.lineTo(终x - 箭头长 * Math.cos(角度 - 箭头角), 终y - 箭头长 * Math.sin(角度 - 箭头角));
    ctx.moveTo(终x, 终y);
    ctx.lineTo(终x - 箭头长 * Math.cos(角度 + 箭头角), 终y - 箭头长 * Math.sin(角度 + 箭头角));
    ctx.stroke();

    if (半兵) {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.72)";
      ctx.lineWidth = Math.max(1, 线宽 * 0.45);
      ctx.beginPath();
      ctx.arc((起x + 终x) / 2, (起y + 终y) / 2, Math.max(2, 线宽 * 0.75), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
    }

    ctx.restore();
  }

  function 画当前移动位置(ctx, 索引, 格宽, 格高, 大小) {
    const 行 = Math.floor(索引 / 状态.宽度);
    const 列 = 索引 % 状态.宽度;
    const x = 列 * 格宽;
    const y = 行 * 格高;
    const 外线宽 = Math.max(2, 大小 * 0.07);
    const 内线宽 = Math.max(1.2, 大小 * 0.035);
    const 角长 = Math.max(4, 大小 * 0.2);
    const 角偏移 = Math.max(4, 大小 * 0.18);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.globalAlpha = 0.46;
    ctx.lineWidth = 外线宽;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.95)";
    ctx.beginPath();
    ctx.moveTo(x + 角偏移, y + 角偏移 + 角长);
    ctx.lineTo(x + 角偏移, y + 角偏移);
    ctx.lineTo(x + 角偏移 + 角长, y + 角偏移);
    ctx.moveTo(x + 格宽 - 角偏移 - 角长, y + 角偏移);
    ctx.lineTo(x + 格宽 - 角偏移, y + 角偏移);
    ctx.lineTo(x + 格宽 - 角偏移, y + 角偏移 + 角长);
    ctx.moveTo(x + 格宽 - 角偏移, y + 格高 - 角偏移 - 角长);
    ctx.lineTo(x + 格宽 - 角偏移, y + 格高 - 角偏移);
    ctx.lineTo(x + 格宽 - 角偏移 - 角长, y + 格高 - 角偏移);
    ctx.moveTo(x + 角偏移 + 角长, y + 格高 - 角偏移);
    ctx.lineTo(x + 角偏移, y + 格高 - 角偏移);
    ctx.lineTo(x + 角偏移, y + 格高 - 角偏移 - 角长);
    ctx.stroke();

    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 内线宽;
    ctx.strokeStyle = "#25f1ff";
    ctx.beginPath();
    ctx.moveTo(x + 角偏移, y + 角偏移 + 角长);
    ctx.lineTo(x + 角偏移, y + 角偏移);
    ctx.lineTo(x + 角偏移 + 角长, y + 角偏移);
    ctx.moveTo(x + 格宽 - 角偏移 - 角长, y + 角偏移);
    ctx.lineTo(x + 格宽 - 角偏移, y + 角偏移);
    ctx.lineTo(x + 格宽 - 角偏移, y + 角偏移 + 角长);
    ctx.moveTo(x + 格宽 - 角偏移, y + 格高 - 角偏移 - 角长);
    ctx.lineTo(x + 格宽 - 角偏移, y + 格高 - 角偏移);
    ctx.lineTo(x + 格宽 - 角偏移 - 角长, y + 格高 - 角偏移);
    ctx.moveTo(x + 角偏移 + 角长, y + 格高 - 角偏移);
    ctx.lineTo(x + 角偏移, y + 格高 - 角偏移);
    ctx.lineTo(x + 角偏移, y + 格高 - 角偏移 - 角长);
    ctx.stroke();

    ctx.restore();
  }

  function 画操作轨迹(ctx, 格宽, 格高, 大小) {
    if (!状态.移动队列.length) return;

    const 格子数 = 状态.宽度 * 状态.高度;
    const 可绘制移动 = 状态.移动队列.filter(移动 => {
      return Number.isInteger(移动.起点) && Number.isInteger(移动.终点)
        && 移动.起点 >= 0 && 移动.终点 >= 0
        && 移动.起点 < 格子数 && 移动.终点 < 格子数;
    });
    if (!可绘制移动.length) return;

    const 线宽 = Math.max(1.5, Math.min(3, 大小 * 0.07));
    ctx.save();
    ctx.globalAlpha = 0.78;
    可绘制移动.forEach((移动, 下标) => {
      const 起点 = 取得格子中心(移动.起点, 格宽, 格高);
      const 终点 = 取得格子中心(移动.终点, 格宽, 格高);
      ctx.globalAlpha = 下标 === 可绘制移动.length - 1 ? 0.9 : 0.45;
      画箭头线(ctx, 起点, 终点, 线宽, 移动.是否半兵);
    });
    ctx.restore();

    画当前移动位置(ctx, 可绘制移动[可绘制移动.length - 1].终点, 格宽, 格高, 大小);

    const 签名 = `${可绘制移动.length}:${可绘制移动
      .map(移动 => `${移动.起点}>${移动.终点}:${移动.是否半兵 ? "半" : "全"}:${移动.攻击序号}`)
      .join("|")}`;
    if (签名 !== 状态.上次操作轨迹渲染签名) {
      状态.上次操作轨迹渲染签名 = 签名;
      记日志("操作轨迹已渲染", {
        移动队列长度: 状态.移动队列.length,
        可绘制移动数量: 可绘制移动.length,
        当前移动位置: 取得移动摘要(可绘制移动[可绘制移动.length - 1])
      });
    }
  }

  function 渲染() {
    状态.已请求渲染 = false;

    if (!状态.已知塔集合.size && !状态.已知敌方基地集合.size && !状态.移动队列.length && !状态.兵力分布着色列表.length) {
      清空覆盖层();
      return;
    }

    if (!状态.宽度 || !状态.高度) {
      const 现在 = Date.now();
      if (现在 - 状态.上次无尺寸日志 > 2000) {
        状态.上次无尺寸日志 = 现在;
        记日志("已有标记位置但缺少地图宽高，无法换算坐标", {
          已知塔数量: 状态.已知塔集合.size,
          已知敌方基地数量: 状态.已知敌方基地集合.size,
          移动队列长度: 状态.移动队列.length,
          已知塔: Array.from(状态.已知塔集合).slice(0, 20),
          已知敌方基地: Array.from(状态.已知敌方基地集合.values()).slice(0, 20),
          移动队列: 状态.移动队列.slice(0, 20).map(取得移动摘要)
        });
      }
      return;
    }

    const 部件 = 确保覆盖层();
    if (!部件) return;

    const 尺寸 = 调整覆盖层(部件);
    const ctx = 部件.覆盖层.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(尺寸.dpr, 0, 0, 尺寸.dpr, 0, 0);
    ctx.clearRect(0, 0, 尺寸.css宽, 尺寸.css高);

    const 格宽 = 尺寸.css宽 / 状态.宽度;
    const 格高 = 尺寸.css高 / 状态.高度;
    const 大小 = Math.min(格宽, 格高);

    function 画兵力分布着色() {
      if (!状态.兵力分布着色列表.length) return;

      const 最高兵力 = 状态.兵力分布着色列表[0].兵力;
      const 最低兵力 = 状态.兵力分布着色列表[状态.兵力分布着色列表.length - 1].兵力;
      const 兵力跨度 = Math.max(1, 最高兵力 - 最低兵力);
      const 内缩 = Math.max(1, 大小 * 0.08);

      ctx.save();
      状态.兵力分布着色列表.forEach(地块 => {
        const 强度 = (地块.兵力 - 最低兵力) / 兵力跨度;
        const 透明度 = 0.14 + 强度 * 0.24;
        const 边线透明度 = 0.16 + 强度 * 0.22;
        const 行 = Math.floor(地块.索引 / 状态.宽度);
        const 列 = 地块.索引 % 状态.宽度;
        const x = 列 * 格宽;
        const y = 行 * 格高;

        ctx.fillStyle = `rgba(255, 190, 72, ${透明度.toFixed(3)})`;
        ctx.fillRect(
          x + 内缩,
          y + 内缩,
          Math.max(1, 格宽 - 内缩 * 2),
          Math.max(1, 格高 - 内缩 * 2)
        );

        ctx.lineWidth = Math.max(1, 大小 * 0.035);
        ctx.strokeStyle = `rgba(255, 230, 150, ${边线透明度.toFixed(3)})`;
        ctx.strokeRect(
          x + 内缩 + ctx.lineWidth / 2,
          y + 内缩 + ctx.lineWidth / 2,
          Math.max(1, 格宽 - 内缩 * 2 - ctx.lineWidth),
          Math.max(1, 格高 - 内缩 * 2 - ctx.lineWidth)
        );
      });
      ctx.restore();
    }

    画兵力分布着色();

    画操作轨迹(ctx, 格宽, 格高, 大小);

    状态.已知塔集合.forEach(索引 => {
      const 行 = Math.floor(索引 / 状态.宽度);
      const 列 = 索引 % 状态.宽度;
      画塔标记(ctx, 列 * 格宽, 行 * 格高, 大小, 状态.已知塔类型.get(索引));
    });

    状态.已知敌方基地集合.forEach((基地, 索引) => {
      const 行 = Math.floor(索引 / 状态.宽度);
      const 列 = 索引 % 状态.宽度;
      画敌方基地标记(ctx, 列 * 格宽, 行 * 格高, 大小);
    });

    const 固定标记渲染签名 = [
      状态.已知塔集合.size,
      Array.from(状态.已知塔类型.values()).filter(类型 => { return 类型 === "敌方塔"; }).length,
      状态.已知敌方基地集合.size,
      状态.兵力分布着色列表.length,
      状态.移动队列.length,
      `${状态.宽度}x${状态.高度}`,
      `${Math.round(尺寸.css宽)}x${Math.round(尺寸.css高)}`
    ].join("|");
    if (固定标记渲染签名 !== 状态.上次固定标记渲染签名) {
      状态.上次固定标记渲染签名 = 固定标记渲染签名;
      记日志("固定标记已渲染", {
        已知塔数量: 状态.已知塔集合.size,
        敌方塔数量: Array.from(状态.已知塔类型.values()).filter(类型 => { return 类型 === "敌方塔"; }).length,
        已知敌方基地数量: 状态.已知敌方基地集合.size,
        兵力分布着色数量: 状态.兵力分布着色列表.length,
        移动队列长度: 状态.移动队列.length,
        地图尺寸: `${状态.宽度}x${状态.高度}`,
        覆盖层尺寸: `${Math.round(尺寸.css宽)}x${Math.round(尺寸.css高)}`
      });
    }
  }

  function 请求渲染() {
    if (状态.已请求渲染) return;
    状态.已请求渲染 = true;
    requestAnimationFrame(() => {
      安全执行("渲染", 渲染);
    });
  }

  function 安装页面观察器() {
    if (状态.页面观察器) return;
    if (!document.body) {
      setTimeout(安装页面观察器, 100);
      return;
    }
    状态.页面观察器 = new MutationObserver(() => {
      更新大回合倒计时();
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
    window.addEventListener("resize", 更新大回合倒计时, { passive: true });
    记日志("页面观察器已安装", { zem: true });
  }

  function 暴露调试接口() {
    window.gio塔标记 = {
      版本: 脚本版本,
      日志() {
        return 状态.最近日志.slice();
      },
      状态() {
        return {
          宽度: 状态.宽度,
          高度: 状态.高度,
          当前回合: 状态.当前回合,
          大回合倒计时: 取得大回合倒计时(状态.当前回合),
          塔列表长度: 状态.塔列表 ? 状态.塔列表.length : null,
          已知塔数量: 状态.已知塔集合.size,
          敌方塔数量: Array.from(状态.已知塔类型.values()).filter(类型 => { return 类型 === "敌方塔"; }).length,
          已知敌方基地数量: 状态.已知敌方基地集合.size,
          兵力分布着色数量: 状态.兵力分布着色列表.length,
          我方索引: 状态.我方索引,
          队伍: 状态.队伍,
          颜色规则: {
            我方蓝色索引,
            敌方红色索引
          },
          socket已挂钩: 状态.socket已挂钩
        };
      },
      已知塔() {
        return Array.from(状态.已知塔集合).map(索引 => {
          return {
            索引,
            类型: 状态.已知塔类型.get(索引) || "塔",
            行: 状态.宽度 ? Math.floor(索引 / 状态.宽度) : null,
            列: 状态.宽度 ? 索引 % 状态.宽度 : null
          };
        });
      },
      已知敌方基地() {
        return Array.from(状态.已知敌方基地集合.values()).map(基地 => {
          return {
            ...基地,
            行: 状态.宽度 ? Math.floor(基地.索引 / 状态.宽度) : null,
            列: 状态.宽度 ? 基地.索引 % 状态.宽度 : null
          };
        });
      },
      兵力分布着色() {
        return 状态.兵力分布着色列表.map(地块 => {
          return {
            索引: 地块.索引,
            兵力: 地块.兵力,
            行: 状态.宽度 ? Math.floor(地块.索引 / 状态.宽度) : null,
            列: 状态.宽度 ? 地块.索引 % 状态.宽度 : null
          };
        });
      },
      手动加塔(索引) {
        if (Number.isInteger(索引) && 索引 >= 0) {
          状态.已知塔集合.add(索引);
          if (!状态.已知塔类型.has(索引)) 状态.已知塔类型.set(索引, "塔");
          记日志("手动加塔", { 索引 });
          请求渲染();
        }
      },
      手动设敌方塔(索引) {
        if (Number.isInteger(索引) && 索引 >= 0) {
          状态.已知塔集合.add(索引);
          状态.已知塔类型.set(索引, "敌方塔");
          记日志("手动设敌方塔", { 索引 });
          请求渲染();
        }
      },
      手动加敌方基地(索引, 玩家索引) {
        if (Number.isInteger(索引) && 索引 >= 0) {
          状态.已知敌方基地集合.set(索引, {
            索引,
            玩家索引: Number.isInteger(玩家索引) ? 玩家索引 : null,
            首次回合: null
          });
          记日志("手动加敌方基地", { 索引, 玩家索引 });
          请求渲染();
        }
      },
      手动尺寸(宽度, 高度) {
        状态.宽度 = 宽度;
        状态.高度 = 高度;
        记日志("手动设置地图尺寸", { 宽度, 高度 });
        请求渲染();
      },
      清空() {
        状态.已知塔集合.clear();
        状态.已知塔类型.clear();
        状态.已知敌方基地集合.clear();
        状态.塔列表 = null;
        清空覆盖层();
        记日志("手动清空");
      },
      重绘: 请求渲染,
      开关日志(值) {
        详细日志 = Boolean(值);
        记日志("日志开关", { 详细日志 });
      }
    };
    window.gioTowerMarker = window.gio塔标记;
  }

  function 启动() {
    记日志("脚本启动", { 版本: 脚本版本, 页面: location.href });
    暴露调试接口();
    轮询socket();
    安装页面观察器();
  }

  安全执行("启动", 启动);
})();
