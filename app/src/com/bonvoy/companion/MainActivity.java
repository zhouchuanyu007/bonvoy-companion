package com.bonvoy.companion;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.location.Criteria;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public class MainActivity extends Activity {
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String START_URL =
            "https://" + ASSET_HOST + "/assets/www/index.html";
    private WebView webView;
    private FrameLayout rootLayout;
    private ProgressBar loadingView;
    private WebView syncWebView;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean syncScriptStarted = false;
    private static final int LOCATION_PERMISSION_REQUEST = 4102;
    private String pendingLocationRequestId;
    private LocationListener pendingLocationListener;
    private Runnable pendingLocationTimeout;
    private static final String FLIGGY_PACKAGE = "com.taobao.trip";
    private static final String AMAP_KEY = BuildConfig.AMAP_KEY;
    private static final String DEEPSEEK_KEY = BuildConfig.DEEPSEEK_KEY;
    private static final String FLYAI_MCP_URL = "https://flyai.open.fliggy.com/mcp";
    private static final String FLYAI_API_KEY = BuildConfig.FLYAI_API_KEY;
    // The signing material is distributed by the official flyai-cli package. It
    // authenticates the client shape; the API key above authorizes the account.
    private static final String FLYAI_SIGN_SECRET = BuildConfig.FLYAI_SIGN_SECRET;
    private static final String FLYAI_USER_AGENT =
            "BonvoyCompanion/0.12 Android";
    private static final String MEITUAN_TRAVEL_URL =
            "https://mcp-open-cater.meituan.com/v1/api/voyage/openapi/query";
    private static final String MEITUAN_TRAVEL_KEY = BuildConfig.MEITUAN_TRAVEL_KEY;
    private final ExecutorService networkExecutor = Executors.newFixedThreadPool(6);
    private static final Set<String> AMAP_ALLOWED_PATHS = new HashSet<>();
    private static final Set<String> FLYAI_ALLOWED_TOOLS = new HashSet<>();

    static {
        AMAP_ALLOWED_PATHS.add("geocode/geo");
        AMAP_ALLOWED_PATHS.add("place/text");
        AMAP_ALLOWED_PATHS.add("place/around");
        AMAP_ALLOWED_PATHS.add("direction/driving");
        AMAP_ALLOWED_PATHS.add("direction/transit/integrated");
        AMAP_ALLOWED_PATHS.add("direction/walking");
        AMAP_ALLOWED_PATHS.add("weather/weatherInfo");

        FLYAI_ALLOWED_TOOLS.add("search_marriott_hotels");
        FLYAI_ALLOWED_TOOLS.add("get_marriott_hotel_info");
        FLYAI_ALLOWED_TOOLS.add("search_domestic_train");
        FLYAI_ALLOWED_TOOLS.add("search_flight");
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(15, 40, 67));
        window.setNavigationBarColor(Color.rgb(246, 243, 236));

        int flags = window.getDecorView().getSystemUiVisibility();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        window.getDecorView().setSystemUiVisibility(flags);

        rootLayout = new FrameLayout(this);
        rootLayout.setBackgroundColor(Color.rgb(246, 243, 236));

        loadingView = new ProgressBar(this);
        FrameLayout.LayoutParams loadingParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
        );
        rootLayout.addView(loadingView, loadingParams);
        setContentView(rootLayout);

        try {
            webView = new WebView(this);
            webView.setBackgroundColor(Color.rgb(246, 243, 236));

            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setAllowFileAccess(false);
            settings.setAllowContentAccess(false);
            settings.setAllowFileAccessFromFileURLs(false);
            settings.setAllowUniversalAccessFromFileURLs(false);
            settings.setSupportZoom(false);
            settings.setBuiltInZoomControls(false);
            settings.setTextZoom(100);

            webView.addJavascriptInterface(new MainHotelSyncBridge(), "AndroidHotelSync");
            webView.addJavascriptInterface(new AppConfigBridge(), "AndroidConfig");
            webView.addJavascriptInterface(new AmapApiBridge(), "AndroidAmapApi");
            webView.addJavascriptInterface(new DeepSeekApiBridge(), "AndroidDeepSeek");
            webView.addJavascriptInterface(new FlyAiApiBridge(), "AndroidFlyAi");
            webView.addJavascriptInterface(new MeituanTravelBridge(), "AndroidMeituanTravel");
            webView.addJavascriptInterface(new LocationBridge(), "AndroidLocation");
            webView.addJavascriptInterface(new FliggyAppBridge(), "AndroidFliggy");
            webView.setWebChromeClient(new WebChromeClient());
            webView.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, String url) {
                    return handleUrl(url);
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    return handleUrl(request.getUrl().toString());
                }

                @Override
                public WebResourceResponse shouldInterceptRequest(
                        WebView view,
                        WebResourceRequest request
                ) {
                    if (ASSET_HOST.equals(request.getUrl().getHost())) {
                        return serveBundledAsset(request.getUrl());
                    }
                    return super.shouldInterceptRequest(view, request);
                }

                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    if (loadingView != null) {
                        loadingView.setVisibility(View.GONE);
                    }
                }

                @Override
                public void onReceivedError(
                        WebView view,
                        WebResourceRequest request,
                        android.webkit.WebResourceError error
                ) {
                    if (request.isForMainFrame()) {
                        showNativeError("应用界面加载失败：" + error.getDescription());
                    }
                }
            });

            rootLayout.addView(
                    webView,
                    new FrameLayout.LayoutParams(
                            FrameLayout.LayoutParams.MATCH_PARENT,
                            FrameLayout.LayoutParams.MATCH_PARENT
                    )
            );
            webView.loadUrl(START_URL);
        } catch (Throwable error) {
            showNativeError(
                    "系统 WebView 不可用。请在系统应用商店更新 Android System WebView 后重试。"
            );
        }
    }

    private boolean handleUrl(String url) {
        if (url == null) {
            return false;
        }
        Uri uri = Uri.parse(url);
        if (ASSET_HOST.equals(uri.getHost())) {
            return false;
        }
        if (url.startsWith("file:") || url.startsWith("about:") || url.startsWith("data:")) {
            return true;
        }
        if (
                url.startsWith("https://") ||
                url.startsWith("http://") ||
                url.startsWith("tel:") ||
                url.startsWith("amapuri://") ||
                url.startsWith("androidamap://")
        ) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                startActivity(intent);
            } catch (ActivityNotFoundException ignored) {
                Toast.makeText(this, "未找到可打开此链接的应用", Toast.LENGTH_SHORT).show();
            }
            return true;
        }
        return true;
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != LOCATION_PERMISSION_REQUEST) return;
        boolean granted = false;
        for (int index = 0; index < permissions.length && index < grantResults.length; index++) {
            boolean locationPermission =
                    Manifest.permission.ACCESS_FINE_LOCATION.equals(permissions[index]) ||
                    Manifest.permission.ACCESS_COARSE_LOCATION.equals(permissions[index]);
            if (
                    locationPermission &&
                    grantResults[index] == PackageManager.PERMISSION_GRANTED
            ) {
                granted = true;
            }
        }
        if (granted) {
            startLocationLookup();
        } else {
            finishLocationError("定位权限未授予，请在系统设置中允许位置权限");
        }
    }

    private void requestCurrentLocation(String requestId) {
        runOnUiThread(() -> {
            if (pendingLocationRequestId != null) {
                notifyLocationError(requestId, "正在定位，请稍候");
                return;
            }
            pendingLocationRequestId =
                    requestId == null || requestId.isEmpty()
                            ? "location-" + System.currentTimeMillis()
                            : requestId;
            boolean fineGranted = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                    == PackageManager.PERMISSION_GRANTED;
            boolean coarseGranted = checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
                    == PackageManager.PERMISSION_GRANTED;
            if (!fineGranted && !coarseGranted) {
                requestPermissions(
                        new String[] {
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                        },
                        LOCATION_PERMISSION_REQUEST
                );
                return;
            }
            startLocationLookup();
        });
    }

    private void startLocationLookup() {
        if (pendingLocationRequestId == null) return;
        LocationManager manager =
                (LocationManager) getSystemService(LOCATION_SERVICE);
        if (manager == null) {
            finishLocationError("系统定位服务不可用");
            return;
        }
        boolean enabled;
        try {
            enabled =
                    manager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                    manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        } catch (RuntimeException ignored) {
            enabled = false;
        }
        if (!enabled) {
            finishLocationError("请先开启手机定位服务");
            return;
        }

        Location best = null;
        for (String provider : new String[] {
                LocationManager.GPS_PROVIDER,
                LocationManager.NETWORK_PROVIDER,
                LocationManager.PASSIVE_PROVIDER
        }) {
            try {
                Location candidate = manager.getLastKnownLocation(provider);
                if (candidate != null && (best == null || candidate.getTime() > best.getTime())) {
                    best = candidate;
                }
            } catch (SecurityException ignored) {
                // The runtime permission check above normally prevents this.
            } catch (RuntimeException ignored) {
                // Some vendors expose providers that are temporarily unavailable.
            }
        }
        if (best != null && System.currentTimeMillis() - best.getTime() <= 10 * 60 * 1000L) {
            finishLocationSuccess(best);
            return;
        }

        boolean fineGranted = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
        Criteria criteria = new Criteria();
        criteria.setAccuracy(
                fineGranted ? Criteria.ACCURACY_FINE : Criteria.ACCURACY_COARSE
        );
        criteria.setAltitudeRequired(false);
        criteria.setBearingRequired(false);
        criteria.setCostAllowed(false);
        final String requestId = pendingLocationRequestId;
        pendingLocationListener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                if (location != null) {
                    finishLocationSuccess(location);
                }
            }

            @Override
            public void onProviderEnabled(String provider) {}

            @Override
            public void onProviderDisabled(String provider) {}

            @Override
            public void onStatusChanged(String provider, int status, Bundle extras) {}
        };
        try {
            manager.requestSingleUpdate(criteria, pendingLocationListener, Looper.getMainLooper());
        } catch (SecurityException error) {
            finishLocationError("定位权限不足，请在系统设置中允许位置权限");
            return;
        } catch (RuntimeException error) {
            finishLocationError("系统暂时无法获取位置，请稍后重试");
            return;
        }
        pendingLocationTimeout = () -> {
            if (requestId != null && requestId.equals(pendingLocationRequestId)) {
                finishLocationError(
                        "定位超时。请确认 GPS/网络定位已开启并在开阔位置重试"
                );
            }
        };
        mainHandler.postDelayed(pendingLocationTimeout, 15000);
    }

    private void cleanupLocationRequest() {
        if (pendingLocationTimeout != null) {
            mainHandler.removeCallbacks(pendingLocationTimeout);
            pendingLocationTimeout = null;
        }
        if (pendingLocationListener != null) {
            try {
                LocationManager manager =
                        (LocationManager) getSystemService(LOCATION_SERVICE);
                if (manager != null) {
                    manager.removeUpdates(pendingLocationListener);
                }
            } catch (RuntimeException ignored) {
                // Ignore cleanup failures from vendor location providers.
            }
            pendingLocationListener = null;
        }
    }

    private void finishLocationSuccess(Location location) {
        String requestId = pendingLocationRequestId;
        pendingLocationRequestId = null;
        cleanupLocationRequest();
        if (requestId == null || webView == null) return;
        webView.evaluateJavascript(
                "window.onNativeLocationResult && window.onNativeLocationResult(" +
                        org.json.JSONObject.quote(requestId) +
                        "," +
                        location.getLatitude() +
                        "," +
                        location.getLongitude() +
                        ",null);",
                null
        );
    }

    private void finishLocationError(String message) {
        String requestId = pendingLocationRequestId;
        pendingLocationRequestId = null;
        cleanupLocationRequest();
        if (requestId == null || webView == null) return;
        notifyLocationError(requestId, message);
    }

    private void notifyLocationError(String requestId, String message) {
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.onNativeLocationResult && window.onNativeLocationResult(" +
                        org.json.JSONObject.quote(requestId) +
                        ",null,null," +
                        org.json.JSONObject.quote(message) +
                        ");",
                null
        );
    }

    private void openFliggy(String url) {
        final String safeUrl = url == null ? "" : url;
        networkExecutor.execute(() -> {
            String target = resolveFliggyHotelTarget(safeUrl);
            runOnUiThread(() -> launchFliggyHotel(safeUrl, target));
        });
    }

    private String resolveFliggyHotelTarget(String url) {
        Uri original = Uri.parse(url);
        String originalHost = original.getHost() == null
                ? ""
                : original.getHost().toLowerCase();
        if (
                "outfliggys.m.taobao.com".equals(originalHost) ||
                originalHost.endsWith(".fliggy.com")
        ) {
            return url;
        }
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setInstanceFollowRedirects(true);
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(15000);
            connection.setRequestProperty(
                    "User-Agent",
                    "Mozilla/5.0 (Linux; Android 14; Pixel 7) " +
                            "AppleWebKit/537.36 (KHTML, like Gecko) " +
                            "Chrome/131.0.0.0 Mobile Safari/537.36"
            );
            connection.setRequestProperty("Accept", "text/html,*/*");
            connection.getResponseCode();
            String finalUrl = connection.getURL().toString();
            String target = Uri.parse(finalUrl).getQueryParameter("targetUrl");
            if (target != null) {
                Uri targetUri = Uri.parse(target);
                String host = targetUri.getHost() == null
                        ? ""
                        : targetUri.getHost().toLowerCase();
                if (
                        "https".equalsIgnoreCase(targetUri.getScheme()) &&
                        (
                                "outfliggys.m.taobao.com".equals(host) ||
                                host.endsWith(".fliggy.com")
                        )
                ) {
                    return target;
                }
            }
        } catch (Throwable ignored) {
            // The original Fliggy router link remains a valid fallback.
        } finally {
            if (connection != null) connection.disconnect();
        }
        return "";
    }

    private void launchFliggyHotel(String originalUrl, String targetUrl) {
        Uri uri = Uri.parse(originalUrl);
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
        boolean allowedHost =
                host.equals("feizhu.com") ||
                host.endsWith(".feizhu.com") ||
                host.equals("fliggy.com") ||
                host.endsWith(".fliggy.com");
        if (!"https".equalsIgnoreCase(uri.getScheme()) || !allowedHost) {
            Toast.makeText(this, "当前链接不是可识别的飞猪链接", Toast.LENGTH_SHORT).show();
            return;
        }
        boolean fliggyInstalled = isPackageInstalled(FLIGGY_PACKAGE);

        if (targetUrl != null && !targetUrl.isEmpty()) {
            Uri tbopenUri = Uri.parse("tbopen://m.taobao.com/tbopen/index.html")
                    .buildUpon()
                    .appendQueryParameter("h5Url", targetUrl)
                    .appendQueryParameter("action", "ali.open.nav")
                    .appendQueryParameter("module", "h5")
                    .appendQueryParameter("bootImage", "0")
                    .appendQueryParameter("source", "slk_dp")
                    .build();
            for (String packageName : new String[] {
                    FLIGGY_PACKAGE,
                    "com.taobao.taobao"
            }) {
                if (!isPackageInstalled(packageName)) continue;
                Intent direct = new Intent(Intent.ACTION_VIEW, tbopenUri);
                direct.setPackage(packageName);
                try {
                    startActivity(direct);
                    return;
                } catch (ActivityNotFoundException ignored) {
                    // Continue to the next installed Alibaba client.
                } catch (RuntimeException ignored) {
                    // Continue to the next installed Alibaba client.
                }
            }
        }

        String[] candidateUrls = new String[] {
                uri.toString(),
                "taobao" + uri.toString().substring("https".length()),
                "fliggy" + uri.toString().substring("https".length())
        };
        for (String candidate : candidateUrls) {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(candidate));
            intent.setPackage(FLIGGY_PACKAGE);
            try {
                startActivity(intent);
                return;
            } catch (ActivityNotFoundException ignored) {
                // Try the next app-registered URL shape.
            } catch (RuntimeException ignored) {
                // A vendor WebView activity may reject this particular URI.
            }
        }

        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(
                FLIGGY_PACKAGE
        );
        if (launchIntent != null) {
            copyTextToClipboard("飞猪酒店链接", originalUrl);
            launchIntent.putExtra(Intent.EXTRA_TEXT, originalUrl);
            try {
                startActivity(launchIntent);
                Toast.makeText(
                        this,
                        "已打开飞猪旅行；酒店链接已复制，可在飞猪内粘贴查看",
                        Toast.LENGTH_LONG
                ).show();
                return;
            } catch (RuntimeException ignored) {
                // Fall through to the final explicit error.
            }
        }
        Toast.makeText(
                this,
                fliggyInstalled
                        ? "飞猪旅行已安装，但系统未能打开其酒店页"
                        : "未检测到飞猪旅行 App，请确认安装的是飞猪旅行正式版",
                Toast.LENGTH_LONG
        ).show();
    }

    private boolean isPackageInstalled(String packageName) {
        try {
            getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException error) {
            return false;
        }
    }

    private void copyTextToClipboard(String label, String text) {
        try {
            ClipboardManager clipboard =
                    (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (clipboard != null) {
                clipboard.setPrimaryClip(ClipData.newPlainText(label, text));
            }
        } catch (RuntimeException ignored) {
            // Clipboard failures must not prevent the app from launching.
        }
    }

    private WebResourceResponse serveBundledAsset(Uri uri) {
        String path = uri.getPath();
        if (path == null || !path.startsWith("/assets/www/") || path.contains("..")) {
            return notFound();
        }
        String relativePath = path.substring("/assets/".length());
        try {
            InputStream input = getAssets().open(relativePath);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            return new WebResourceResponse(
                    mimeTypeFor(relativePath),
                    "UTF-8",
                    200,
                    "OK",
                    headers,
                    input
            );
        } catch (IOException error) {
            return notFound();
        }
    }

    private WebResourceResponse notFound() {
        return new WebResourceResponse(
                "text/plain",
                "UTF-8",
                404,
                "Not Found",
                new HashMap<>(),
                new ByteArrayInputStream(new byte[0])
        );
    }

    private String mimeTypeFor(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".woff")) return "font/woff";
        return "application/octet-stream";
    }

    private String readAsset(String path) throws IOException {
        InputStream input = getAssets().open(path);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        while ((count = input.read(buffer)) >= 0) {
            output.write(buffer, 0, count);
        }
        input.close();
        return new String(output.toByteArray(), StandardCharsets.UTF_8);
    }

    private void requestCitySync(
            String destinationId,
            double latitude,
            double longitude,
            String cityName,
            String checkIn,
            String checkOut
    ) {
        if (syncWebView != null) {
            Toast.makeText(this, "正在更新，请稍候", Toast.LENGTH_SHORT).show();
            return;
        }
        try {
            syncScriptStarted = false;
            syncWebView = new WebView(this);
            syncWebView.setAlpha(0.01f);
            WebSettings settings = syncWebView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setAllowContentAccess(true);
            settings.setUserAgentString(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                            "AppleWebKit/537.36 (KHTML, like Gecko) " +
                            "Chrome/131.0.0.0 Safari/537.36"
            );
            CookieManager cookies = CookieManager.getInstance();
            cookies.setAcceptCookie(true);
            cookies.setAcceptThirdPartyCookies(syncWebView, true);
            syncWebView.addJavascriptInterface(new SyncResultBridge(), "LvbanSyncBridge");
            syncWebView.setWebChromeClient(new WebChromeClient());
            syncWebView.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    String url = request.getUrl().toString();
                    return !url.startsWith("https://www.marriott.com.cn/");
                }

                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    if (syncScriptStarted || !url.contains("marriott.com.cn")) {
                        return;
                    }
                    syncScriptStarted = true;
                    mainHandler.postDelayed(
                            () -> injectOfficialSyncScript(
                                    view,
                                    destinationId,
                                    latitude,
                                    longitude,
                                    cityName,
                                    checkIn,
                                    checkOut
                            ),
                            2200
                    );
                }

                @Override
                public void onReceivedError(
                        WebView view,
                        WebResourceRequest request,
                        android.webkit.WebResourceError error
                ) {
                    if (request.isForMainFrame()) {
                        failCitySync("无法连接万豪官方页面：" + error.getDescription());
                    }
                }
            });

            FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(1, 1);
            params.leftMargin = -2;
            params.topMargin = -2;
            rootLayout.addView(syncWebView, params);
            syncWebView.loadUrl("https://www.marriott.com.cn/search/default.mi");
            mainHandler.postDelayed(() -> {
                if (syncWebView != null) {
                    failCitySync("官方查询超时，请稍后重试");
                }
            }, 60000);
        } catch (Throwable error) {
            failCitySync("无法发起联网更新：" + error.getMessage());
        }
    }

    private void injectOfficialSyncScript(
            WebView view,
            String destinationId,
            double latitude,
            double longitude,
            String cityName,
            String checkIn,
            String checkOut
    ) {
        try {
            String script = readAsset("sync/marriott-sync.js");
            view.evaluateJavascript(script, ignored -> {
                String args =
                        "{destinationId:" + org.json.JSONObject.quote(destinationId) +
                        ",latitude:" + latitude +
                        ",longitude:" + longitude +
                        ",cityName:" + org.json.JSONObject.quote(cityName) +
                        ",checkIn:" + org.json.JSONObject.quote(checkIn) +
                        ",checkOut:" + org.json.JSONObject.quote(checkOut) + "}";
                String call =
                        "window.__lvbanOfficialSync && " +
                        "window.__lvbanOfficialSync(" + args + ");";
                view.evaluateJavascript(call, null);
            });
        } catch (Throwable error) {
            failCitySync("官方同步脚本加载失败：" + error.getMessage());
        }
    }

    private void completeCitySync(String payload) {
        if (webView != null) {
            webView.evaluateJavascript(
                    "window.onNativeHotelSyncResult && window.onNativeHotelSyncResult(" +
                            org.json.JSONObject.quote(payload) +
                            ");",
                    null
            );
        }
        cleanupSyncWebView();
    }

    private void failCitySync(String message) {
        if (webView != null) {
            webView.evaluateJavascript(
                    "window.onNativeHotelSyncError && window.onNativeHotelSyncError(" +
                            org.json.JSONObject.quote(message) +
                            ");",
                    null
            );
        }
        cleanupSyncWebView();
    }

    private void cleanupSyncWebView() {
        if (syncWebView != null) {
            rootLayout.removeView(syncWebView);
            syncWebView.removeJavascriptInterface("LvbanSyncBridge");
            syncWebView.removeAllViews();
            syncWebView.destroy();
            syncWebView = null;
        }
        syncScriptStarted = false;
    }

    private class MainHotelSyncBridge {
        @JavascriptInterface
        public void requestCitySync(
                String destinationId,
                double latitude,
                double longitude,
                String cityName,
                String checkIn,
                String checkOut
        ) {
            runOnUiThread(
                    () -> MainActivity.this.requestCitySync(
                            destinationId,
                            latitude,
                            longitude,
                            cityName,
                            checkIn,
                            checkOut
                    )
            );
        }
    }

    private class AppConfigBridge {
        @JavascriptInterface
        public String getAmapKey() {
            return AMAP_KEY;
        }
    }

    private class AmapApiBridge {
        @JavascriptInterface
        public void request(String requestId, String path, String query) {
            final String safeRequestId = requestId == null ? "" : requestId;
            final String safePath = path == null ? "" : path;
            final String safeQuery = query == null ? "" : query;
            networkExecutor.execute(() -> {
                HttpURLConnection connection = null;
                try {
                    if (!AMAP_ALLOWED_PATHS.contains(safePath)) {
                        throw new IllegalArgumentException("不允许的高德接口");
                    }
                    String url =
                            "https://restapi.amap.com/v3/" +
                            safePath +
                            "?" +
                            safeQuery +
                            "&key=" +
                            AMAP_KEY;
                    connection = (HttpURLConnection) new URL(url).openConnection();
                    connection.setRequestMethod("GET");
                    connection.setConnectTimeout(15000);
                    connection.setReadTimeout(20000);
                    connection.setRequestProperty("Accept", "application/json");
                    connection.setRequestProperty(
                            "User-Agent",
                            "BonvoyCompanion/0.12 Android"
                    );
                    int status = connection.getResponseCode();
                    InputStream stream = status >= 200 && status < 300
                            ? connection.getInputStream()
                            : connection.getErrorStream();
                    ByteArrayOutputStream output = new ByteArrayOutputStream();
                    byte[] buffer = new byte[8192];
                    int count;
                    while (stream != null && (count = stream.read(buffer)) >= 0) {
                        output.write(buffer, 0, count);
                    }
                    String body = new String(output.toByteArray(), StandardCharsets.UTF_8);
                    if (status < 200 || status >= 300) {
                        throw new IOException("高德接口 HTTP " + status);
                    }
                    runOnUiThread(() -> callAmapResult(safeRequestId, body));
                } catch (Throwable error) {
                    runOnUiThread(
                            () -> callAmapError(
                                    safeRequestId,
                                    error.getMessage() == null
                                            ? "高德接口请求失败"
                                            : error.getMessage()
                            )
                    );
                } finally {
                    if (connection != null) {
                        connection.disconnect();
                    }
                }
            });
        }
    }

    private void callAmapResult(String requestId, String body) {
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.onNativeAmapResult && window.onNativeAmapResult(" +
                        org.json.JSONObject.quote(requestId) +
                        "," +
                        org.json.JSONObject.quote(body) +
                        ");",
                null
        );
    }

    private void callAmapError(String requestId, String message) {
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.onNativeAmapError && window.onNativeAmapError(" +
                        org.json.JSONObject.quote(requestId) +
                        "," +
                        org.json.JSONObject.quote(message) +
                        ");",
                null
        );
    }

    private class DeepSeekApiBridge {
        @JavascriptInterface
        public void request(String requestId, String prompt) {
            final String safeRequestId = requestId == null ? "" : requestId;
            final String safePrompt = prompt == null ? "" : prompt;
            networkExecutor.execute(() -> {
                HttpURLConnection connection = null;
                try {
                    org.json.JSONObject payload = new org.json.JSONObject();
                    payload.put("model", "deepseek-chat");
                    org.json.JSONArray messages = new org.json.JSONArray();
                    messages.put(
                            new org.json.JSONObject()
                                    .put("role", "system")
                                    .put(
                                            "content",
                                            "你是中文旅行规划助手。只能使用用户提供的事实，" +
                                                    "不得编造景点、营业时间、交通班次、房价或用户评价。" +
                                                    "输出简洁、可执行、自然的中文建议。"
                                    )
                    );
                    messages.put(
                            new org.json.JSONObject()
                                    .put("role", "user")
                                    .put("content", safePrompt)
                    );
                    payload.put("messages", messages);
                    payload.put("temperature", 0.25);
                    payload.put("max_tokens", 1800);
                    byte[] bytes = payload.toString().getBytes(StandardCharsets.UTF_8);

                    connection = (HttpURLConnection) new URL(
                            "https://api.deepseek.com/chat/completions"
                    ).openConnection();
                    connection.setRequestMethod("POST");
                    connection.setConnectTimeout(15000);
                    connection.setReadTimeout(45000);
                    connection.setDoOutput(true);
                    connection.setRequestProperty(
                            "Authorization",
                            "Bearer " + DEEPSEEK_KEY
                    );
                    connection.setRequestProperty("Content-Type", "application/json");
                    connection.setRequestProperty("Accept", "application/json");
                    OutputStream requestBody = connection.getOutputStream();
                    requestBody.write(bytes);
                    requestBody.close();

                    int status = connection.getResponseCode();
                    InputStream stream = status >= 200 && status < 300
                            ? connection.getInputStream()
                            : connection.getErrorStream();
                    ByteArrayOutputStream output = new ByteArrayOutputStream();
                    byte[] buffer = new byte[8192];
                    int count;
                    while (stream != null && (count = stream.read(buffer)) >= 0) {
                        output.write(buffer, 0, count);
                    }
                    String body = new String(output.toByteArray(), StandardCharsets.UTF_8);
                    if (status < 200 || status >= 300) {
                        throw new IOException("DeepSeek HTTP " + status);
                    }
                    org.json.JSONObject response = new org.json.JSONObject(body);
                    String content = response
                            .getJSONArray("choices")
                            .getJSONObject(0)
                            .getJSONObject("message")
                            .getString("content");
                    final String finalContent = content;
                    runOnUiThread(() -> callDeepSeekResult(safeRequestId, finalContent));
                } catch (Throwable error) {
                    runOnUiThread(
                            () -> callDeepSeekError(
                                    safeRequestId,
                                    error.getMessage() == null
                                            ? "DeepSeek 请求失败"
                                            : error.getMessage()
                            )
                    );
                } finally {
                    if (connection != null) {
                        connection.disconnect();
                    }
                }
            });
        }
    }

    private class MeituanTravelBridge {
        @JavascriptInterface
        public void query(String requestId, String city, String query) {
            final String safeRequestId = requestId == null ? "" : requestId;
            final String safeCity = city == null ? "" : city.trim();
            final String safeQuery = query == null ? "" : query.trim();
            networkExecutor.execute(() -> {
                HttpURLConnection connection = null;
                try {
                    if (safeCity.isEmpty() || safeQuery.isEmpty()) {
                        throw new IllegalArgumentException("城市和查询内容不能为空");
                    }
                    org.json.JSONObject payload = new org.json.JSONObject();
                    payload.put("city", safeCity);
                    payload.put("query", safeQuery);
                    payload.put("channel", "clawhub");
                    byte[] bytes = payload.toString().getBytes(StandardCharsets.UTF_8);

                    connection = (HttpURLConnection) new URL(MEITUAN_TRAVEL_URL)
                            .openConnection();
                    connection.setRequestMethod("POST");
                    connection.setConnectTimeout(20000);
                    connection.setReadTimeout(125000);
                    connection.setDoOutput(true);
                    connection.setRequestProperty("Authorization", MEITUAN_TRAVEL_KEY);
                    connection.setRequestProperty("SOURCE-FROM-CHANNEL", "clawhub");
                    connection.setRequestProperty("Content-Type", "application/json");
                    connection.setRequestProperty("Accept", "application/json");
                    connection.setRequestProperty(
                            "User-Agent",
                            "BonvoyCompanion/0.12 Android"
                    );
                    OutputStream requestBody = connection.getOutputStream();
                    requestBody.write(bytes);
                    requestBody.close();

                    int status = connection.getResponseCode();
                    InputStream stream = status >= 200 && status < 300
                            ? connection.getInputStream()
                            : connection.getErrorStream();
                    String body = readStream(stream);
                    if (status < 200 || status >= 300) {
                        throw new IOException(
                                "美团酒旅 Skill HTTP " +
                                        status +
                                        (body.isEmpty() ? "" : "：" + shorten(body, 180))
                        );
                    }
                    final String finalBody = body;
                    runOnUiThread(
                            () -> callMeituanTravelResult(safeRequestId, finalBody)
                    );
                } catch (Throwable error) {
                    runOnUiThread(
                            () -> callMeituanTravelError(
                                    safeRequestId,
                                    error.getMessage() == null
                                            ? "美团酒旅 Skill 请求失败"
                                            : error.getMessage()
                            )
                    );
                } finally {
                    if (connection != null) {
                        connection.disconnect();
                    }
                }
            });
        }
    }

    private void callDeepSeekResult(String requestId, String content) {
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.onNativeDeepSeekResult && window.onNativeDeepSeekResult(" +
                        org.json.JSONObject.quote(requestId) +
                        "," +
                        org.json.JSONObject.quote(content) +
                        ");",
                null
        );
    }

    private void callDeepSeekError(String requestId, String message) {
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.onNativeDeepSeekError && window.onNativeDeepSeekError(" +
                        org.json.JSONObject.quote(requestId) +
                        "," +
                        org.json.JSONObject.quote(message) +
                        ");",
                null
        );
    }

    private class FlyAiApiBridge {
        @JavascriptInterface
        public void request(String requestId, String tool, String argumentsJson) {
            final String safeRequestId = requestId == null ? "" : requestId;
            final String safeTool = tool == null ? "" : tool;
            final String safeArguments = argumentsJson == null ? "{}" : argumentsJson;
            networkExecutor.execute(() -> {
                try {
                    if (!FLYAI_ALLOWED_TOOLS.contains(safeTool)) {
                        throw new IllegalArgumentException("不允许的飞猪工具");
                    }
                    if (safeArguments.length() > 12000) {
                        throw new IllegalArgumentException("飞猪查询参数过长");
                    }
                    org.json.JSONObject arguments = new org.json.JSONObject(safeArguments);
                    String content = callFlyAiTool(safeTool, arguments);
                    final String finalContent = content;
                    runOnUiThread(() -> callFlyAiResult(safeRequestId, finalContent));
                } catch (Throwable error) {
                    runOnUiThread(
                            () -> callFlyAiError(
                                    safeRequestId,
                                    error.getMessage() == null
                                            ? "飞猪接口请求失败"
                                            : error.getMessage()
                            )
                    );
                }
            });
        }
    }

    private String callFlyAiTool(
            String tool,
            org.json.JSONObject arguments
    ) throws Exception {
        org.json.JSONObject params = new org.json.JSONObject();
        params.put("name", tool);
        params.put("arguments", arguments);

        org.json.JSONObject rpc = new org.json.JSONObject();
        rpc.put("jsonrpc", "2.0");
        rpc.put("id", 1);
        rpc.put("method", "tools/call");
        rpc.put("params", params);
        String body = rpc.toString();

        String timestamp = String.valueOf(System.currentTimeMillis());
        String nonce = randomHex(16);
        String authorization = "Bearer " + FLYAI_API_KEY;
        String canonical =
                "POST\n/mcp\n" +
                timestamp + "\n" +
                nonce + "\n" +
                sha256Hex(body) + "\n" +
                sha256Hex(authorization);
        String signature = hmacSha256Base64Url(canonical, FLYAI_SIGN_SECRET);

        HttpURLConnection connection =
                (HttpURLConnection) new URL(FLYAI_MCP_URL).openConnection();
        try {
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(65000);
            connection.setDoOutput(true);
            connection.setFixedLengthStreamingMode(bytes.length);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty(
                    "Accept",
                    "application/json, text/event-stream"
            );
            connection.setRequestProperty("Authorization", authorization);
            connection.setRequestProperty("x-ttid", "ai2c(sk.clawhub)");
            connection.setRequestProperty("User-Agent", FLYAI_USER_AGENT);
            connection.setRequestProperty("x-flyai-ts", timestamp);
            connection.setRequestProperty("x-flyai-sign-ver", "7");
            connection.setRequestProperty("x-flyai-sign-alg", "hmac-sha256");
            connection.setRequestProperty("x-flyai-nonce", nonce);
            connection.setRequestProperty("x-flyai-sign", signature);
            OutputStream requestBody = connection.getOutputStream();
            requestBody.write(bytes);
            requestBody.close();

            int status = connection.getResponseCode();
            InputStream stream = status >= 200 && status < 300
                    ? connection.getInputStream()
                    : connection.getErrorStream();
            String responseBody = readStream(stream);
            if (status < 200 || status >= 300) {
                throw new IOException(
                        "飞猪接口 HTTP " +
                        status +
                        (responseBody.isEmpty() ? "" : "：" + shorten(responseBody, 180))
                );
            }
            String text = extractFlyAiText(responseBody, connection.getContentType());
            // The web layer expects the tool's JSON object, not an arbitrary page.
            new org.json.JSONObject(text);
            return text;
        } finally {
            connection.disconnect();
        }
    }

    private String extractFlyAiText(String body, String contentType) throws Exception {
        if (contentType != null && contentType.toLowerCase().contains("text/event-stream")) {
            String lastResult = null;
            for (String line : body.split("\\r?\\n")) {
                String trimmed = line.trim();
                if (!trimmed.startsWith("data:")) continue;
                String data = trimmed.substring(5).trim();
                if (data.isEmpty() || "[DONE]".equals(data)) continue;
                try {
                    lastResult = extractFlyAiContent(new org.json.JSONObject(data));
                } catch (org.json.JSONException ignored) {
                    // Ignore keep-alive and non-JSON SSE frames.
                }
            }
            if (lastResult != null) return lastResult;
            throw new IOException("飞猪 SSE 响应中没有结果");
        }
        return extractFlyAiContent(new org.json.JSONObject(body));
    }

    private String extractFlyAiContent(org.json.JSONObject response) throws Exception {
        org.json.JSONObject error = response.optJSONObject("error");
        if (error != null) {
            throw new IOException(
                    "飞猪接口错误：" +
                    error.optString("message", error.optString("code", "未知错误"))
            );
        }
        org.json.JSONObject result = response.optJSONObject("result");
        org.json.JSONArray content = result == null
                ? null
                : result.optJSONArray("content");
        if (content == null) {
            throw new IOException("飞猪响应缺少 result.content");
        }
        for (int index = 0; index < content.length(); index += 1) {
            org.json.JSONObject item = content.optJSONObject(index);
            if (item == null) continue;
            String text = item.optString("text", "");
            if (!text.isEmpty()) return text;
        }
        throw new IOException("飞猪响应中没有文本结果");
    }

    private String readStream(InputStream stream) throws IOException {
        if (stream == null) return "";
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        while ((count = stream.read(buffer)) >= 0) {
            output.write(buffer, 0, count);
        }
        stream.close();
        return new String(output.toByteArray(), StandardCharsets.UTF_8);
    }

    private String sha256Hex(String value) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder output = new StringBuilder(hash.length * 2);
        for (byte item : hash) {
            output.append(String.format("%02x", item & 0xff));
        }
        return output.toString();
    }

    private String hmacSha256Base64Url(String value, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] signature = mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
        return Base64.encodeToString(
                signature,
                Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING
        );
    }

    private String randomHex(int byteCount) {
        byte[] bytes = new byte[byteCount];
        new SecureRandom().nextBytes(bytes);
        StringBuilder output = new StringBuilder(bytes.length * 2);
        for (byte item : bytes) {
            output.append(String.format("%02x", item & 0xff));
        }
        return output.toString();
    }

    private String shorten(String value, int maxLength) {
        if (value == null) return "";
        String clean = value.replace('\n', ' ').replace('\r', ' ').trim();
        return clean.length() <= maxLength
                ? clean
                : clean.substring(0, maxLength) + "…";
    }

    private void callFlyAiResult(String requestId, String body) {
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.onNativeFlyAiResult && window.onNativeFlyAiResult(" +
                        org.json.JSONObject.quote(requestId) +
                        "," +
                        org.json.JSONObject.quote(body) +
                        ");",
                null
        );
    }

    private void callFlyAiError(String requestId, String message) {
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.onNativeFlyAiError && window.onNativeFlyAiError(" +
                        org.json.JSONObject.quote(requestId) +
                        "," +
                        org.json.JSONObject.quote(message) +
                        ");",
                null
        );
    }

    private void callMeituanTravelResult(String requestId, String body) {
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.onNativeMeituanTravelResult && " +
                        "window.onNativeMeituanTravelResult(" +
                        org.json.JSONObject.quote(requestId) +
                        "," +
                        org.json.JSONObject.quote(body) +
                        ");",
                null
        );
    }

    private void callMeituanTravelError(String requestId, String message) {
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.onNativeMeituanTravelError && " +
                        "window.onNativeMeituanTravelError(" +
                        org.json.JSONObject.quote(requestId) +
                        "," +
                        org.json.JSONObject.quote(message) +
                        ");",
                null
        );
    }

    private class LocationBridge {
        @JavascriptInterface
        public void getCurrentLocation(String requestId) {
            requestCurrentLocation(requestId);
        }
    }

    private class FliggyAppBridge {
        @JavascriptInterface
        public void openHotel(String url) {
            openFliggy(url);
        }
    }

    private class SyncResultBridge {
        @JavascriptInterface
        public void onComplete(String payload) {
            runOnUiThread(() -> completeCitySync(payload));
        }

        @JavascriptInterface
        public void onError(String message) {
            runOnUiThread(() -> failCitySync(message));
        }
    }

    private void showNativeError(String message) {
        if (rootLayout == null) {
            return;
        }
        if (loadingView != null) {
            loadingView.setVisibility(View.GONE);
        }
        rootLayout.removeAllViews();

        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        int padding = Math.round(28 * getResources().getDisplayMetrics().density);
        panel.setPadding(padding, padding, padding, padding);

        TextView title = new TextView(this);
        title.setText("旅伴暂时无法打开");
        title.setTextColor(Color.rgb(15, 40, 67));
        title.setTextSize(22);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        panel.addView(title);

        TextView detail = new TextView(this);
        detail.setText(message);
        detail.setTextColor(Color.rgb(82, 92, 88));
        detail.setTextSize(14);
        detail.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams detailParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        detailParams.topMargin = Math.round(12 * getResources().getDisplayMetrics().density);
        panel.addView(detail, detailParams);

        Button retry = new Button(this);
        retry.setText("重新加载");
        retry.setOnClickListener(view -> recreate());
        LinearLayout.LayoutParams retryParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        retryParams.topMargin = Math.round(18 * getResources().getDisplayMetrics().density);
        panel.addView(retry, retryParams);

        rootLayout.addView(
                panel,
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                )
        );
    }

    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript(
            "(function(){return window.appBack && window.appBack() ? 'true' : 'false';})()",
            value -> {
                if (!"\"true\"".equals(value)) {
                    if (webView.canGoBack()) {
                        webView.goBack();
                    } else {
                        finish();
                    }
                }
            }
        );
    }

    @Override
    protected void onDestroy() {
        pendingLocationRequestId = null;
        cleanupLocationRequest();
        cleanupSyncWebView();
        if (webView != null) {
            webView.removeAllViews();
            webView.destroy();
            webView = null;
        }
        networkExecutor.shutdownNow();
        super.onDestroy();
    }
}
