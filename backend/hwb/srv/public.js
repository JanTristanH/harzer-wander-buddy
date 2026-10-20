const cds = require("@sap/cds");
module.exports = class extends cds.ApplicationService {
  init() {
    this.after(
      "READ",
      "Stampboxes",
      require("./stamp-notices").attachActiveNotices,
    );
    return super.init();
  }
};
