/**
 * Queue simple framework
 * @copyright 2020 Siu <xiaoguanhai@gmail.com>
 * @since 2020.02.24
 * @license Apache 2.0
 */
'use strict';
/**
 * Module exports.
 */
module.exports = Socket;

/**
 * Socket constructor.
 *
 * @param {Socket} server instance
 * @param {Socket} conn
 * @api private
 */
function Socket(config){
    if (!(this instanceof Socket)) return new Socket(config);
    this.config = config.config;
    this.logger = config.logger('socket');
    this.clients = [];
    /**
     * 处理中回调
     * @param {string} token
     * @param {Server} socket
     * @param {{}} data
     */
    this.onProgress = function(token, socket, data){}
    /**
     * 处理中回调
     * @param {string} token
     * @param {socket.id} socket
     * @param {{}} data
     */
    this.onComplete = function(token, socket, data){};
    /**
     * 断开回调
     * @param {string} token
     * @param {socket.io} socket
     * @param {string} reason
     */
    this.onDisconnect = function(token, socket, reason){};
    /**
     * 失败回调
     * @param {string} token
     * @param {socket.io} socket
     * @param {{}} data
     */
    this.onFailed = function(token, socket, data){};
    /**
     * 连接成功之后的回调
     * @param {string} id
     * @param {socket.io} socket
     */
    this.onConnection = function(id, socket){}
}

/**
 * 判断DATA是否有效
 * @param data
 * @returns {boolean|boolean}
 */
Socket.prototype.isValid = function (data){
    return (
        typeof(data) == 'object' &&
        typeof(data.id) != 'undefined'
    );
};

/**
 * 成功连接之后回调
 * @param {function} callback
 * @returns {Socket}
 */
Socket.prototype.connection = function(callback){
    if (typeof callback === 'function') {
        this.onConnection = callback;
    };
    return this;
};

/**
 * 断开连接之后回调
 * @param {function} callback
 * @returns {Socket}
 */
Socket.prototype.disconnect = function(callback){
    if (typeof callback === 'function') {
        this.onDisconnect = callback;
    }
    return this;
};

/**
 * 任务处理中回调
 * @param {function} callback
 * @returns {Socket}
 */
Socket.prototype.progress = function(callback){
    if (typeof callback === 'function') {
        this.onProgress = callback;
    }
    return this;
};

/**
 * 任务完成之后回调
 * @param {function} callback
 * @returns {Socket}
 */
Socket.prototype.complete = function(callback){
    if (typeof callback === 'function') {
        this.onComplete = callback;
    }
    return this;
}

/**
 * 任务失败之后回调
 * @param {function} callback
 * @returns {Socket}
 */
Socket.prototype.failed = function(callback){
    if (typeof callback === 'function') {
        this.onFailed = callback;
    }
    return this;
};

/**
 * 客户端
 * @param {string} token
 * @returns {client}
 */
Socket.prototype.client = function(token){
    const io = require('socket.io-client');
    const self = this;
    const socket = io(self.config.socket.server + ':' + self.config.socket.port + '?token=' + token, {
        transportOptions: {
            polling: {
                extraHeaders: {
                    'authorization': process.env.SOCKET_SERVER_AUTHORIZATION //标记客户端
                }
            },
            websocket: {
                extraHeaders: {
                    'authorization': process.env.SOCKET_SERVER_AUTHORIZATION //标记客户端
                }
            }
        },
        forceNew: false,
        transports: ['websocket', 'polling'] // 优先ws,失败采用poll模式
    });
    /** 监听连接事件 **/
    socket.on('connect', function() {
        if (typeof self.onConnection === 'function') {
            self.onConnection(token, socket);
        }
    });
    /** 监听验证事件 **/
    socket.on('authorization', function (code) {
        if (typeof self.onDisconnect === 'function') {
            self.onDisconnect(token, socket, code);
        }
    });
    /** 监听断开事件 **/
    socket.on('disconnect', function(reason) {
        if (typeof self.onDisconnect === 'function') {
            self.onDisconnect(token, socket, reason);
        }
    });
    /** 监听关闭事件 **/
    socket.on('close', function(reason) {
        if (typeof self.onDisconnect === 'function') {
            self.onDisconnect(token, socket, reason);
        }
    });
    /** 监听处理中事件 **/
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
        if (typeof self.onProgress === 'function') {
            self.onProgress(token, socket, data);
        }
    });
    /** 监听已完成事件 **/
    socket.on('complete', function(data) {
        /**
         * data字段说明
         * @see socket.on('progress', function(data) {.....} 的data说明
         */
        if (typeof self.onComplete === 'function') {
            self.onComplete(token, socket, data);
        }
    });
    /** 监听失败事件 **/
    socket.on('failed', function(data) {
        /**
         * data字段说明
         * @see socket.on('progress', function(data) {.....} 的data说明
         */
        if (typeof self.onFailed === 'function') {
            self.onFailed(token, socket, data);
        }
    });
};

/**
 * 启动服务
 * @param {function} callback
 * @returns {Socket}
 */
Socket.prototype.start = function(callback){
    const self = this;
    const app = require('express')(); // http server
    const httpServer = require('http').createServer(app); // system server
    /**
     *
     * @type {Server}
     */
    const io = require('socket.io')(httpServer, { // socket.io
        cookie: false,
        transports: ['websocket','polling']
    });
    /** 配置参数 */
    const config = self.config;
    /**日志文件路径 */
    const logger = self.logger;
    //连接socket
    io.on('connection',function(socket){
        if (typeof callback === 'undefined') {
            socket.disconnect(true);
            return false;
        }
        // Token
        let handshake = socket.handshake;
        let token = `client-${self.clients.length}`;
        if (typeof handshake.query.token !== 'undefined') {
            token = `${token}_${handshake.query.token}`;
            logger.trace(`set [socket=${socket.id} token=${token}] online.`);
        }
        // 验证合法性
        if (typeof(handshake.headers['authorization']) === 'undefined'
            || handshake.headers['authorization'] !== process.env.SOCKET_SERVER_AUTHORIZATION) {
            logger.trace(`authorization [authorization=${handshake.headers['authorization']} token=${token} socket=${socket.id}] is invalid`);
            socket.emit('authorization', 'INVALID_AUTHORIZATION');
            socket.disconnect(true);
            return false;
        }
        // 加入到对应组织房间
        if (typeof(handshake.headers['token']) !== 'undefined'
            && handshake.headers['token'] === process.env.APP_SECRET) {
            socket.join(process.env.APP_SECRET, function(){
                logger.trace(`set [token=${token} id=${socket.id}] join room (${process.env.APP_SECRET}) ok.`);
            });
        }
        // 标记用户到在线列表
        self.clients[token] = socket.id;
        // 回调
        callback(token, function(isVerified){
            if (isVerified !== true) {
                // 未验证的用户直接关闭连接
                logger.trace(`token [token=${token} socket=${socket.id}] is invalid`);
                socket.emit('authorization', 'INVALID_TOKEN');
                socket.disconnect(true);
                return false;
            }
            self.done(token, socket)
        });
        // 处理中回调
        if (typeof self.onConnection === 'function') {
            self.onConnection(token, socket);
        }
    });
    // 监听端口
    httpServer.listen(config.socket.port);
    return self;
};

/**
 *
 * @param {string} event complate|faild|presses
 * @param {{}} data
 * @param socket
 */
Socket.prototype.reply = function(event, data, socket) {
    const self = this;
    const logger = this.logger;
    // 找到了,发送进度给对应在线用户
    if (typeof self.clients[data.id] !== 'undefined') {
        const reply = self.clients[data.id];
        logger.trace(`found ["${data.id}":"${reply}"]`);
        socket.to(reply).emit(event, data);
    }
    // 发送到内部房间
    socket.to(process.env.APP_SECRET).emit(event, data);
};
/**
 * 验证通过
 * @param {string} token
 * @param socket
 */
Socket.prototype.done = function(token, socket) {
    const self = this;
    const logger = this.logger;
    socket.on('job progress', function(data){
        // 判断任务是否要通过socket回报状态
        if (!self.isValid(data)) {
            logger.warn(`invalid data for [job progress] from socket "${socket.id}"`);
            return false;
        }
        self.reply('progress', data, socket);
        // 处理中回调
        if (typeof self.onProgress === 'function') {
            self.onProgress(token, socket, data);
        }
    });
    // 监听接收队列连接中 job complete 事件
    socket.on('job complete',function(data){
        // 判断数据完整性
        if (!self.isValid(data)) {
            logger.warn(`invalid data to [job complete] from socket "${socket.id}"`);
            return false;
        }
        self.reply('complete', data, socket);
        // 完成回调
        if (typeof self.onComplete === 'function') {
            self.onComplete(token, socket, data);
        }
    });
    // 监听接收队列连接中 job failed 事件
    socket.on('job failed',function(data){
        // 判断数据完整性
        if(!self.isValid(data)) {
            logger.warn(`invalid data to [job failed] from socket "${socket.id}"`);
            return false;
        }
        self.reply('failed', data, socket);
        // 失败回调
        if (typeof self.onFailed === 'function') {
            self.onFailed(token, socket, data);
        }
    });
    // 绑定断开事件
    socket.on('disconnect', function(reason){
        logger.trace(`disconnect {token: ${token}, id: ${socket.id}} by {reason: ${reason}}`);
        // 断开回调
        if (typeof self.onDisconnect === 'function') {
            self.onDisconnect(token, socket, reason);
        }
    });
};