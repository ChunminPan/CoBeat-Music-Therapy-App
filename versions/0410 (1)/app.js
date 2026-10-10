// app.js
const subject = require('./utils/subject');
const api = require('./utils/api');
App({
  globalData: {
    subjectProfile: null,
    user:null,
  },

  onLaunch() {
    //获取小程序 code
    wx.login({
      success: (res) => {
        if (res.code) {
          // 检查 code 是否为 mock 值
          if (res.code === 'mock_code' || !res.code.startsWith('0')) {
          }
          api.getUserWechat(res.code).then(()=>{
              api.getUser().then((res1)=>{
                this.globalData.user = res1.data
              }).catch((err)=>{
                console.error('api.getUser() 失败:', err)
              })
          }).catch((err)=>{
            console.error('api.getUserWechat() 失败:', err)
          })
          
        } else {
        }
      },
      fail: (err) => {
        console.error('wx.login 调用失败', err);
      }
    });
    this.refreshSubjectProfile();
  },

  refreshSubjectProfile() {
    this.globalData.subjectProfile = subject.getSubjectProfile();
  },

  /**
   * 示例：提交节拍训练
   */
  submitTrainingExample() {
    const trainingData = {
      userId: this.globalData.user?.id || '',
      duration: 300, // 训练时长（秒）
      accuracy: 0.95, // 准确率
      difficulty: 'medium', // 难度级别
      timestamp: Date.now(), // 训练时间
      // 自定义参数可以根据实际需求添加
      customField1: 'value1',
      customField2: 'value2'
    };

    api.saveTraining(trainingData)
      .then((result) => {
      })
      .catch((error) => {
        console.error('节拍训练提交失败:', error);
      });
  },

  /**
   * 示例：提交即兴创作
   */
  submitImprovExample() {
    const improvData = {
      userId: this.globalData.user?.id || '',
      duration: 180, // 创作时长（秒）
      style: 'jazz', // 音乐风格
      mood: 'happy', // 情绪
      timestamp: Date.now(), // 创作时间
      // 自定义参数可以根据实际需求添加
      customField1: 'value1',
      customField2: 'value2'
    };

    api.saveImprov(improvData)
      .then((result) => {
      })
      .catch((error) => {
        console.error('即兴创作提交失败:', error);
      });
  }
});
