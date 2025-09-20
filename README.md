# 云收发 - 项目入口说明（精简）

本仓库的所有文档已统一收敛为两份精要文档，根目录 README 仅作为导航入口，保持仓库简洁稳定。

文档入口
- 项目介绍（精简版）：docs/README.md
- 项目规则（精简版）：docs/rules.md

如何开始
- 请首先阅读 docs/README.md，按其中“快速开始”完成环境配置、云函数部署与本地联调
- 开发与排障过程中，请严格遵循 docs/rules.md 的约定（多租户 orgId 传递与校验、状态过滤、统一响应结构、最小权限等）

目录指引（核心）
- miniprogram/ 小程序前端
- cloudfunctions/ 云函数后端（api、auth、upload、statements 等）
- admin/ 与 web/ 管理端与静态站点
- docs/ 文档目录（仅保留 README.md 与 rules.md）

变更说明
- 2025-09-20：精简文档体系，仅保留项目介绍与规则两份文档，其余合并删除

说明
- 详细内容与规范以 docs/ 目录为准；如遇到与旧版文档不一致的地方，以 docs/rules.md 为最终解释
- 如需扩展新的专题文档，建议先在 rules.md 增补章节，确认稳定后再是否拆分附录