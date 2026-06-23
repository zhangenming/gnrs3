// 功能注册 — 汇总所有功能模块，导出分类钩子列表。
// 每个功能文件通过 import { 注册功能 } from './注册中心.js' 自行注册。
// 新增功能只需：1) 在下方加一行 import；2) 在功能文件底部调用 注册功能()。

import './功能/禁止滚轮缩放.js'
import './功能/自动隐藏回放控制.js'
import './功能/回放大回合逐帧跳转.js'
import './功能/自适应棋盘.js'
import './功能/地图大小标签.js'
import './功能/长任务诊断.js'
import './功能/玩家颜色.js'
import './功能/大回合倒计时.js'
import './功能/回合结束提示.js'
import './功能/塔记忆.js'
import './功能/战场数据差.js'
import './功能/战场塔信息.js'
import './功能/敌方开塔提示.js'
import './功能/我方行动监控.js'
import './功能/游戏数据进展图表.js'
import './功能/帧数分布.js'
import './功能/基地记忆.js'
import './功能/基地危险.js'
import './功能/敌方基地推测.js'
import './功能/视野.js'
import './功能/障碍物标记.js'
import './功能/最佳开局路线.js'
import './功能/兵力分布着色.js'
import './功能/敌方移动高亮.js'
import './功能/敌方主力标记.js'
import './功能/抢塔提示.js'
import './功能/移动队列.js'
import './功能/选中棋子提示.js'
import './功能/自动避免2吃1.js'
import './功能/自动保护基地.js'
import './功能/自动吃基地.js'
import './功能/战场数据冻结.js'
import './功能/自动发送ggs.js'
import './功能/结算星星变化.js'

export {
  功能列表,
  覆盖层功能列表,
  主程序功能列表,
  功能恢复列表,
  socket功能列表,
  地图更新功能列表,
  功能样式列表,
} from './注册中心.js'
