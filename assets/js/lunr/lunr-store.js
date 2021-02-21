var store = [{
        "title": "Introduction",
        "excerpt":"Redis 源码阅读与分析。目标版本为5.0.10，即5.0最新的稳定版。6.0及以后的变更考虑以增补形式加入。   约定     Redis 源码内目录约定为redis/src，即xxx.h默认指redis/src/xxx.h；源码内其他文件以完整相对路径表示，如redis/deps/hiredis/hiredis.h；系统头文件以尖括号表示，如&lt;stdio.h&gt;；其他外部文件会指明具体路径；   阐述函数逻辑时以流程图为主，简单函数则说明作用，必要时辅以源码；   引用文件内定义或代码时，使用格式xxx.h:n#func(const int)-&gt;int表示，含义为xxx.h文件中行号n的行为函数func，func有一个类型为const int的形参，返回值类型为int，其中行号:n和函数结构#func(const int)-&gt;int均为可选，同时函数引用中返回值为void时省略-&gt;void；   引用自源码中的说明会贴出原文，指明来源位置，例：            [sds.h:45] Note: sdshdr5 is never used, we just access the flags byte directly. However is here to document the layout of type 5 SDS strings.            名词定义  后续行文会用到一些通过概念或符号，此处统一约定，后续直接使用。      C 风格字符串：指以字符数组和 ACSII 码值0（即空字符）做终止符的字符串；   size_t：C 标准库中用来表示长度的无符号整数类型，一般为unsigned int或unsigned long，与系统实现有关，Redis亦用此表示长度；   ssize_t：即signed size_t，值为非负数时含义与size_t相同，值为负的时含义以各自实现为准；      参考资料     Redis源码（版本5.0.10）   Redis设计与实现   Redis实战  ","categories": ["Redis"],
        "tags": [],
        "url": "/blog/redis/introduction",
        "teaser": null
      },{
        "title": "Simple Dynamic String",
        "excerpt":"Redis 采用名为简单动态字符串（Simple Dynamic String，即 sds）的结构存储字符串或二进制数据。字符串是 Redis 中五大基础数据结构之一，也是 Redis 基础值类型容器。           概述           sds.h: 结构定义、操作函数声明与内联函数定义等     sdsalloc.h: 声明内存分配与回收函数的宏定义     sds.c: 实现      在 Redis 中，键一定是sds对象，sds对象也是值的基本容器，C 风格的字符串仅用于字面值。sds对象依靠sdshdr结构实现，其定义位于sds.h中，其结构以sdshdr5和sdshdr8（其余结构仅header中表示长度的类型不一样）为例可以表示为下图：           sdshdr5             sdshdr8        sdshdr结构有以下特点：     flag域的低三位表示结构体类型（特别的，高五位在sdshdr5中表示长度，其余类型未使用），类型与标志位的定义如下：   1 2 3 4 5 6 7 8 //sds.h:76 #define SDS_TYPE_5  0 //0b000 #define SDS_TYPE_8  1 //0b001 #define SDS_TYPE_16 2 //0b010 #define SDS_TYPE_32 3 //0b011 #define SDS_TYPE_64 4 //0b100 #define SDS_TYPE_MASK 7 //0b111 #define SDS_TYPE_BITS 3      柔性数组buf域的地址作为sds对象地址，内存上与对象头连续，同时相关函数保证buf的最后一位一定有\\0作为终止符，因而可以当做 C 风格字符串使用，可以复用 C 标准库中众多的字符串函数；   len域表示buf数组中最后一个\\0前面的内容长度；   alloc域表示buf数组长度，不包括结尾默认自带的\\0，所以alloc - len = free space；   len域和alloc域使得可以以时间复杂度 O(1) 获取长度和剩余空间等信息，不以\\0为计算标准，保证了二进制安全；   字符串内容有变动时，优先在原对象的缓冲区做拷贝，同时必要时才扩容，大大减少了内存的申请频率；   不同的数据长度使用不同的sdshdr结构，更精准的按需使用内存。   操作  内存管理  sds使用下列函数管理内存     sds.h:266#sds_malloc(size_t)-&gt;void *   void *sds_realloc(void *ptr, size_t size)   void sds_free(void *ptr) 上述函数均委托位于sdsalloc.h中的宏函数实现内存管理，又委托zmalloc.h中的具体定义实现。底层可以为tcmalloc、jemalloc或标准库实现，通过USE_TCMALLOC、USE_JEMALLOC、__APPLE__和__GLIBC__等宏开关控制，具体分析参见章节Redis 内存管理。   sds 对象的定义与 sdshdr 结构的转换  sds对象类型即char *，定义如下：   1 2 //sds.h:43 typedef char *sds;   一般的，sds对象指向sdshdr结构的buf域，因此可以通过下列操作转换为sdshdr结构指针：   1 2 3 //sds.h:83 #define SDS_HDR_VAR(T,s) struct sdshdr##T *sh = (void*)((s)-(sizeof(struct sdshdr##T))); #define SDS_HDR(T,s) ((struct sdshdr##T *)((s)-(sizeof(struct sdshdr##T))))   即将sds对象往前移动sdshdr的结构体大小即可，如下图示：  其中T表示所需sdshdr结构的类型，由需要的内容长度界定（参见sds.c:60#sdsReqType(size_t)-&gt;char）关系如下表：                  内容长度       sds_type       sdshdr 结构       说明                       [0, 32)       SDS_TYPE_5       sdshdr5       32即1&lt;&lt;5，存入flag域高五位。 实际使用中不使用此结构，因为sdshdr5没有alloc域，不能指示剩余空间                 [32, 256)       SDS_TYPE_8       sdshdr8       256即1&lt;&lt;8，所以 header 中长度域类型为uint8                 [256, 65536)       SDS_TYPE_16       sdshdr16       65536即1&lt;&lt;16，所以 header 中长度域类型为uint16                 [65536, 4294967296)       SDS_TYPE_32       sdshdr32       4294967296即1&lt;&lt;32，所以 header 中长度域类型为uint32，特别的，32位系统中最大的类型即为此，由LONG_MAX == LLONG_MAX判断                 大于4294967296       SDS_TYPE_64       sdshdr64       unsigned long long为64位系统中最大整数，header 中长度域类型为uint64           内联函数  sds对象的对象头操作是以内联函数的形式实现，这些内联函数依赖sds对象和sdshdr结构体的转换实现操作，也是sds对象其他操作不可或缺的部分。                  函数       说明                       sds.h:87#sdslen(const sds)-&gt;size_t       获取对象头中len域                 sds.h:104#sdsavail(const sds)-&gt;size_t       获取对象头中剩余空间，即alloc - len                 sds.h:130#sdssetlen(sds, size_t)       设置对象头len域 （特别的，sdshdr5的长度通过位运算设置flag域的高5位，同时此处对len域是否满足alloc域限制并未做校验）                 sds.h:154#sdsinclen(sds, size_t)       指定长度增加len域 （此处对len域是否满足alloc域限制并未做校验）                 sds.h:180#sdsalloc(const sds)-&gt;size_t       获取对象头中alloc域                 sds.h:197#sdssetalloc(sds, size_t)       设置对象头alloc域                 sds.c:44#sdsHdrSize(char)-&gt;size_t       根据 sds_type 获取对象头长度                 sds.c:60#sdsReqType(size_t)-&gt;char       根据内容长度获取合适的 sds_type，参见sds 对象的定义与 sdshdr 结构的转换           sds 对象的创建  sds对象创建几种方式：指定内容和长度创建、由 C 风格字符串创建、由深拷贝其他sds对象和创建空对象，后三种创建方式通过委托第一种方式实现。   指定内容和长度创建sds sdsnewlen(const void *init, size_t initlen)  函数声明位于sds.h:217，函数实现位于sds.c:89，所有创建操作依赖此。实现逻辑如下图示：     A=&gt;start: START B=&gt;operation: 由initlen获取sds_type C=&gt;condition: sys_type为SDS_TYPE_5 D=&gt;operation: 使用sds_type指定为SDS_TYPE_8 E=&gt;operation: 由sds_type获取对象头大小至hdrlen F=&gt;operation: 分配大小为hdrlen+initlen+1的内存空间至sh G=&gt;condition: init内容为SDS_NOINIT H=&gt;operation: init指为NULL I=&gt;condition: init为空 J=&gt;operation: 以0填充sh内容 K=&gt;condition: sh为NULL L=&gt;operation: 获取buf域地址和flag域地址 M=&gt;operation: 设置len域和alloc域为initlen N=&gt;operation: 设置flag域为sds_type O=&gt;condition: initlen&gt;0且init不为NULL P=&gt;operation: init内容copy至buf域中 Q=&gt;operation: 设置buf域最后一位为\\0 ZX=&gt;operation: 返回NULL ZY=&gt;operation: 返回buf域地址 ZZ=&gt;end: END  A-&gt;B-&gt;C C(yes)-&gt;D-&gt;E C(no)-&gt;E-&gt;F-&gt;G G(yes)-&gt;H-&gt;L G(no)-&gt;I I(yes)-&gt;J-&gt;L I(no)-&gt;K K(yes)-&gt;ZX K(no)-&gt;L L-&gt;M-&gt;N-&gt;O O(yes)-&gt;P-&gt;Q O(no)-&gt;Q Q-&gt;ZY-&gt;ZZ ZX-&gt;ZZ     由 C 风格字符串创建sds sdsnew(const char *init)  函数声明位于sds.h:218，函数实现位于sds.c:154。通过&lt;string.h&gt;#strlen(const char *)-&gt;size_t获取字符串长度（NULL则长度为0），委托sdsnewlen实现创建。   深拷贝其他 sds 对象sds sdsdup(const sds s)  函数声明位于sds.h:221，函数实现位于sds.c:169。通过sds.h:87#sdslen(const sds)-&gt;size_t获取字符串长度，委托sdsnewlen实现创建。   创建空对象sds sdsempty(void)  函数声明位于sds.h:219，函数实现位于sds.c:149。指定空字符串字面值\"\"和长度0委托sdsnewlen实现创建。   sds 对象的释放  sds 对象主要通过sds.h:268#sds_free(void *)释放内存空间，最终委托 Redis 内存管理中的 zfree函数实现，也可以直接调用zfree释放内存。详细内容参见章节Redis 内存管理。   sds 对象低层 API  Redis 暴露出来了一些sds对象的底层 API，例如分配空间保证缓冲区不溢出等。sds的 API 实现也或多或少依赖这些函数。   sds sdsMakeRoomFor(sds s, size_t addlen)     [sds.c:198]  Enlarge the free space at the end of the sds string so that the caller is sure that after calling this function can overwrite up to addlen bytes after the end of the string, plus one more byte for nul term. Note: this does not change the length of the sds string as returned by sdslen(), but only the free buffer space we have.    此函数主要作用是在buf域后增加内容时，剩余空间不足以分配addlen时扩充额外空间（并不改变缓冲区已有内容，len域不变），确保缓冲区不溢出。所有往sds对象追加内容的操作前，都应该调用此函数。功能逻辑如图示：     A=&gt;start: START B=&gt;operation: 获取缓冲区当前剩余空间avail C=&gt;operation: 获取当前sds_type D=&gt;condition: avail&gt;=add_len E=&gt;operation: 获取当前缓冲区内容长度len F=&gt;operation: newlen=len+addlen G=&gt;condition: newlen&lt;SDS_MAX_PREALLOC H=&gt;operation: newlen*=2 即申请与内容相同的额外空间 I=&gt;operation: newlen+=SDS_MAX_PREALLOC 即只多申请1MiB的额外空间 J=&gt;operation: 根据newlen计算新sds_type KK=&gt;operation: 根据sds_type计算对象头长度hdrlen K=&gt;condition: sds_type不变 L=&gt;operation: 调用realloc扩容缓冲区大小至 hdrlen+newlen+1 M=&gt;condition: 扩容结果为NULL N=&gt;operation: 置alloc域为newlen O=&gt;operation: 调用malloc申请新空间大小为 hdrlen+newlen+1 P=&gt;condition: 申请新空间为空 Q=&gt;operation: 拷贝原字符串至新地址 R=&gt;operation: 释放原sds对象 S=&gt;operation: 设置sds_type至新对象flag域 T=&gt;operation: 设置len至新对象len域 ZX=&gt;operation: 返回原sds对象地址 ZY=&gt;operation: 返回NULL ZZ=&gt;end: END  A-&gt;B-&gt;C-&gt;D D(yes, right)-&gt;ZX D(no)-&gt;E-&gt;F-&gt;G G(yes, right)-&gt;H-&gt;J G(no)-&gt;I-&gt;J J-&gt;KK-&gt;K K(yes)-&gt;L-&gt;M K(no)-&gt;O-&gt;P M(yes)-&gt;ZY M(no)-&gt;N P(yes, right)-&gt;ZY P(no, bottom)-&gt;Q-&gt;R-&gt;S-&gt;T(left)-&gt;N N(right)-&gt;ZX ZX-&gt;ZZ ZY-&gt;ZZ    注：宏SDS_MAX_PREALLOC定义位于sds.h:36，默认为1024*1024，即1 MiB。本质上即新容量小于1 MiB时直接扩容为所需内存两倍，否则只增加1 MiB。   void sdsIncrLen(sds s, int incr)  此函数主要是sdsMakeRoomFor操作保证容量，再通过其他操作直接向buf域写入内容后，重新调整len域，并与新内容后增加终止符\\0，保证len域值与缓冲区内容一致。同时incr可以为负数，达到 trim 操作的效果。典型用例如下：     [sds.h:321]   Usage example: Using sdsIncrLen() and sdsMakeRoomFor() it is possible to mount the following schema, to cat bytes coming from the kernel to the end of an sds string without copying into an intermediate buffer:     oldlen = sdslen(s); s = sdsMakeRoomFor(s, BUFFER_SIZE); nread = read(fd, s+oldlen, BUFFER_SIZE); … check for nread &lt;= 0 and handle it … sdsIncrLen(s, nread);    本函数实现逻辑与sds.h:154#sdsinclen(sds, size_t)基本一致，只有几点不同：      设置长度前校验缓冲区空间足够增减，以SDS_TYPE_5和SDS_TYPE_8为例，其余类似：   1 2 3 4 5 6 //sds.c:338, SDS_TYPE_5 unsigned char oldlen = SDS_TYPE_5_LEN(flags); assert((incr &gt; 0 &amp;&amp; oldlen+incr &lt; 32) || (incr &lt; 0 &amp;&amp; oldlen &gt;= (unsigned int)(-incr)));  //sds.c:347, SDS_TYPE_8 assert((incr &gt;= 0 &amp;&amp; sh-&gt;alloc-sh-&gt;len &gt;= incr) || (incr &lt; 0 &amp;&amp; sh-&gt;len &gt;= (unsigned int)(-incr)));      缓冲区内容后一位增加终止符\\0。   sds sdsRemoveFreeSpace(sds s)     [sds.h:249]   Reallocate the sds string so that it has no free space at the end. The contained string remains not altered, but next concatenation operations will require a reallocation. After the call, the passed sds string is no longer valid and all the references must be substituted with the new pointer returned by the call.    本函数为回收sds对象缓冲区剩余空间，使缓冲区容量变为当前缓冲区内容长度加上结尾终止符。逻辑与sdsMakeRoomFor基本一致，只有几点不同：     剩余空间不为0时重新分配对象内存，否则返回原对象地址；   sds_type 不变时也要通过realloc操作重新分配内存；   新对象的len域和alloc域均为当前len域加1。   size_t sdsAllocSize(sds s)  获取sds对象背后sdshdr结构完整的大小，包括以下几部分：     对象头；   缓冲区内容；   未使用空间；   结尾隐含的终止符。 实现逻辑即对象头长度+alloc域+1，如下源码所示：   1 2 3 4 5 //sds.c:299#sdsAllocSize(sds)-&gt;size_t size_t sdsAllocSize(sds s) {     size_t alloc = sdsalloc(s);     return sdsHdrSize(s[-1])+alloc+1; }   void *sdsAllocPtr(sds s)  获取sds对象背后sdshdr的地址，效果类似宏函数SDS_HDR，直接通过对象头获取对象头大小并偏移sds对象指针获得。实现如源码所示：   1 2 3 4 //sds.c:306#sdsAllocPtr(sds)-&gt;void * void *sdsAllocPtr(sds s) {     return (void*) (s-sdsHdrSize(s[-1])); }   API清单  sds对象提供了众多操作函数，部分函数与 C 标准库字符串操作函数类似。下述表格列出 API 清单，并简单说明功能，API 顺序以头文件声明顺序为准。   注：调用返回值为sds的函数后，应使用返回值作为新字符串使用，原字符串不应再有任何读写操作。                  函数声明       源码位置       功能简要说明                       sds sdsnewlen(const void *init, size_t initlen);       sds.c:89       指定二进制内容创建                 sds sdsnew(const char *init);       sds.c:154       由 C 风格字符串创建                 sds sdsempty(void);       sds.c:149       创建空对象                 sds sdsdup(const sds s)       sds.c:160       复制字符串（深拷贝）                 void sdsfree(sds s)       sds.c:165       释放对象                 sds sdsgrowzero(sds s, size_t len)       sds.c:379       扩容字符串缓冲区至指定长度                 sds sdscatlen(sds s, const void *t, size_t len)       sds.c:397       追加指定长度的二进制数据                 sds sdscat(sds s, const char *t)       sds.c:412       追加 C 风格字符串                 sds sdscatsds(sds s, const sds t)       sds.c:420       追加sds对象                 sds sdscpylen(sds s, const char *t, size_t len)       sds.c:426       替换为指定长度的字符串                 sds sdscpy(sds s, const char *t)       sds.c:439       替换为 C 风格字符串                 sds sdscatvprintf(sds s, const char *fmt, va_list ap)       sds.c:522       按照格式写字符串入缓冲区（依靠标准库宏vsnprintf实现）                 sds sdscatprintf(sds s, const char *fmt, ...)       sds.c:522       功能同sdscatvprintf，GNU 扩展，增加__attribute__((format(printf, 2, 3)))校验                 sds sdscatfmt(sds s, char const *fmt, ...)       sds.c:600       功能同sdscatvprintf，未以来标准库，直接实现部分格式占位符的支持                 sds sdstrim(sds s, const char *cset)       sds.c:704       从字符串左右两端去除指定的字符                 void sdsrange(sds s, ssize_t start, ssize_t end)       sds.c:735       指定范围截取字符串                 void sdsupdatelen(sds s)       sds.c:184       通过标准库函数strlen计算字符串长度并重新设置                 void sdsclear(sds s)       sds.c:193       字符串首位置\\0并设置长度为0                 int sdscmp(const sds s1, const sds s2)       sds.c:788       比较两个字符串，相等条件为长度相同且内容一致 （通过&lt;string.h&gt;#memcmp(const void *, const void *, size_t)-&gt;int比较内容）                 sds *sdssplitlen(const char *s, ssize_t len, const char *sep, int seplen, int *count);       sds.c:816       以子串sep为分割符分隔字符串(C 风格字符串和sds均可)，返回sds数组和长度，以len为原字符串长度保证二进制安全                 void sdsfreesplitres(sds *tokens, int count)       sds.c:867       释放字符串数组空间                 void sdstolower(sds s)       sds.c:764       字符串内英文字母变小写                 void sdstoupper(sds s)       sds.c:771       字符串内英文字母变大写                 sds sdsfromlonglong(long long value)       sds.c:514       整数转字符串                 sds sdscatrepr(sds s, const char *p, size_t len)       sds.c:880       将字符串中不可打印字符转换并显示 如\\t转为\\\\t，U+000A转换为\\x0A                 sds *sdssplitargs(const char *line, int *argc)       sds.c:955       通过空白分割符将字符串转换为 token 数组                 sds sdsmapchars(sds s, const char *from, const char *to, size_t setlen)       sds.c:1074       转换字符串中的字符 如from为 AB，to为CD时表示 字符串中 A 替换为 C，B 替换为 D                 sds sdsjoin(char **argv, int argc, char *sep)       sds.c:1090       将 C 风格字符串数组通过指定分割符合成一个字符串                 sds sdsjoinsds(sds *argv, int argc, const char *sep, size_t seplen)       sds.c:1102       将sds数组通过指定分割符合成一个字符串           参考     antirez/sds   Redis源码（版本5.0.10）   Redis设计与实现   ","categories": ["Redis"],
        "tags": [],
        "url": "/blog/redis/sds",
        "teaser": null
      },{
        "title": "Doubly Linked List",
        "excerpt":"链表是线性表的一种实现，在 Redis 中也是列表类型的底层实现之一。C 标准库没有内建的链表类型，所以 Redis 自己实现了一个泛型双向链表。由于链表的操作和结构有广泛的认识基础，本文仅做简单说明。   概述           adlist.h     adlist.c      Redis 中的链表是一个带头节点的双向链表，同时头节点还有指向尾部的指针域。结构如图示：      同时 Redis 中还定义了一个迭代器，指向链表中的一个节点并且标识出来迭代方向。定义如下：   1 2 3 4 5 6 7 8 9 10 //adlist.h:42 typedef struct listIter {     listNode *next;     int direction; } listIter;  //adlist.h:92 /* Directions for iterators */ #define AL_START_HEAD 0 #define AL_START_TAIL 1   有结构可知，除了双向链表固有的特点之外，Redis 的双向链表还有以下特点：     有固定的头节点；   头节点保存链表的长度；   无环且头节点有指向头节点和尾节点的域；   提供了三个函数指针，用于链表节点的复制、释放和比较，由调用方根据存储的数据类型自行实现。   操作  内存管理  Reids 链表主要依赖底层内存管理实现，具体分析参见章节Redis 内存管理。比较特别的是，链表头存储了节点内存释放的函数指针，需要调用方自行实现。   宏函数  链表操作的宏函数主要以取结构中某些字段为主，逻辑简单，仅贴上源码，顾名思义即可。   1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 //adlist.h:56 /* Functions implemented as macros */ #define listLength(l) ((l)-&gt;len) #define listFirst(l) ((l)-&gt;head) #define listLast(l) ((l)-&gt;tail) #define listPrevNode(n) ((n)-&gt;prev) #define listNextNode(n) ((n)-&gt;next) #define listNodeValue(n) ((n)-&gt;value)  #define listSetDupMethod(l,m) ((l)-&gt;dup = (m)) #define listSetFreeMethod(l,m) ((l)-&gt;free = (m)) #define listSetMatchMethod(l,m) ((l)-&gt;match = (m))  #define listGetDupMethod(l) ((l)-&gt;dup) #define listGetFree(l) ((l)-&gt;free) #define listGetMatchMethod(l) ((l)-&gt;match)   链表的 CRUD   创建adlist.c:41#listCreate(void)-&gt;list *  创建链表实质上是初始化一个空的头节点，申请头节点内存并将所有域置为NULL，长度设置为0。特别的，内存申请失败后返回的头节点地址为NULL。   复制adlist.c:250#listDup(list *)-&gt;list *  复制链表依赖链表创建和链表迭代器。特别的，链表节点的复制依赖头节点的dup域，可以实现多态下的节点值深拷贝。   节点插入  链表增加节点分为头插、尾插和给定节点前后插入值，具体逻辑不赘述，仅列出实现的函数。      adlist.c:88#listAddNodeHead(list *, void *)-&gt;list *   adlist.c:114#listAddNodeTail(list *, void *)-&gt;list *   adlist.c:134#listInsertNode(list *, listNode *, void *, int)-&gt;list *            本函数做简单额外说明。形参的最后一个用作 bool 值，表示插入方向。           上述函数均以返回值作为链表头节点，原头节点不应有任何读写操作。如果返回值为NULL，则表明内存操作返回为空，应该以操作失败处理。   节点的删除与内容清空  逻辑简单不赘述，仅列出函数。特别的，如果头节点free域有值，则可以实现调用方自行析构节点。      adlist.c:167#listDelNode(list *, listNode *)   adlist.c:56#listEmpty(list *)   遍历  Redis 的双向链表提供了迭代器形式的遍历，支持从头节点或尾节点的双向遍历。   链表的释放adlist.c:76#listRelease(list *)  先清空链表（即释放所有节点），再释放头节点。   API汇总   注：调用返回值类型为list的函数后，应使用返回值作为新链表使用，原链表不应再有任何读写操作。   注2：复杂度中的问题规模 N 表示链表的节点数量                  函数声明       源码位置       功能简要说明       时间复杂度                       list *listCreate(void)       adlist.c:41       初始化空的头节点       O(1)                 void listRelease(list *list)       adlist.c:76       释放链表所有节点（包括头节点）       O(N)                 void listEmpty(list *list)       adlist.c:56       释放链表所有节点（头节点除外）       O(N)                 list *listAddNodeHead(list *list, void *value)       adlist.c:88       头插节点       O(1)                 list *listAddNodeTail(list *list, void *value)       adlist.c:114       尾插节点       O(1)                 list *listInsertNode(list *list, listNode *old_node, void *value, int after)       adlist.c:134       指定节点（未校验节点是否属于链表）前或后插入       O(1)                 void listDelNode(list *list, listNode *node)       adlist.c:167       删除指定节点（未校验节点是否属于链表）       O(1)                 listIter *listGetIterator(list *list, int direction)       adlist.c:186       指定方向获取链表迭代器       O(1)                 listNode *listNext(listIter *iter)       adlist.c:229       获取迭代器下一个指向的节点（空值表示迭代结束）       O(1)                 void listReleaseIterator(listIter *iter)       adlist.c:200       释放迭代器       O(1)                 list *listDup(list *orig)       adlist.c:250       复制链表       O(N)                 listNode *listSearchKey(list *list, void *key)       adlist.c:290       列表中查找指定值（值比较可以由调用方自定义）的节点，未找到时返回空       O(N)                 listNode *listIndex(list *list, long index)       adlist.c:315       指定索引（起点为0，负数表示从尾节点向前）查找链表节点，未找到时返回空       O(N)                 void listRewind(list *list, listIter *li)       adlist.c:205       初始化正向迭代器       O(1)                 void listRewindTail(list *list, listIter *li)       adlist.c:210       初始化逆向迭代器       O(1)                 void listRotateTailToHead(list *list)       adlist.c:330       尾节点变头节点       O(1)                 void listRotateHeadToTail(list *list)       adlist.c:345       头节点变尾节点       O(1)                 void listJoin(list *l, list *o)       adlist.c:361       链表追加（操作后 o 依然是有效的头节点，只是节点为空长度为0）       O(1)           参考     Redis源码（版本5.0.10）   Redis设计与实现  ","categories": ["Redis"],
        "tags": [],
        "url": "/blog/redis/adlist",
        "teaser": null
      }]
