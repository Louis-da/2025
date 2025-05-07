Page({
  data: {},
  navigateToProductManage() {
    wx.navigateTo({ url: '/pages/product-manage/product-manage' });
  },
  navigateToFactoryManage() {
    wx.navigateTo({ url: '/pages/factory-manage/factory-manage' });
  },
  navigateToColorManage() {
    wx.navigateTo({ url: '/pages/color-manage/color-manage' });
  },
  navigateToSizeManage() {
    wx.navigateTo({ url: '/pages/size-manage/size-manage' });
  },
  navigateToProcessManage() {
    wx.navigateTo({ url: '/pages/process-manage/process-manage' });
  }
});