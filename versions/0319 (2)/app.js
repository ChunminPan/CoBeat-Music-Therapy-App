// app.js
const subject = require('./utils/subject');

App({
  globalData: {
    subjectProfile: null
  },

  onLaunch() {
    this.refreshSubjectProfile();
  },

  refreshSubjectProfile() {
    this.globalData.subjectProfile = subject.getSubjectProfile();
  }
});
