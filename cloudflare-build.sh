#!/bin/bash
# 执行正常构建
npm run build

# 删除缓存目录以避免大小限制问题
rm -rf .next/cache

# 成功退出
exit 0 