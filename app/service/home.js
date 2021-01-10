const Service = require("egg").Service;
const rpio = require("rpio");
const fs = require("fs");
var timePhotoHandle = null;
class HomeService extends Service {
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
    let fileData = fs.readFileSync(fileName)
    // 将这个数据json化
    let jsonData = JSON.parse(fileData)
    return jsonData
  }
  // 写入文件
  writeFileJson(fileName, json) {
    let data = JSON.stringify(json);
    fs.writeFileSync(fileName, data);
  }
  // 如果是定时任务 那么就需要处理这个
  setTimeIntervalByType(type, file, json, str, time) {
    const { ctx } = this
    if (type === "photo") {
      json['isSetTime'] = 1 // 设置为定时拍照
      ctx.service.home.writeFileJson(file, json)
      // 这个时候需要判断时间
      // 如果之前你已经设定过了这个定时器 那么就需要把这个定时器干掉 防止会吃爆内存
      if (timePhotoHandle) {
        clearInterval(timePhotoHandle);
      }
      // rpio.open(str, rpio.OUTPUT, rpio.LOW); // 先初始化为低电平
      timePhotoHandle = setInterval(async () => {
        // 开始设置定时器的时间来设定
        // 开始设置100毫秒为低电平
        console.log('这个是定时拍照的程序 我这边先模拟在拍照即可')
        rpio.write(str, rpio.HIGH);
        // 设置为100ms
        rpio.msleep(100);
        rpio.write(str, rpio.LOW);
      }, time);

    } else {
      // noPhoto
      json['isSetTime'] = 0 // 设置为定时拍照
      ctx.service.home.writeFileJson(file, json)
      // 表示为取消定时拍照
      if (timePhotoHandle) {
        clearInterval(timePhotoHandle);
      }
    }
  }
}

module.exports = HomeService;
