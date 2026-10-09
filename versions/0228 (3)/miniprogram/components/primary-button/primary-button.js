Component({
  properties: {
    size: { type: String, value: "large" },
    disabled: { type: Boolean, value: false },
    className: { type: String, value: "" }
  },
  methods: {
    onTap() {
      if (this.data.disabled) return;
      this.triggerEvent("tap");
    }
  }
});
