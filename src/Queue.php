<?php

/**
 * @copyright Copyright (c) 2018 Siu <xiaoguanhai@gmail.com>
 * @author Siu <xiaoguanhai@gmail.com>
 * @since 2020.02.18
 * @link http://www.ddtechs.cn
 */
namespace Siu;

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
    private $propertyAccessor;
    /**
     * @var User
     */
    private $user;
    private $options = [];
    private $timeout = 600;
    private $data = [];
    private $id;
    private $title;
    private $service = [];
    private $type = 'service';
    private $url;
    private $failedAlive = 0;
    private $completeAlive = 0;
    private $job = 0;
    private $progress = 0;
    private $error;
    /**
     * @var Version2X
     */
    private $socket;
    /**
     * 队列失败之后的回调
     * @var array
     */
    private $failed = [];
    /**
     * 队列成功之后的回调
     * @var array
     */
    private $complete = [];
    private $body;
    /**
     * @var array
     */
    private $params;
    private $callable = 'service';

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
        $this->id = uniqid();
    }

    /**
     * 演示
     * @param $data
     * @param Queue $queue
     * @return array
     */
    public function example($data, $queue)
    {
        for($i = 10; $i < 100; $i += 10) {
            sleep(1);
            $queue->setProgress($i);
        }
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
     * @return array
     */
    private function build()
    {
        $this->params = [
            'type' => $this->type,
            'data' => [
                'id' => $this->id,
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
                'job' => [
                    'type' => $this->type,
                    'options' => $this->options,
                    'id' => $this->job,
                ]
            ],
            'options' => $this->options
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
        $this->type = $this->propertyAccessor->getValue($options, '[job][type]', $this->type);
        $this->job = $this->propertyAccessor->getValue($options, '[job][id]', $this->job);
        $this->options = $this->propertyAccessor->getValue($options, '[job][options]', $this->options);
        $this->id = $this->propertyAccessor->getValue($options, '[id]', $this->id);
        $this->title = $this->propertyAccessor->getValue($options, '[title]', $this->title);
        $this->url = $this->propertyAccessor->getValue($options, '[url]', $this->url);
        $this->timeout = $this->propertyAccessor->getValue($options, '[timeout]', $this->timeout);
        $this->service = $this->propertyAccessor->getValue($options, '[service]', $this->service);
        $this->data = $this->propertyAccessor->getValue($options, '[data]', $this->data);
        $this->body = $this->propertyAccessor->getValue($options, '[body]', $this->body);
        $this->callable = $this->propertyAccessor->getValue($options, '[callable]', $this->callable);
        $this->error = $this->propertyAccessor->getValue($options, '[error]', $this->error);
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

    public function getId()
    {
        return $this->id;
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
     * @return Api|array|bool
     * @throws ClientExceptionInterface
     * @throws DecodingExceptionInterface
     * @throws RedirectionExceptionInterface
     * @throws ServerExceptionInterface
     * @throws TransportExceptionInterface
     */
    public function createJob()
    {
        $client = HttpClient::create();
        $server = $this->propertyAccessor->getValue($this->options, '[server]');
        $port = $this->propertyAccessor->getValue($this->options, '[port]');
        $response = $client->request('POST', "{$server}:{$port}/console/job", ['body' => $this->build()]);
        if ($response->getStatusCode() == 200) {
            $job = $response->toArray();
            $this->job = $this->propertyAccessor->getValue($job, '[id]', 0);
            return $job;
        } else {
            throw new ApiProblemException(20002012,"创建Job失败");
        }
    }

    /**
     * @param $progress
     * @return Socket
     */
    public function setProgress($progress)
    {
        $this->progress = $progress;
        $this->socket->initialize();
        $data = $this->propertyAccessor->getValue($this->build(), '[data]', []);
        $data = array_merge($data, ['progress' => $progress]);
        return $this->socket->emit('job progress', $data);
    }

    /**
     * @return mixed|null
     */
    public function getJob()
    {
        return $this->job;
    }
}