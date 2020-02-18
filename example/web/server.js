'use strict';
const queue = require('queue-simple-framework').initialization('./.env');
queue.queue.run();
queue.socket.run();