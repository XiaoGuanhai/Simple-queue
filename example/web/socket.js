'use strict';
const client = require('../../lib')('./example/web/.env');
const socket = client.socket;
// connection 事件
socket.connection(
    /**
     * 连接之后回调
     * @param {string} token 客户端Token
     * @param {Socket} socket Socket实例
     */
    function(token, socket) {
        console.log('socket connection', token);
    }
) ;
// progress 事件
socket.progress(
    /**
     * 处理中回调
     * @param {string} token 客户端Token
     * @param {Socket} socket Socket实例
     * @param {Object} data
     */
    function(token, socket, data) {
    console.log('socket progress', `[socket:${socket.id} token: ${token}]`, data);
});
// complete 事件
socket.complete(
    /**
     * 完成之后回调
     * @param {string} token 客户端Token
     * @param {Socket} socket Socket实例
     * @param {Object} data
     */
    function(token, socket, data) {
        console.log('socket complete', `[socket:${socket.id} token: ${token}]`, data);
    }
);
// failed 事件
socket.failed(
    /**
     * 失败之后回调
     * @param {string} token 客户端Token
     * @param {Socket} socket Socket实例
     * @param {Object} data
     */
    function(token, socket, data) {
    console.log('socket failed', `[socket:${socket.id} token: ${token}]`, data);
});
// disconnect 事件
socket.disconnect(
    /**
     * 断开之后回调
     * @param {string} token 客户端Token
     * @param {Socket} socket Socket实例
     * @param {string} reason 断开原因
     * 断开原因说明：
     * INVALID_AUTHORIZATION： 未认证的客户端。
     * INVALID_TOKEN： 客户端的Token无效
     */
    function(token, socket, reason) {
        console.log('socket disconnect', `[socket:${socket.id} token: ${token}]`);
    });
// 启动服务
socket.start(function(token, done){
    done(true);/** Token有效 */
    // done(false);/** Token无效 */
});