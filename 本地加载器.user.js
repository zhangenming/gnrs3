// ==UserScript==
// @name         generals.io 塔记忆标记
// @namespace    https://generals.io/
// @version      0.9.1
// @description  发现塔和敌方基地后固定标记该位置，丢失视野后仍保留标记。
// @author       Codex
// @match        https://generals.io/*
// @match        http://generals.io/*
// @match        https://ws.generals.io/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

const { observe } = MutationObserver.prototype
MutationObserver.prototype.observe = function (target, config) {
  if (config.zem !== true) {
    return
  }
  return observe.call(this, target, config)
}

void import('http://127.0.0.1:48291/源码/主程序.js').catch((错误) => {
  console.error('generals.io 塔记忆标记加载失败', 错误)
})
