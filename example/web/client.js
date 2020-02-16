'use strict';
const io = require('socket.io-client');
const config = require('./../../node/config.js');
const socket = io(config.config.socket.server + ':' + config.config.socket.port + '?id=1', {
    forceNew: false,
    transports: ['websocket', 'polling'] // 优先ws,失败采用poll模式
});
// 接收到socket服务器连接成功事件
socket.on('connect', function(data) {
    console.log(data);
    console.log('connect', 'ok');
});
// 接收到socket服务器断开事件
socket.on('disconnect', function() {
    console.log('disconnect', 'ok');
});
// 接收到socket服务器 JOB_PROGRESS[任务进度] 类型事件
socket.on('progress', function(data) {
    console.log("进度条", data);
});
// 接收到socket服务器 JOB_COMPLETE[任务完成] 类型事件
socket.on('complete', function(data) {
    console.log("完成", data);

});
// 接收到socket服务器 JOB_FAILED[任务失败] 类型事件
socket.on('failed', function(data) {
    console.log("失败", data);
});