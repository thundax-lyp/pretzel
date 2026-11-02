# 管理认证与权限契约

## 当前 HTTP 协议

管理接口前缀为 /pretzel-admin-api/api。请求携带 Access-Token，不能使用前端按钮是否显示作为后端授权依据。

成功业务码为 COMMON-00000。未认证与禁止访问等业务失败可能采用 HTTP 200 返回，调用方必须同时检查业务码。COMMON-00002 表示未认证，COMMON-00003 表示无权访问。

登录前调用 /auth/session/pre-auth-session/request 取得登录上下文及密码加密公钥；客户端按现有服务契约进行验证码与 SM2 密码传输，不发送明文密码。

取得令牌后必须成功加载当前用户权限才能完成登录会话建立。权限加载失败清除令牌和权限。/sys/current-user/permission/list 提供权限集合，/sys/current-user/menu/list 提供可见菜单。

令牌清理同时清理权限。刷新、退出、用户禁用和角色撤权需保持服务端会话与客户端状态一致。

## 代码归属

admin-web/src/api/http.ts 统一解释业务响应和处理网络；src/auth 保存认证协议与令牌、权限存储；src/session 编排登录后权限加载及当前用户信息；业务页面不直接调用 fetch。
