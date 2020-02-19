'use strict';
const queue = require('./../../lib/main').initialization('./example/web/.env');
/** 启动队列服务 **/
queue.queue.start();