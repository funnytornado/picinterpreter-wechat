# 常用语与整句查看：评审证据

日期：2026-10-27。范围：小程序常用语管理、整句查看的现有字号、换行、缺图显示及搜索空结果提示。没有修改分词、匹配、人物身份、播报、计数、存储或同步逻辑。

## 基线与环境

- 小程序上游：`lightcoloror/picinterpreter-wechat`，目标 `feature/patient-collaboration`，基线 `8d19c26ae3963ec77bcbf9528147bac5b47a2b3f`；2026-10-27提交前重新fetch，仍为该SHA。
- 相邻只读CBoard：`lightcoloror/cboard`，`feature/tuyujia-mvp`，`c770abbc8c6887d0aa45351ee77cb700768e9c28`。
- Windows、Node 22.14.0、Yarn 1.22.22、微信开发者工具2.02.2608080、官方工具skill 0.3.11、模拟器基础库3.17.5。
- 环境修复独立分支：`work/url-parse-lock`（`9a7300d`）。UI发布分支从上游重新挑选UI提交；与已验收的本地`cbad687`业务源码逐字相同，差异仅为未包含该锁文件修复，以及后补评审材料。
- 构建使用development设置，API地址为空，云、AI、在线图符、OCR、方言ASR及家庭协作开关均关闭。没有以真实账号资料、私人照片或付费模型进行验证；未对网络做抓包级零请求证明。

## 修改前后

| 问题 | 修改前证据 | 修改后结果 |
| --- | --- | --- |
| 大字号列表与操作 | 390px最大字号下正文14px、查看按钮9px及36×28px | 375px最大字号正文/按钮18px，按钮88×44px；按现有字号切换，操作换行 |
| 整句与长标签 | 390px最大字号下整句19px，图卡长标签省略 | 375px最大字号整句28px，完整长标签换行，长句和返回操作可达 |
| 列表缺图说明 | 768px缺图容器55px、内部提示约67px，新增布局断言在旧产物失败 | 容器随文字增高；375/768默认与最大字号下垂直边界断言通过 |
| 整句缺图宽度 | 窄屏规则中固定110px覆盖100%宽度 | 去掉重复覆盖，占位使用图卡可用宽度 |
| 搜索无结果 | 有8条常用语，搜索不匹配时仍提示情境为空 | 区分搜索无结果、情境为空、整个库为空；清空搜索恢复8条 |

截图全部来自隔离工程的合成资料，保持原图。**修改前为390px早期基线，修改后为375/768px最终复验，字号/对比度和缩放并非完全相同，不能作为同尺寸像素差分。**

| 场景 | 修改前 | 修改后 |
| --- | --- | --- |
| 列表与缺图 | [390px基线](phrase-readability-evidence/before-list-390.jpg) | [375px最大字号](phrase-readability-evidence/after-list-375-max.jpg)、[768px最大字号](phrase-readability-evidence/after-list-768-max.jpg) |
| 整句与长标签 | [390px最大字号基线](phrase-readability-evidence/before-overlay-390.jpg) | [375px最大字号](phrase-readability-evidence/after-overlay-375-max.jpg)、[768px滚动至返回](phrase-readability-evidence/after-overlay-768-end.jpg) |
| 纯文字 | 不涉及图片替换 | [375px纯文字整句](phrase-readability-evidence/pure-text-375.jpg) |

## 行为验收结果与边界

| 要求 | 实测结果 | 证据类型及边界 |
| --- | --- | --- |
| 纯文字条目 | “请帮我把窗户打开一点。”完整显示，图卡数量0，可关闭 | 组件测试及375px快捷入口补验；历史375/768管理流程亦包含该条目 |
| 查看不自动播报 | 查看/关闭的源码回调不启动播放；整句组件渲染不调用onReplay | 7项回调测试及组件测试；没有声学录音检测，主动点击播报不在“静默查看”断言内 |
| 查看不计次 | 查看流程前后常用语文件字节一致，包括usageCount；回调没有调用使用计数 | 管理流程和新增6次快捷入口查看/关闭均核对；没有改计数逻辑 |
| 不改顶部输出 | 快捷入口查看中和关闭后，顶部表达区域仍为“还没有选择图片”；表达/草稿文件字节一致 | 本轮屏幕级补验使用空表达。已有内容的表达屏幕级场景未额外布置，不能把空表达测试说成覆盖所有表达状态 |
| 连续切换与关闭 | 管理页9次跨条目查看/关闭，每次核对当前句子和浮层移除；本轮另有6次快捷入口交替查看/关闭 | 官方自动化顺序调用，不等同于固定毫秒频率的连点压力测试；取消播放后的迟到回调另有单测覆盖 |
| 返回保留筛选 | 情境+搜索后查看长句，关闭后筛选结果及搜索词保留 | 375/768管理流程 |
| 特殊图卡与后续条目 | 重复图卡保留2张；同名人物保留不同ID及橙圆/蓝方；快捷6条经查看全部到达第7/8条 | 合成资料模拟器与组件测试，未改身份/匹配逻辑 |

## 实跑命令与结果

以下命令在相邻CBoard已安装、项目依赖已准备后运行；`<隔离工程绝对路径>`替代本机路径，不提交测试profile或原始日志。

```powershell
node node_modules/vitest/vitest.mjs run src/features/communication/receiverSession.test.ts src/features/communication/receiverPeople.test.ts src/features/communication/PhrasePlaybackOverlay.test.ts src/features/communication/management.test.ts
node --test scripts/saved-phrase-use-callbacks.test.cjs
npm run typecheck
node node_modules/eslint/bin/eslint.js src/features/communication/SavedPhraseManager.tsx src/features/communication/PhrasePlaybackOverlay.test.ts
npm run check:boundary
npm run check:boards
```

2026-10-27在UI发布分支实跑：4个Vitest文件/45项通过；回调7项通过；typecheck、目标lint通过；边界检查321 app / 32 core，通过；图板46 boards / 892 tiles / 818 images，通过。

同日已验收的相同业务源码执行过 `npm run build:weapp`，prebuild、build、postbuild通过；分支拆分仅去掉锁描述符修复，未改业务源码或重新冒称构建了一份不同产品。完整`npm test`及其posttest没有作为本次全套运行，不能写全库测试全绿。原全库`npm run lint`基线49 errors / 6 warnings保留。

分别选择真实375×603和768×960、默认/最大字号后，布局子脚本实跑如下；本轮第二次检查使用高对比度，前一阶段另有普通对比度证据：

```powershell
node scripts/weapp-readability-check.mjs '<隔离工程绝对路径>' list
# 从列表打开合成长句后：
node scripts/weapp-readability-check.mjs '<隔离工程绝对路径>' overlay
```

上述脚本只读当前页面，8条合成常用语需先在隔离工程中准备；返回、筛选和存储前后比较由本地验收辅助脚本完成。源码库未包含本机辅助工具、测试存储或原始日志。完整阶段记录见[可读性验收](phrase-readability-check.md)。

## 未解决事项与回退

- fullMode启动曾短暂出现标题可见、主体空白，同时记录`routeDone with a webviewId 9 is not found`，随后没有刷新即恢复。尚未定位根因，不能证明与UI修复有因果关系，未改启动逻辑；单列给维护者判断。
- 真机未测，首批协作说明不安排手机真机。构建仍有既有包体积建议提示，未做上传预览、正式性能扫描或发布。
- 无数据迁移；回退本PR的UI/测试提交即可恢复显示行为。锁文件PR可以单独合并或回退，建议先合并环境修复，便于干净检出使用冻结锁文件安装。
- 本轮等待维护者审核与合并，再安排下一项任务。
