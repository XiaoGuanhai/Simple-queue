<?php
/**
 * @copyright Copyright (c) 2018 Siu <xiaoguanhai@gmail.com>
 * @author Siu <xiaoguanhai@gmail.com>
 * @since 2020.02.18
 * @link http://www.ddtechs.cn
 */
namespace Siu;
class QueueException extends \Exception implements QueueExceptionInterface
{
    private $data;
    /**
     * @var int
     */
    private $throwableCode;

    /**
     * 初始化
     * @param int $throwableCode 错误代码
     * @param string|null $message 提示信息
     * @param array $data 其他数据
     */
    public function __construct(int $throwableCode, string $message = null, array $data = [])
    {
        $this->data = $data;
        $this->throwableCode = $throwableCode;
        parent::__construct($message, 0);
    }

    /**
     * 其他数据
     * @return array
     */
    public function getData()
    {
        return $this->data;
    }

    /**
     * 异常代码
     * @return int
     */
    public function getThrowableCode()
    {
        return $this->throwableCode;
    }
}