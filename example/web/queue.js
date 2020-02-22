'use strict';
const client = require('./../../lib/main').initialization('./example/web/.env');
/** 启动队列服务 **/
const queue = client.queue;
queue.afterService = function(err, response, data){
    console.log(response);
};
queue.start({service: 10});