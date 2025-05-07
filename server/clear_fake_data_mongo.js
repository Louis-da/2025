// 清除org1组织的假数据命令
// 使用方法：在MongoDB Shell中运行以下命令

// 切换到processing_app数据库
use processing_app

// 删除货品假数据
db.products.deleteMany({ orgId: "org1" })

// 删除工序假数据
db.processes.deleteMany({ orgId: "org1" })

// 检查清除结果
db.products.countDocuments({ orgId: "org1" })
db.processes.countDocuments({ orgId: "org1" }) 