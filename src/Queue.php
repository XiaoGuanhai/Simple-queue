<?php

/**
 * @copyright Copyright (c) 2018 Siu <xiaoguanhai@gmail.com>
 * @author Siu <xiaoguanhai@gmail.com>
 * @since 2020.02.18
 * @link http://www.ddtechs.cn
 */
namespace Siu;

use ElephantIO\Client;
use ElephantIO\Engine\SocketIO\Version2X;
use Symfony\Component\HttpClient\HttpClient;
use Symfony\Component\PropertyAccess\PropertyAccess;
use Symfony\Contracts\HttpClient\Exception\ClientExceptionInterface;
use Symfony\Contracts\HttpClient\Exception\DecodingExceptionInterface;
use Symfony\Contracts\HttpClient\Exception\RedirectionExceptionInterface;
use Symfony\Contracts\HttpClient\Exception\ServerExceptionInterface;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;

/**
 * 简易队列框架
 * @package Siu
 */
class Queue
{
    /**
     * @var PropertyAccessor
     */
    protected $propertyAccessor;
    /**
     * @var mixed
     */
    protected $user;
    protected $timeout = 600;
    /**
     * 任务回调的数据
     * @var array
     */
    protected $data = [];
    /**
     * 订阅者
     * @var string
     */
    protected $subscriber;
    /**
     * 任务标题
     * @var string
     */
    protected $title;
    /**
     * 任务执行的回调
     * @var array
     */
    protected $service = [];
    /**
     * 任务执行的回调地址
     * @var string
     */
    protected $url;
    /**
     * 任务失败之后是否保持记录
     * 1 保持记录
     * 0 删除记录
     * @var int
     */
    protected $failedAlive = 0;
    /**
     * 任务完成之后是否保持记录
     * 1 保持记录
     * 0 删除记录
     * @var int
     */
    protected $completeAlive = 0;
    /**
     * 任务类型
     * @var string
     */
    protected $type = 'service';
    /**
     * 任务参数
     * @var array
     */
    protected $options = [];
    /**
     * 任务进度
     * 最大值 100
     * @var int
     */
    protected $progress = 0;
    /**
     * 错误信息
     * @var string
     */
    protected $error;
    /**
     * Socket客户端
     * @var Client
     */
    protected $socket;
    /**
     * 队列失败之后的回调
     * @var array
     */
    protected $failed = [];
    /**
     * 队列成功之后的回调
     * @var array
     */
    protected $complete = [];
    /**
     * 执行回调之后的html内容
     * @var string
     */
    protected $body;
    /**
     * @var array
     */
    protected $params;
    /**
     * 将要执行的回调类型
     * @var string
     */
    protected $callable = 'service';
    /**
     * 任务ID
     * @var string
     */
    protected $id = 0;
    /**
     * 计划任务的时间
     * 格式 * * * * * *
     * 参考 @link https://crontab.guru/
     * @var string
     */
    protected $schedule;

    /**
     * Queue constructor.
     * @param mixed $socket socket客户端
     * @param array $options 队列参数
     * $options[server] string 队列地址
     * $options[port] string 队列端口
     */
    public function __construct($socket, $options = [])
    {
        $this->socket = $socket;
        $this->options = array_merge($options, []);
        $this->propertyAccessor = PropertyAccess::createPropertyAccessor();
    }

    /**
     * 演示
     * @param $data
     * @param Queue $queue
     * @return array
     */
    public function example($data, $queue)
    {
        $queue->setProgress(100)
            ->close();
        return [
            'example' => 'isOk'
        ];
    }

    /**
     * @param string $failedAlive
     * @return $this
     */
    public function setFailedAlive($failedAlive)
    {
        $this->failedAlive = $failedAlive;
        return $this;
    }

    /**
     * @param $complete
     * @return $this
     */
    public function setComplete($complete)
    {
        $this->complete = $complete;
        return $this;
    }

    /**
     * @param string|null $type 任务类型 schedule|service
     * @param array $options 任务参数
     * @return array
     */
    protected function build($type = null, $options = [])
    {
        $this->params = [
            'type' => $type ? $type : $this->type,
            'data' => [
                'id' => $this->id,
                'subscriber' => $this->subscriber,
                'failed' => $this->failed,
                'complete' => $this->complete,
                'failedAlive' => $this->failedAlive,
                'completeAlive' => $this->completeAlive,
                'title' => $this->title,
                'url' => $this->url,
                'timeout' => $this->timeout, //超时时间
                'service' => $this->service,
                'callable' => $this->callable,
                'data' => $this->data,
                'body' => $this->body,
                'error' => $this->error,
                'type' => $this->type,
                'options' => $this->options,
                'schedule' => $this->schedule
            ],
            'options' => $options ? $options : $this->options
        ];
        return $this->params;
    }

    /**
     * @param string $url
     * @return Queue
     */
    public function setUrl($url)
    {
        $this->url = $url;
        return $this;
    }

    /**
     * @param array $options
     * @return Queue
     */
    public function parse(array $options)
    {
        $this->type = $this->propertyAccessor->getValue($options, '[type]', $this->type);
        $this->id = $this->propertyAccessor->getValue($options, '[id]', $this->id);
        $this->options = $this->propertyAccessor->getValue($options, '[options]', $this->options);
        //
        $this->subscriber = $this->propertyAccessor->getValue($options, '[subscriber]', $this->subscriber);
        $this->title = $this->propertyAccessor->getValue($options, '[title]', $this->title);
        $this->url = $this->propertyAccessor->getValue($options, '[url]', $this->url);
        $this->timeout = $this->propertyAccessor->getValue($options, '[timeout]', $this->timeout);
        $this->service = $this->propertyAccessor->getValue($options, '[service]', $this->service);
        $this->data = $this->propertyAccessor->getValue($options, '[data]', $this->data);
        $this->body = $this->propertyAccessor->getValue($options, '[body]', $this->body);
        $this->callable = $this->propertyAccessor->getValue($options, '[callable]', $this->callable);
        $this->error = $this->propertyAccessor->getValue($options, '[error]', $this->error);
        $this->schedule = $this->propertyAccessor->getValue($options, '[schedule]', $this->schedule);
        //
        $this->params = $this->build();
        return $this;
    }

    /**
     * @param string|integer $id
     * @return $this
     */
    public function setId($id)
    {
        $this->id = $id;
        return $this;
    }

    /**
     * @param string|integer $subscriber
     * @return $this
     */
    public function setSubscriber($subscriber)
    {
        $this->subscriber = $subscriber;
        return $this;
    }

    /**
     * 执行服务
     * @return mixed
     * @throws \Exception
     */
    public function doService()
    {
        try {
            switch ($this->callable) {
                case 'failed':
                    $params = $this->failed;
                    break;
                case 'complete':
                    $params = $this->complete;
                    break;
                default:
                    $params = $this->service;
            }
            if (count($params) < 2) {
                throw new QueueException(50001, "无效的service", $this->service);
            }
            $name = array_shift($params);
            $function = array_shift($params);
            $params[] = $this;
            if(!class_exists($name)) {
                throw new QueueException(50002, "{$name} 类不存在.", $this->service);
            }
            $object = new $name();
            if (!method_exists($object, $function)) {
                throw new QueueException(50003, get_class($object) . "->{$function} 方法不存在.", $this->service);
            }
            return call_user_func_array([$object, $function], $params);
        } catch (\Exception $ex) {
            throw $ex;
        }

    }

    public function getSubscriber()
    {
        return $this->subscriber;
    }

    /**
     * @param User $user
     * @return $this
     */
    public function setUser(User $user)
    {
        $this->user = $user;
        return $this;
    }

    public function getUser()
    {
        return $this->user;
    }

    /**
     * @param int $timeout
     * @return $this
     */
    public function setTimeout($timeout)
    {
        $this->timeout = $timeout;
        return $this;
    }

    /**
     * @param array $data
     * @return $this
     */
    public function setData($data)
    {
        $this->data = $data;
        return $this;
    }

    public function getData()
    {
        return $this->data;
    }

    public function getTimeout()
    {
        return $this->timeout;
    }

    /**
     * @param $title
     * @return $this
     */
    public function setTitle($title)
    {
        $this->title = $title;
        return $this;
    }

    public function getTitle()
    {
        return $this->title;
    }

    /**
     * @param $service
     * @return $this
     */
    public function setService($service)
    {
        $this->service = $service;
        return $this;
    }

    public function getService()
    {
        return $this->service;
    }

    /**
     * @param string $type doService
     * @return $this
     */
    public function setType($type)
    {
        $this->type = $type;
        return $this;
    }

    /**
     * @return $this
     */
    public function enableCompleteAlive()
    {
        $this->completeAlive = 1;
        return $this;
    }

    /**
     * @return $this
     */
    public function enableFailedAlive()
    {
        $this->failedAlive = 1;
        return $this;
    }

    /**
     * 失败回调
     * @param $failed
     * @return $this
     */
    public function setFailed($failed)
    {
        $this->failed = $failed;
        return $this;
    }

    /**
     * @param null $type
     * @return Api|array|bool
     * @throws ClientExceptionInterface
     * @throws DecodingExceptionInterface
     * @throws RedirectionExceptionInterface
     * @throws ServerExceptionInterface
     * @throws TransportExceptionInterface
     */
    public function createJob($type = null)
    {
        $client = HttpClient::create();
        $server = $this->propertyAccessor->getValue($this->options, '[server]');
        $port = $this->propertyAccessor->getValue($this->options, '[port]');
        $response = $client->request('POST', "{$server}:{$port}/console/job", ['body' => $this->build($type)]);
        if ($response->getStatusCode() == 200) {
            $job = $response->toArray();
            $this->id = $this->propertyAccessor->getValue($job, '[id]', 0);
            return $job;
        } else {
            throw new ApiProblemException(20002012,"创建Job失败");
        }
    }

    /**
     * 创建定时器
     * @param string $schedule
     * @return Api|array|bool
     * @throws ClientExceptionInterface
     * @throws DecodingExceptionInterface
     * @throws RedirectionExceptionInterface
     * @throws ServerExceptionInterface
     * @throws TransportExceptionInterface
     */
    public function createSchedule($schedule)
    {
        return $this->setSchedule($schedule)
            ->createJob('schedule');
    }

    /**
     * @param $schedule
     * @return $this
     */
    public function setSchedule($schedule)
    {
        $this->schedule = $schedule;
        return $this;
    }

    /**
     * @param $progress
     * @return Client
     */
    public function setProgress($progress)
    {
        $this->progress = $progress;
        $this->socket->initialize();
        $data = $this->propertyAccessor->getValue($this->build(), '[data]', []);
        $data = array_merge($data, ['progress' => $progress]);
        return $this->socket->emit('job progress', $data);
    }
}