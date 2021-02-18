---
layout: single
title: Introduction
categories: Redis
sidebar:
    nav: "side-nav"
---

Redis 源码阅读与分析。目标版本为5.0.10，即5.0最新的稳定版。6.0及以后的变更考虑以增补形式加入。

# 约定
1. Redis 源码内目录约定为`redis/src`，即`xxx.h`默认指`redis/src/xxx.h`；源码内其他文件以完整相对路径表示，如`redis/deps/hiredis/hiredis.h`；系统头文件以尖括号表示，如`<stdio.h>`；其他外部文件会指明具体路径；
2. 阐述函数逻辑时以流程图为主，简单函数则说明作用，必要时辅以源码；
3. 引用文件内定义或代码时，使用格式`xxx.h:n#func(const int)->int`表示，含义为**xxx.h文件中行号n的行为函数func，func有一个类型为const int的形参，返回值类型为int**，其中行号`:n`和函数结构`#func(const int)->int`均为可选，同时函数引用中返回值为`void`时省略`->void`；
4. 引用自源码中的说明会贴出原文，指明来源位置，例：
> [sds.h:45]<br />Note: sdshdr5 is never used, we just access the flags byte directly. However is here to document the layout of type 5 SDS strings.


# 参考资料
- [Redis源码（版本5.0.10）](https://github.com/redis/redis/tree/5.0.10)
- [Redis设计与实现](http://shuyuan.hzmedia.com.cn/ebookdtl?id=11112416)
- [Redis实战](https://book.douban.com/subject/26612779)
