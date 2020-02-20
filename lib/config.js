'use strict';
const fs = require('fs');
const dotenv = require('dotenv');
const log4js = require('log4js');
module.exports = {
    load: function(path){
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
        //
        this.config.queue.db.redis.url = process.env.QUEUE_REDIS_URL;
        this.config.queue.port = process.env.QUEUE_SERVER_PORT;
        this.config.queue.url = process.env.QUEUE_URL;
        this.config.queue.server = process.env.QUEUE_SERVER_URL;
        //
        this.config.socket.db.redis.url = process.env.SOCKET_REDIS_URL;
        this.config.socket.server = process.env.SOCKET_SERVER_URL;
        this.config.socket.port = process.env.SOCKET_SERVER_PORT;
        //
        this.config.log.path = process.env.LOG_PATH;
        return this;
    },
    logger: function(name) {
        const options = this.config.log.log4js;
        options.appenders.dateFile.filename = this.config.log.path + '/' + name + '_' + process.env.APP_ENV;
        log4js.configure(options);
        const logger = log4js.getLogger(process.env.APP_ENV);
        return logger;
    },
    config: {
        "queue": {
            /** [RPC队列] 接口回调地址 */
            "url": "", //@see .env>QUEUE_URL
            "server": "", //@see .env>QUEUE_SERVER_URL
            "port": "", //@see .env>QUEUE_SERVER_PORT
            /** 默认超时设置(毫秒) */
            "defaultTimeout": 600000,
            /** [RPC队列] 数据库 */
            "db": {
                "prefix": "queue_",
                "redis": {
                    "url": "", //@see .env>QUEUE_REDIS_URL
                }
            }
        },
        /************************************** Socket服务 ***************************************/
        /** Socket服务使用数据库(用于维护在线状态) */
        "socket": {
            "db": {
                "prefix": "socket_",
                "redis": {
                    "url": "" //@see .env>SOCKET_REDIS_URL
                }
            },
            "authorization": "", //@see .env>SOCKET_SERVER_AUTHORIZATION
            "server": "", //@see .env>SOCKET_SERVER_URL
            "port": "" //@see .env>SOCKET_SERVER_PORT
        },
        /************************************* 全局日志设置 **************************************/
        "log":{
            "path": "", //@see .env>LOG_PATH
            "log4js": {
                "appenders": {
                    "console": { "type": "stdout" },
                    "dateFile": {
                        "type": "dateFile",
                        "pattern": "yyyy-MM-dd.log",
                        "alwaysIncludePattern": true,
                        "maxLogSize": 20480000,
                        "backups": 100
                    }
                },
                "categories": {
                    "default": { "appenders": ["console", "dateFile"], "level": "debug" },
                    "dev": { "appenders": ["console","dateFile"], "level": "trace" },
                    "test": { "appenders": ["console","dateFile"], "level": "trace" },
                    "production": { "appenders": ["dateFile"], "level": "error" }
                }
            },
        }
    }
};
