/**
 * 用户会话清理定时任务
 * 定期清理过期的用户会话记录，维护数据库性能
 * 
 * @author 云收发开发团队
 * @version 3.0.0
 * @since 2024-12-19
 */

const db = require('../db');

/**
 * 清理过期会话
 * 将超过指定时间未活跃的会话标记为非活跃状态
 * 
 * @param {number} hoursThreshold 小时阈值，默认2小时
 */
async function cleanupExpiredSessions(hoursThreshold = 2) {
  try {
    console.log(`[SessionCleanup] 开始清理 ${hoursThreshold} 小时未活跃的会话...`);
    
    // 清理过期会话：将长时间未活跃的会话标记为非活跃
    const result = await db.executeQuery(
      `UPDATE user_sessions 
       SET is_active = 0 
       WHERE is_active = 1 
       AND last_activity < DATE_SUB(NOW(), INTERVAL ? HOUR)`,
      [hoursThreshold]
    );
    
    console.log(`[SessionCleanup] 清理完成，共清理 ${result.affectedRows} 个过期会话`);
    
    // 统计当前活跃会话数量
    const [activeCount] = await db.executeQuery(
      'SELECT COUNT(*) as count FROM user_sessions WHERE is_active = 1'
    );
    
    console.log(`[SessionCleanup] 当前活跃会话数量: ${activeCount.count}`);
    
    return result.affectedRows;
  } catch (error) {
    console.error('[SessionCleanup] 会话清理失败:', error);
    throw error;
  }
}

/**
 * 删除旧的会话记录
 * 删除超过指定天数的会话记录，节省存储空间
 * 
 * @param {number} daysThreshold 天数阈值，默认30天
 */
async function deleteOldSessions(daysThreshold = 30) {
  try {
    console.log(`[SessionCleanup] 开始删除 ${daysThreshold} 天前的会话记录...`);
    
    // 删除旧的会话记录
    const result = await db.executeQuery(
      `DELETE FROM user_sessions 
       WHERE login_time < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [daysThreshold]
    );
    
    console.log(`[SessionCleanup] 删除完成，共删除 ${result.affectedRows} 条旧会话记录`);
    
    return result.affectedRows;
  } catch (error) {
    console.error('[SessionCleanup] 删除旧会话记录失败:', error);
    throw error;
  }
}

/**
 * 获取会话统计信息
 */
async function getSessionStats() {
  try {
    // 获取活跃会话统计
    const [activeStats] = await db.executeQuery(`
      SELECT 
        COUNT(*) as total_active,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(CASE WHEN platform = 'miniprogram' THEN 1 END) as miniprogram_sessions,
        COUNT(CASE WHEN platform = 'web' THEN 1 END) as web_sessions,
        COUNT(CASE WHEN platform = 'admin' THEN 1 END) as admin_sessions
      FROM user_sessions 
      WHERE is_active = 1
    `);
    
    // 获取今日登录统计
    const [todayStats] = await db.executeQuery(`
      SELECT COUNT(*) as today_logins
      FROM user_sessions 
      WHERE DATE(login_time) = CURDATE()
    `);
    
    return {
      activeStats,
      todayLogins: todayStats.today_logins,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[SessionCleanup] 获取会话统计失败:', error);
    return null;
  }
}

/**
 * 启动定时清理任务
 */
function startCleanupSchedule() {
  // 每小时清理过期会话
  setInterval(async () => {
    try {
      await cleanupExpiredSessions(2); // 清理2小时未活跃的会话
    } catch (error) {
      console.error('[SessionCleanup] 定时清理失败:', error);
    }
  }, 60 * 60 * 1000); // 1小时

  // 每天凌晨2点删除旧会话记录
  setInterval(async () => {
    const now = new Date();
    if (now.getHours() === 2 && now.getMinutes() === 0) {
      try {
        await deleteOldSessions(30); // 删除30天前的记录
        
        // 打印统计信息
        const stats = await getSessionStats();
        if (stats) {
          console.log('[SessionCleanup] 当前会话统计:', stats);
        }
      } catch (error) {
        console.error('[SessionCleanup] 定时删除失败:', error);
      }
    }
  }, 60 * 1000); // 每分钟检查一次时间

  console.log('[SessionCleanup] 定时清理任务已启动');
}

module.exports = {
  cleanupExpiredSessions,
  deleteOldSessions,
  getSessionStats,
  startCleanupSchedule
}; 