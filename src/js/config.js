'use strict';
module.exports = {
    load: function(path){
        /** 加载环境变量 */
        const fs = require('fs');
        const envConfig = dotenv.parse(fs.readFileSync(path));
        for (const k in envConfig) {
            process.env[k] = envConfig[k]
        }
        try{
            const envLocalConfig = dotenv.parse(fs.readFileSync(path + process.env.NODE_ENV));
            for (const k in envLocalConfig) {
                process.env[k] = envLocalConfig[k]
            }
        }catch (e) {
            //什么也不做
        }
        try{
            const envLocalConfig = dotenv.parse(fs.readFileSync(path + '.local'));
            for (const k in envLocalConfig) {
                process.env[k] = envLocalConfig[k]
            }
        }catch (e) {
            //什么也不做
        }
// 环境配置
        require('json5/lib/register');
        const merge = require('merge-anything');
        const json5 = require('./config.json5');
        const envJson5 = require(`./config_${process.env.APP_ENV}.json5`);
        const config = merge.merge(json5, envJson5);
//
        config.queue.db.redis.url = process.env.QUEUE_REDIS_URL;
        config.queue.port = process.env.QUEUE_SERVER_PORT;
        config.queue.url = process.env.QUEUE_URL;
        config.queue.server = process.env.QUEUE_SERVER_URL;
//
        config.socket.db.redis.url = process.env.SOCKET_REDIS_URL;
        config.socket.server = process.env.SOCKET_SERVER_URL;
        config.socket.port = process.env.SOCKET_SERVER_PORT;
        //
        config.log.path = process.env.LOG_PATH;
        //
        this.config = config;
    },
    logger: function(name) {
        const options = this.config.log.log4js;
        options.appenders.dateFile.filename = config.log.path + '/' + name + '_' + process.env.APP_ENV;
        log4js.configure(options);
        const logger = log4js.getLogger(process.env.APP_ENV);
        return logger;
    },
    config: {}
};
