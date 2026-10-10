

var base_url = 'https://api.example.com';
// 存储 Token（从 Set-Cookie 获取）
var authToken = '';

// 设置 Token
function setAuthToken(token) {
  authToken = token;
  wx.setStorageSync('user_auth_token', token);
}

// 获取 Token
function getAuthToken() {
  const token = authToken || wx.getStorageSync('user_auth_token') || '';
  return token;
}

// 统一的请求封装
function request(options) {
  return new Promise((resolve, reject) => {
    const token = getAuthToken();
    wx.request({
      ...options,
      header: {
        'Content-Type': 'application/json',
        'Cookie': token,
        ...(options.header || {})
      },
      success: (res) => {
        resolve(res);
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

// 通过code获取用户信息
function getUserWechat(code) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: base_url + '/wechat/mini/auth/session',
      method: 'POST',
      data: { code: code },
      success: (res) => {
        
        if (res.data.code !== 200) {
          reject(res.data);
          return;
        }
        
        // 从响应头中获取 Set-Cookie
        
        const setCookie = res.header['Set-Cookie'] || res.header['set-cookie'];
        if (setCookie) {
          // 提取 Cookie 中的 token 部分（通常是第一个分号前的内容）
          const token = setCookie.split(';')[0];
          setAuthToken(token);
        }
        
        resolve(res.data);
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}


// ========== 保存用户信息 ==========
function saveUser(data) {
  return request({
    url: base_url + '/user/update',
    method: 'PUT',
    data: data
  }).then((res) => {
    return res.data;
  }).catch((err) => {
    throw err;
  });
}
function getUser() {
  return request({
    url: base_url + '/user',
    method: 'POST'
  }).then((res) => {
    return res.data;
  }).catch((err) => {
    throw err;
  });
}

// ========== 节律训练记录（trainer 使用） ==========
function getTraining(data = {}) {
  // 添加默认分页参数
  const params = { page: 1, ...data };
  return request({
    url: base_url + '/form_v2/training',
    method: 'GET',
    data: params
  }).then((res) => {
    let records = [];
    
    if (res.data && res.data.data) {
      // 确保res.data.data是数组
      const dataArray = res.data.data;
      // 解析content字段为JSON对象
      records = dataArray.data
      // records = dataArray.data.map(item => {
      //   try {
      //     // 检查item和content是否存在且有效
      //     if (item && typeof item.content === 'string' && item.content.trim()) {
      //       return JSON.parse(item.content);
      //     } else {
      //       console.error('[API] 训练记录content字段无效', item);
      //       return null;
      //     }
      //   } catch (e) {
      //     console.error('[API] 解析训练记录失败', e, item.content);
      //     return null;
      //   }
      // }).filter(Boolean); // 过滤掉解析失败的记录
    }
    
    // 返回完整的响应结构，包括code和数据
    return {
      code: res.data.code || 200,
      data: records,
      original: res.data // 保留原始响应数据
    };
  }).catch((err) => {
    throw err;
  });
}
// 保存一条训练记录
function saveTraining(data) {
  return request({
    url: base_url + '/form_v2/training',
    method: 'POST',
    data: data
  }).then((res) => {
    return res.data;
  }).catch((err) => {
    throw err;
  });
}

// 删除一条训练记录
function deleteTraining(id) {
  return request({
    url: base_url + '/form_v2/training/' + id,
    method: 'DELETE'
  }).then((res) => {
    return res.data;
  }).catch((err) => {
    throw err;
  });
}

// 查询一条训练记录
function getTrainingById(id) {
  return request({
    url: base_url + '/form_v2/training/' + id,
    method: 'GET'
  }).then((res) => {
    return res.data;
  }).catch((err) => {
    throw err;
  });
}


// ========== 即兴创作记录（improv 使用） ==========
// 保存一次创作相关事件（create / save / share 等）
function getImprov(data = {}) {
  // 添加默认分页参数
  const params = { page: 1, ...data };
  return request({
    url: base_url + '/form_v2/improv',
    method: 'GET',
    data: params
  }).then((res) => {
    let records = [];
    
    if (res.data && res.data.data) {
      // 确保res.data.data是数组
      const dataArray = res.data.data;
      records = dataArray.data
      // 解析content字段为JSON对象
      // records = dataArray.data.map(item => {
      //   try {
      //     // 检查item和content是否存在且有效
      //     if (item && typeof item.content === 'string' && item.content.trim()) {
      //       return JSON.parse(item.content);
      //     } else {
      //       console.error('[API] 即兴创作记录content字段无效', item);
      //       return null;
      //     }
      //   } catch (e) {
      //     console.error('[API] 解析即兴创作记录失败', e, item.content);
      //     return null;
      //   }
      // }).filter(Boolean); // 过滤掉解析失败的记录
    }
    
    // 返回完整的响应结构，包括code和数据
    return {
      code: res.data.code || 200,
      data: records,
      original: res.data // 保留原始响应数据
    };
  }).catch((err) => {
    throw err;
  });
}
function saveImprov(data) {
  return request({
    url: base_url + '/form_v2/improv',
    method: 'POST',
    data: data
  }).then((res) => {
    return res.data;
  }).catch((err) => {
    throw err;
  });
}

// 查询所有即兴创作记录
function getImprovById(id) {
  return request({
    url: base_url + '/form_v2/improv/' + id,
    method: 'GET'
  }).then((res) => {
    if (res.data && res.data.content) {
      try {
        // 解析content字段为JSON对象
        const content = JSON.parse(res.data.content);
        // 返回包含原始数据和解析后内容的对象
        return {
          ...res.data,
          content: content,
          parsedContent: content // 保留原始content字段，同时添加parsedContent字段
        };
      } catch (e) {
        return res.data;
      }
    }
    return res.data;
  }).catch((err) => {
    throw err;
  });
}

// 删除一条即兴创作记录
function deleteImprov(id) {
  return request({
    url: base_url + '/form_v2/improv/' + id,
    method: 'DELETE'
  }).then((res) => {
    return res.data;
  }).catch((err) => {
    throw err;
  });
}



module.exports = {
  // Token 管理
  getAuthToken,
  setAuthToken,
  //获取用户的微信信息 openid 等【注意 OpenID 需要全局使用】
  getUserWechat,
  //用户信息
  saveUser,
  getUser,
  // 训练
  getTraining,
  getTrainingById,
  saveTraining,
  deleteTraining,
  // 即兴创作
  getImprov,
  getImprovById,
  saveImprov,
  deleteImprov,
};

