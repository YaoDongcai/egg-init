'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;
  // 设置树莓派的页面
  router.get('/', controller.home.index);
  // 获取当前的LED灯的状态
  router.get('/respberry/P36Status', controller.home.status);
  router.get('/respberry/getIP', controller.home.getCurrentIP);
  // 获取当前的串口接口列表
  router.get('/respberry/serialPortList', controller.home.getSerialPortList);
  // 发送数据到串口
  router.post('/respberry/writePort', controller.home.writePort);
  // 挂载数据
  router.post('/respberry/writeMount', controller.home.writeMount);
  // 打开串口
  router.post('/respberry/openPortByName', controller.home.openPortByName);
  // 定时拍照打开或者关闭
  router.post('/respberry/writePortIsIntertime', controller.home.writePortIsIntertime)
};
