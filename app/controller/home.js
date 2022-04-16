"use strict";
const Gpio = require("pigpio").Gpio;
const Controller = require("egg").Controller;
const SerialPort = require("serialport");
const child = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");
const FILE_URL = "your file url";
const NETWORK = os.networkInterfaces();
const rpio = require("rpio"); // 控制GPIO的脚口子
let globalSerialPort = null;
let globalHasOpenPort = null;
var timePhotoHandle = null;
var hasMakeDir = false; // 默认是否建立文件夹了
// 关于命令的数据 这个命令是之前的串口发出的
// const commandCodeObj = {
//   on: 'AA7511020000CC', // 开机命令
//   off: 'AA7522020000FF', // 关机命令
//   photo: 'AA7533020000EE', // 手动拍照
//   menuOn: 'AA7577020000AA', // 菜单打开
//   menuOff: 'AA758802000055', // 菜单关闭
//   menuUp: 'AA759902000044', // 菜单上翻
//   menuDown: 'AA75AA02000077', // 菜单下翻
//   menuLeft: 'AA75BB02000066', // 菜单左翻
//   menuRight: 'AA75CC02000011', // 菜单右翻
//   menuOk: 'AA75DD02000000', // 菜单确定
//   focusSub: 'AA753E020000E3', // 变焦-
//   focusAdd: 'AA754E02000093', // 变焦+
//   downloadStart: 'AA751E020100C2', // 数据下载开始
//   downloadEnd: 'AA751E020000C3', // 数据下载结束
//   audioStart: 'AA755E02010082', // 录像开始
//   audioEnd: 'AA755E02000083', // 录像结束
//   autoModel: 'AA755502010089', // auto自动模式
//   avModel: 'AA75550202008A', // av模式
//   hdrModel: 'AA75550203008B', // HDR 模式
//   personImageModel: 'AA75550204008C', // 人像
//   c1Model: 'AA75550205008D',
//   mModel: 'AA75550206008E',
//   tvModel: 'AA75550207008F',
//   audioModel: 'AA755502080080',
//   c2Model: 'AA755502090081',
//   pModel: 'AA7555020a0082',
//   mixinModel: 'AA7555020b0083',
// };
const uatCommandCodeObj = {
  AA7511020000CC: "on", // 开机
  AA7522020000FF: "off", // 关机
  AA7533020000EE: "photo", // 手动拍照
  AA7577020000AA: "menuOn",
  AA758802000055: "menuOff",
  AA759902000044: "menuUp",
  AA75AA02000077: "menuDown",
  AA75BB02000066: "menuLeft",
  AA75CC02000011: "menuRight",
  AA75DD02000000: "menuOk",
  AA7555020a0082: "P",
  AA755502010089: "AUTO",
  AA75550202008A: "TV",
  AA75550207008F: "AV",
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
class HomeController extends Controller {
  async clearDB() {
    const { ctx } = this;
    const findAllResult = await ctx.service.home.clearDB();
    // 找到所有的数据
    // 这个时候开始返回给前台即可
    ctx.body = {
      status: 1,
      data: findAllResult,
    };
    ctx.status = 200;
  }
  async index() {
    const { ctx } = this;
    await ctx.render("index.html");
  }
  async exportData() {
    const { ctx, logger } = this;
    logger.info("exportData");
    const findAllResult = await ctx.service.home.selectAll();
    // 找到所有的数据
    // 这个时候开始返回给前台即可
    ctx.body = {
      status: 1,
      data: findAllResult,
    };
    ctx.status = 200;
  }
  async initGPIOController() {
    const { ctx, logger, app } = this;
    const body = ctx.request.body;
    // 默认打开串口来可以通信识别

    const dateYMD = body.dateYMD;
    const dateHMS = body.dateHMS;
    const versionType = body.versionType;
    // 增加一个全局的变量来设置这个
    // app.versionType =  // versionType;
    // 强制设置系统时间
    ctx.service.home.setDate(dateYMD, dateHMS);
    // 设置串口打开
    // 初始化时间范围内
    // 开始初始化以下需要用到的GPIO口
    // const GPIOList = [35, 37,7, 13, 31, 29, 11, 15, 32, 22, 12, 36, 38, 40]
    // // 初始化后直接赋予值
    // for(let i=0; i<GPIOList.length; ++i) {
    //   rpio.open(GPIOList[i], rpio.OUTPUT, rpio.LOW); // 先初始化为低电平
    //   logger.info('初始化GPIO引脚', GPIOList[i])
    //   rpio.write(GPIOList[i], 0);
    // }
    // 获取文件里面的json对象
    const dirname = ctx.app.baseDir;
    var file = path.join(dirname, "client.config.json");
    let jsonData = ctx.service.home.readFileJson(file);
    // 增加了几个判断条件 是否有2个是否为空 如果为空 给默认的值即可

    ctx.body = {
      status: 1,
      data: jsonData,
    };
    ctx.status = 200;
  }
  // 这个接口是为了永久输出电压的 为了保持电压的输出不变
  async GPIOControllerByGPIO() {
    const { ctx, logger } = this;
    const body = ctx.request.body;
    const type = body.send;
    let str = commandCodeObj[type + ""];
    // 对于SD卡切换或者USB通电 都需要保存永久的电压或者电平的
    // rpio.open(str, rpio.OUTPUT, rpio.LOW); // 先初始化为低电平
    // 永久为高电平
    if ((type + "").includes("On")) {
      // 表示这个是为开启状态 那么就是on
      rpio.write(str, 1);
      logger.info("包含为on 为高电平");
    } else {
      rpio.write(str, 0);
      logger.info("包含为off 为低电平");
    }

    ctx.body = {
      status: 1,
    };
    ctx.status = 200;
  }
  // 这个是下载结束后的卸载SD卡
  async downLoadEnd() {
    const { ctx, logger } = this;
    child.exec(`sudo umount /dev/sda1`, function (err, sto) {
      logger.info("卸载成功", err, sto);
      // 开始删除之前留下的文件夹
      child.exec("rm -rf /mnt/*", function (err2, sto2) {
        logger.info("删除文件夹成功", "err2", err2, "sto2", sto2);
      });
    });
    ctx.body = {
      status: 1,
    };
    ctx.status = 200;
  }
  // 这个是下载开始的导入数据
  async downLoadStart() {
    const { ctx, logger } = this;
    child.exec(`sudo ls /dev/sd*`, function (err, sto) {
      logger.info("开始执行了ls的命令 当前的sd卡 占用的口子为:");
      logger.info("ls /dev/sd*", err, sto);
    });
    // 创立个文件夹 具有读写权限
    child.exec("rm -rf /mnt/*", function (err2, sto2) {
      logger.info("删除文件夹成功", "err2", err2, "sto2", sto2);
      child.exec(
        "sudo mkdir -m 777 /mnt/raspberry_document",
        function (err, sto) {
          // 这个时候表示建立成功了
          logger.info("新建目录成功");
          child.exec(
            `sudo mount -o rw /dev/sda1 /mnt/raspberry_document`,
            function (err, sto) {
              logger.info("挂载sk卡到文件夹底下");
            }
          );
        }
      );
    });

    // 开始返回数据
    ctx.body = {
      status: 1,
    };
    ctx.status = 200;
  }

  async setFileByAutoFocus() {
    const { ctx, logger } = this;
    const body = ctx.request.body;
    const type = body.send;

    // ctx.service.home.initModel(type);
    const dirname = ctx.app.baseDir;
    // 开始写入这个模态
    var file = path.join(dirname, "client.config.json");
    let json = ctx.service.home.readFileJson(file);
    json["autoFocus"] = type;
    ctx.service.home.writeFileJson(file, json);
    ctx.body = {
      status: 1,
    };
    ctx.status = 200;
  }
  async GPIOControllerByModel() {
    const { ctx, logger } = this;
    const body = ctx.request.body;
    const type = body.send;
    // G5X的模型
    console.log("this.app", this.app.versionType);
    if (this.app.versionType == "1") {
      ctx.service.home.initModel(type);
    } else {
      ctx.service.home.initG5XModel(type);
    }
    // ctx.service.home.initModel(type);
    const dirname = ctx.app.baseDir;
    // 开始写入这个模态
    var file = path.join(dirname, "client.config.json");
    let json = ctx.service.home.readFileJson(file);
    json["workType"] = type;
    ctx.service.home.writeFileJson(file, json);
    ctx.body = {
      status: 1,
    };
    ctx.status = 200;
  }

  async GPIOControllerIntertime() {
    const { ctx, logger } = this;
    const body = ctx.request.body;
    const type = body.send;
    const timeOut = body.timeOut; // 定时拍照的时间
    const defineTime = body.defineTime;
    const unit = body.unit;

    // 定义全局定时拍照的时间句柄
    const dirname = ctx.app.baseDir;
    // 开始写入这个模态
    var file = path.join(dirname, "client.config.json");
    let json = ctx.service.home.readFileJson(file);
    if (type == "photo") {
      json["defineTime"] = defineTime;
      json["unit"] = unit;
    }
    let str = "";
    str = commandCodeObj[type + ""];
    // 如果是定时拍照那么就要显示这个
    ctx.service.home.setTimeIntervalByType(type, file, json, str, timeOut);
    ctx.body = {
      status: 1,
    };
    ctx.status = 200;
  }
  // 第二版的数据获取 GPIO 的控制
  async GPIOController() {
    // 获取前端那边的命令
    const { ctx, logger, app } = this;
    const body = ctx.request.body;
    const type = body.send;
    logger.info("type", type);

    let str = commandCodeObj[type + ""];
    if (type == "photo") {
      ctx.service.home.setGpioPhoto();
    } else if (type !== "downloadStart" && type !== "downloadEnd") {
      logger.info("str", str);
      // 先要打开这个口子
      logger.info("引脚 rpio.LOW", rpio.LOW, "引脚OUTPUT", rpio.OUTPUT);
      // rpio.open(str, rpio.OUTPUT, rpio.LOW); // 先初始化为低电平
      // rpio.open(str, 1, 0); // 先初始化为低电平
      // 开始设置100毫秒为低电平
      //rpio.write(str, rpio.HIGH);
      rpio.write(str, 1);
      logger.info("开启电压");
      // 设置为100ms 开启或者关闭
      if (type == "on" || type == "off") {
        // 开机是500ms
        rpio.msleep(500);
        // 如果是on 那么就再需要判断是否为开启变焦即可
        if (type == "on") {
          // 获取即可
          // 获取当前的文件配置信息
          // 同步写法
          const jsonData = ctx.service.home.getFileJsonByFileName(
            app.configFilePath
          );
          const autoFocus = jsonData["autoFocus"];

          if (autoFocus == 1) {
            setTimeout(() => {
              ctx.service.home.autoFocusOn();
            }, 3000);
          }
        }
      } else {
        rpio.msleep(150);
      }
      // rpio.write(str, rpio.LOW);
      rpio.write(str, 0);
      logger.info("关闭电压");
    } else {
      // 这个时候是下载开始
      // 先要挂载文件
      if (type === "downloadStart") {
        // 表示为开始下载
        // 需要延迟几秒钟然后再给这个数据来挂载 因为有一些延迟
        // 延迟1秒钟
        // 这个时候先sd卡切换 然后再usb 通电
        str = commandCodeObj["SDToggle"];
        // rpio.open(str, rpio.OUTPUT, rpio.LOW); // 先初始化为低电平
        logger.info("SD卡切换成功");
        // 开始设置100毫秒为低电平
        rpio.write(str, rpio.HIGH);
        // 打开断点程序
        // rpio.msleep(2000);

        setTimeout(() => {
          logger.info("USB 继电器响声开始");
          // rpio.open(commandCodeObj['SDOn'], rpio.OUTPUT, rpio.LOW); // 先初始化为低电平
          // rpio.msleep(2000);
          // 开始设置100毫秒为低电平
          rpio.write(str, rpio.HIGH);
          logger.info("USB 继电器响声结束");
          // 开始切换USB的电压
        }, 1000);

        setTimeout(() => {
          // 开始监听事件了 开始挂载了
          // 新建这个目录 这个目录每次重启后都会消除掉 所以需要判断是否为重启
          //
          // child.exec('rm -rf /mnt/USB_FLASH/*', function(err2, sto2) {
          //   logger.info('err2', err2, 'sto2', sto2)
          //   child.exec('sudo ls /dev/sd*', function(err, sto) {
          //     logger.info('err', err, 'sto', sto)
          //   })
          // })
          // child.exec('sudo mkdir -m 777 /run/user/USB_FLASH', function (err, sto) {
          //   // 这个时候表示建立成功了
          //   hasMakeDir = true;
          //   logger.info('新建目录成功');
          //   // 新建目录后 需要清空一下这个目录 然后再挂载
          // });
          // if(hasMakeDir) {
          //   // 表示这个是已经重启过了 那么就不需要mkdir 一个新的目录了
          //   child.exec('sudo ls /dev/sd*', function(err, sto) {
          //     logger.info('err', err, 'sto', sto)
          //     child.exec(`sudo mount -o rw /dev/sda1 /run/user/USB_FLASH/`, function (err, sto) {
          //       logger.info(err, sto);
          //       logger.info('挂载成功');
          //     });
          //   })
          // } else {
          // }
        }, 5000);
      }

      if (type === "downloadEnd") {
        str = commandCodeObj["SDToggle"];
        // rpio.open(str, rpio.OUTPUT, rpio.LOW); // 先初始化为低电平
        rpio.write(str, rpio.LOW);

        rpio.msleep(2000);
        // rpio.open(commandCodeObj['SDOn'], rpio.OUTPUT, rpio.LOW); // 先初始化为低电平
        // 开始设置100毫秒为低电平
        rpio.write(str, rpio.LOW);
        rpio.msleep(2000);
        // 先mount 这个sd卡
        child.exec(`sudo umount /dev/sda1`, function (err, sto) {
          logger.info("卸载成功", err, sto);
          // 开始删除之前留下的文件夹
          child.exec("rm -rf /mnt/*", function (err2, sto2) {
            logger.info("删除文件夹成功", "err2", err2, "sto2", sto2);
          });
        });
        // 开始切换USB的电压
      }
    }
    ctx.body = {
      status: 1,
    };
    ctx.status = 200;
  }
  // 获取本地IP地址
  async getCurrentIP() {
    const { ctx, logger } = this;
    let currentItem = null;
    Object.keys(NETWORK).forEach((v) => {
      for (let i = 0; i < NETWORK[v].length; i++) {
        const item = NETWORK[v][i];
        if (!item.internal && item.family.toLocaleLowerCase() === "ipv4") {
          // CURRENT_IP = item.address;
          // console.log('currentItem', item);
          currentItem = item;
        }
      }
    });
    // 获取这个current_ip 的数据
    logger.info("currentItem", currentItem);
    ctx.body = {
      list: currentItem,
      status: 1,
    };
    ctx.status = 200;
  }
  // 修改 本地IP地址
  async setCurrentIP() {}
  // 获取串口列表
  async getSerialPortList() {
    const { ctx, logger } = this;
    // 获取list 列表
    const ports = await SerialPort.list();
    logger.info("getSerialPortList", ports);
    ctx.body = {
      list: ports,
      status: 1,
    };
    ctx.status = 200;
    // ports.then(data => {
    // }, error => {
    //   ctx.body = {
    //     status: 0,
    //     message: error,
    //   };
    //   ctx.status = 400;
    // });
  }
  // 设置打开串口
  async openPortByName() {
    const { ctx, logger } = this;
    const body = ctx.request.body; // { port: port}
    logger.info("body", body);
    const portName = body.portName;
    logger.info("portName", portName);
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
      ctx.body = {
        status: 1,
      };
      ctx.status = 200;
    } else {
      const result = await serialPort.open();
      if (result) {
        // 表示为有错误了
        globalHasOpenPort = false;
      } else {
        globalHasOpenPort = true;
        globalSerialPort = serialPort;
        ctx.body = {
          status: 1,
        };
        ctx.status = 200;
        // 开始接受数据
        serialPort.on("data", function (data) {
          // 转换为16进制的数据
          let dataArray = data.toString("hex");
          // 开始判断当前的数据字节是否正确
          logger.info("dataArray", dataArray);
          const length = dataArray.length;
          logger.info("length", length);
          // 开始判断校验位是否正确
          for (let i = 0; i <= dataArray.length; ++i) {}
          logger.info("on data");
        });
      }
    }
    // 打开这个端口前 最好先close一下 这样就不会让它关闭了

    // serialPort.close(function(error) {
    //   // 先要关闭这个端口
    //   if (error) {
    //     logger.info('关闭端口失败', error);
    //   } else {
    //     logger.info('关闭端口成功');
    //   }
    // });
  }
  // 设置挂载命令
  async writeMount() {
    const { ctx, logger } = this;
    const body = ctx.request.body;
    if (body.type === "mount") {
      child.exec("cd /run/user", function (err, sto) {
        logger.info("获取文件夹");
        logger.info(err, sto);
        logger.info("挂载成功");
        child.exec("ls", function (err2, sto2) {
          logger.info("err2", err2, sto2);
        });
      });
    } else {
      child.exec("umount /mnt/udisk", function (err, sto) {
        logger.info(err, sto);
        logger.info("卸载成功");
      });
    }
  }
  // 设置发送数据
  async writePort() {
    const { ctx, logger } = this;
    const body = ctx.request.body;
    const type = body.send;
    logger.info("type", type);

    const str = commandCodeObj[type + ""];
    logger.info("str", str);
    // 如果是2进制 那么数据又会是什么样子呢?
    logger.info("hex data", str.toString("hex"));
    const result = await globalSerialPort.write(str, "hex");

    if (type !== "downloadStart" && type !== "downloadEnd") {
      ctx.body = {
        status: 1,
      };
      ctx.status = 200;
    }
    // 如果是downloadStart 表示当前的数据是下载 那么我们需要
    // 第一步 是将当前的存储卡挂载到当前的数据里面
    // 第二步骤就是监听当前是否含有存储卡的数据
    // 第三步 如果不在 那么就不需要重新挂载
    if (type === "downloadStart") {
      // 表示为开始下载
      // 需要延迟几秒钟然后再给这个数据来挂载 因为有一些延迟
      // 延迟1秒钟
      setTimeout(() => {
        // 开始监听事件了 开始挂载了
        // 新建这个目录 这个目录每次重启后都会消除掉 所以需要判断是否为重启
        //
        // child.exec(`sudo ls /dev/sd*`, function(err, sto) {
        //   logger.info('ls /dev/sd*', err, sto);
        //   logger.info('开始执行了ls的命令')
        // })
        // child.exec(`sudo mount -o rw /dev/sda1 /mnt/USB_FLASH/raspberry_document`, function (err, sto) {
        //   logger.info(err, sto);
        //   logger.info('已经过了4秒开始执行的挂载成功');
        // });
        // child.exec('rm -rf /mnt/USB_FLASH/*', function(err2, sto2) {
        //   logger.info('err2', err2, 'sto2', sto2)
        //   child.exec('sudo ls /dev/sd*', function(err, sto) {
        //     logger.info('err', err, 'sto', sto)
        //   })
        // })
        // child.exec('sudo mkdir -m 777 /run/user/USB_FLASH', function (err, sto) {
        //   // 这个时候表示建立成功了
        //   hasMakeDir = true;
        //   logger.info('新建目录成功');
        //   // 新建目录后 需要清空一下这个目录 然后再挂载
        // });
        // if(hasMakeDir) {
        //   // 表示这个是已经重启过了 那么就不需要mkdir 一个新的目录了
        //   child.exec('sudo ls /dev/sd*', function(err, sto) {
        //     logger.info('err', err, 'sto', sto)
        //     child.exec(`sudo mount -o rw /dev/sda1 /run/user/USB_FLASH/`, function (err, sto) {
        //       logger.info(err, sto);
        //       logger.info('挂载成功');
        //     });
        //   })
        // } else {
        // }
      }, 5000);

      ctx.body = {
        status: 1,
      };
      ctx.status = 200;
    }

    if (type === "downloadEnd") {
      // 卸载这个分区的dev 即可
      // child.exec(`sudo umount /dev/sda1`, function(err, sto) {
      //   let message = 'umount成功'
      // })
      // child.exec('sudo ls /dev/sd*', function(err, sto) {
      //   logger.info('err', err, 'sto', sto)
      //   child.exec(`sudo umount ${sto}`, function(err, sto) {
      //     let message = 'umount成功'
      //   })
      // })

      ctx.body = {
        status: 2,
        message: message,
      };
      ctx.status = 200;
    }
  }
  // 设置定时拍照或者关闭的数据
  async writePortIsIntertime() {
    const { ctx, logger } = this;
    const body = ctx.request.body;
    const type = body.send;
    const timeOut = body.timeOut; // 定时拍照的时间
    // 定义全局定时拍照的时间句柄

    let str = "";
    // 如果是定时拍照那么就要显示这个
    if (type === "photo") {
      str = commandCodeObj["photo" + ""];
      // 这个时候需要判断时间
      // 如果之前你已经设定过了这个定时器 那么就需要把这个定时器干掉 防止会吃爆内存
      if (timePhotoHandle) {
        clearInterval(timePhotoHandle);
      }
      timePhotoHandle = setInterval(async () => {
        const result = await globalSerialPort.write(str, "hex");
      }, timeOut);

      ctx.body = {
        status: 1,
      };
      ctx.status = 200;
    } else {
      // noPhoto
      // 表示为取消定时拍照
      if (timePhotoHandle) {
        clearInterval(timePhotoHandle);
        ctx.body = {
          status: 1,
        };
        ctx.status = 200;
      }
    }
  }
  // 获取LED灯的状态
  async setStatus() {
    const { ctx, logger } = this;
    const body = ctx.request.body;
    logger.info("body", body);
    // 设置LED灯的状态为body里面的status的值
    let status = 0;
    if (body.status === 1) {
      // 设置led为1
      status = 1;
    } else {
      // 设置为0
      status = 0;
    }
    ctx.body = {
      status,
    };
    ctx.status = 200;
  }
  //  获取LED的状态
  async status() {
    const { ctx } = this;
    ctx.body = {
      status: 1,
    };
    ctx.status = 200;
  }

  async setPWM() {
    const { ctx, logger } = this;
    const body = ctx.request.body;
    const count = body.count;
    const port = body.port;
    // 获取pwm的数据 然后outPut
    const pwm = new Gpio(port, Gpio.OUTPUT);
    // 设置占空比即可
    logger.info("count", count, "port", port);
    pwm.pwmWrite(count);
    ctx.body = {
      status: 1,
    };
    ctx.status = 200;
  }
}

module.exports = HomeController;
