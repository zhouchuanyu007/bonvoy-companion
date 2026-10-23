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
                    JSON.stringify({
                      attractions: [
                        {
                          name: "南京秋色公园",
                          address: "南京市玄武区",
                          reason: "高德可定位的秋季自然风光"
                        },
                        {
                          name: "南京城市博物馆",
                          address: "南京市秦淮区",
                          reason: "适合半日参观的历史人文景点"
                        }
                      ],
                      restaurants: [
                        {
                          name: "南京大牌档（夫子庙老门东店）",
                          address: "秦淮区老门东",
                          cuisine: "南京菜",
                          reason: "大众点评必吃榜上榜品牌，适合体验本地小吃"
                        },
                        {
                          name: "金陵小厨·南京菜·淮扬菜（夫子庙店）",
                          address: "秦淮区贡院街",
                          cuisine: "淮扬菜",
                          reason: "本地高分餐厅"
                        }
                      ]
                    })
                })
              ),
            110
          );
        }
      };
      window.AndroidAmapApi = {
        request(requestId, path, query) {
          const params = new URLSearchParams(query || "");
          let payload;
          if (path === "geocode/geo") {
            const address = String(params.get("address") || "");
            const nanjing = /南京/.test(address);
            payload = {
              status: "1",
              geocodes: [{
                formatted_address: address,
                adcode: nanjing ? "320100" : "310000",
                location: nanjing ? "118.796624,32.059344" : "121.473667,31.230525"
              }]
            };
          } else if (path === "place/text") {
            const keyword = String(params.get("keywords") || "");
            const nanjing = /南京/.test(String(params.get("city") || ""));
            payload = {
              status: "1",
              pois: [{
                id: "mock-amap-" + keyword,
                name: keyword,
                address: (nanjing ? "南京市" : "上海市") + "测试地址",
                type: "风景名胜",
                location: nanjing ? "118.82,32.04" : "121.47,31.23",
                biz_ext: { rating: "4.7" }
              }]
            };
          } else if (path === "direction/driving") {
            payload = {
              status: "1",
              route: {
                paths: [{
                  distance: "299000",
                  duration: "14400",
                  tolls: "120"
                }]
              }
            };
          } else if (path === "weather/weatherInfo") {
            payload = {
              status: "1",
              forecasts: [{
                casts: [
                  { date: "2026-10-22", dayweather: "多云", nightweather: "晴", daytemp: "21", nighttemp: "13", daywind: "东北", daypower: "1-3" },
                  { date: "2026-10-23", dayweather: "小雨", nightweather: "阴", daytemp: "19", nighttemp: "12", daywind: "东", daypower: "1-3" },
                  { date: "2026-10-24", dayweather: "晴", nightweather: "晴", daytemp: "22", nighttemp: "14", daywind: "东南", daypower: "1-3" }
                ]
              }]
            };
          } else {
            payload = { status: "1", pois: [] };
          }
          setTimeout(
            () => window.onNativeAmapResult(requestId, JSON.stringify(payload)),
            30
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
      "document.querySelector('[data-action=clear-map-address]').click();"
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
      "(()=>{const destinationId=document.querySelector('#map-city-select').value;const activeId=document.querySelector('.amap-price-marker')?.dataset.hotelId;const hotel=APP_DATA.hotels.find(h=>h.id===activeId)||APP_DATA.hotels.find(h=>h.destinationId===destinationId);if(!hotel)return {ok:false};window.onNativeHotelSyncResult(JSON.stringify({destinationId,checkIn:'2026-10-22',checkOut:'2026-10-23',total:1,hotels:[{id:hotel.id,name:hotel.name,nameEn:hotel.nameEn,brandId:hotel.brandId,brandName:hotel.brand,latitude:hotel.coords.latitude,longitude:hotel.coords.longitude,price:688,totalPrice:799,pointsPrice:22000,pointsPromotion:{bonusPoints:3000,title:'额外赠送3000积分',validTo:'2026-11-30',source:'测试官方活动'},rating:hotel.rating,reviewCount:hotel.reviewCount,seoNickname:'test'}]}));return {ok:true,id:hotel.id,price:hotel.price,pointsPrice:hotel.pointsPrice,status:document.querySelector('.map-filter-card .micro')?.textContent};})()"
    );
    await sleep(450);
    const pointsValueState = await client.evaluate(
      "({mapText:document.querySelector('.map-points-value')?.textContent.trim()||null,mapPromotion:document.querySelector('.map-points-promotion')?.textContent.trim()||null,cards:document.querySelectorAll('.hotel-points-value').length,promotionCards:document.querySelectorAll('.hotel-points-promotion').length})"
    );
    if (
      !pointsValueState.mapText ||
      !pointsValueState.mapText.includes("约值") ||
      !pointsValueState.mapPromotion ||
      !pointsValueState.mapPromotion.includes("3,000")
    ) {
      throw new Error("Points valuation or bonus-points promotion is missing");
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
      "({score:document.querySelector('.review-score-block strong')?.textContent,rooms:document.querySelectorAll('.room-rate-card').length,facilityGroups:document.querySelectorAll('.facility-groups > div').length,reviewCount:document.querySelectorAll('.insight-evidence article').length,notOfficial:document.body.innerText.includes('不是酒店官网评分'),hasEvidenceSection:document.body.innerText.includes('住客证据摘要'),hasWatchouts:document.body.innerText.includes('需要留意'),hasBookingLink:document.body.innerText.includes('飞猪订房'),redemptionVerdict:document.querySelector('.redemption-verdict')?.textContent.trim()||null,pointsPromotion:document.querySelector('.points-promotion-detail')?.textContent.trim()||null,hasFlashSale:document.body.innerText.includes('闪促套餐判断'),facilityTextLength:Array.from(document.querySelectorAll('.facility-groups p')).reduce((n,x)=>n+x.textContent.length,0),policyCards:document.querySelectorAll('.policy-grid > div').length,budgetLabel:Array.from(document.querySelectorAll('.hotel-summary-cell span')).map(x=>x.textContent)})"
    );
    if (
      insightState.hasWatchouts ||
      insightState.hasFlashSale ||
      !insightState.redemptionVerdict ||
      !insightState.pointsPromotion ||
      !insightState.pointsPromotion.includes("3,000") ||
      !/积分|现金/.test(insightState.redemptionVerdict) ||
      insightState.facilityTextLength > 900 ||
      insightState.policyCards > 4
    ) {
      throw new Error("Hotel detail simplification or redemption verdict regression");
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
      "({rows:document.querySelectorAll('.value-row').length,champions:document.querySelectorAll('.champion').length,title:document.querySelector('.value-header h1')?.textContent})"
    );
    await snap("07-rankings");

    await client.evaluate(
      "(()=>{const s=document.querySelector('#rank-brand');s.value='万豪';s.dispatchEvent(new Event('change',{bubbles:true}));})()"
    );
    await sleep(250);
    const brandRankState = await client.evaluate(
      "({active:document.querySelector('#rank-brand')?.value,rows:document.querySelectorAll('.value-row').length,first:document.querySelector('.value-meta')?.textContent})"
    );
    await client.evaluate(
      "(()=>{const s=document.querySelector('#rank-brand');s.value='all';s.dispatchEvent(new Event('change',{bubbles:true}));})()"
    );
    await sleep(250);

    await client.evaluate(
      "(()=>{const s=document.querySelector('#rank-scope');s.value='region:华东';s.dispatchEvent(new Event('change',{bubbles:true}));})(); document.querySelector('[data-action=set-rank-season][data-id=winter]').click(); document.querySelector('[data-action=set-rank-band][data-id=\"500to900\"]').click(); document.querySelector('[data-action=toggle-rank-ledger]')?.click();"
    );
    await sleep(350);
    const valueRankState = await client.evaluate(
      "({rows:document.querySelectorAll('.value-row').length,scope:document.querySelector('#rank-scope')?.value,activeSeason:document.querySelector('[data-action=set-rank-season].is-active')?.textContent,activeBand:document.querySelector('.value-bands .is-active')?.textContent,ledger:Boolean(document.querySelector('.value-ledger'))})"
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
      "({days:document.querySelectorAll('.plan-day').length,route:document.querySelector('.route-stats strong')?.textContent,transport:document.querySelector('.transport-option strong')?.textContent||null,deepseekBrief:document.querySelector('.ai-plan-note p')?.textContent.slice(0,120)||null,error:document.querySelector('.planner-status.error')?.textContent||null,loading:document.querySelector('.planner-status.loading')?.textContent||null,pace:document.querySelector('#planner-pace')?.value,interest:document.querySelector('#planner-interest')?.value,notes:document.querySelector('#planner-notes')?.value,travelStyle:JSON.parse(localStorage.getItem('lvban.tripPlan.v1')||'{}').travelStyle||JSON.parse(localStorage.getItem('lvban.plannerDraft.v1')||'{}').travelStyle,hasUndefined:document.body.innerText.includes('undefined'),foodRendered:Array.from(document.querySelectorAll('.plan-entry')).some(x=>/当地美食|餐饮|小吃/.test(x.innerText)),hotelOptions:document.querySelectorAll('#trip-hotel-select option').length,amapHref:document.querySelector('.plan-actions a')?.getAttribute('href')||null,total:document.querySelector('.plan-budget-summary strong')?.textContent||null,weatherCount:document.querySelectorAll('.plan-weather').length,weatherText:document.querySelector('.plan-weather')?.textContent||null,attractionCards:document.querySelectorAll('.meituan-attractions-section .restaurant-card').length,restaurantCards:document.querySelectorAll('.restaurant-section:not(.meituan-attractions-section) .restaurant-card').length,meituanCalls:window.__meituanCalls.length,restaurantSourceNote:document.querySelector('.restaurant-source-note')?.textContent||null,sourceBadge:document.querySelector('.source-badge')?.textContent||null,placeCategories:(JSON.parse(localStorage.getItem('lvban.tripPlan.v1')||'{}').placeCategories||[]).slice(0,12),foodPlaces:(JSON.parse(localStorage.getItem('lvban.tripPlan.v1')||'{}').placeCategories||[]).filter(x=>/美食|餐饮|小吃/.test((x.category||'')+(x.type||''))).slice(0,8),places:Array.from(document.querySelectorAll('.plan-entry strong')).slice(0,20).map(x=>x.textContent)})"
    );
    const hotelSwitchState = await client.evaluate(
      "(()=>{const select=document.querySelector('#trip-hotel-select');if(!select||select.options.length<2)return null;const before=document.querySelector('.plan-budget-summary strong')?.textContent;select.value=select.options[1].value;select.dispatchEvent(new Event('change',{bubbles:true}));return {before,after:document.querySelector('.plan-budget-summary strong')?.textContent,selected:select.value};})()"
    );
    if (
      plannerPlanState.hasUndefined ||
      !plannerPlanState.deepseekBrief ||
      !plannerPlanState.amapHref.startsWith("amapuri://") ||
      (!plannerPlanState.foodRendered && !plannerPlanState.restaurantCards) ||
      !plannerPlanState.attractionCards ||
      !plannerPlanState.restaurantCards ||
      !plannerPlanState.weatherCount ||
      !plannerPlanState.weatherText?.includes("高德天气") ||
      !plannerPlanState.meituanCalls ||
      plannerPlanState.travelStyle !== "distinctive" ||
      !hotelSwitchState ||
      !hotelSwitchState.selected
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
    if (
      flyAiCalls.some((call) =>
        ["search_poi", "fliggy_ai_search"].includes(call.tool)
      )
    ) {
      throw new Error("Planner must use Meituan for POI instead of FlyAI");
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
