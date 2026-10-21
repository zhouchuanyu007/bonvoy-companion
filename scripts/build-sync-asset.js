"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const captured = JSON.parse(
  fs.readFileSync(
    path.join(root, "build", "research", "marriott-search-network.json"),
    "utf8"
  )
);
const request = captured.requests.find((item) =>
  item.url.includes("phoenixShopDatedSearchByGeoQuery")
);
if (!request) {
  throw new Error("Captured Marriott search request not found");
}
const payload = JSON.parse(request.postData);
const signature = request.headers["graphql-operation-signature"];
if (!payload.query || !signature) {
  throw new Error("Captured Marriott query or signature is missing");
}

const source = `(function (global) {
  "use strict";

  const QUERY = ${JSON.stringify(payload.query)};
  const SIGNATURE = ${JSON.stringify(signature)};
  const BASE_VARIABLES = ${JSON.stringify(payload.variables)};

  function dateString(date) {
    const month = ("0" + (date.getMonth() + 1)).slice(-2);
    const day = ("0" + date.getDate()).slice(-2);
    return date.getFullYear() + "-" + month + "-" + day;
  }

  function normalizeHotel(edge) {
    const node = edge && edge.node;
    const property = node && node.property;
    const info = property && property.basicInformation;
    if (!property || !info) return null;
    const cash = (node.rates || [])
      .map((rate) => rate && rate.rateModes && rate.rateModes.lowestAverageRate)
      .find(Boolean);
    let price = null;
    let totalPrice = null;
    if (cash && cash.amount && Number.isFinite(cash.amount.amount)) {
      price = Math.round(
        cash.amount.amount / Math.pow(10, Number(cash.amount.decimalPoint) || 0)
      );
      if (cash.totalAmount && Number.isFinite(cash.totalAmount.amount)) {
        totalPrice = Math.round(
          cash.totalAmount.amount /
            Math.pow(10, Number(cash.totalAmount.decimalPoint) || 0)
        );
      }
    }
    const rating =
      property.reviews &&
      property.reviews.stars &&
      Number.isFinite(property.reviews.stars.count)
        ? property.reviews.stars.count
        : null;
    return {
      id: property.id,
      distance: Number(node.distance) || null,
      seoNickname: property.seoNickname || null,
      name: info.name || "",
      nameEn: info.nameInDefaultLanguage || info.name || "",
      brandId: info.brand && info.brand.id ? info.brand.id : "",
      brandName: info.brand && info.brand.name ? info.brand.name : "",
      latitude: info.latitude,
      longitude: info.longitude,
      bookable: Boolean(info.bookable),
      openingDate: info.openingDate || null,
      newProperty: Boolean(info.newProperty),
      rating,
      reviewCount:
        property.reviews &&
        property.reviews.numberOfReviews &&
        Number.isFinite(property.reviews.numberOfReviews.count)
          ? property.reviews.numberOfReviews.count
          : null,
      price,
      totalPrice,
      checkIn: BASE_VARIABLES.search && BASE_VARIABLES.search.options
        ? null
        : null,
      currency: cash && cash.amount ? cash.amount.currency : "CNY",
      source: "marriott-official-live"
    };
  }

  global.__lvbanOfficialSync = async function (request) {
    try {
      if (!request || !Number.isFinite(Number(request.latitude)) || !Number.isFinite(Number(request.longitude))) {
        throw new Error("城市坐标无效");
      }
      const today = new Date();
      const tomorrow = new Date(today.getTime() + 86400000);
      const checkIn = dateString(today);
      const checkOut = dateString(tomorrow);
      const hotels = [];
      let offset = 0;
      let total = null;
      for (let page = 0; page < 6; page += 1) {
        const variables = JSON.parse(JSON.stringify(BASE_VARIABLES));
        variables.search.latitude = Number(request.latitude);
        variables.search.longitude = Number(request.longitude);
        variables.search.distance = 80000;
        variables.search.options.startDate = checkIn;
        variables.search.options.endDate = checkOut;
        variables.search.options.includeUnavailableProperties = true;
        variables.offset = offset;
        variables.limit = 40;
        const response = await fetch("/mi/query/phoenixShopDatedSearchByGeoQuery", {
          method: "POST",
          headers: {
            "application-name": "shop",
            "accept": "application/json",
            "apollographql-client-version": "v1",
            "apollographql-client-name": "phoenix_shop",
            "content-type": "application/json",
            "graphql-operation-name": "phoenixShopDatedSearchByGeoQuery",
            "graphql-require-safelisting": "true",
            "graphql-operation-signature": SIGNATURE,
            "accept-language": "zh-CN"
          },
          body: JSON.stringify({
            operationName: "phoenixShopDatedSearchByGeoQuery",
            variables,
            query: QUERY
          })
        });
        const text = await response.text();
        if (!response.ok) {
          throw new Error("官方查询返回 HTTP " + response.status);
        }
        let data;
        try {
          data = JSON.parse(text);
        } catch (error) {
          throw new Error("官方查询返回了无法解析的内容");
        }
        const search =
          data &&
          data.data &&
          data.data.search &&
          data.data.search.lowestAvailableRates &&
          data.data.search.lowestAvailableRates.searchByGeolocation;
        if (!search || !Array.isArray(search.edges)) {
          throw new Error("官方查询没有返回酒店结果");
        }
        if (total === null) total = Number(search.total) || 0;
        search.edges.forEach((edge) => {
          const hotel = normalizeHotel(edge);
          if (hotel) {
            hotel.checkIn = checkIn;
            hotel.checkOut = checkOut;
            hotels.push(hotel);
          }
        });
        if (
          search.edges.length < 40 ||
          hotels.length >= total ||
          !search.pageInfo ||
          !search.pageInfo.hasNextPage
        ) {
          break;
        }
        offset += search.edges.length;
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      if (global.LvbanSyncBridge && global.LvbanSyncBridge.onComplete) {
        global.LvbanSyncBridge.onComplete(
          JSON.stringify({
            destinationId: request.destinationId,
            cityName: request.cityName,
            checkIn,
            checkOut,
            total,
            hotels
          })
        );
      }
    } catch (error) {
      if (global.LvbanSyncBridge && global.LvbanSyncBridge.onError) {
        global.LvbanSyncBridge.onError(String(error && error.message || error));
      }
    }
  };
})(window);
`;

const outputDir = path.join(root, "app", "assets", "sync");
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "marriott-sync.js"), source);
console.log(path.join(outputDir, "marriott-sync.js"));
