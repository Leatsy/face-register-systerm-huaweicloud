# Debug Session: mobile-register-html
- **Status**: [OPEN]
- **Issue**: 手机端注册时返回 HTML 导致前端报 `Unexpected token '<'`，同时更新标准照片成功文案过时
- **Debug Server**: http://172.19.21.113:7777/event
- **Log File**: .dbg/trae-debug-log-mobile-register-html.ndjson

## Reproduction Steps
1. 在已部署到云服务器的移动端页面进入注册页。
2. 使用手机拍照上传标准人脸照片并提交注册。
3. 观察前端提示为 `Unexpected token '<'`，注册失败。
4. 在电脑端或本地环境下，同样的注册流程可以成功。
5. 在个人信息页更新标准照片，观察顶部提示文案。

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | 手机端拍照上传触发了代理层 HTML 错误页，前端仍按 JSON 解析 | High | Low | Pending |
| B | 手机端图片格式或体积导致后端异常，响应被代理改写为 HTML | High | Med | Pending |
| C | 手机端注册请求被错误回退到静态站点，拿到了 `index.html` | Med | Low | Pending |
| D | 前端 `requestJson()` 缺少非 JSON 响应兜底，掩盖了真实错误 | High | Low | Pending |
| E | 更新标准照片接口成功文案是旧文本残留 | High | Low | Pending |

## Log Evidence
- Debug Server running at `http://172.19.21.113:7777/event`

## Verification Conclusion
- Pending
