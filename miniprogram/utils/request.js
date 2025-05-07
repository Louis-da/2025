const app = getApp()

const request = (options) => {
  const { url, method = 'GET', data = {}, header = {} } = options
  
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBaseUrl}${url}`,
      method,
      data,
      header: {
        'content-type': 'application/json',
        'token': wx.getStorageSync('token'),
        ...header
      },
      success(res) {
        if (res.statusCode === 200) {
          if (res.data.code === 0) { // 假设约定0为成功
            resolve(res.data)
          } else {
            // 业务错误处理
            wx.showToast({
              title: res.data.message || '请求失败',
              icon: 'none'
            })
            reject(res.data)
          }
        } else if (res.statusCode === 401) {
          // 未授权，跳转到登录页
          wx.navigateTo({
            url: '/pages/login/login'
          })
          reject(res)
        } else {
          // 其他http错误
          wx.showToast({
            title: `请求失败(${res.statusCode})`,
            icon: 'none'
          })
          reject(res)
        }
      },
      fail(err) {
        wx.showToast({
          title: '网络异常',
          icon: 'none'
        })
        reject(err)
      }
    })
  })
}

module.exports = {
  request
} 