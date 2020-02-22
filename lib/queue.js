'use strict';
module.exports = {
    app: require('express')(),
    kue: require('kue'),
    kueUiExpress: require('kue-ui-express'),
    request: require('request'),
    bodyParser: require('body-parser'),
    logger: {},
    queue: {},
    socket: {},
    config: {},
    defaultServices: {service: 10},
    connectedSocket: false, // 是否已经连接socket
    /**
     * 返回Job数据
     * @param job
     * @returns {{options: *, id: *, type: *}}
     */
    getJobData: function(job) {
        return {
            id: job.id,
            type: job.type,
            options: job.options
        }
    },
    initialization: function(config){
        this.config = config;
        /**日志文件路径 */
        this.logger = this.config.logger('queue');
        return this;
    },
    /**
     * 队列结束
     * @param id
     * @param jobErr
     */
    doJobFailed: function(id, jobErr) {
        let self = this;
        self.logger.error(jobErr.toString());
        self.kue.Job.get(id, function(err, job){
            if (err) {
                self.logger.error(jobErr.toString());
                return false;
            }
            /** 通知Socket服务器 */
            job.data.job = self.getJobData(job);
            job.data.error = jobErr.toString();
            // 队列执行失败之后回调
            if (typeof job.data.failed !== 'undefined' && job.data.failed.length > 0) {
                job.data.callable = 'failed';
                self.request({
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
            if (self.connectedSocket === true) {
                self.socket.emit('job failed', job.data);
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
            self.afterFailed(job.data);
        });
    },
    /**
     * 队列完成
     * @param {string} id
     * @param {$ObjMap} res
     */
    doJobComplete: function(id, res) {
        let self = this;
        self.kue.Job.get(id, function(err, job) {
            if (err) return;
            /** 通知Socket服务器 */
            job.data.body = res;
            job.data.job = self.getJobData(job);
            // 队列完成之后回调
            if (typeof job.data.complete !== 'undefined' && job.data.complete.length > 0) {
                job.data.callable = 'complete';
                self.request({
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
            if (self.connectedSocket === true) {
                self.socket.emit('job complete', job.data);
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
            self.afterComplete(job.data);
        });
    },
    /**
     * 队列处理
     * @param {string} serviceName 服务名称
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
     * @param {anonymous} done
     * @returns {boolean}
     */
    doJobProcess: function(serviceName, job, done) {
        let self = this;
        self.logger.trace(`process job ["type":${serviceName},"title":"${job.data.title}","id":"${job.id}"]`);
        /** 防止POST进来的超时设置不正确 */
        if(!job.data.timeout || typeof(job.data.timeout) !== 'number'){
            job.data.timeout = self.config.config.queue.defaultTimeout;
        }
        job.data.job = self.getJobData(job);
        self.beforeService(job.data);
        // 未定义回调则直接结束
        if (typeof(job.data.url) === 'undefined' || !job.data.url) {
            self.logger.trace(`undefined job.data.url in ["type":${serviceName},"title":"${job.data.title}","id":"${job.id}"]`);
            done();
            self.afterProgress(job.data);
            return false;
        }
        self.logger.trace( 'request url:',job.data.url);
        if (self.connectedSocket) {
            // 添加Socket客户端ID
            job.data.job.client = self.socket.id;
        }
        // 执行回调
        self.request({
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
            self.afterService(error, response, job.data);
            // 错误处理
            if (error) {
                self.logger.warn(`request url: ${job.data.url} msg: ${error.toString()}`);
                done(error.toString());
                self.afterProgress(job.data);
                return false;
            }
            // 回调地址访问出错
            if (response.statusCode !== 200) {
                self.logger.error(`request url: ${job.data.url} body: ${body}`);
                done(`request url: ${job.data.url} status: ${response.statusCode} body: ${body}`);
                self.afterProgress(job.data);
                return false;
            }
            // 回调地址返回结果出错.
            if (!(body && typeof (body) == 'object')) {
                self.logger.error(`request url: ${job.data.url} body: ${body}`);
                done(`invalid json response: ${body}`);
                self.afterProgress(job.data);
                return false;
            }
            done(null, body);
            self.afterProgress(job.data);
        });
    },
    /**
     * 启动服务
     * @param {{service: number}} doServices
     */
    start: function(doServices){
        let self = this;
        if (typeof doServices === 'undefined') {
            doServices = self.defaultServices;
        }
        self.app.use(self.bodyParser.json({limit: '100mb'}));
        self.app.use(self.bodyParser.urlencoded({limit: '100mb', extended: true}));
        /**
         * 连接redis并创建任务队列
         * @return {Object} kue.queue 对象
         * @see https://github.com/Automattic/kue#redis-connection-settings
         */
        self.queue = self.kue.createQueue({
            redis:self.config.config.queue.db.redis.url,
            prefix:self.config.config.queue.db.prefix
        });
        /** 队列控制台 */
        self.kueUiExpress(self.app, '/job/', '/console'); // 绑定控制台路径
        self.app.use('/console/', self.kue.app); // 开启界面监控
        /** 将队列连接到Socket服务 */
        self.socket = require('socket.io-client')(self.config.config.socket.server + ':' + self.config.config.socket.port, {
            transportOptions: {
                polling: {
                    extraHeaders: {
                        'token': process.env.APP_SECRET //标记客户端
                    }
                }
            }
        });
        /** 连接Socket服务成功 */
        self.socket.on('connect', function(){
            self.connectedSocket = true;
            self.logger.info(`connect socket server ok, socket id:${self.socket.id}`);
        });
        /** 断开Socket服务连接 */
        self.socket.on('disconnect', function(){
            self.connectedSocket = false;
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
        self.socket.on('progress', function(data){
            if (typeof data.progress === 'undefined') {
                self.logger.error(`undefined [progress] in data for progress socket.`);
                return false;
            }
            if (typeof data.job.id === 'undefined') {
                self.logger.error(`undefined [job.id] in data for progress socket.`);
                return false;
            }
            self.kue.Job.get(data.job.id, function(err, job){
                if(err){
                    self.logger.error(`${err.toString()} on update queue progress`);
                    return false;
                }
                job.progress(data.progress, 100);
            });
        });
        // 队列执行
        for (let serviceName in doServices){
            let serviceMaximum = doServices[serviceName];
            self.queue.process(serviceName, serviceMaximum, function(job, done) {
                self.doJobProcess(serviceName, job, done);
            });
        };
        // 队列完成
        self.queue.on('job complete', function(id, res){
            self.doJobComplete(id, res);
        });
        // 队列重试失败
        self.queue.on('job failed attempt', function(id, errorMessage, doneAttempts){

        });
        // 队列失败
        self.queue.on('job failed', function(id, jobErr){
            self.doJobFailed(id, jobErr);
        });
        // 队列进度
        self.queue.on('job progress',function(progress, data){

        });
        // 监控端口
        require('http').Server(self.app).listen(self.config.config.queue.port);
    },
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
    afterProgress: function(data){},
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
    afterFailed: function(data){},
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
    afterComplete: function(data){},
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
    beforeService: function(data){},
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
    afterService: function(error, response, data){},
};