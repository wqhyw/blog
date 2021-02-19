---
layout: single
title: Dict(Hash Table)
categories: Redis
classes: wide
sidebar:
    nav: "side-nav"
---

Redis 中哈希表是键-值对类型的底层实现。可以自动扩容，并且采用拉链法解决哈希碰撞。

# 概述
> - dict.h
> - dict.c


[![dict]({{ site.baseurl }}/assets/img/dict.png)]({{ site.baseurl }}/assets/img/dict.png)


# 参考
- [Redis源码（版本5.0.10）](https://github.com/redis/redis/tree/5.0.10)
- [Redis设计与实现](http://shuyuan.hzmedia.com.cn/ebookdtl?id=11112416)
