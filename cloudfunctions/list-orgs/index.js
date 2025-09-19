const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  try {
    console.log('Listing all organizations');
    
    // 查询所有组织信息
    const orgResult = await db.collection('organizations').get();
    
    console.log('Found organizations:', orgResult.data.length);
    
    const organizations = orgResult.data.map(org => ({
      _id: org._id,
      orgId: org.orgId,
      orgName: org.orgName || 'unknown',
      status: org.status,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt
    }));
    
    return {
      success: true,
      data: {
        totalOrgs: orgResult.data.length,
        organizations: organizations
      }
    };
    
  } catch (error) {
    console.error('List orgs error:', error);
    return {
      success: false,
      message: error.message
    };
  }
};