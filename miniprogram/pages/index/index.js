const app = getApp()

Page({
  data: {
    activeTab: 'sent',
    sendList: [],
    receiveList: []
  },

  onLoad: function() {
    this.loadInitialData();
  },

  onShow: function() {
    this.loadInitialData();
  },

  loadInitialData: function() {
    this.fetchSendList();
    this.fetchReceiveList();
  },

  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ 
      activeTab: tab
    });
  },

  fetchSendList: function() {
    const mockData = [{
      id: 'S1',
      orderNo: 'F20250505001',
      factoryName: '桃姐 - 织机',
      weight: 100,
      quantity: 50,
      date: '2025-05-04',
      staff: 'admin'
    }];
    
    this.setData({ 
      sendList: mockData
    });
  },

  fetchReceiveList: function() {
    const mockData = [{
      id: 'R1',
      orderNo: 'F20250505001',
      factoryName: '李哥 - 织机',
      weight: 80,
      quantity: 40,
      date: '2025-05-04',
      staff: 'admin'
    }];
    
    this.setData({ 
      receiveList: mockData
    });
  }
}); 