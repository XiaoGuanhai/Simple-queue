<?php
/**
 * @copyright Copyright (c) 2018 Siu <xiaoguanhai@gmail.com>
 * @author Siu <xiaoguanhai@gmail.com>
 * @since 2020.02.18
 * @link http://www.ddtechs.cn
 */
namespace Siu;
interface QueueExceptionInterface extends \Throwable
{
    public function getData();
}