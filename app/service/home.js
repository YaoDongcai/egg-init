const Service = require("egg").Service;
const rpio = require("rpio");
const child = require("child_process");
const fs = require("fs");
var Datastore = require("nedb");
const path = require("path");

var db = null;
var timePhotoHandle = null;
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
class HomeService extends Service {
  // 获取所有的数据
  initDB(dbName) {
    db = new Datastore({ filename: dbName, autoload: true });
    // db.insert({
    //   time: "2021年5月份",
    //   index: 1,
    // });
  }
  selectAll() {
    // 返回所有的结果数据
    const { logger } = this;
    logger.info("selectAll");
    return new Promise((resolve, reject) => {
      db.find({}, (err, docs) => {
        logger.info("docs", docs);
        if (err) {
          return reject(err);
        }
        resolve(docs);
      });
    });
  }
  handleGPIOByType(type1, time = "") {
    console.log("type1", type1);
    let str = commandCodeObj[type1 + ""];
    console.log("str", str);
    // 这个时候需要判断是否是模式选择
    rpio.write(str, 1);
    // 设置为100ms 开启或者关闭
    if (type1 == "on" || type1 == "off") {
      // 开机是500ms
      // logger.info("on or off");
      rpio.msleep(500);
    } else {
      rpio.msleep(100);
    }
    // rpio.write(str, rpio.LOW);
    rpio.write(str, 0);
    if (type1 == "photo") {
      db.count({}, function (err, count) {
        // count equals to 4
        db.insert({
          time: time,
          index: count + 1,
        });
      });
    }
  }
  // 如果是带有时间的拍照 那么就需要将这个时间记上
  handleTimePhoto(hex) {
    // 带有时间的校验程序
    const hexArray = [];
    const length = hex.length;
    let temp = "";
    for (let i = 0; i <= length - 1; i += 2) {
      temp = hex[i] + "" + hex[i + 1];
      hexArray.push(temp);
    }
    // 第4位和第5位组合为年份
    let heighBit, lowBit;
    heightBit = (hexArray[4] + "").substring(0, 1);
    lowBit = hexArray[5].substr(1, 1);
    // 获取到year
    let year = "20" + "" + this.hex2int(heightBit + "" + lowBit);
    let month = this.hex2int(hexArray[6]);
    let day = this.hex2int(hexArray[7]);
    let hour = this.hex2int(hexArray[8]);
    let min = this.hex2int(hexArray[9]);
    let sec = this.hex2int(hexArray[10]);
    const time =
      year +
      "年" +
      month +
      "月" +
      day +
      "日" +
      hour +
      "时" +
      min +
      "分" +
      sec +
      "秒";
    // 同时需要拍照
    // 获取当前的insert 数目
    that.handleGPIOByType("photo", time);
    return time;
  }
  // 将16进制转换为10进制的数
  hex2int(hex) {
    var len = hex.length,
      a = new Array(len),
      code;
    for (var i = 0; i < len; i++) {
      code = hex.charCodeAt(i);
      if (48 <= code && code < 58) {
        code -= 48;
      } else {
        code = (code & 0xdf) - 65 + 10;
      }
      a[i] = code;
    }

    return a.reduce(function (acc, c) {
      acc = 16 * acc + c;
      return acc;
    }, 0);
  }
  setDate(dateYMD, dateHMS) {
    const { ctx, logger } = this;
    let cmd = "sudo date --s  " + dateYMD;
    // 需要更改系统时间 强制设置当前的系统时间
    logger.info("cmd", cmd);
    child.exec(cmd, function (error, stdout, stderr) {
      logger.info("error", error);
      logger.info("stdout", stdout);
      logger.info("stderr", stderr);
      logger.info("设置年月日成功");
      cmd = "sudo date --s  " + dateHMS;
      child.exec(cmd, function (error, stdout, stderr) {
        logger.info("error", error);
        logger.info("stdout", stdout);
        logger.info("stderr", stderr);
        logger.info("设置时分秒成功");
      });
    });
  }
  // 初始化G5X的模式
  initG5XModel(type) {
    const { ctx, logger } = this;
    //         case "1": // 0000
    //     rpio.write(36, rpio.LOW);
    //     rpio.write(38, rpio.LOW);
    //     rpio.write(22, rpio.LOW);
    //     rpio.write(40, rpio.LOW);
    //     break;
    //   case "2": // 0001
    //     rpio.write(36, rpio.LOW);
    //     rpio.write(38, rpio.LOW);
    //     rpio.write(22, rpio.LOW);
    //     rpio.write(40, rpio.HIGH);
    //     break;
    //   case "3": // 0010
    //     rpio.write(36, rpio.LOW);
    //     rpio.write(38, rpio.LOW);
    //     rpio.write(22, rpio.HIGH);
    //     rpio.write(40, rpio.LOW);
    //     break;
    //   case "4": // 0011
    //     rpio.write(36, rpio.LOW);
    //     rpio.write(38, rpio.LOW);
    //     rpio.write(22, rpio.HIGH);
    //     rpio.write(40, rpio.HIGH);
    //     break;
    //   case "5": // 0100
    //     rpio.write(36, rpio.LOW);
    //     rpio.write(38, rpio.HIGH);
    //     rpio.write(22, rpio.LOW);
    //     rpio.write(40, rpio.LOW);
    //     break;
    //   case "6": // 0101
    //     rpio.write(36, rpio.LOW);
    //     rpio.write(38, rpio.HIGH);
    //     rpio.write(22, rpio.LOW);
    //     rpio.write(40, rpio.HIGH);
    //     break;
    //   case "7": // 0110
    //     rpio.write(36, rpio.LOW);
    //     rpio.write(38, rpio.HIGH);
    //     rpio.write(22, rpio.HIGH);
    //     rpio.write(40, rpio.LOW);
    //     break;
    //   case "8": // 0111
    //     rpio.write(36, rpio.LOW);
    //     rpio.write(38, rpio.HIGH);
    //     rpio.write(22, rpio.HIGH);
    //     rpio.write(40, rpio.HIGH);
    //     break;
    //   case "9": // 1000
    //     rpio.write(36, rpio.HIGH);
    //     rpio.write(38, rpio.LOW);
    //     rpio.write(22, rpio.LOW);
    //     rpio.write(40, rpio.LOW);
    //     break;
    //   case "10": // 1001
    //     rpio.write(36, rpio.HIGH);
    //     rpio.write(38, rpio.LOW);
    //     rpio.write(22, rpio.LOW);
    //     rpio.write(40, rpio.HIGH);
    //     break;
    //   case "11": // 1010
    //     rpio.write(36, rpio.HIGH);
    //     rpio.write(38, rpio.LOW);
    //     rpio.write(22, rpio.HIGH);
    //     rpio.write(40, rpio.LOW);
    //     break;
    //   case "12": // 1011
    //     rpio.write(36, rpio.HIGH);
    //     rpio.write(38, rpio.LOW);
    //     rpio.write(22, rpio.HIGH);
    //     rpio.write(40, rpio.HIGH);
    //     break;
    //   case "13": // 1100
    //     rpio.write(36, rpio.HIGH);
    //     rpio.write(38, rpio.HIGH);
    //     rpio.write(22, rpio.LOW);
    //     rpio.write(40, rpio.LOW);
    //     break;
    //   case "14": // 1101
    //     rpio.write(36, rpio.HIGH);
    //     rpio.write(38, rpio.HIGH);
    //     rpio.write(22, rpio.LOW);
    //     rpio.write(40, rpio.HIGH);
    //     break;
    //   case "15": // 1110
    //     rpio.write(36, rpio.HIGH);
    //     rpio.write(38, rpio.HIGH);
    //     rpio.write(22, rpio.HIGH);
    //     rpio.write(40, rpio.LOW);
    //     break;
    //   case "16": // 1111
    //     rpio.write(36, rpio.HIGH);
    //     rpio.write(38, rpio.HIGH);
    //     rpio.write(22, rpio.HIGH);
    //     rpio.write(40, rpio.HIGH);
    //     break;
    switch (type) {
      // 36 38 40 22
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
      //   case "P": // P模式
      //     rpio.write(36, rpio.HIGH);
      //     rpio.write(38, rpio.HIGH);
      //     rpio.write(22, rpio.LOW);
      //     rpio.write(40, rpio.LOW);
      //     logger.info("p");
      //     break;
      //   case "AV": // Av 模式
      //     rpio.write(36, rpio.LOW);
      //     rpio.write(38, rpio.HIGH);
      //     rpio.write(22, rpio.LOW);
      //     rpio.write(40, rpio.HIGH);
      //     logger.info("AV");
      //     break;
      //   case "TV": // Tv 模式
      //     rpio.write(36, rpio.HIGH);
      //     rpio.write(38, rpio.HIGH);
      //     rpio.write(22, rpio.LOW);
      //     rpio.write(40, rpio.HIGH);
      //     logger.info("TV");
      //     break;
      //   case "AUTO": // 自动模式
      //     rpio.write(36, rpio.HIGH);
      //     rpio.write(38, rpio.HIGH);
      //     rpio.write(22, rpio.HIGH);
      //     rpio.write(40, rpio.LOW);
      //     logger.info("AUTO");
      //     break;
      //   case "MIX": // 混合模式
      //     rpio.write(36, rpio.LOW);
      //     rpio.write(38, rpio.HIGH);
      //     rpio.write(22, rpio.LOW);
      //     rpio.write(40, rpio.LOW);
      //     logger.info("MIX");
      //     break;
      //   case "VIDEO": // 摄像模式
      //     rpio.write(36, rpio.HIGH);
      //     rpio.write(38, rpio.LOW);
      //     rpio.write(22, rpio.HIGH);
      //     rpio.write(40, rpio.HIGH);
      //     logger.info("VIDEO");
      //     break;
    }
  }
  // 开始设置模式选择
  initModel(type) {
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
  }
  // 读取文件
  readFileJson(fileName) {
    let fileData = fs.readFileSync(fileName);
    // 将这个数据json化
    let jsonData = JSON.parse(fileData);
    return jsonData;
  }
  // 写入文件
  writeFileJson(fileName, json) {
    let data = JSON.stringify(json);
    fs.writeFileSync(fileName, data);
  }
  // 往数据库里面读写文件设置

  // 如果是定时任务 那么就需要处理这个
  setTimeIntervalByType(type, file, json, str, time) {
    const { ctx } = this;
    if (type === "photo") {
      json["isSetTime"] = 1; // 设置为定时拍照
      ctx.service.home.writeFileJson(file, json);
      // 这个时候需要判断时间
      // 如果之前你已经设定过了这个定时器 那么就需要把这个定时器干掉 防止会吃爆内存
      if (timePhotoHandle) {
        clearInterval(timePhotoHandle);
      }
      // rpio.open(str, rpio.OUTPUT, rpio.LOW); // 先初始化为低电平
      timePhotoHandle = setInterval(async () => {
        // 开始设置定时器的时间来设定
        // 开始设置100毫秒为低电平
        console.log("这个是定时拍照的程序 我这边先模拟在拍照即可");
        rpio.write(str, rpio.HIGH);
        // 设置为100ms
        rpio.msleep(100);
        rpio.write(str, rpio.LOW);
        db.count({}, function (err, count) {
          // count equals to 4
          db.insert({
            time: {},
            index: count + 1,
          });
        });
      }, time);
    } else {
      // noPhoto
      json["isSetTime"] = 0; // 设置为定时拍照
      ctx.service.home.writeFileJson(file, json);
      // 表示为取消定时拍照
      if (timePhotoHandle) {
        clearInterval(timePhotoHandle);
      }
    }
  }
}

module.exports = HomeService;
