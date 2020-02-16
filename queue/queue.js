'use strict';
const app = require('express')();
const server = require('http').Server(app);
const config = require(`./config.js`);
const kue = require('kue');
const kueUiExpress = require('kue-ui-express');
const request = require('request');
const bodyParser = require('body-parser');
// 标记是否断开连接
let connectedSocket;
/**日志文件路径 */
const logger = config.logger('queue');
/** 将队列连接到Socket服务 */
const socket = require('socket.io-client')(config.config.socket.server + ':' + config.config.socket.port);
/**
 * 连接redis并创建任务队列
 * @return {object} kue.queue 对象
 * @see https://github.com/Automattic/kue#redis-connection-settings
 */
const queue = kue.createQueue({
    redis:config.config.queue.db.redis.url,
    prefix:config.config.queue.db.prefix
});
/**
 * 返回Job数据
 * @param job
 * @returns {{options: *, id: *, type: *}}
 */
const getJobData = function(job)
{
    return {
        id: job.id,
        type: job.type,
        options: job.options
    }
}
/** 连接Socket服务成功 */
socket.on('connect', function(){
    connectedSocket = true;
    logger.info(`connect socket server ok, socket id:${socket.id}`);
});
/** 断开Socket服务连接 */
socket.on('disconnect', function(){
    connectedSocket = false;
    logger.error('socket server is disconnect');
});
app.use(bodyParser.json({limit: '100mb'}));
app.use(bodyParser.urlencoded({limit: '100mb', extended: true}));
/** 队列控制台 */
kueUiExpress(app, '/job/', '/console'); // 绑定控制台路径
app.use('/console/', kue.app); // 开启界面监控
/**
 * 进度更新
 * @param {string} 'UPDATE_JOB_PROGRESS' 事件名
 * Callback param
 * data {Any} 事件中传递的数据或对象
 * data[id] {int|string} 任务ID
 * data[setup] {int} 正在处理
 * data[length] {int} 长度
 */
socket.on('progress', function(data){
    if (typeof data.progress === 'undefined') {
        logger.error(`undefined [progress] in data for progress socket.`);
        return false;
    }
    kue.Job.get(data.id, function(err, job){
        if(err){
            logger.error(`${err.toString()} on update queue progress`);
            return false;
        }
        job.progress(data.progress, 100);
    });
});
// 队列执行
queue.process('service', 10, function(job, done){
    logger.trace(`process job ["type":doService,"title":"${job.data.title}","id":"${job.id}"]`);
    /** 防止POST进来的超时设置不正确 */
    if(!job.data.timeout || typeof(job.data.timeout) !== 'number'){
        job.data.timeout = config.config.queue.defaultTimeout;
    }
    if (typeof(job.data.url) === 'undefined' || !job.data.url) {
        return false;
    }
    logger.trace( 'request url:',job.data.url);
    job.data.job = getJobData(job);
    request({
        url: job.data.url,
        timeout: job.data.timeout,
        method: "POST",
        json:true,
        headers: {
            "content-type": "application/json",
        },
        pool: {maxSockets: 800},
        agent: false,
        forever:true,
        form:job.data
    },function(error, response, body){
        if(error){
            logger.warn(`request url: ${config.config.queue.url} msg: ${error.toString()}`);
            done(error.toString());
            return false;
        }
        if(response.statusCode !== 200){
            done('request statusCode: ' + response.statusCode /*+' body: ' + response.body*/);
            return false;
        }
        if (!(body && typeof (body) == 'object')) {
            done('invalid json response=' + body);
            return false;
        }
        done(null, body);
    });
});
// 队列完成
queue.on('job complete', function(id, res){
    kue.Job.get(id, function(err, job) {
        if (err) return;
        /** 通知Socket服务器 */
        job.data.body = res;
        job.data.job = getJobData(job);
        // 队列完成之后回调
        if (job.data.complete.length > 0) {
            job.data.callable = 'complete';
            request({
                url: job.data.url,
                method: "POST",
                json:true,
                headers: {
                    "content-type": "application/json",
                },
                pool: {maxSockets: 800},
                agent: false,
                forever:true,
                form:job.data
            },function(error, response, body){
                if(error){
                    logger.warn(`job complete request url: ${config.config.queue.url} msg: ${error.toString()}`);
                    done(error.toString());
                    return false;
                }
                if(response.statusCode !== 200){
                    done('job complete request status code: ' + response.statusCode);
                    return false;
                }
                done(null, body);
            });
        }
        if (connectedSocket === true) {
            socket.emit('job complete', job.data);
        }
        /** 如果没有标记任务不允许成功删除,成功后清理掉任务 */
        if (parseInt(job.data.completeAlive) === 0) {
            job.remove(function(removeErr){
                if(removeErr){
                    logger.error(removeErr.toString());
                    return false;
                }
                logger.trace(`removed complete job ["type":"${job.type}",title":"${job.data.title}","id":${job.id}, "body": ${JSON.stringify(job.data.body)}]`);
            });
        }
    });
});
// 队列重试失败
queue.on('job failed attempt', function(id, errorMessage, doneAttempts){

});
// 队列失败
queue.on('job failed', function(id, err){
    logger.error(err.toString());
    kue.Job.get(id, function(err, job){
        /** 通知Socket服务器 */
        job.data.job = getJobData(job);
        // 队列执行失败之后回调
        if (job.data.failed.length > 0) {
            job.data.callable = 'failed';
            request({
                url: job.data.url,
                method: "POST",
                json:true,
                headers: {
                    "content-type": "application/json",
                },
                pool: {maxSockets: 800},
                agent: false,
                forever:true,
                form:job.data
            },function(error, response, body){
                if(error){
                    logger.warn(`job failed request url: ${config.config.queue.url} msg: ${error.toString()}`);
                    done(error.toString());
                    return false;
                }
                if(response.statusCode !== 200){
                    done('job failed request status code: ' + response.statusCode);
                    return false;
                }
                done(null, body);
            });
        }
        //
        if (connectedSocket === true) {
            socket.emit('job failed', job.data);
        }
        /** 如果没有标记任务不允许失败删除,失败后清理掉任务 */
        if (parseInt(job.data.failedAlive) === 0){
            job.remove(function(removeErr){
                if(removeErr){
                    logger.error(removeErr.toString());
                    return false;
                }
                logger.trace(`removed failed job ["type":"${job.type}",title":"${job.data.title}","id":${job.id}]`);
            });
        }
    });
});
// 队列进度
queue.on('job progress',function(progress, data){

});
// 监控端口
server.listen(config.config.queue.port);