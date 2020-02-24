/**
 * Queue simple framework
 * @copyright 2020 Siu <xiaoguanhai@gmail.com>
 * @since 2020.02.24
 * @license Apache 2.0
 */
const fs = require('fs');
const dotenv = require('dotenv');
const log4js = require('log4js');

Object.defineProperty(global, "__stack", {
    get: function () {
        let orig = Error.prepareStackTrace;
        Error.prepareStackTrace = function (_, stack) {
            return stack
        };
        let err = new Error;
        Error.captureStackTrace(err, arguments.callee);
        let stack = err.stack;
        return Error.prepareStackTrace = orig, stack
    }
}),
Object.defineProperty(global, "__line", {
    get: function () {
        return __stack[1].getLineNumber()
    }
});

/**
 * Module exports.
 */
module.exports = Index;
/**
 * 入口
 * @param path
 * @returns {Index}
 * @constructor
 */
function Index(path){
    if (!(this instanceof Index)) return new Index(path);
    /** 加载环境变量 */
    const envConfig = dotenv.parse(fs.readFileSync(path));
    for (const k in envConfig) {
        process.env[k] = envConfig[k]
    }
    try{
        //.env.local
        const envLocalConfig = dotenv.parse(fs.readFileSync(path + '.local'));
        for (const k in envLocalConfig) {
            process.env[k] = envLocalConfig[k]
        }
    }catch (e) {
        //什么也不做
    }
    try{
        if (typeof process.env.NODE_ENV !== 'undefined') {
            //.env.<NODE_ENV>
            const envLocalConfig = dotenv.parse(fs.readFileSync(path + '.' + process.env.NODE_ENV));
            for (const k in envLocalConfig) {
                process.env[k] = envLocalConfig[k]
            }
            try{
                //.env.<NODE_ENV>.local
                const envLocalConfig = dotenv.parse(fs.readFileSync(path + '.' + process.env.NODE_ENV + '.local'));
                for (const k in envLocalConfig) {
                    process.env[k] = envLocalConfig[k]
                }
            }catch (e) {
                //什么也不做
            }
        }
    }catch (e) {
        //什么也不做
    }
    this.config = {
        queue: {
            /** [RPC队列] 接口回调地址 */
            url: process.env.QUEUE_URL, //@see .env>QUEUE_URL
            server: process.env.QUEUE_SERVER_URL, //@see .env>QUEUE_SERVER_URL
            port: process.env.QUEUE_SERVER_PORT, //@see .env>QUEUE_SERVER_PORT
            /** 默认超时设置(毫秒) */
            defaultTimeout: 600000,
            /** [RPC队列] 数据库 */
            db: {
                prefix: "queue_",
                redis: {
                    url: process.env.QUEUE_REDIS_URL, //@see .env>QUEUE_REDIS_URL
                }
            }
        },
        /************************************** Socket服务 ***************************************/
        /** Socket服务使用数据库(用于维护在线状态) */
        socket: {
            db: {
                prefix: "socket_",
                redis: {
                    url: process.env.SOCKET_REDIS_URL //@see .env>SOCKET_REDIS_URL
                }
            },
            authorization: process.env.SOCKET_SERVER_AUTHORIZATION, //@see .env>SOCKET_SERVER_AUTHORIZATION
            server: process.env.SOCKET_SERVER_URL, //@see .env>SOCKET_SERVER_URL
            port: process.env.SOCKET_SERVER_PORT //@see .env>SOCKET_SERVER_PORT
        },
        /************************************* 全局日志设置 **************************************/
        log:{
            path: process.env.LOG_PATH, //@see .env>LOG_PATH
            log4js: {
                appenders: {
                    console: { "type": "stdout" },
                    dateFile: {
                        type: "dateFile",
                        pattern: "yyyy-MM-dd.log",
                        alwaysIncludePattern: true,
                        maxLogSize: 20480000,
                        backups: 100
                    }
                },
                categories: {
                    default: { "appenders": ["dateFile"], "level": "error" },
                    dev: { "appenders": ["console","dateFile"], "level": "trace" },
                    test: { "appenders": ["console","dateFile"], "level": "debug" }
                }
            },
        }
    };
    /**
     *
     * @type {Queue}
     */
    this.queue = require('./queue')(this);
    /**
     *
     * @type {Socket}
     */
    this.socket = require('./socket')(this);
}

/**
 * 日志实例
 * @param name
 * @returns {Logger}
 */
Index.prototype.logger = function(name) {
    const options = this.config.log.log4js;
    options.appenders.dateFile.filename = this.config.log.path + '/' + name + '_' + process.env.APP_ENV;
    log4js.configure(options);
    const logger = log4js.getLogger(process.env.APP_ENV);
    return logger;
}
