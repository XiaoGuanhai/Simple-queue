'use strict';
const app = require('express')(); // http server
const redis = require('redis'); // redis
const server = require('http').Server(app); // system server
const io = require('socket.io')(server, { // socket.io
    cookie: false,
    transports: ['websocket','polling']
});
/** 创建一个redis连接 */
const redisClient = redis.createClient(config.config.socket.db.redis);
/**日志文件路径 */
const logger = config.logger('socket');
const isValid = function (data){
    return (
        typeof(data) == 'object' &&
        typeof(data.id) != 'undefined'
    );
}
const run = function(self){
    console.log(self);
    const config = self.config;
    let client;
    io.on('connection',function(socket){
        client = socket;
        let handshake = socket.handshake;
        let id = false;
        if (typeof handshake.query.id !== 'undefined') {
            id = handshake.query.id;
            logger.trace(`set online [${socket.id}] in redis.`);
            // 标记用户到在线列表
            redisClient.set(handshake.query.id, socket.id);
            if (handshake.query.id !== config.config.queue.id) {
                // TODO: 标记在线用户
            }
        }
        // 加入到对应组织房间
        // socket.join(handshake.query.room, function(){
        //     logger.trace(`set "${redisKey}" join ${room} ok.`);
        // });
        socket.on('job progress', function(data){
            console.log(data);
            if (!isValid(data)) {
                logger.warn(`invalid data for [job progress] from socket "${socket.id}"`);
                return false;
            }
            // 判断任务是否要通过socket回报状态
            redisClient.get(data.id, function(err, reply){
                // redis 出错
                if(err){
                    logger.error(`get "${data.id}" from redis error:${err.toString()}`);
                    return false;
                }
                // 没找到在线用户
                if(!reply){
                    logger.warn(`can't find on line user "${data.id}"`);
                    return false;
                }
                // 找到了,发送进度给对应在线用户
                logger.trace(`found ["${data.id}":"${reply}"]`);
                socket.to(reply).emit('progress', data);
            });
        });
        // 监听接收队列连接中 job complete 事件
        socket.on('job complete',function(data){
            // 判断数据完整性
            // 通知队列任务进度
            if (!isValid(data)) {
                logger.warn(`invalid data to [job complete] from socket "${socket.id}"`);
                return false;
            }
            redisClient.get(data.id, function(err, reply){
                // redis 出错
                if(err){
                    logger.error(`get "${data.id}" from redis error:${err.toString()}`);
                    return false;
                }
                // 没找到在线用户
                if(!reply){
                    logger.warn(`can't find on line user "${data.id}"`);
                    return false;
                }
                // 找到了,发送进度给对应在线用户
                logger.trace(`found ["${data.id}":"${reply}"]`);
                socket.to(reply).emit('complete', data);
            });
        });
        // 监听接收队列连接中 job failed 事件
        socket.on('job failed',function(data){
            // 判断数据完整性
            if(!isValid(data)) {
                logger.warn(`invalid data to [job failed] from socket "${socket.id}"`);
                return false;
            }
            redisClient.get(data.id, function(err,reply) {
                // redis 出错
                if(err){
                    logger.error(`get "${data.id}" from redis error:${err.toString()}`);
                    return false;
                }
                // 没找到在线用户
                if(!reply){
                    logger.warn(`can't find on line user "${data.id}"`);
                    return false;
                }
                // 找到了,发送进度给对应在线用户
                logger.trace(`found ["${data.id}":"${reply}"]`);
                socket.to(reply).emit('failed', data);
            });
        });
        // 断开连接
        socket.on('disconnect', function(){
            if (id !== false) {
                redisClient.del(id);
            }
            logger.trace(`disconnect ${socket.id}`);
        });
    });
    server.listen(config.config.socket.port);
    return client;
}
module.exports = {
    initialization: function(config){
        this.config = config;
    },
    config: {},
    run: function(){
        run(this);
    },
    progress: function(){},
    complete: function(){},
    disconnect: function(){},
    failed: function(){},
};