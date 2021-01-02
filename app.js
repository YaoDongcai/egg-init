const rpio = require("rpio"); // 控制GPIO的脚口子
const path = require("path"); // 读取本地配置文件
const fs = require("fs");
class AppBootHook {
  constructor(app) {
    this.app = app;
    // 需要在这里设置一个变量 如果这个变量最大为50
    app.maxFocusLimit = 0
    app.on('request', ctx => {
        // 监听这个里面的所有请求是否都经过这个
        app.maxFocusLimit = 0
      });
  }

  // 在这个里面开始自定义服务启动即可
  async serverDidReady() {
    // 默认开始初始化数据
    const GPIOList = [35, 37, 7, 13, 31, 29, 11, 15, 32,33, 22, 12, 36, 38, 40];
    // 初始化后直接赋予值
    for (let i = 0; i < GPIOList.length; ++i) {
      rpio.open(GPIOList[i], rpio.OUTPUT, rpio.LOW); // 先初始化为低电平
      rpio.write(GPIOList[i], 0);
    }
    // console.log('开始启动了 需要初始化数据了')
    // 自动开机
    const str = 35;
    rpio.write(str, 1);
    rpio.msleep(500);
    rpio.write(str, 0);
    // 异步操作数据
    // 开始读取本地配置文件 读取数据操作
    var file = path.join(__dirname, "client.config.json");
    let fileData = fs.readFileSync(file);
    // 将这个数据json化
    let jsonData = JSON.parse(fileData);
    const type = jsonData["workType"];
    // 读取配置后需要将对应的数据设置为这个模式
    switch (type) {
      case "P":
        // p模式
        rpio.write(36, rpio.LOW);
        rpio.write(38, rpio.LOW);
        rpio.write(40, rpio.LOW);
        break;
      case "AV":
        rpio.write(36, rpio.HIGH);
        rpio.write(38, rpio.HIGH);
        rpio.write(40, rpio.LOW);
        break;
      case "TV":
        rpio.write(36, rpio.LOW);
        rpio.write(38, rpio.HIGH);
        rpio.write(40, rpio.LOW);
        break;
      case "AUTO":
        rpio.write(36, rpio.HIGH);
        rpio.write(38, rpio.HIGH);
        rpio.write(40, rpio.HIGH);
        break;
    }
    // 这个代码就是创建一个匿名的函数来创建这个context
    if(jsonData['isSetTime'] == 1) {
      // 表示为定时服务 那么就需要将以下这个函数
      const ctx = this.app.createAnonymousContext();
      // 如果是定时 那么就需要设置这个函数了
      // 如果是定时拍照那么就要显示这个
      let time = 0
      switch (jsonData['unit']) {
        case 's':
          time = parseInt(jsonData['defineTime'] * 1000)
          break
        case 'm':
          time = parseInt(jsonData['defineTime'] * 1000 * 60)
          break
        case 'h':
          time = parseInt(jsonData['defineTime'] * 1000 * 60 * 60)
          break
      }
      ctx.service.home.setTimeIntervalByType('photo', file, jsonData, 37, time)
    }
    
    // 这样就可以调用ctx service 函数
  }
}

module.exports = AppBootHook;
