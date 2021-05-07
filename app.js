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
  pModel: "AA7555020a0082",
  mixinModel: "AA7555020b0083",
};
class AppBootHook {
  constructor(app) {
    this.app = app;
    // 需要在这里设置一个变量 如果这个变量最大为50
    app.maxFocusLimit = 0;
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
    ctx.service.home.initDB(dbName);
    // 默认开始初始化数据
    const GPIOList = [
      35,
      37,
      7,
      13,
      31,
      29,
      11,
      15,
      32,
      33,
      22,
      12,
      36,
      38,
      40,
    ];
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
    console.log("jsonData unit", jsonData["unit"]);
    // 读取配置后需要将对应的数据设置为这个模式
    ctx.service.home.initModel(type);
    // 这个代码就是创建一个匿名的函数来创建这个context
    if (jsonData["isSetTime"] == 1) {
      // 表示为定时服务 那么就需要将以下这个函数
      // 如果是定时 那么就需要设置这个函数了
      // 如果是定时拍照那么就要显示这个
      let time = 0;
      switch (jsonData["unit"]) {
        case "s":
          time = parseInt(jsonData["defineTime"] * 1000);
          break;
        case "m":
          time = parseInt(jsonData["defineTime"] * 1000 * 60);
          break;
        case "h":
          time = parseInt(jsonData["defineTime"] * 1000 * 60 * 60);
          break;
      }
      console.log("time", time);
      ctx.service.home.setTimeIntervalByType("photo", file, jsonData, 37, time);
    }
    const portName = "/dev/ttyAMA0"; // 默认为打开的串口
    //logger.info("portName", portName);
    // 设置属性
    const serialPort = new SerialPort(
      portName,
      {
        baudRate: 9600,
        dataBits: 8,
        parity: "none",
        stopBits: 1,
        flowControl: false,
        autoOpen: false,
      },
      false
    );
    // 如果端口已经打开过了 那么就不需要再打开了
    if (globalHasOpenPort) {
      // 如果端口已经打开过了 那么就不需要再打开了
      //logger.info("端口已经打开过了  不能再重复打开了");
    } else {
      const result = await serialPort.open();
      //logger.info("端口result", result);
      if (result) {
        // 表示为有错误了
        globalHasOpenPort = false;
        // logger.info("端口打开错误了");
      } else {
        globalHasOpenPort = true;
        globalSerialPort = serialPort;
        //logger.info("端口打开正常");
        // 开始接受数据
        serialPort.on("data", async function (data) {
          let dataArray = data.toString("hex");
          console.log("dataArray", dataArray);
          dataArray = dataArray.toUpperCase(); // 变成大写的
          // 开始判断当前的数据字节是否正确
          // 开始判断校验位是否正确
          //  for (let i = 0; i <= dataArray.length; ++i) {}
          // logger.info(dataArray);

          const codeType = dataArray.substring(4, 6);
          let type1 = null;
          // 为取消定时拍照

          if (codeType.toUpperCase() == "55") {
            // 表示为模式选择
            const bitType = dataArray.substring(9, 10);
            console.log("bitType", bitType);
            switch (bitType) {
              case "A":
                type1 = "P";
                break;
              case "1":
                type1 = "AUTO";
                break;
              case "2":
                type1 = "TV";
                break;
              case "7":
                type1 = "AV";
                break;
            }
          } else {
            type1 = uatCommandCodeObj[codeType.toUpperCase() + ""];
          }
          console.log("type1", type1, codeType.toUpperCase());
          // 如果为55 那么就需要再判断
          if (
            type1 == "P" ||
            type1 == "AUTO" ||
            type1 == "AV" ||
            type1 == "TV"
          ) {
            ctx.service.home.initModel(type1);
          } else {
            // 开始执行对应的io口即可
            // logger.info("type", type);
            console.log("type1", type1, codeType.toUpperCase());
            // 开始判断是否为定时拍照
            if (type1 == "noPhoto") {
              ctx.service.home.setTimeIntervalByType(
                "noPhoto",
                file,
                jsonData,
                37,
                0
              );
            }
            if (type1 === "photo") {
              // 表示为拍照 需要检测是否为定时拍照 还是图片给的时间拍照
              const isContainerTime = dataArray.substring(6, 8) == "07";
              if (isContainerTime) {
                // 表示这个是给的时间拍照 需要解析时间 且需要保存到数据库里面去
                console.log("isContainerTime", isContainerTime);
                // 需要将时间来解析即可
                // 如果当前的时间需要解析到不同的时间 需要一个16进制的时间来解析即可
                // 这个时候需要设置不同的时间而且设置不同的时分秒
                // 如果当前的时间有问题 那么就需要将这个移植即可
                ctx.service.home.handleTimePhoto(dataArray);
                return;
              }
              // 定时拍照
              if (codeType.toUpperCase() == "44") {
                const timeDate = dataArray.substring(9, 11); // 需要转为16进制的时间 否则不对
                const unitTime = dataArray.substring(11, 13);
                let isSetTime = false;
                isSetTime = timeDate !== "00";
                if (isSetTime) {
                  // 表示为定时服务 那么就需要将以下这个函数
                  // 如果是定时 那么就需要设置这个函数了
                  // 如果是定时拍照那么就要显示这个
                  let time = 0;
                  switch (unitTime) {
                    case "01":
                      time = parseInt(timeDate * 1000);
                      break;
                    case "02":
                      time = parseInt(timeDate * 1000 * 60);
                      break;
                    case "03":
                      time = parseInt(timeDate * 1000 * 60 * 60);
                      break;
                  }
                  console.log("time", time);
                  ctx.service.home.setTimeIntervalByType(
                    "photo",
                    file,
                    jsonData,
                    37,
                    time
                  );
                }
                return;
              }
              if (codeType.toUpperCase() == "33") {
                ctx.service.home.handleGPIOByType(type1);
              }
            } else {
              // 这个时候需要取消为nophoto
              console.log("拍照", type1);
              ctx.service.home.handleGPIOByType(type1);
            }
          }
        });
      }
    }
    // 这样就可以调用ctx service 函数
  }
}

module.exports = AppBootHook;
