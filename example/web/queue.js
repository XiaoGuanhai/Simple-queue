'use strict';
const client = require('../../lib')('./example/web/.env');
/** 启动队列服务 **/
const queue = client.queue;
// service 事件
queue.service(function(err, response, data){
    console.log(`queue.service`, JSON.stringify(data));
});
// progress 事件
queue.progress(function(data){
    console.log(`queue.progress`, JSON.stringify(data));
});
// complete 事件
queue.complete(function(data){
    console.log(`queue.complete`, JSON.stringify(data));
});
// complete 事件
queue.failed(function(data){
    console.log(`queue.failed`, JSON.stringify(data));
});



queue.start({service: 10});