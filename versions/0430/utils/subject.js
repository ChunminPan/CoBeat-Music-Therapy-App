const SUBJECT_PROFILE_KEY = 'subjectProfile';

function getSubjectProfile() {
  try {
    const profile = wx.getStorageSync(SUBJECT_PROFILE_KEY);
    return profile && typeof profile === 'object' ? profile : null;
  } catch (e) {
    return null;
  }
}

function hasSubjectProfile() {
  const profile = getSubjectProfile();
  return !!(profile && profile.submitted);
}

function saveSubjectProfile(formData) {
  const profile = {
    version: 1,
    submitted: true,
    submittedAt: Date.now(),
    nickname: formData.nickname || '',
    age: formData.age || '',
    gender: formData.gender || '',
    hasAsdDiagnosis: formData.hasAsdDiagnosis || '',
    consentResearch: formData.consentResearch || '',
    dsmLevel: formData.dsmLevel || null,
    carsScore: formData.carsScore || null
  };

  wx.setStorageSync(SUBJECT_PROFILE_KEY, profile);
  return profile;
}

function getSubjectMeta() {
  const profile = getSubjectProfile();
  if (!profile) return null;
  return {
    subjectProfileVersion: profile.version || 1,
    submittedAt: profile.submittedAt || null,
    nickname: profile.nickname || '',
    age: profile.age || '',
    gender: profile.gender || '',
    hasAsdDiagnosis: profile.hasAsdDiagnosis || '',
    consentResearch: profile.consentResearch || '',
    dsmLevel: profile.dsmLevel || null,
    carsScore: profile.carsScore || null
  };
}

function attachSubjectMeta(payload) {
  const subjectMeta = getSubjectMeta();
  if (!payload || typeof payload !== 'object') return payload;
  if (!payload.meta || typeof payload.meta !== 'object') payload.meta = {};
  payload.meta.subject = subjectMeta;
  return payload;
}

function pad2(num) {
  return num < 10 ? '0' + num : '' + num;
}

function formatRecentLabel(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const sameYear = now.getFullYear() === date.getFullYear();
  const sameMonth = now.getMonth() === date.getMonth();
  const sameDay = now.getDate() === date.getDate();

  const timePart = pad2(date.getHours()) + ':' + pad2(date.getMinutes());
  if (sameYear && sameMonth && sameDay) return '今天 ' + timePart;

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const sameAsYesterday =
    yesterday.getFullYear() === date.getFullYear() &&
    yesterday.getMonth() === date.getMonth() &&
    yesterday.getDate() === date.getDate();
  if (sameAsYesterday) return '昨天 ' + timePart;

  const datePart = (date.getMonth() + 1) + '月' + date.getDate() + '日';
  return sameYear ? (datePart + ' ' + timePart) : (date.getFullYear() + '年' + datePart + ' ' + timePart);
}

function requireSubjectProfile() {
  if (hasSubjectProfile()) return true;
  wx.reLaunch({ url: '/pages/intake/index' });
  return false;
}

module.exports = {
  SUBJECT_PROFILE_KEY,
  getSubjectProfile,
  hasSubjectProfile,
  saveSubjectProfile,
  getSubjectMeta,
  attachSubjectMeta,
  formatRecentLabel,
  requireSubjectProfile
};
