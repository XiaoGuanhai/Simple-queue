<?php
header('Content-type: application/json');
require "./../../vendor/autoload.php";
use ElephantIO\Engine\SocketIO\Version2X;
use ElephantIO\Client;

class example
{
    public function doAction($message, \Siu\Queue $queue)
    {
        // 发送信息
        $queue->setData(['message' => $message]);
        // 汇报进度
        for($i = 10; $i < 100; $i += 30) {
            sleep(1);
            $queue->setProgress($i);
        }
        $queue->setProgress(100)
            ->close();
        return [
            'example' => 'isOk'
        ];
    }
}
/**
 * Socket客户端
 */
$client = new Client(new Version2X("http://node:3315", [
    [
        'headers' => [
            'authorization: 12b3c4d5e6f7g8h9i'
        ],
    ]
]));
// 实例化队列
$queue = new \Siu\Queue($client, [
    'server' => 'http://node',
    'port' => 3314
]);
$data = $queue->parse($_POST)/** 解析参数 */
->doService(); /** 执行队列回调的方法 */
echo json_encode($data);

