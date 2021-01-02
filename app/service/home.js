const Service = require("egg").Service;
const rpio = require("rpio");
const fs = require("fs");
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
}

module.exports = HomeService;
