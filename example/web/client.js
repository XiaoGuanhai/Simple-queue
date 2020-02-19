'use strict';
const io = require('socket.io-client');
const config = require('./../../lib/config').load('./example/web/.env');
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
// 接收到socket服务器 progress[任务进度] 类型事件
socket.on('progress', function(data) {
    /**
     * data字段说明
     * data[id] 客户端ID
     * data[title] 队列标题
     * data[data] Web服务端使用setData设置的data
     * data[error] 队列错误信息
     * data[job][type] 队列类型
     * data[job][id] 队列id
     * data[job][options] 队列参数
     * data[progress] 队列进度条（最小值：0， 最大值：100）
     */
    console.log("进度条", data);
});
// 接收到socket服务器 complete[任务完成] 类型事件
socket.on('complete', function(data) {
    /**
     * data字段说明
     * @see socket.on('progress', function(data) {.....} 的data说明
     */
    console.log("完成", data);

});
// 接收到socket服务器 failed[任务失败] 类型事件
socket.on('failed', function(data) {
    /**
     * data字段说明
     * @see socket.on('progress', function(data) {.....} 的data说明
     */
    console.log("失败", data);
});