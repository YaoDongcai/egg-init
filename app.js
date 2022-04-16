"use strict";
const rpio = require("rpio"); // 控制GPIO的脚口子
const path = require("path"); // 读取本地配置文件
const fs = require("fs");
const SerialPort = require("serialport");
let globalSerialPort = null;
let globalHasOpenPort = null;

const uatCommandCodeObj = {
  11: "on", // 开机
  22: "off", // 关机
  33: "photo", // 手动拍照
  44: "photo", // 定时拍照
  66: "noPhoto", // 停止拍照
  77: "menuOn",
  88: "menuOff",
  99: "menuUp",
  AA: "menuDown",
  BB: "menuLeft",
  CC: "menuRight",
  DD: "menuOk",
};
// 以下是第二个版本的命令
const commandCodeObj = {
  on: 35, // 开机命令
  off: 35, // 关机命令
  photo: 37, // 手动拍照
  menuOn: 7, // 菜单打开
  menuOff: 7, // 菜单关闭
  menuUp: 13, // 菜单上翻
  menuDown: 31, // 菜单下翻
  menuLeft: 29, // 菜单左翻
  menuRight: 11, // 菜单右翻
  menuOk: 15, // 菜单确定
  SDToggle: 32, // 保持之前的程序一致
  SDToggleOn: 32, // SD卡切换
  SDToggleOff: 32, // SD卡关闭切换
  SDOn: 22, // USB的正极线切换
  SDOff: 22, // 关闭USB的正极线切换
  focusSub: "AA753E020000E3", // 变焦-
  focusAdd: "AA754E02000093", // 变焦+
  downloadStart: "AA751E020100C2", // 数据下载开始
  downloadEnd: "AA751E020000C3", // 数据下载结束
  audioStart: 12, // 录像开始
  audioEnd: 12, // 录像结束
  autoModel: "AA755502010089", // auto自动模式
  avModel: "AA75550202008A", // av模式
  hdrModel: "AA75550203008B", // HDR 模式
  personImageModel: "AA75550204008C", // 人像
  c1Model: "AA75550205008D",
  mModel: "AA75550206008E",
  tvModel: "AA75550207008F",
  audioModel: "AA755502080080",
  c2Model: "AA755502090081",
  pModel: "AA7555020A0082",
  mixinModel: "AA7555020b0083",
};
class AppBootHook {
  constructor(app) {
    this.app = app;
    // 需要在这里设置一个变量 如果这个变量最大为50
    app.maxFocusLimit = 0;
    app.versionType = "2"; // 表示为G5X
    app.isSetTime = "0"; //  这个默认为初始化是没有被定时的
    app.on("request", (ctx) => {
      // 监听这个里面的所有请求是否都经过这个
      app.maxFocusLimit = 0;
    });
  }

  // 在这个里面开始自定义服务启动即可
  async serverDidReady() {
    // const { logger } = this;
    const ctx = this.app.createAnonymousContext();
    const dbName = path.join(__dirname, "camera");
    // 初始化数据库
    ctx.service.home.initDB(dbName);
    // 默认开始初始化数据
    ctx.service.home.initGPIOStatus();
    // 自动开机
    ctx.service.home.autoStartOn();

    // 开始读取本地配置文件 读取数据操作
    var file = path.join(__dirname, "client.config.json");
    // 获取当前的文件配置信息
    this.app.configFilePath = file;
    console.log("this.app", this.app.configFilePath);
    // 同步写法
    const jsonData = ctx.service.home.getFileJsonByFileName(file);
    // 读取配置后需要将对应的数据设置为这个模式
    const type = jsonData["workType"];

    // 这个代码就是创建一个匿名的函数来创建这个context

    // 通信端口打开的工作
    const serialPort = ctx.service.home.openSerialPortByPort();
    // 打开这个端口
    const result = await serialPort.open();
    const autoFocus = jsonData["autoFocus"];
    if (autoFocus == 1) {
      setTimeout(() => {
        ctx.service.home.autoFocusOn();
      }, 3000);
    }
    serialPort.on("data", async function (data) {
      // 对应的data 数据
      let dataArray = data.toString("hex");
      dataArray = dataArray.toUpperCase(); // 变成大写的
      // 开始判断当前的数据字节是否正确
      // 开始判断校验位是否正确
      //  for (let i = 0; i <= dataArray.length; ++i) {}
      // logger.info(dataArray);
      console.log("data", dataArray);
      const codeType = dataArray.substring(4, 6);
      switch (codeType + "") {
        case "11":
        case "22":
          // 开机或者关机都是一样的
          ctx.service.home.setRpioOnOrOff();
          break;
        case "33":
          // 是拍照
          // 需要判断是否是手动拍照 或者定时拍照
          ctx.service.home.setGpioPhotoByTime(dataArray);
          break;
        case "44":
          ctx.service.home.setGpioPhotoInternalTime(dataArray, file, jsonData);
          // 表示为定时拍照
          break;
        case "55":
          // 模式选择
          ctx.service.home.setRpioModel(dataArray);
          break;
        case "66":
          // 停止定时拍照
          ctx.service.home.setTimeIntervalByType(
            "noPhoto",
            file,
            jsonData,
            37,
            0
          );
          // ctx.service.home.stopInterPhoto(dataArray,)
          break;
        case "77":
        case "88":
          ctx.service.home.setRpioMenuOnOrOff();
          break;
        case "99":
          ctx.service.home.setRpioMenuUp();
          break;
        case "AA":
          ctx.service.home.setRpioMenuDown();
          break;
        case "BB":
          ctx.service.home.setRpioMenuLeft();
          break;
        case "CC":
          ctx.service.home.setRpioMenuRight();
          break;
        case "DD":
          ctx.service.home.setRpioMenuOk();
          break;
        case "2E":
          // 如果是2e 表示是收到相机的状态查询 需要返回这个状态即可

          const initStatus = ctx.service.home.getInitStatus(jsonData);
          // 这个时候port 直接返回即可
          serialPort.write(initStatus, "hex", async function (data) {
            // 返回数据即可
            console.log("initStatus", initStatus);
          });
          break;
      }

      // 如果是接受到 那么就需要发送对应的数据给前端即可
      //   serialPort.write("AA", "hex", async function (data) {
      //     // 接受到了数据
      //   });
    });
    // 这样就可以调用ctx service 函数
  }
}

module.exports = AppBootHook;
