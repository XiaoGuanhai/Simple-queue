'use strict';
const client = require('./../../lib/main').initialization('./example/web/.env');

client.socket.start();/** 启动Socket服务 */