毛衣收发管理小程序
这是一个用于毛衣加工行业的小程序，帮助管理货品、工厂、发出单、收回单、流水表和对账单等功能。本文档将指导你（零代码基础用户）如何设置和测试小程序。
文件结构

miniprogram/：微信小程序前端代码
server/：后端代码（Node.js + Express + MongoDB）

环境准备

安装微信开发者工具：

下载并安装微信开发者工具。
登录你的微信账号。


安装Node.js：

下载并安装Node.js（选择LTS版本）。


安装MongoDB：

下载并安装MongoDB Community Server。
启动MongoDB：
Windows：在命令提示符运行 mongod。
Mac/Linux：在终端运行 sudo mongod。





设置和运行
1. 运行后端

打开终端（Windows用CMD或PowerShell，Mac用Terminal）。

进入 server 文件夹：
cd 你的文件夹路径/processing-app/server


安装依赖：
npm install


启动后端：
node index.js


看到 Server running on port 3000 表示后端启动成功。


2. 运行前端

打开微信开发者工具。
点击“小程序” -> “导入项目”。
项目目录选择 processing-app/miniprogram 文件夹。
AppID 填入你的小程序AppID（如果没有，可用测试号）。
点击“预览”，用微信扫描二维码即可测试。

测试步骤

登录：

打开小程序，进入登录页面。
输入以下信息登录：
组织ID：org1，用户名：admin1，密码：123456
或 组织ID：org2，用户名：admin2，密码：123456




首页：

查看今日发出和收回统计。
切换“发出单”和“收回单”标签，查看单据列表。
点击“筛选”按钮，按日期、工厂名或单据号筛选单据。
左右滑动单据，点击“作废”可隐藏单据。


新增发出单：

点击首页



