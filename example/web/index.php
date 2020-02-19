<?php
header('Content-type: application/json');
require "./../../vendor/autoload.php";
use ElephantIO\Engine\SocketIO\Version2X;
use ElephantIO\Client;

class example
{
    function doAction($message, \Siu\Queue $queue)
    {
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

