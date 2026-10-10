// api_example.js - 接口调用示例
const api = require('./api');

/**
 * 提交节拍训练示例
 * @param {Object} trainingData - 训练数据
 * @example
 * submitTraining({
 *   userId: '123456',
 *   duration: 300,
 *   accuracy: 0.95,
 *   difficulty: 'medium',
 *   timestamp: Date.now(),
 *   // 自定义参数可以根据实际需求添加
 *   customField1: 'value1',
 *   customField2: 'value2'
 * });
 */
function submitTraining(trainingData) {
  // 确保用户已登录并有有效 Token
  const token = api.getAuthToken();
  if (!token) {
    return Promise.reject('用户未登录');
  }

  // 调用接口提交训练数据
  return api.saveTraining(trainingData)
    .then((result) => {
      // 处理成功返回的结果
      return result;
    })
    .catch((error) => {
      console.error('节拍训练提交失败:', error);
      // 处理错误
      throw error;
    });
}

/**
 * 提交即兴创作示例
 * @param {Object} improvData - 即兴创作数据
 * @example
 * submitImprov({
 *   userId: '123456',
 *   duration: 180,
 *   style: 'jazz',
 *   mood: 'happy',
 *   timestamp: Date.now(),
 *   // 自定义参数可以根据实际需求添加
 *   customField1: 'value1',
 *   customField2: 'value2'
 * });
 */
function submitImprov(improvData) {
  // 确保用户已登录并有有效 Token
  const token = api.getAuthToken();
  if (!token) {
    return Promise.reject('用户未登录');
  }

  // 调用接口提交即兴创作数据
  return api.saveImprov(improvData)
    .then((result) => {
      // 处理成功返回的结果
      return result;
    })
    .catch((error) => {
      console.error('即兴创作提交失败:', error);
      // 处理错误
      throw error;
    });
}

// 导出示例函数供其他模块使用
module.exports = {
  submitTraining,
  submitImprov
};
