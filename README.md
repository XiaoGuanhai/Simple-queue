# Queue simple framework

#### 介绍
Queue简易框架

#### 软件架构
***时序图说明***
![image](https://public-1256939332.cos.ap-guangzhou.myqcloud.com/queue/timing-diagram.png)


***数据流程图说明***

![image](https://public-1256939332.cos.ap-guangzhou.myqcloud.com/queue/data-flow-chart.png)


#### 使用说明
##### 全局变量设置
```dotenv
#  * .env                包含应用程序所需的环境变量的默认值
#  * .env.local          带有本地替代的未提交文件
# 环境变量
APP_ENV=dev
# 应用密钥（暂时未使用）        
APP_SECRET=0d0e71bec41cfe7cfbe3ce3b0a468c4e
###> Queue ###
# 队列定时任务接口地址（暂时未使用）
QUEUE_URL=http://web:8081/api.php
# 队列服务端地址
QUEUE_SERVER_URL=http://node
# 队列服务端端口
QUEUE_SERVER_PORT=3314
# 队列连接用的redis地址
QUEUE_REDIS_URL=redis://redis:6379/1
###< Queue ###
###> Socket ###
# socket服务端地址
SOCKET_SERVER_URL=http://node
# socket服务端端口
SOCKET_SERVER_PORT=3315
# socket连接用的redis地址
SOCKET_REDIS_URL=redis://redis:6379/2
# socket连接用的密钥（暂时未使用）
SOCKET_SERVER_AUTHORIZATION=12b3c4d5e6f7g8h9i
###< Socket ###
```

##### Web服务端
*** 创建队列 ***
```php
// 实例化Socket客户端
$client = new Client(new Version2X("http://node:3315"));
// 实例化队列
$queue = new \Siu\Queue($client, [
    'server' => 'http://node', // 队列地址
    'port' => 3314 // 队列端口
]);
/**
 * 创建队列
 */
$job = $queue->setUrl('http://web/api.php') /** 设置队列回调地址 */
    ->setId(1) /** 设置客户端ID */
    ->enableCompleteAlive() /** 完成之后不会删除队列记录 */
    ->enableFailedAlive() /** 失败之后不会删除队列记录 */
    ->setService([example::class, 'doAction', '你好啊，客户1!!']) /** 设置回调接口 */
    ->setTitle('消息推送') /** 设置标题 */
    ->createJob() /** 创建job */;
/**
 * 返回结果实例：
 * {
 *     "message": "job created",
 *     "id": 1
 * }
 */
echo json_encode($job);
```

*** 任务回调 ***
```php
use ElephantIO\Engine\SocketIO\Version2X;
use ElephantIO\Client;

class example
{
    public function doAction($message, \Siu\Queue $queue)
    {
        // 发送信息
        $queue->setData(['message' => $message]);
        $queue->setProgress(100) // 汇报进度
            ->close(); // 关闭连接
        return [
            'example' => 'isOk'
        ];
    }
}
/**
 * Socket客户端
 */
$client = new Client(new Version2X("http://node:3315"));
// 实例化队列
$queue = new \Siu\Queue($client, [
    'server' => 'http://node',
    'port' => 3314
]);
$data = $queue->parse($_POST)/** 解析参数 */
->doService(); /** 执行队列回调的方法 */
echo json_encode($data);
```

##### Queue服务端
```js
'use strict';
// ./example/web/.env 为你的配置文件路径
const client = require('queue-simple-framework').initialization('./example/web/.env');
/** 启动队列服务 **/
client.queue.start();
```

##### Socket服务端
```js
'use strict';
// ./example/web/.env 为你的配置文件路径
const client = require('queue-simple-framework').initialization('./example/web/.env');
/** 启动队列服务 **/
client.socket.start();
```

##### Socket客户端
```js
// 接收到socket服务器 progress[任务进度] 类型事件
socket.on('progress', function(data) {
    /**
     * data字段说明
     * data[id] 客户端ID
     * data[title] 队列标题
     * data[data] Web服务端使用setData设置的data
     * data[error] 队列错误信息
     * data[job][type] 队列类型
     * data[job][id] 队列id
     * data[job][options] 队列参数
     * data[progress] 队列进度条（最小值：0， 最大值：100）
     */
    console.log("进度条", data);
});
// 接收到socket服务器 complete[任务完成] 类型事件
socket.on('complete', function(data) {
    /**
     * data字段说明
     * @see socket.on('progress', function(data) {.....} 的data说明
     */
    console.log("完成", data);

});
// 接收到socket服务器 failed[任务失败] 类型事件
socket.on('failed', function(data) {
    /**
     * data字段说明
     * @see socket.on('progress', function(data) {.....} 的data说明
     */
    console.log("失败", data);
});
```

*** 更多使用方法可参考 `example目录` ***