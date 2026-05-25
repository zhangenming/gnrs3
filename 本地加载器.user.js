// ==UserScript==
// @name         generals.io 地图标记
// @namespace    https://generals.io/
// @description  标记未知障碍物，发现塔和山后保留地图标记。
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

window.addEventListener('wheel', 禁止滚轮缩放, {
  passive: false,
  capture: true,
})
window.addEventListener('mousewheel', 禁止滚轮缩放, {
  passive: false,
  capture: true,
})

void import('http://127.0.0.1:48291/src/main.js').catch((错误) => {
  console.error('generals.io 地图标记加载失败', 错误)
})

function 禁止滚轮缩放(事件) {
  if (!document.querySelector('#game-page #gameMap')) return
  事件.preventDefault()
  事件.stopImmediatePropagation()
}
