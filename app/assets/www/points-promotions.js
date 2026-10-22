(function (global) {
  "use strict";

  // Only add hotels after the extra-points offer, validity window and source
  // have been verified. Do not treat ordinary member rates as point promotions.
  global.APP_POINTS_PROMOTIONS = {
    updatedAt: null,
    source: "Awaiting verified public Marriott bonus-points promotion data",
    hotels: {}
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = global.APP_POINTS_PROMOTIONS;
  }
})(typeof window !== "undefined" ? window : globalThis);
