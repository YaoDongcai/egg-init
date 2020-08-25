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
    // const result = await globalSerialPort.write(str + '', 'hex');
    // const result = await globalSerialPort.write(str + '');
    console.log('result', result);
    ctx.body = {
      status: 1,
    };
    ctx.status = 200;
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
