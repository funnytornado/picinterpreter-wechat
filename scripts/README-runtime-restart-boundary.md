# 小程序表达草稿：开发者工具关项目重开验收

记录：2026-10-21，Codex（运行时具体型号未独立核验）。

## 适用范围与原因

当前安装版本的微信开发者工具源码显示：模拟器存储先在内存更新，磁盘保存存在 **10,000 ms 防抖**；即时保存调用本身也不等于磁盘写入已经完成。`close_project_window` 回执早于真正的 `native-window-closed`，立即调用打开还可能复用旧窗口。证据归档在工作区 `outputs/tuyujia-mini-draft-close-reopen-20261021/`。这些是当前安装版本的实现证据，不能推广为所有 IDE 或手机系统的固定行为。

因此，`wx.setStorageSync → getStorageSync` 相等只能证明当时可读，不能单独证明关项目后恢复。使用 `weapp_runtime_restart_boundary.py` 作为验收边界；**不要用固定 sleep 代替落盘证明，也不要因此增加产品第二套存储、重复写入或修改 IDE 安装包。**

该修正不保证“显示已保存后立即强制关窗、结束进程也永不丢数据”，也不等同于手机杀进程验证。立即关闭的失败记录必须保留并与正常完成落盘后的重开结果分开报告。

## 受控流程

1. 先按现有验收夹具备份用户会话，使用明确的 `communication-v2:offline:synthetic-…:synthetic-…:` 范围、合成图片，阻断真实 AI 和网络。保存要测试的草稿，记录实际打开回执中的窗口 ID。
2. 入口只读取该范围的表达草稿，创建范围内 `close-open-proof` 哨兵；同名哨兵已存在时拒绝覆盖，必须先依据上次记录核对所有权并清理。
3. 只读检查当前项目对应的磁盘分区及明确 namespace（本轮为 `0`）。草稿和哨兵的哈希必须与运行时相同，并在 **同一文件身份连续两次检查** 中相同。检查之间有轮询间隔；分区不唯一、错误 namespace、部分写入、内容变化或超时均不继续关窗。
4. 再次核对运行时内容未变后，记录关闭起点并关闭项目。只接受该窗口、起点之后的 `native-window-closed` 日志；日志延迟时等待。取消关闭或超时则停止，不能自动重新打开、关闭或刷新补救。
5. 使用 `fullMode` 打开，要求回执为 `type: newopen`。后台执行，不调用聚焦或持续置顶。`fullMode` 只规定项目窗口模式，本身不是后台或不置顶的保证。
6. 绑定当前页面超时只允许一次只读重试，**不调用 `simulator_refresh`**。重开后必须验证旧 JavaScript 哨兵消失、持久哨兵相同、草稿哈希相同，再主动继续并检查内容。绑定调用开始和超时会及时输出进度。
7. 最后按现有夹具逐值恢复用户会话，仅清理自己拥有的合成范围和替身。公共证据只留哈希、状态与合成内容，不能输出用户存储值、私密路径或照片。

## 入口与示例

共用边界：`scripts/weapp_runtime_restart_boundary.py`。离线测试：`scripts/test_weapp_runtime_restart_boundary.py`。现有项目验收入口已复用该模块：

```powershell
# 在工作区 D:/used-by-codex 下执行；先完成 wechatide 技能要求的工具检查。
# s0 必须替换为本次实际 open 回执的窗口 ID，不能猜测。
python -B outputs/tuyujia-expression-draft-20261020/mini-runtime-restart.py `
  --project D:/used-by-codex/fork-cboard/cboard-wechat-poc/dist-local-20261021-expression-draft-v2 `
  --mode close-open `
  --synthetic-scope-prefix communication-v2:offline:synthetic-close-family:synthetic-close-profile: `
  --window-id s0 `
  --storage-namespace 0 `
  --evidence-root D:/used-by-codex/outputs/tuyujia-mini-draft-close-reopen-20261021 `
  --output unique-close-open-evidence.json
```

证据文件名必须新建，不覆盖历史记录。旧 `refresh` 模式保留原调用约定，但仅能证明运行环境刷新，不能作为关项目重开结果。

## 离线故障验收

```powershell
# 在 cboard-wechat-poc 目录内；不调用 IDE、网络或模型。
python -B -m unittest discover -s scripts -p test_weapp_runtime_restart_boundary.py -v
```

覆盖延迟落盘、两次稳定读回、分区切换、错误 namespace、部分 JSON 写入、关窗日志延迟、取消与超时、旧窗口复用、内容中途变化及绑定重试次数。临时文件夹测试需允许创建与清理该测试的临时目录；临时目录 ACL 拒绝是执行环境错误，不能计为逻辑测试通过，也不应跨 shell 删除目录。

## 变更说明

- **意图**：避免把模拟器内存读回和窗口操作成功误认为可靠的关项目恢复。
- **决策**：复用原验收入口，只增加明确合成范围的磁盘与窗口边界检查和离线故障测试。
- **理由**：当前 IDE 的延迟写盘及关闭回执时序可以解释上轮证据缺口；产品仓储的版本检查没有发现修订倒退路径。
- **证据**：本轮安装包只读诊断、合成范围即时关闭与等待落盘对照、边界单测及实际重开回执。最终通过状态以阶段 JSON 为准。
- **生效范围**：开发者工具自动验收脚本；不修改产品存储、已发布产物、账号、模型配置或照片权限。
