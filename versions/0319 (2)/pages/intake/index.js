const subject = require('../../utils/subject');

const DEFAULT_FORM = {
  nickname: '',
  age: '',
  gender: '',
  hasAsdDiagnosis: '',
  consentResearch: '',
  dsmLevel: '',
  carsScore: ''
};

Page({
  data: {
    form: Object.assign({}, DEFAULT_FORM),
    genderOptions: ['男', '女', '其他'],
    yesNoOptions: ['是', '否'],
    dsmOptions: ['Level 1', 'Level 2', 'Level 3', '报告未写明 / 不清楚'],
    isEditMode: false,
    showDiagnosisExtras: false,
    submitting: false
  },

  onLoad(options) {
    const existing = subject.getSubjectProfile();
    const isEditMode = options && options.edit === '1';

    if (existing && !isEditMode) {
      wx.reLaunch({ url: '/pages/home/index' });
      return;
    }

    if (existing && isEditMode) {
      const form = {
        nickname: existing.nickname || '',
        age: existing.age || '',
        gender: existing.gender || '',
        hasAsdDiagnosis: existing.hasAsdDiagnosis || '',
        consentResearch: existing.consentResearch || '',
        dsmLevel: existing.dsmLevel || '',
        carsScore: existing.carsScore || ''
      };
      this.setData({
        form,
        isEditMode: true,
        showDiagnosisExtras: form.hasAsdDiagnosis === '是'
      });
    }
  },

  onTextInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({ [`form.${field}`]: value });
  },

  onRadioChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;

    if (field === 'hasAsdDiagnosis') {
      const patch = {
        'form.hasAsdDiagnosis': value,
        showDiagnosisExtras: value === '是'
      };
      if (value === '否') {
        patch['form.dsmLevel'] = '';
        patch['form.carsScore'] = '';
      }
      this.setData(patch);
      return;
    }

    this.setData({ [`form.${field}`]: value });
  },

  validateForm(form) {
    const nickname = (form.nickname || '').trim();
    const age = String(form.age || '').trim();
    const carsScore = String(form.carsScore || '').trim();

    if (!nickname) return '请填写昵称';
    if (!age) return '请填写年龄';
    if (!/^\d+$/.test(age) || Number(age) <= 0) return '年龄请填写正整数';
    if (!form.gender) return '请选择性别';
    if (!form.hasAsdDiagnosis) return '请选择是否有 ASD 正式诊断';
    if (!form.consentResearch) return '请选择是否同意匿名使用训练数据进行研究分析';
    if (carsScore && !/^\d+(\.\d+)?$/.test(carsScore)) return 'CARS 总分格式不正确，请输入数字';
    return '';
  },

  onSubmit() {
    if (this.data.submitting) return;
    const form = Object.assign({}, this.data.form);
    const error = this.validateForm(form);
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }

    const payload = {
      nickname: (form.nickname || '').trim(),
      age: String(form.age || '').trim(),
      gender: form.gender,
      hasAsdDiagnosis: form.hasAsdDiagnosis,
      consentResearch: form.consentResearch,
      dsmLevel: form.hasAsdDiagnosis === '是' ? (form.dsmLevel || '') : null,
      carsScore: form.hasAsdDiagnosis === '是'
        ? (String(form.carsScore || '').trim() || null)
        : null
    };

    this.setData({ submitting: true });
    subject.saveSubjectProfile(payload);

    wx.showToast({
      title: this.data.isEditMode ? '资料已更新' : '提交成功',
      icon: 'success',
      duration: 1200
    });

    setTimeout(() => {
      wx.reLaunch({ url: '/pages/home/index' });
    }, 500);
  }
});
