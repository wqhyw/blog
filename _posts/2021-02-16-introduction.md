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

# 名词定义
后续行文会用到一些通过概念或符号，此处统一约定，后续直接使用。

1. **C 风格字符串**：指以字符数组和 ACSII 码值0（即空字符）做终止符的字符串；
2. **size_t**：C 标准库中用来表示长度的无符号整数类型，一般为`unsigned int`或`unsigned long`，与系统实现有关，Redis亦用此表示长度；
3. **ssize_t**：即**signed size_t**，值为非负数时含义与*size_t*相同，值为负的时含义以各自实现为准；
4. 


# 参考资料
- [Redis源码（版本5.0.10）](https://github.com/redis/redis/tree/5.0.10)
- [Redis设计与实现](http://shuyuan.hzmedia.com.cn/ebookdtl?id=11112416)
- [Redis实战](https://book.douban.com/subject/26612779)
