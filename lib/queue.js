/**
 * Queue simple framework
 * @copyright 2020 Siu <xiaoguanhai@gmail.com>
 * @since 2020.02.24
 * @license Apache 2.0
 */
'use strict';
const app = require('express')(),
    kue = require('kue'),
    kueUiExpress = require('kue-ui-express'),
    request = require('request'),
    bodyParser = require('body-parser');
app.use(bodyParser.json({limit: '100mb'}));
app.use(bodyParser.urlencoded({limit: '100mb', extended: true}));
const httpServer = require('http').createServer(app); // system server
const cronJob = require('cron').CronJob;
/**
 *
 * @type {Socket.io}
 */
let socket;
/**
 * Module exports.
 */
module.exports = Queue;
/**
 *
 * 队列
 *
 * @param {Index} config
 * @returns {Queue}
 * @constructor
 */
function Queue(config) {
    if (!(this instanceof Queue)) return new Queue(config);
    this.config = config.config;
    this.scheduleType = 'schedule';
    /**
     *
     * @type {*[]}
     */
    this.schedules = [];
    /**日志文件路径 */
    this.logger = config.logger('queue');
    this.defaultServices = {service: 10};
    this.isConnected = false; // 是否已经连接socket
    /**
     * 处理回调
     * @param {{
     *     id: string,
     *     failed: array,
     *     complete: array,
     *     failedAlive: boolean,
     *     completeAlive: boolean,
     *     title: string,
     *     url: string,
     *     timeout: number,
     *     service: array,
     *     callable: string,
     *     data: array,
     *     body: string,
     *     error: string,
     *     job: {
     *         type: string,
     *         options: array,
     *         id: number
     *     }
     * }} data
     */
    this.onProgress = function(data){};
    /**
     * 失败回调
     * @param {{
     *     id: string,
     *     failed: array,
     *     complete: array,
     *     failedAlive: boolean,
     *     completeAlive: boolean,
     *     title: string,
     *     url: string,
     *     timeout: number,
     *     service: array,
     *     callable: string,
     *     data: array,
     *     body: string,
     *     error: string,
     *     job: {
     *         type: string,
     *         options: array,
     *         id: number
     *     }
     * }} data
     */
    this.onFailed = function(data){};
    /**
     * 完成回调
     * @param {{
     *     id: string,
     *     failed: array,
     *     complete: array,
     *     failedAlive: boolean,
     *     completeAlive: boolean,
     *     title: string,
     *     url: string,
     *     timeout: number,
     *     service: array,
     *     callable: string,
     *     data: array,
     *     body: string,
     *     error: string,
     *     job: {
     *         type: string,
     *         options: array,
     *         id: number
     *     }
     * }} data
     */
    this.onComplete = function(data){};
    /**
     * 处理回调
     * @param {Object|null} error,
     * @param {Object} response,
     * @param {{
     *     id: string,
     *     failed: array,
     *     complete: array,
     *     failedAlive: boolean,
     *     completeAlive: boolean,
     *     title: string,
     *     url: string,
     *     timeout: number,
     *     service: array,
     *     callable: string,
     *     data: array,
     *     body: string,
     *     error: string,
     *     job: {
     *         type: string,
     *         options: array,
     *         id: number
     *     }
     * }} data
     */
    this.onService = function(error, response, data){};
}
/**
 * 返回Job数据
 * @param job
 * @returns {{options: *, id: *, type: *}}
 */
Queue.prototype.getJobData = function(job) {
    return {
        id: job.id,
        type: job.type,
        options: job.options
    }
};
/**
 * 队列结束
 * @param id
 * @param jobErr
 */
Queue.prototype.doFailed = function(job, jobErr) {
    let self = this;
    self.logger.error(jobErr.toString());
    /** 通知Socket服务器 */
    job.data.job = self.getJobData(job);
    job.data.error = jobErr.toString();
    // 队列执行失败之后回调
    if (typeof job.data.failed !== 'undefined' && job.data.failed.length > 0) {
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
                self.logger.warn(`job failed request url: ${job.data.url} msg: ${error.toString()}`);
            }
            if(response.statusCode !== 200){
                self.logger.error(`job failed request url: ${job.data.url} body: ${body}`);
                return false;
            }
        });
    }
    //
    if (self.isConnected === true) {
        socket.emit('job failed', job.data);
    }
    /** 如果没有标记任务不允许失败删除,失败后清理掉任务 */
    if (parseInt(job.data.failedAlive) === 0){
        job.remove(function(removeErr){
            if(removeErr){
                self.logger.error(removeErr.toString());
                return false;
            }
            self.logger.trace(`removed failed job ["type":"${job.type}",title":"${job.data.title}","id":${job.id}]`);
        });
    }
    // 失败回调
    self.onFailed(job.data);
};
/**
 * 队列完成
 * @param {string} id
 * @param {$ObjMap} res
 */
Queue.prototype.doComplete = function(job, res) {
    let self = this;
    /** 通知Socket服务器 */
    job.data.body = res;
    job.data.job = self.getJobData(job);
    // 队列完成之后回调
    if (typeof job.data.complete !== 'undefined' && job.data.complete.length > 0) {
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
                self.logger.warn(`job complete request url: ${job.data.url} msg: ${error.toString()}`);
                return false;
            }
            if(response.statusCode !== 200){
                self.logger.error(`request url: ${job.data.url} body: ${body}`);
                return false;
            }
        });
    }
    if (self.isConnected === true) {
        socket.emit('job complete', job.data);
    }
    /** 如果没有标记任务不允许成功删除,成功后清理掉任务 */
    if (parseInt(job.data.completeAlive) === 0) {
        job.remove(function(removeErr){
            if(removeErr){
                self.logger.error(removeErr.toString());
                return false;
            }
            self.logger.trace(`removed complete job ["type":"${job.type}",title":"${job.data.title}","id":${job.id}, "body": ${JSON.stringify(job.data.body)}]`);
        });
    }
    // 完成回调
    self.onComplete(job.data);
};
/**
 * 队列处理
 * @param {
 *     data: {
 *         id: string,
 *         failed: array,
 *         complete: array,
 *         failedAlive: boolean,
 *         completeAlive: boolean,
 *         title: string,
 *         url: string,
 *         timeout: number,
 *         service: array,
 *         callable: string,
 *         data: array,
 *         body: string,
 *         error: string,
 *         job: {
 *             type: string,
 *             options: array,
 *             id: number
 *         }
 *     }
 * } job
 * @param {function} done
 * @returns {boolean}
 */
Queue.prototype.doProcess = function(job, done) {
    /**
     *
     * @type {Queue}
     */
    let self = this;
    self.logger.trace(`process job ["type":${job.type},"title":"${job.data.title}","id":"${job.id}"]`);
    /** 防止POST进来的超时设置不正确 */
    if(!job.data.timeout || typeof(job.data.timeout) !== 'number'){
        job.data.timeout = self.config.queue.defaultTimeout;
    }
    job.data.job = self.getJobData(job);
    // 未定义回调则直接结束
    if (typeof(job.data.url) === 'undefined' || !job.data.url) {
        self.logger.trace(`undefined job.data.url in ["type":${job.type},"title":"${job.data.title}","id":"${job.id}"]`);
        done();
        self.onProgress(job.data);
        return false;
    }
    self.logger.trace( 'request url:',job.data.url);
    if (self.isConnected) {
        // 添加Socket客户端ID
        // job.data.job.socket = socket.id;
    }
    // 执行回调
    request({
        url: job.data.url,
        timeout: job.data.timeout,
        method: "POST",
        json: true,
        headers: {
            "content-type": "application/json",
        },
        pool: {maxSockets: 800},
        agent: false,
        forever: true,
        form: job.data
    }, function(error, response, body) {
        // 记录回调结果
        job.data.body = body;
        // after事件
        self.onService(error, response, job.data);
        // 错误处理
        if (error) {
            self.logger.warn(`request url: ${job.data.url} msg: ${error.toString()}`);
            done(error.toString());
            self.onProgress(job.data);
            return false;
        }
        // 回调地址访问出错
        if (response.statusCode !== 200) {
            self.logger.error(`request url: ${job.data.url} body: ${body}`);
            done(`request url: ${job.data.url} status: ${response.statusCode} body: ${body}`);
            self.onProgress(job.data);
            return false;
        }
        // 回调地址返回结果出错.
        if (!(body && typeof (body) == 'object')) {
            self.logger.error(`request url: ${job.data.url} body: ${body}`);
            done(`invalid json response: ${body}`);
            self.onProgress(job.data);
            return false;
        }
        done(null, body);
        self.onProgress(job.data);
    });
};
/**
 * 执行定时任务
 * @param job
 */
Queue.prototype.doSchedule = function(job, queue) {
    /**
     *
     * @type {Queue}
     */
    let self = this;
    /** @type boolean has **/
    let has;
    let i = 0;
    let item = {job:job, running: []};
    self.schedules.forEach(
        /**
         * @param {{id:number}} item
         */
        function(item) {
            if (item.job.id === job.id) {
                has = true;
            }
        });
    if (has === true) {
        self.logger.trace(`schedule {job:${job.id}} has start.`);
        return;
    };
    self.logger.trace(`process schedule {type:${job.type}, title:"${job.data.title}", id:${job.id}}`);
    job.data.job = self.getJobData(job);
    const schedule = new cronJob(job.data.schedule, function() {
        i += 1;
        self.logger.info(`doing schedule {job:${job.id}} ${i} times.`);
        // 标记父节点
        // TODO: 标记父子关系
        // job.data.schedule = job.id;
        const subJob = queue.create(job.data.type, job.data)
            .save(function(err){
                if (err !== null) {
                    self.logger.error(`doing schedule {job:${subJob.id}} fail because {error:${err}}`);
                }
            });
        // item.running.push(subJob);
    });
    item.schedule = schedule;
    schedule.start();
    self.schedules.push(item);
};
/**
 * 启动服务
 * @param {Object} doServices 格式：{'<订阅的服务名称>', '<并发数>'>}
 */
Queue.prototype.start = function(doServices){
    const self = this;
    if (typeof doServices === 'undefined') {
        doServices = self.defaultServices;
    }
    /**
     * 连接redis并创建任务队列
     * @return {Object} kue.queue 对象
     * @see https://github.com/Automattic/kue#redis-connection-settings
     */
    const queue = kue.createQueue({
        redis:self.config.queue.db.redis.url,
        prefix:self.config.queue.db.prefix
    });
    queue.setMaxListeners(0); // 最大对象监听量
    /** 队列控制台 */
    // kueUiExpress(app, '/job/', '/console'); // 绑定控制台路径
    app.use('/console/', kue.app); // 开启界面监控
    self.socket();
    // 队列执行
    for (let serviceName in doServices){
        let serviceMaximum = doServices[serviceName];
        queue.process(serviceName, serviceMaximum, function(job, done) {
            self.doProcess(job, done);
        });
    }
    // 定时任务
    queue.process(self.scheduleType, 9999, function(job, done) {
        try{
            self.doSchedule(job, queue);
        } catch (e) {
            done(e.toString());
        }
    });
    // 激活任务
    queue.active( function( err, ids ) {
        ids.forEach(function(id) {
            kue.Job.get(id, function(err, job) {
                if (err) {
                    self.logger.trace(`{job:${id}} active fail because ${err}`);
                    return;
                }
                if (job.type === self.scheduleType) {
                    self.doSchedule(job, queue);
                }
            });
        });
    });
    // 队列完成
    queue.on('job complete', function(id, res){
        kue.Job.get(id, function(err, job){
            if (err) {
                self.logger.error(`{job:${id}} complete fail because ${err}`);
                return;
            }
            if (job.type === self.scheduleType) {
                self.delSchedule(job.id);
            }
            self.doComplete(job, res);
        });
    });
    // 删除队列
    queue.on('job remove', function(id, type){
        self.logger.trace(`{job:${id}} removed.`);
        if (type === self.scheduleType) {
            self.delSchedule(id);
        };
    });
    // 队列重试失败
    queue.on('job failed attempt', function(id, errorMessage, doneAttempts){
        // TODO: 延迟重试机制
    });
    // 队列失败
    queue.on('job failed', function(id, jobErr){
        kue.Job.get(id, function(err, job){
            if (err) {
                self.logger.error(`{job:${id}} failed because ${err}`);
                return;
            }
            if (job.type === self.scheduleType) {
                self.delSchedule(job.id);
            }
            self.doFailed(job, jobErr);
        });
    });
    // 队列进度
    queue.on('job progress',function(progress, data){

    });
    // 监控端口
    httpServer.listen(self.config.queue.port);
};
/**
 * 删除定时任务
 * @param id
 */
Queue.prototype.delSchedule= function(id) {
    const self = this;
    self.schedules.forEach(
        /**
         * @param {{}} item
         * @param n
         */
        function(item, n) {
            if (item.job.id === parseInt(id)) {
                self.logger.trace(`{job:${id}, type:${item.job.type}} deleted`);
                item.schedule.stop();
                self.schedules.splice(n,1);
                return true;
            }
        });
};
/**
 * 暂停定时任务
 * @param id
 */
Queue.prototype.pauseSchedule= function(id) {
    const self = this;
    self.schedules.forEach((item, n) => {
        if (item.job.id === id) {
            // 定时
            self.logger.trace(`{job:${id}, type:${item.job.type} has paused.`);
            item.schedule.stop();
            return true;
        }
    });
};
/**
 * 恢复定时任务
 * @param id
 */
Queue.prototype.resumeSchedule= function(id) {
    const self = this;
    self.schedules.forEach((item, n) => {
        if (item.job.id === id) {
            // 定时
            self.logger.trace(`{job:${id}, type:${item.job.type} has resumed.`);
            item.schedule.start();
            return true;
        }
    });
};

/**
 * 任务完成之后回调
 * @param {function} callback
 * @returns {Queue}
 */
Queue.prototype.complete = function(callback){
    if (typeof callback === 'function') {
        this.onComplete = callback;
    }
    return this;
};

/**
 * 任务失败之后回调
 * @param {function} callback
 * @returns {Queue}
 */
Queue.prototype.failed = function(callback){
    if (typeof callback === 'function') {
        this.onFailed = callback;
    }
    return this;
};

/**
 * 任务处理中回调
 * @param {function} callback
 * @returns {Queue}
 */
Queue.prototype.progress = function(callback){
    if (typeof callback === 'function') {
        this.onProgress = callback;
    }
    return this;
};

/**
 * 处理业务后回调
 * @param {function} callback
 * @returns {Queue}
 */
Queue.prototype.service = function(callback){
    if (typeof callback === 'function') {
        this.onService = callback;
    }
    return this;
};
/**
 * Socket客户端
 */
Queue.prototype.socket = function(){
    const self = this;
    socket = require('socket.io-client')(this.config.socket.server + ':' + this.config.socket.port, {
        transportOptions: {
            polling: {
                extraHeaders: {
                    'token': process.env.APP_SECRET, //标记客户端
                    'authorization': process.env.SOCKET_SERVER_AUTHORIZATION //标记客户端
                }
            },
            websocket: {
                extraHeaders: {
                    'token': process.env.APP_SECRET, //标记客户端
                    'authorization': process.env.SOCKET_SERVER_AUTHORIZATION //标记客户端
                }
            }
        },
        forceNew: false,
        transports: ['websocket', 'polling'] // 优先ws,失败采用poll模式
    });
    /** 连接Socket服务成功 */
    socket.on('connect', function(){
        self.isConnected = true;
        self.logger.info(`connect socket server ok, socket id:${socket.id}`);
    });
    /** 断开Socket服务连接 */
    socket.on('disconnect', function(){
        self.isConnected = false;
        self.logger.error('socket server is disconnect');
    });
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
            self.logger.error(`undefined [progress] in data for progress socket.`);
            return false;
        }
        if (typeof data.job.id === 'undefined') {
            self.logger.error(`undefined [job.id] in data for progress socket.`);
            return false;
        }
        kue.Job.get(data.job.id, function(err, job){
            if(err){
                self.logger.error(`${err.toString()} on update {job:${job.id}} progress`);
                return false;
            }
            job.progress(data.progress, 100);
        });
    });
}

