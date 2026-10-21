(function (global) {
  "use strict";

  const QUERY = "query phoenixShopDatedSearchByGeoQuery($search: SearchLowestAvailableRatesByGeolocationInput!, $offset: Int, $limit: Int, $sort: SearchLowestAvailableRatesSort, $filter: [PropertyDescriptionType]) {\n  search {\n    lowestAvailableRates {\n      searchByGeolocation(\n        search: $search\n        offset: $offset\n        limit: $limit\n        sort: $sort\n      ) {\n        pageInfo {\n          hasNextPage\n          hasPreviousPage\n          previousOffset\n          currentOffset\n          nextOffset\n        }\n        total\n        edges {\n          node {\n            distance\n            property {\n              id\n              basicInformation {\n                isMax\n                resort\n                isAdultsOnly\n                brand {\n                  id\n                  name\n                  type\n                  photos {\n                    content {\n                      alternateText\n                      index\n                      name\n                      url\n                    }\n                    type {\n                      code\n                    }\n                  }\n                }\n                name\n                nameInDefaultLanguage\n                descriptions(filter: $filter) {\n                  text\n                  type {\n                    code\n                    enumCode\n                  }\n                }\n                currency\n                isRecentlyRenovated\n                isFullyRenovated\n                hasRenovatedRooms\n                ... on HotelBasicInformation {\n                  newLobby\n                }\n                newProperty\n                openingDate\n                latitude\n                longitude\n                bookable\n                hasUniquePropertyLogo\n              }\n              otherPropertyInformation {\n                isAllInclusive\n              }\n              reviews {\n                stars {\n                  count\n                }\n                numberOfReviews {\n                  count\n                }\n              }\n              media {\n                primaryImage {\n                  edges {\n                    node {\n                      alternateDescription\n                      title\n                      imageUrls {\n                        wideHorizontal\n                        square\n                        classicHorizontal\n                      }\n                    }\n                  }\n                }\n              }\n              ... on Hotel {\n                seoNickname\n              }\n            }\n            rates {\n              rateModes {\n                ... on SearchLowestAvailableRatesRateModesCashAndPoints {\n                  cashAndPointsPerUnit {\n                    amount {\n                      amount\n                      currency\n                      decimalPoint\n                    }\n                    amountPlusMandatoryFees {\n                      currency\n                      amount\n                      decimalPoint\n                    }\n                    fees {\n                      amount\n                      currency\n                      decimalPoint\n                    }\n                    mandatoryFees {\n                      currency\n                      amount\n                      decimalPoint\n                    }\n                    points\n                    taxes {\n                      currency\n                      decimalPoint\n                      amount\n                      decimalPoint\n                    }\n                    totalAmount {\n                      currency\n                      amount\n                      decimalPoint\n                    }\n                  }\n                }\n                ... on SearchLowestAvailableRatesRateModesCash {\n                  lowestAverageRate {\n                    amount {\n                      amount\n                      currency\n                      decimalPoint\n                    }\n                    fees {\n                      amount\n                      currency\n                      decimalPoint\n                    }\n                    taxes {\n                      amount\n                      currency\n                      decimalPoint\n                    }\n                    totalAmount {\n                      amount\n                      currency\n                      decimalPoint\n                    }\n                    amountPlusMandatoryFees {\n                      amount\n                      currency\n                      decimalPoint\n                    }\n                    mandatoryFees {\n                      amount\n                      currency\n                      decimalPoint\n                    }\n                  }\n                }\n                ... on SearchLowestAvailableRatesRateModesPoints {\n                  pointsPerUnit {\n                    points\n                  }\n                }\n              }\n              membersOnly\n              lengthOfStay\n              status {\n                code\n              }\n              rateCategory {\n                code\n                value\n              }\n              sourceOfRate\n            }\n          }\n        }\n        facets {\n          type {\n            code\n            label\n            count\n            description\n          }\n          buckets {\n            ... on SearchLowestAvailableRatesTermFacetBucket {\n              code\n              label\n              description\n              count\n            }\n            ... on SearchLowestAvailableRatesRangeFacetBucket {\n              index\n              start\n              end\n              count\n            }\n          }\n        }\n        status @contentError(options: {channel: \"web\"}) {\n          ... on ResponseStatus {\n            __typename\n            code\n            httpStatus\n            errors {\n              code\n              devMessage\n              message\n            }\n            warnings {\n              code\n              devMessage\n              message\n            }\n          }\n        }\n        searchQueryId\n        recipeId\n      }\n    }\n  }\n}\n";
  const SIGNATURE = "46b57113564cd372d3105f7f86be3efdb1549f31a86028977a9b46e251966acd";
  const BASE_VARIABLES = {"search":{"latitude":32.0583799,"longitude":118.79647,"distance":80467.2,"options":{"startDate":"2026-10-19","endDate":"2026-10-20","includeMandatoryFees":false,"numberInParty":1,"rateRequestTypes":[{"type":"CLUSTER","value":"MRW"},{"type":"STANDARD","value":""},{"type":"CLUSTER","value":"P17"}],"quantity":1,"customerId":"","includeTaxesAndFees":false,"includeUnavailableProperties":false},"facets":{"terms":[{"type":"BRANDS","dimensions":[]},{"type":"AMENITIES","dimensions":[]},{"type":"PROPERTY_TYPES","dimensions":[]},{"type":"ACTIVITIES","dimensions":[]},{"type":"CITIES","dimensions":[]},{"type":"STATES","dimensions":[]},{"type":"COUNTRIES","dimensions":[]},{"type":"HOTEL_SERVICE_TYPES","dimensions":[]},{"type":"MEETINGS_EVENTS","dimensions":[]},{"type":"TRANSPORTATION_TYPES","dimensions":[]},{"type":"LEISURE_REGIONS","dimensions":[]}],"ranges":[{"type":"POINTS","dimensions":[],"endpoints":["0","40000","80000","120000","160000","200000","240000","overflow"]},{"type":"DISTANCE","dimensions":[],"endpoints":["0","4830","14520","80470"]}]}},"limit":40,"offset":0,"sort":{"fields":[{"field":"DISTANCE","direction":"ASC"}]},"filter":["HOTEL_MARKETING_CAPTION"]};

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
    const pointsRate = (node.rates || []).find(
      (rate) =>
        rate &&
        rate.rateModes &&
        rate.rateModes.pointsPerUnit &&
        Number.isFinite(rate.rateModes.pointsPerUnit.points)
    );
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
      pointsPrice: pointsRate
        ? Number(pointsRate.rateModes.pointsPerUnit.points)
        : null,
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
      const checkIn =
        request.checkIn && /^\d{4}-\d{2}-\d{2}$/.test(request.checkIn)
          ? request.checkIn
          : dateString(today);
      const checkOut =
        request.checkOut && /^\d{4}-\d{2}-\d{2}$/.test(request.checkOut)
          ? request.checkOut
          : dateString(tomorrow);
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
