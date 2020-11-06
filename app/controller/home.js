'use strict';

const Controller = require('egg').Controller;
const SerialPort = require('serialport');
const child = require('child_process');
const os = require('os');
const fs = require('fs');
const FILE_URL = 'your file url';
const NETWORK = os.networkInterfaces();

let globalSerialPort = null;
let globalHasOpenPort = null;
var timePhotoHandle = null;
var hasMakeDir = false; // 默认是否建立文件夹了
// 关于命令的数据
const commandCodeObj = {
  on: 'AA7511020000CC', // 开机命令
  off: 'AA7522020000FF', // 关机命令
  photo: 'AA7533020000EE', // 手动拍照
  menuOn: 'AA7577020000AA', // 菜单打开
  menuOff: 'AA758802000055', // 菜单关闭
  menuUp: 'AA759902000044', // 菜单上翻
  menuDown: 'AA75AA02000077', // 菜单下翻
  menuLeft: 'AA75BB02000066', // 菜单左翻
  menuRight: 'AA75CC02000011', // 菜单右翻
  menuOk: 'AA75DD02000000', // 菜单确定
  focusSub: 'AA753E020000E3', // 变焦-
  focusAdd: 'AA754E02000093', // 变焦+
  downloadStart: 'AA751E020100C2', // 数据下载开始
  downloadEnd: 'AA751E020000C3', // 数据下载结束
  audioStart: 'AA755E02010082', // 录像开始
  audioEnd: 'AA755E02000083', // 录像结束
  autoModel: 'AA755502010089', // auto自动模式
  avModel: 'AA75550202008A', // av模式
  hdrModel: 'AA75550203008B', // HDR 模式
  personImageModel: 'AA75550204008C', // 人像
  c1Model: 'AA75550205008D',
  mModel: 'AA75550206008E',
  tvModel: 'AA75550207008F',
  audioModel: 'AA755502080080',
  c2Model: 'AA755502090081',
  pModel: 'AA7555020a0082',
  mixinModel: 'AA7555020b0083',
};

class HomeController extends Controller {
  async index() {
    const { ctx } = this;
    await ctx.render('index.html');
  }
  // 获取本地IP地址
  async getCurrentIP() {
    const { ctx, logger } = this;
    let currentItem = null;
    Object.keys(NETWORK).forEach(v => {
      for (let i = 0; i < NETWORK[v].length; i++) {
        const item = NETWORK[v][i];
        if (
          !item.internal &&
          item.family.toLocaleLowerCase() === 'ipv4'
        ) {
          // CURRENT_IP = item.address;
          // console.log('currentItem', item);
          currentItem = item;
        }
      }
    });
    // 获取这个current_ip 的数据
    logger.info('currentItem', currentItem);
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
    logger.info('getSerialPortList', ports);
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
    logger.info('body', body);
    const portName = body.portName;
    logger.info('portName', portName);
    // 设置属性
    const serialPort = new SerialPort(
      portName,
      {
        baudRate: 9600,
        dataBits: 8,
        parity: 'none',
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
        serialPort.on('data', function (data) {
          logger.info('on data', data.toString('hex'));
        });
      }
      // function(error) {
      //   if (error) {
      //     globalHasOpenPort = false;
      //   } else {
      //     globalHasOpenPort = true;
      //     globalSerialPort = serialPort;
      //     // 开始接受数据
      //     serialPort.on('data', function(data) {
      //       logger.info('on data', data);
      //     });
      //   }
      // }
      console.log('result', result);
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
    if (body.type === 'mount') {
      child.exec('cd /run/user', function (err, sto) {
        logger.info('获取文件夹');
        logger.info(err, sto);
        logger.info('挂载成功');
        child.exec('ls', function (err2, sto2) {
          logger.info('err2', err2, sto2);
        });
      });
    } else {
      child.exec('umount /mnt/udisk', function (err, sto) {
        logger.info(err, sto);
        logger.info('卸载成功');
      });
    }
  }
  // 设置发送数据
  async writePort() {
    const { ctx, logger } = this;
    const body = ctx.request.body;
    const type = body.send;
    logger.info('type', type);
    
    const str = commandCodeObj[type + ''];
    logger.info('str', str);
    // 如果是2进制 那么数据又会是什么样子呢?
    logger.info('hex data', str.toString('hex'))
    const result = await globalSerialPort.write(str, 'hex');

    if(type !== 'downloadStart' && type !=='downloadEnd') {
      ctx.body = {
        status: 1
      };
      ctx.status = 200;
    }
    // 如果是downloadStart 表示当前的数据是下载 那么我们需要
    // 第一步 是将当前的存储卡挂载到当前的数据里面
    // 第二步骤就是监听当前是否含有存储卡的数据
    // 第三步 如果不在 那么就不需要重新挂载
    if(type === 'downloadStart') {
      // 表示为开始下载
      // 需要延迟几秒钟然后再给这个数据来挂载 因为有一些延迟
      // 延迟1秒钟
      setTimeout(() => {
        // 开始监听事件了 开始挂载了
        // 新建这个目录 这个目录每次重启后都会消除掉 所以需要判断是否为重启
        // 
        child.exec(`sudo ls /dev/sd*`, function(err, sto) {
          logger.info('ls /dev/sd*', err, sto);
          logger.info('开始执行了ls的命令')
        })
        child.exec(`sudo mount -o rw /dev/sda1 /mnt/USB_FLASH/raspberry_document`, function (err, sto) {
          logger.info(err, sto);
          logger.info('已经过了4秒开始执行的挂载成功');
        });
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
        status: 1
      };
      ctx.status = 200;
    }

    if(type === 'downloadEnd') {
      // 卸载这个分区的dev 即可
      child.exec(`sudo umount /dev/sda1`, function(err, sto) {
        let message = 'umount成功'
      })
      // child.exec('sudo ls /dev/sd*', function(err, sto) {
      //   logger.info('err', err, 'sto', sto)
      //   child.exec(`sudo umount ${sto}`, function(err, sto) {
      //     let message = 'umount成功'
      //   })
      // })
      

      ctx.body = {
          status: 2,
          message: message
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
    
    let str = ''
    // 如果是定时拍照那么就要显示这个
    if(type === 'photo') {
       str = commandCodeObj['photo' + ''];
       // 这个时候需要判断时间
       // 如果之前你已经设定过了这个定时器 那么就需要把这个定时器干掉 防止会吃爆内存
       if(timePhotoHandle) {
         clearInterval(timePhotoHandle)
       }
       timePhotoHandle = setInterval(async () => {
        const result = await globalSerialPort.write(str, 'hex');
      }, timeOut)
       
      ctx.body = {
        status: 1,
      };
      ctx.status = 200;
    }else { // noPhoto
      // 表示为取消定时拍照
      if(timePhotoHandle) {
        clearInterval(timePhotoHandle)
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
    logger.info('body', body);
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
}

module.exports = HomeController;