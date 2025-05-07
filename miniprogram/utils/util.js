const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return [year, month, day].map(formatNumber).join('/') + ' ' + [hour, minute, second].map(formatNumber).join(':')
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : '0' + n
}

const showToast = (title, icon = 'none') => {
  wx.showToast({
    title: title,
    icon: icon
  })
}

const showModal = (title, content, showCancel = true) => {
  return new Promise((resolve, reject) => {
    wx.showModal({
      title: title,
      content: content,
      showCancel: showCancel,
      success(res) {
        if (res.confirm) {
          resolve(true)
        } else if (res.cancel) {
          resolve(false)
        }
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

const showLoading = (title = '加载中') => {
  wx.showLoading({
    title: title,
    mask: true
  })
}

const hideLoading = () => {
  wx.hideLoading()
}

module.exports = {
  formatTime,
  formatNumber,
  showToast,
  showModal,
  showLoading,
  hideLoading
} 