const Subscription = require("egg").Subscription;
const rpio = require("rpio"); // 控制GPIO的脚口子
class UpdateFocus extends Subscription {
  // 通过 schedule 属性来设置定时任务的执行间隔等配置
  static get schedule() {
    return {
      interval: "1s", // 1s间隔
      type: "all", // 指定所有的 worker 都需要执行
    };
  }

  // subscribe 是真正定时任务执行时被运行的函数
  async subscribe() {
    const { ctx, logger } = this;
    // ctx.app
    // 开始执行对焦的功能
    ctx.app.maxFocusLimit += 1; // 通过设置30s的间隔
    if (ctx.app.maxFocusLimit > 30) {
      // 如果是定时拍照 或者正在拍照 那么就不能点击了
      if (ctx.app.isSetTime == "1") {
        // 表示在定时中 那么就需要让这个数据返回即可
        ctx.app.maxFocusLimit = 0;
        return;
      }
      if (rpio.read(37) === rpio.HIGH) {
        console.log("正在拍照中");
        return;
      }
      const str = 11;
      rpio.write(str, 1);
      rpio.msleep(50); // 如果是50ms 的操作就可以执行这个操作了 对焦的作用
      rpio.write(str, 0);
      ctx.app.maxFocusLimit = 0;
    }
  }
}

module.exports = UpdateFocus;
