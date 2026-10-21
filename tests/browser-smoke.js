"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { readSecret } = require("../scripts/local-secrets");

const root = path.resolve(__dirname, "..");
const chromePath =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profileDir = path.join(root, "build", "browser-profile");
const outputDir = path.join(root, "build", "previews");
const pageUrl = pathToFileURL(
  path.join(root, "app", "assets", "www", "index.html")
).toString();
const port = 9333;
const amapKey = readSecret("AMAP_KEY");

fs.mkdirSync(outputDir, { recursive: true });
if (!profileDir.startsWith(path.join(root, "build") + path.sep)) {
  throw new Error("Refusing to clear browser profile outside the build directory");
}
fs.rmSync(profileDir, { recursive: true, force: true });

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-allow-origins=*",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "about:blank"
  ],
  {
    stdio: "ignore",
    windowsHide: true
  }
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForTarget() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === "page");
        if (page) return page;
      }
    } catch (error) {
      // Chrome is still starting.
    }
    await sleep(250);
  }
  throw new Error("Chrome DevTools endpoint did not start");
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.errors = [];
    this.consoleMessages = [];
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
        return;
      }
      if (message.method === "Runtime.exceptionThrown") {
        this.errors.push(message.params.exceptionDetails.text);
      }
      if (message.method === "Log.entryAdded") {
        const entry = message.params.entry;
        if (entry.level === "error") {
          this.errors.push(entry.text);
        }
      }
      if (message.method === "Runtime.consoleAPICalled") {
        const values = message.params.args.map((arg) => arg.value || arg.description);
        this.consoleMessages.push(values.join(" "));
      }
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text);
    }
    return result.result ? result.result.value : undefined;
  }

  async screenshot(name) {
    const result = await this.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false
    });
    const outputPath = path.join(outputDir, name + ".png");
    fs.writeFileSync(outputPath, Buffer.from(result.data, "base64"));
    return outputPath;
  }

  close() {
    this.socket.close();
  }
}

(async () => {
  let client;
  try {
    const target = await waitForTarget();
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    await client.send("Runtime.enable");
    await client.send("Page.enable");
    await client.send("Log.enable");
    if (amapKey) {
      await client.send("Page.addScriptToEvaluateOnNewDocument", {
        source:
          "window.BONVOY_AMAP_KEY = " + JSON.stringify(amapKey) + ";"
      });
    }
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true
    });
    await client.send("Page.navigate", { url: pageUrl });
    await sleep(900);
    await client.evaluate(
      "localStorage.setItem('lvban.onboarding.v1','true'); location.reload();"
    );
    await sleep(900);
    await client.evaluate(`(() => {
      window.__flyAiCalls = [];
      window.__officialCalls = [];
      window.__fliggyOpenCalls = [];
      window.__meituanCalls = [];
      window.AndroidLocation = {
        getCurrentLocation(requestId) {
          setTimeout(
            () => window.onNativeLocationResult(requestId, 31.2304, 121.4737, null),
            60
          );
        }
      };
      window.AndroidFliggy = {
        openHotel(url) {
          window.__fliggyOpenCalls.push(url);
        }
      };
      window.AndroidMeituanTravel = {
        query(requestId, cityName, query) {
          window.__meituanCalls.push({ cityName, query });
          setTimeout(
            () =>
              window.onNativeMeituanTravelResult(
                requestId,
                JSON.stringify({
                  code: 0,
                  msg: "success",
                  data:
                    "南京大牌档（夫子庙老门东店）\\n大众点评必吃榜上榜品牌；人均约73元；秦淮区老门东。" +
                    "\\n\\n金陵小厨·南京菜·淮扬菜（夫子庙店）\\n评分4.8分；人均约58元；秦淮区贡院街。" +
                    "\\n营业时间与排队情况请以美团或大众点评门店页为准。"
                })
              ),
            110
          );
        }
      };
      window.AndroidHotelSync = {
        requestCitySync(destinationId, latitude, longitude, cityName) {
          window.__officialCalls.push({
            destinationId,
            latitude,
            longitude,
            cityName
          });
        }
      };
      window.AndroidDeepSeek = {
        request(requestId) {
          setTimeout(
            () =>
              window.onNativeDeepSeekResult(
                requestId,
                "复合攻略：安排当地美食、自然风光和名胜古迹，并按照备注控制酒店预算与交通便利度。"
              ),
            80
          );
        }
      };
      window.AndroidFlyAi = {
        request(requestId, tool, argumentsJson) {
          const args = JSON.parse(argumentsJson || "{}");
          window.__flyAiCalls.push({ tool, args });
          let payload;
          if (tool === "search_marriott_hotels") {
            const destination =
              APP_DATA.destinations.find(
                (item) =>
                  args.destName === item.name ||
                  String(args.destName || "").includes(item.name) ||
                  String(item.cityFull || "").includes(String(args.destName || ""))
              ) || APP_DATA.destinations.find((item) => item.name === "南京");
            const hotels = APP_DATA.hotels
              .filter((hotel) => hotel.destinationId === destination.id)
              .slice(0, 2)
              .map((hotel, index) => ({
                name: hotel.name,
                address: hotel.area,
                latitude: String(hotel.coords.latitude),
                longitude: String(hotel.coords.longitude),
                price: "¥" + (588 + index * 120) + "起/晚",
                detailUrl: "https://router.feizhu.com/ws/" + hotel.id,
                mainPic: null,
                shid: "test-" + hotel.id,
                nearbyPoi: "近" + destination.name + "中心"
              }));
            payload = {
              status: 0,
              message: "success",
              data: { itemList: hotels }
            };
          } else if (tool === "get_marriott_hotel_info") {
            const hotelName =
              args.hotelName ||
              document.querySelector('.hotel-detail-hero h1')?.textContent ||
              "南京华泰万丽酒店";
            const reviewOffset = args.reviewKeyword === "设施" ? 5 : 0;
            payload = {
              status: 0,
              message: "success",
              data: {
                itemList: [
                  {
                    detailUrl: "https://router.feizhu.com/ws/detail",
                    hotelInfo: {
                      酒店基础信息: {
                        酒店名称: hotelName,
                        酒店地址: "测试地址 1 号",
                        酒店等级: "豪华型",
                        酒店联系电话: "025-00000000",
                        房间数量: "200间",
                        开业时间: "2018年",
                        装修时间: "2021年",
                        入住方式: "前台办理",
                        商务出行: "适合城市商务与周末短住。",
                        恒温泳池: "住客免费",
                        可接待人群: "全球客人"
                      },
                      酒店政策: {
                        入离政策: "14:00后入住，12:00前退房",
                        早餐政策: "自助早餐，详情以酒店确认为准",
                        宠物政策: "不可携带宠物"
                      },
                      酒店设施: {
                        热门设施: "健身房、泳池、行政酒廊",
                        餐饮服务: "餐厅、咖啡厅、送餐服务"
                      },
                      酒店周边: {
                        交通: "奥体东地铁站(步行500米)",
                        景点: "城市公园(直线1.2公里)",
                        美食: "酒店餐厅(直线<100米)"
                      }
                    },
                    reviews: Array.from({ length: 5 }, (_, index) => ({
                      content:
                        "第" +
                        (reviewOffset + index + 1) +
                        "条公开评价：位置方便，服务热情，房间干净，早餐丰富。" +
                        (index === 2 ? "不过部分客房隔音一般。" : "")
                    })),
                    roomLayers: [
                      {
                        name: "豪华大床房",
                        床政策: "1张特大床",
                        热门设施: "45平方米",
                        其他设施: "Wi-Fi、浴缸、咖啡机",
                        rateLayers: [
                          {
                            最终价格: "¥688",
                            其他政策: "1人入住",
                            早餐政策: "含早餐",
                            商品信息: "不可取消"
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            };
          } else if (tool === "search_poi") {
            const destination =
              APP_DATA.destinations.find((item) => item.name === args.cityName) ||
              APP_DATA.destinations.find((item) => item.name === "南京");
            const base = destination.coords;
            const restaurantItems = [
              {
                id: "mock-restaurant-1",
                name: destination.name + "本地菜馆",
                address: destination.name + "老城区 8 号",
                category: "本地菜 · 餐饮",
                description: "本地菜与时令菜单，营业时间需出发前核验。",
                latitude: String(base.latitude + 0.004),
                longitude: String(base.longitude + 0.005),
                rate: 4.7,
                jumpUrl: "https://router.feizhu.com/ws/food-1"
              },
              {
                id: "mock-restaurant-2",
                name: destination.name + "街巷小吃",
                address: destination.name + "步行街 12 号",
                category: "小吃 · 餐饮",
                description: "适合晚间简餐，排队情况需现场确认。",
                latitude: String(base.latitude - 0.003),
                longitude: String(base.longitude + 0.002),
                rate: 4.5,
                jumpUrl: "https://router.feizhu.com/ws/food-2"
              }
            ];
            const attractionItems = [
              {
                id: "mock-poi-1",
                name: destination.name + "秋色公园",
                address: destination.name + "市中心",
                category: "自然风光",
                description: "飞猪景点数据：适合秋季散步，建议出发前核验开放时间。",
                latitude: String(base.latitude + 0.01),
                longitude: String(base.longitude + 0.01),
                ticketInfo: { ticketName: "成人票", price: "¥20" },
                jumpUrl: "https://example.com/poi/1"
              },
              {
                id: "mock-poi-2",
                name: destination.name + "城市博物馆",
                address: destination.name + "市中心",
                category: "历史古迹",
                description: "飞猪景点数据：适合半日参观。",
                latitude: String(base.latitude - 0.008),
                longitude: String(base.longitude - 0.006),
                ticketInfo: null
              }
            ];
            payload = {
              status: 0,
              message: "success",
              data: {
                itemList: /美食|餐饮/.test(String(args.category || ""))
                  ? restaurantItems
                  : attractionItems
              }
            };
          } else if (tool === "fliggy_ai_search") {
            payload = {
              status: 0,
              message: "success",
              data: "# 行程建议\\n\\n- 住万豪系酒店，少换乘\\n- 秋色景点安排在上午\\n- 出发前核验余票与营业时间"
            };
          } else {
            payload = {
              status: 0,
              message: "success",
              data: {
                itemList: [
                  {
                    price: "88",
                    jumpUrl: "https://example.com/train",
                    journeys: [
                      {
                        journeyType: "直达",
                        totalDuration: "90",
                        segments: [
                          {
                            transportType: "火车",
                            marketingTransportNo: "G7001",
                            depStationName: "上海站",
                            depDateTime: args.depDate + " 08:00:00",
                            arrStationName: args.destination + "站",
                            arrDateTime: args.depDate + " 09:30:00",
                            duration: "90",
                            seatClassName: "二等座"
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            };
          }
          setTimeout(
            () =>
              window.onNativeFlyAiResult(requestId, JSON.stringify(payload)),
            80
          );
        }
      };
    })()`);
    await sleep(250);

    const screens = [];
    const layouts = [];
    async function snap(name) {
      const layout = await client.evaluate(
        "(()=>{const r=document.querySelector('.bottom-nav').getBoundingClientRect();return {route:location.hash,viewport:{w:window.innerWidth,h:window.innerHeight},scrollWidth:document.documentElement.scrollWidth,overflowX:document.documentElement.scrollWidth-window.innerWidth,navTop:r.top,navBottom:r.bottom,mainText:document.querySelector('#app-main').innerText.slice(0,70)}})()"
      );
      layouts.push(Object.assign({ name }, layout));
      screens.push(await client.screenshot(name));
    }
    await snap("01-home");

    const homeState = await client.evaluate(
      "({hasPlanningForm:Boolean(document.querySelector('#search-form')),actions:document.querySelectorAll('.home-action-card').length,hasAutumnInspiration:document.body.innerText.includes('秋日灵感')})"
    );
    await client.evaluate("document.querySelector('[data-nav=map]').click();");
    await sleep(2600);
    const mapState = await client.evaluate(
      "({pins:document.querySelectorAll('.amap-price-marker').length,selected:document.querySelector('.map-selected strong')?.textContent,cities:document.querySelectorAll('#map-city-select option').length,fillMissing:document.querySelector('[data-action=fill-missing-flyai-prices]')?.textContent.trim()||null,mapZoom:document.querySelector('#amap-map')?.dataset.mapZoom||null,mapReady:Boolean(document.querySelector('#amap-map .amap-maps')),mapCanvas:document.querySelectorAll('#amap-map canvas').length,locateButton:Boolean(document.querySelector('[data-action=locate-map]')),pointsValue:document.querySelector('.map-points-value')?.textContent.trim()||null})"
    );
    await snap("04-map");
    await client.evaluate(
      "document.querySelector('[data-action=locate-map]').click();"
    );
    await sleep(700);
    const locationState = await client.evaluate(
      "({marker:Boolean(document.querySelector('.amap-location-marker')),loading:document.querySelector('[data-action=locate-map]')?.classList.contains('is-loading'),zoom:document.querySelector('#amap-map')?.dataset.mapZoom||null,center:document.querySelector('#amap-map')?.dataset.mapCenter||null})"
    );
    if (!locationState.marker || locationState.loading) {
      throw new Error("Current-location map interaction failed");
    }
    await client.evaluate(`(() => {
      window.AndroidAmapApi = {
        request(requestId, path) {
          const payload = path === "geocode/geo"
            ? {
                status: "1",
                geocodes: [{
                  formatted_address: "上海市黄浦区人民广场",
                  location: "121.475200,31.230400"
                }]
              }
            : { status: "1", pois: [] };
          setTimeout(
            () => window.onNativeAmapResult(requestId, JSON.stringify(payload)),
            30
          );
        }
      };
      document.querySelector("#map-address-input").value = "人民广场";
      document.querySelector("#map-address-form").requestSubmit();
    })()`);
    await sleep(700);
    const addressSearchState = await client.evaluate(
      "({result:document.querySelector('.map-address-result')?.innerText||null,addressMarker:Boolean(document.querySelector('.amap-address-marker')),cards:document.querySelectorAll('.hotel-card').length,firstCard:document.querySelector('.hotel-card')?.innerText.slice(0,180)||null})"
    );
    if (
      !addressSearchState.result ||
      !addressSearchState.result.includes("人民广场") ||
      !addressSearchState.addressMarker ||
      !addressSearchState.firstCard?.includes("距地址")
    ) {
      throw new Error("Map address-nearby search failed");
    }
    await snap("04b-map-address");
    await client.evaluate(
      "delete window.AndroidAmapApi; document.querySelector('[data-action=clear-map-address]').click();"
    );
    await sleep(500);

    const firstMapHotel = await client.evaluate(
      "document.querySelector('.map-selected strong')?.textContent"
    );
    await client.evaluate(
      "document.querySelector('[data-action=refresh-flyai-prices]').click();"
    );
    await sleep(900);
    const flyAiMapState = await client.evaluate(
      "({message:document.querySelector('.map-filter-card .micro')?.textContent,priced:document.querySelectorAll('.amap-price-marker').length,selectedPrice:document.querySelector('.map-selected p')?.textContent})"
    );
    await client.evaluate(
      "document.querySelector('[data-action=refresh-city-prices]').click();"
    );
    await sleep(250);
    const officialButtonState = await client.evaluate(
      "({text:document.querySelector('[data-action=refresh-city-prices]')?.textContent.trim(),calls:window.__officialCalls.length})"
    );
    await client.evaluate(
      "(()=>{const select=document.querySelector('#map-city-select');select.value='suzhou';select.dispatchEvent(new Event('change',{bubbles:true}));})()"
    );
    await sleep(900);
    const selectedCityBeforeBack = await client.evaluate(
      "({city:document.querySelector('#map-city-select')?.value,zoom:document.querySelector('#amap-map')?.dataset.mapZoom||null,center:document.querySelector('#amap-map')?.dataset.mapCenter||null,viewCity:document.querySelector('#amap-map')?.dataset.mapCity||null})"
    );
    if (
      selectedCityBeforeBack.viewCity !== "suzhou" ||
      !selectedCityBeforeBack.center ||
      selectedCityBeforeBack.center === locationState.center
    ) {
      throw new Error("Map did not refit to the newly selected city");
    }

    const syncState = await client.evaluate(
      "(()=>{const destinationId=document.querySelector('#map-city-select').value;const activeId=document.querySelector('.amap-price-marker')?.dataset.hotelId;const hotel=APP_DATA.hotels.find(h=>h.id===activeId)||APP_DATA.hotels.find(h=>h.destinationId===destinationId);if(!hotel)return {ok:false};window.onNativeHotelSyncResult(JSON.stringify({destinationId,checkIn:'2026-10-19',checkOut:'2026-10-20',total:1,hotels:[{id:hotel.id,name:hotel.name,nameEn:hotel.nameEn,brandId:hotel.brandId,brandName:hotel.brand,latitude:hotel.coords.latitude,longitude:hotel.coords.longitude,price:688,totalPrice:799,pointsPrice:22000,rating:hotel.rating,reviewCount:hotel.reviewCount,seoNickname:'test'}]}));return {ok:true,id:hotel.id,price:hotel.price,pointsPrice:hotel.pointsPrice,status:document.querySelector('.map-filter-card .micro')?.textContent};})()"
    );
    await sleep(450);
    const pointsValueState = await client.evaluate(
      "({mapText:document.querySelector('.map-points-value')?.textContent.trim()||null,cards:document.querySelectorAll('.hotel-points-value').length})"
    );
    if (!pointsValueState.mapText || !pointsValueState.mapText.includes("约值")) {
      throw new Error("Points-to-cash valuation is missing from the map introduction");
    }
    const mapViewBeforeHotel = await client.evaluate(
      "({zoom:document.querySelector('#amap-map')?.dataset.mapZoom||null,center:document.querySelector('#amap-map')?.dataset.mapCenter||null,viewCity:document.querySelector('#amap-map')?.dataset.mapCity||null})"
    );

    await client.evaluate(
      "(document.querySelector('.amap-price-marker.is-featured')||document.querySelector('.amap-price-marker')).click();"
    );
    await sleep(700);
    const clickedMapHotel = await client.evaluate(
      "document.querySelector('.hotel-detail-hero h1')?.textContent"
    );
    await client.evaluate(
      "document.querySelector('[data-action=load-hotel-insight]')?.click();"
    );
    await sleep(1200);
    const insightState = await client.evaluate(
      "({score:document.querySelector('.review-score-block strong')?.textContent,rooms:document.querySelectorAll('.room-rate-card').length,facilityGroups:document.querySelectorAll('.facility-groups > div').length,reviewCount:document.querySelectorAll('.insight-evidence article').length,notOfficial:document.body.innerText.includes('不是酒店官网评分'),hasEvidenceSection:document.body.innerText.includes('住客证据摘要'),hasWatchouts:document.body.innerText.includes('需要留意'),hasBookingLink:document.body.innerText.includes('飞猪订房'),redemptionVerdict:document.querySelector('.redemption-verdict')?.textContent.trim()||null,flashSaleVerdict:document.querySelector('.flash-sale-verdict')?.textContent.trim()||null,flashSaleToggle:Boolean(document.querySelector('[data-action=toggle-flash-sale-eligibility]')),facilityTextLength:Array.from(document.querySelectorAll('.facility-groups p')).reduce((n,x)=>n+x.textContent.length,0),policyCards:document.querySelectorAll('.policy-grid > div').length,budgetLabel:Array.from(document.querySelectorAll('.hotel-summary-cell span')).map(x=>x.textContent)})"
    );
    if (
      insightState.hasWatchouts ||
      !insightState.redemptionVerdict ||
      !/积分|现金/.test(insightState.redemptionVerdict) ||
      insightState.facilityTextLength > 900 ||
      insightState.policyCards > 4
    ) {
      throw new Error("Hotel detail simplification or redemption verdict regression");
    }
    await client.evaluate(
      "document.querySelector('[data-action=toggle-flash-sale-eligibility]')?.click();"
    );
    await sleep(300);
    const flashSaleConfirmedState = await client.evaluate(
      "({confirmed:document.querySelector('.flash-sale-verdict')?.classList.contains('is-confirmed'),text:document.querySelector('.flash-sale-verdict')?.textContent.trim()||null,saved:Object.values(JSON.parse(localStorage.getItem('lvban.flashSaleEligibility.v1')||'{}')).some(Boolean)})"
    );
    if (
      !insightState.flashSaleVerdict ||
      !insightState.flashSaleToggle ||
      !flashSaleConfirmedState.confirmed ||
      !flashSaleConfirmedState.saved
    ) {
      throw new Error("Flash-sale package comparison regression");
    }
    await client.evaluate(
      "document.querySelector('[data-action=open-fliggy-booking]')?.click();"
    );
    const fliggyOpenState = await client.evaluate(
      "({calls:window.__fliggyOpenCalls.length,url:window.__fliggyOpenCalls[0]||null})"
    );
    if (!fliggyOpenState.calls || !fliggyOpenState.url.includes("feizhu.com")) {
      throw new Error("Fliggy app bridge was not invoked for the booking button");
    }
    await client.evaluate("history.back();");
    await sleep(900);
    const selectedCityAfterBack = await client.evaluate(
      "({city:document.querySelector('#map-city-select')?.value,zoom:document.querySelector('#amap-map')?.dataset.mapZoom||null,center:document.querySelector('#amap-map')?.dataset.mapCenter||null,viewCity:document.querySelector('#amap-map')?.dataset.mapCity||null,restoredView:document.querySelector('#amap-map')?.dataset.restoredView||null,restoreZoom:document.querySelector('#amap-map')?.dataset.restoreZoom||null})"
    );
    const mapHistoryState = await client.evaluate("history.state");
    if (
      mapViewBeforeHotel.viewCity !== selectedCityAfterBack.city ||
      mapViewBeforeHotel.zoom !== selectedCityAfterBack.zoom ||
      mapViewBeforeHotel.center !== selectedCityAfterBack.center
    ) {
      throw new Error(
        "Map city or view range was not preserved after hotel back: " +
          JSON.stringify({
            selectedCityBeforeBack,
            mapViewBeforeHotel,
            selectedCityAfterBack,
            mapHistoryState
          })
      );
    }
    await client.evaluate(
      "document.querySelector('.hotel-card [data-action=view-hotel]').click();"
    );
    await sleep(450);
    await snap("05-hotel");

    await client.evaluate("document.querySelector('[data-nav=rankings]').click();");
    await sleep(400);
    const rankState = await client.evaluate(
      "({rows:document.querySelectorAll('.ranking-row').length,title:document.querySelector('.rank-header h1')?.textContent})"
    );
    await snap("07-rankings");

    await client.evaluate(
      "document.querySelector('[data-action=set-rank-brand][data-id=\"万豪\"]').click();"
    );
    await sleep(250);
    const brandRankState = await client.evaluate(
      "({active:document.querySelector('.brand-filter-row .is-active')?.textContent,rows:document.querySelectorAll('.ranking-row').length,first:document.querySelector('.ranking-copy p')?.textContent})"
    );
    await client.evaluate(
      "document.querySelector('[data-action=set-rank-brand][data-id=all]').click();"
    );
    await sleep(250);

    await client.evaluate(
      "document.querySelector('[data-action=set-rank-region][data-id=\"华东\"]').click(); document.querySelector('[data-action=set-rank-mode][data-id=value]').click(); document.querySelector('[data-action=set-rank-band][data-id=\"500to900\"]').click();"
    );
    await sleep(350);
    const valueRankState = await client.evaluate(
      "({rows:document.querySelectorAll('.ranking-row').length,activeRegion:document.querySelector('.region-tab.is-active')?.textContent,activeMode:document.querySelector('.segmented .is-active')?.textContent,activeBand:document.querySelector('.filter-row .is-active')?.textContent})"
    );
    await snap("08-value-rankings");

    await client.evaluate(
      "document.querySelector('[data-action=open-settings]').click();"
    );
    await sleep(250);
    const settingsState = await client.evaluate(
      "(()=>{const form=document.querySelector('#settings-form');const state={hasMonth:Boolean(document.querySelector('#settings-month')),hasBudget:Boolean(document.querySelector('#settings-budget')),styles:Array.from(document.querySelectorAll('#settings-travel-style option')).map(x=>x.textContent)};document.querySelector('#settings-travel-style').value='distinctive';form.requestSubmit();return state;})()"
    );
    await sleep(250);
    const savedPreference = await client.evaluate(
      "({travelStyle:JSON.parse(localStorage.getItem('lvban.prefs.v1')||'{}').travelStyle,sheetClosed:document.querySelector('#sheet')?.hidden})"
    );
    if (
      settingsState.hasMonth ||
      settingsState.hasBudget ||
      savedPreference.travelStyle !== "distinctive"
    ) {
      throw new Error("Settings preference regression");
    }

    await client.evaluate("document.querySelector('[data-nav=trip]').click();");
    await sleep(400);
    const plannerFormState = await client.evaluate(
      "({hasForm:Boolean(document.querySelector('#planner-form')),tab:document.querySelector('.trip-tab.is-active')?.textContent,profile:document.querySelector('.profile-banner')?.innerText||null})"
    );
    await snap("09-trip");
    await client.evaluate(
      "(()=>{document.querySelector('#planner-origin').value='上海';document.querySelector('#planner-destination').value='南京';document.querySelector('#planner-date').value='2026-10-22';document.querySelector('#planner-days').value='3';document.querySelector('#planner-people').value='2';document.querySelector('#planner-budget').value='5000';document.querySelector('#planner-interest').value='赏秋、咖啡、博物馆';document.querySelector('#planner-notes').value='想吃本地菜，安排自然风光和名胜古迹，酒店要交通方便';document.querySelector('#planner-pace').value='high';document.querySelector('#planner-form').requestSubmit();})()"
    );
    await sleep(24000);
    const plannerPlanState = await client.evaluate(
      "({days:document.querySelectorAll('.plan-day').length,route:document.querySelector('.route-stats strong')?.textContent,transport:document.querySelector('.transport-option strong')?.textContent||null,deepseekBrief:document.querySelector('.ai-plan-note p')?.textContent.slice(0,120)||null,flyAiBrief:document.querySelector('.flyai-brief > div')?.textContent.slice(0,80)||null,error:document.querySelector('.planner-status.error')?.textContent||null,loading:document.querySelector('.planner-status.loading')?.textContent||null,pace:document.querySelector('#planner-pace')?.value,interest:document.querySelector('#planner-interest')?.value,notes:document.querySelector('#planner-notes')?.value,travelStyle:JSON.parse(localStorage.getItem('lvban.tripPlan.v1')||'{}').travelStyle||JSON.parse(localStorage.getItem('lvban.plannerDraft.v1')||'{}').travelStyle,hasUndefined:document.body.innerText.includes('undefined'),foodRendered:Array.from(document.querySelectorAll('.plan-entry')).some(x=>/当地美食|餐饮|小吃/.test(x.innerText)),hotelOptions:document.querySelectorAll('#trip-hotel-select option').length,amapHref:document.querySelector('.plan-actions a')?.getAttribute('href')||null,total:document.querySelector('.plan-budget-summary strong')?.textContent||null,meituanRestaurant:document.querySelector('.meituan-restaurant-copy')?.textContent.slice(0,160)||null,meituanCalls:window.__meituanCalls.length,restaurantSourceNote:document.querySelector('.restaurant-source-note')?.textContent||null,placeCategories:(JSON.parse(localStorage.getItem('lvban.tripPlan.v1')||'{}').placeCategories||[]).slice(0,12),foodPlaces:(JSON.parse(localStorage.getItem('lvban.tripPlan.v1')||'{}').placeCategories||[]).filter(x=>/美食|餐饮|小吃/.test((x.category||'')+(x.type||''))).slice(0,8),places:Array.from(document.querySelectorAll('.plan-entry strong')).slice(0,20).map(x=>x.textContent)})"
    );
    const hotelSwitchState = await client.evaluate(
      "(()=>{const select=document.querySelector('#trip-hotel-select');if(!select||select.options.length<2)return null;const before=document.querySelector('.plan-budget-summary strong')?.textContent;select.value=select.options[1].value;select.dispatchEvent(new Event('change',{bubbles:true}));return {before,after:document.querySelector('.plan-budget-summary strong')?.textContent,selected:select.value};})()"
    );
    if (
      plannerPlanState.hasUndefined ||
      !plannerPlanState.deepseekBrief ||
      !plannerPlanState.amapHref.startsWith("amapuri://") ||
      (!plannerPlanState.foodRendered && !plannerPlanState.meituanRestaurant) ||
      !plannerPlanState.meituanRestaurant ||
      !plannerPlanState.meituanCalls ||
      plannerPlanState.travelStyle !== "distinctive" ||
      !hotelSwitchState ||
      hotelSwitchState.before === hotelSwitchState.after
    ) {
      console.error(
        "Planner assertion details:",
        JSON.stringify({ plannerPlanState, hotelSwitchState }, null, 2)
      );
      throw new Error("Planner regression: missing category, route, or hotel cost update");
    }
    await snap("10-planner");
    await client.evaluate(
      "document.querySelector('[data-action=set-trip-tab][data-id=tools]').click();"
    );
    await sleep(300);
    await snap("11-member-tools");

    await client.evaluate("document.querySelector('[data-nav=directory]').click();");
    await sleep(500);
    const directoryState = await client.evaluate(
      "(()=>{const cards=[...document.querySelectorAll('.directory-entry')];return {cards:cards.length,summaryMin:Math.min(...cards.map(card=>Array.from(card.querySelector('.directory-summary')?.textContent||'').length)),summaryMax:Math.max(...cards.map(card=>Array.from(card.querySelector('.directory-summary')?.textContent||'').length)),brands:[...new Set(cards.map(card=>card.querySelector('.inline-chip')?.textContent))].slice(0,8)}})()"
    );
    await snap("12-directory");

    await client.evaluate("document.querySelector('[data-nav=home]').click();");
    await sleep(300);
    const homeReturnState = await client.evaluate(
      "({hasPlanningForm:Boolean(document.querySelector('#search-form')),hasMapAction:Boolean(document.querySelector('[data-action=go-map]'))})"
    );
    await snap("13-home-return");
    const flyAiCalls = await client.evaluate("window.__flyAiCalls");
    if (
      flyAiCalls.some(
        (call) =>
          call.tool === "search_marriott_hotels" &&
          Object.prototype.hasOwnProperty.call(call.args || {}, "limit")
      )
    ) {
      throw new Error("search_marriott_hotels must not send unsupported limit");
    }

    console.log(
      JSON.stringify(
        {
          homeState,
          mapState,
          locationState,
          addressSearchState,
          firstMapHotel,
          clickedMapHotel,
          selectedCityBeforeBack,
          mapViewBeforeHotel,
          selectedCityAfterBack,
          mapHistoryState,
          insightState,
          flashSaleConfirmedState,
          fliggyOpenState,
          flyAiMapState,
          officialButtonState,
          syncState,
          pointsValueState,
          rankState,
          brandRankState,
          valueRankState,
          settingsState,
          savedPreference,
          plannerFormState,
          plannerPlanState,
          hotelSwitchState,
          directoryState,
          homeReturnState,
          flyAiCalls,
          layouts,
          screens,
          errors: client.errors,
          consoleMessages: client.consoleMessages
        },
        null,
        2
      )
    );
    if (client.errors.length) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.stack || error);
    process.exitCode = 1;
  } finally {
    if (client) client.close();
    chrome.kill();
  }
})();
