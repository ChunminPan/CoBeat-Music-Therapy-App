Component({
  properties: {
    title: { type: String, value: "" },
    showBack: { type: Boolean, value: true },
    showHelp: { type: Boolean, value: false },
    showSettings: { type: Boolean, value: false }
  },
  methods: {
    onBack() { this.triggerEvent("back"); },
    onHelp() { this.triggerEvent("help"); },
    onSettings() { this.triggerEvent("settings"); }
  }
});
