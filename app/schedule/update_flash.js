const Subscription = require('egg').Subscription;
const rpio = require("rpio"); // 控制GPIO的脚口子
class UpdateFlash extends Subscription {
  // 通过 schedule 属性来设置定时任务的执行间隔等配置
  static get schedule() {
    return {
      interval: '30m', // 1 分钟间隔
      type: 'all', // 指定所有的 worker 都需要执行
    };
  }

  // subscribe 是真正定时任务执行时被运行的函数
  async subscribe() {
    const  { ctx,logger } = this

    // 开始执行闪光灯的设置
    const str = 33
    rpio.write(str, 1);
    rpio.msleep(1000) // 执行一秒后开始执行这个操作
    rpio.write(str, 0);
  }
}

module.exports = UpdateFlash;