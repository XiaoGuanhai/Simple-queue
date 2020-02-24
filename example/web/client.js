'use strict';
const client = require('../../lib')('./example/web/.env');
client.socket.connection(
    function(token, socket) {
        console.log(`client [token=${token}, socket:${socket.id}]`, `connect`, 'ok')
    }
).disconnect(function(token, socket, reason){
    // reason = INVALID_AUTHORIZATION 表示连接不合法
    // reason = INVALID_TOKEN 表示TOKEN不合法
    console.log(`client [token=${token}] disconnect because [reason=${reason}].`);
}).progress(function(token, socket, data) {
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
}).complete(function(token, socket, data) {
    /**
     * data字段说明
     * @see socket.on('progress', function(data) {.....} 的data说明
     */
    console.log("完成", data);
}).failed(function(token, socket, data) {
    /**
     * data字段说明
     * @see socket.on('progress', function(data) {.....} 的data说明
     */
    console.log("失败", data);
});
// 启动Socket客户端
client.socket.client(1);