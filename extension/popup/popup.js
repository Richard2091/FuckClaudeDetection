// ============================================================
// Fuck Claude Detection  popup.js  v2.3
// - 去掉标题前状态图标
// - 动效拆分：开=持续高亮+pulse，关=去高亮+pulse
// - 未注入时给出刷新页面指引
// ============================================================

const DEFAULT_CONFIG = {
  timezone: "America/New_York",
  locale: "en-US",
  langs: ["en-US", "en"],
  features: {
    timezone: true,
    language: true,
    fonts: true,
    webrtc: true,
    intlLocale: true,
    acceptLanguageHeader: true,
    uaPlatform: false
  }
};

const FEATURES = [
  { key: "timezone", name: "时区伪装" },
  { key: "language", name: "浏览器语言" },
  { key: "fonts", name: "中文字体拦截" },
  { key: "webrtc", name: "WebRTC 拦截" },
  { key: "intlLocale", name: "Intl 区域" },
  { key: "uaPlatform", name: "UA 平台伪装", desc: () => "伪装 macOS（增强）" },
  { key: "acceptLanguageHeader", name: "请求语言伪装" }
];

const AUTO_DETECT_COOLDOWN = 60 * 1000;

let config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
let masterAutoDetectDone = false;
let lastAutoDetectTs = 0;
let detecting = false;

function $(id) { return document.getElementById(id); }
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---------- 配置 ----------
function deepMerge(base, over) {
  Object.keys(over || {}).forEach((k) => {
    if (k === "features" && typeof over[k] === "object") {
      base.features = Object.assign({}, base.features, over[k]);
    } else if (k !== "enabled") {
      base[k] = over[k];
    }
  });
  return base;
}
function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["fcdConfig"], (res) => {
      const saved = res && res.fcdConfig;
      config = saved ? deepMerge(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), saved) : JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      resolve(config);
    });
  });
}
function saveConfig() {
  return new Promise((resolve) => chrome.storage.local.set({ fcdConfig: config }, resolve));
}

// ---------- 总开关联动 ----------
function allOn() { return FEATURES.every((f) => config.features[f.key]); }
function allOff() { return FEATURES.every((f) => !config.features[f.key]); }

function syncMaster() {
  const cb = $("masterCheckbox");
  // 只有全部子选项开启时总开关才显示开启，否则一律关闭（无中间态）
  cb.checked = allOn();
  cb.indeterminate = false;
}

// ---------- 行 DOM ----------
function buildRows() {
  const list = $("featureList");
  list.innerHTML = "";
  FEATURES.forEach((f) => {
    const row = document.createElement("div");
    row.className = "feature-row";
    row.id = "row-" + f.key;
    row.innerHTML =
      '<div class="feature-main">' +
        '<span class="feature-name">' + f.name + '</span>' +
        '<label class="switch">' +
          '<input type="checkbox" data-key="' + f.key + '" id="sw-' + f.key + '">' +
          '<span class="slider"></span>' +
        '</label>' +
      '</div>' +
      '<div class="feature-sub" id="sub-' + f.key + '"></div>';
    list.appendChild(row);
    row.querySelector("input").addEventListener("change", onFeatureToggle);
  });
}

// 动效拆分：开=加 on 高亮（持续）；关=移除 on；每次切换触发 pulse
function updateRow(key) {
  const row = $("row-" + key);
  if (!row) return;
  const on = !!config.features[key];
  const cb = $("sw-" + key);
  if (cb) cb.checked = on;
  row.classList.toggle("on", on);
  row.classList.remove("pulse");
  void row.offsetWidth;
  row.classList.add("pulse");
}

// ---------- 子开关 ----------
async function onFeatureToggle(e) {
  const key = e.target.dataset.key;
  config.features[key] = e.target.checked;
  await saveConfig();
  updateRow(key);
  syncMaster();
  if (key === "acceptLanguageHeader") {
    await applyAcceptLanguageRule(e.target.checked);
  }
  if (key === "uaPlatform") {
    await applyUaPlatformRule(e.target.checked);
  }
  if (key === "timezone" && e.target.checked) {
    await detectAndApply("feature");
  }
  refreshLivePanel();
}

// ---------- 总开关（一键全开/全关） ----------
$("masterCheckbox").addEventListener("change", async (e) => {
  const on = e.target.checked;
  FEATURES.forEach((f) => { config.features[f.key] = on; });
  await saveConfig();
  await applyAcceptLanguageRule(on);
  await applyUaPlatformRule(on);
  FEATURES.forEach((f, i) => {
    setTimeout(() => updateRow(f.key), i * 60);
  });
  if (on) {
    await detectAndApply("master");
  }
  refreshLivePanel();
});

// ---------- Accept-Language 规则 ----------
async function applyAcceptLanguageRule(enable) {
  try {
    if (enable) {
      await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: ["fc_ruleset"] });
    } else {
      await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ["fc_ruleset"] });
    }
  } catch (e) {}
}

const MAC_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function applyUaPlatformRule(enable) {
  try {
    if (enable) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [{
          id: 100,
          priority: 2,
          action: {
            type: "modifyHeaders",
            requestHeaders: [
              { header: "User-Agent", operation: "set", value: MAC_UA },
              { header: "Sec-CH-UA", operation: "set", value: "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"" },
              { header: "Sec-CH-UA-Platform", operation: "set", value: "\"macOS\"" }
            ]
          },
          condition: {
            urlFilter: "http",
            resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest", "script", "stylesheet", "image", "font", "media", "websocket", "other"]
          }
        }],
        removeRuleIds: [100]
      });
    } else {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [100] });
    }
  } catch (e) {}
}
// ---------- 代理时区检测 ----------
const CN_RISK_TZ = ["Asia/Shanghai", "Asia/Urumqi", "Asia/Chongqing", "Asia/Harbin", "Asia/Kashgar", "Asia/Hong_Kong", "Asia/Macau"];
function normTz(tz) { return tz === "Asia/Macao" ? "Asia/Macau" : tz; }
function markGreaterCnTz(tz) {
  const tzEl = $("currentTz");
  if (!tzEl) return;
  const n = normTz(tz);
  const isCnMainland = n === "Asia/Shanghai" || n === "Asia/Urumqi" || n === "Asia/Chongqing" || n === "Asia/Harbin" || n === "Asia/Kashgar";
  const isGreaterCn = n === "Asia/Hong_Kong" || n === "Asia/Macau";
  tzEl.classList.toggle("warn", isGreaterCn);
  tzEl.classList.toggle("error", isCnMainland);
  tzEl.title = isCnMainland
    ? "警告：中国大陆时区在检测中计满分（24 分），强烈建议使用海外代理"
    : (isGreaterCn ? "注意：港澳时区按 0.6 系数计分（客户端约 14 分；服务端口径影响更大），建议使用其他地区代理" : "");
}

function setRefreshing(on) {
  const btn = $("refreshTzBtn");
  btn.classList.toggle("spin", on);
  btn.disabled = on;
}

async function fetchIpWho() {
  try {
    const resp = await fetch("https://ipwho.is/", { cache: "no-store" });
    const d = await resp.json();
    if (!d || d.success === false || !d.timezone || !d.timezone.id) {
      return { ok: false, error: "无法获取时区信息" };
    }
    return { ok: true, tz: d.timezone.id, ip: d.ip || "", utc: (d.timezone && d.timezone.utc) || "" };
  } catch (e) {
    return { ok: false, error: e.message || "网络不可用" };
  }
}

async function detectAndApply(source) {
  if (detecting) return;
  const now = Date.now();
  if (source !== "manual" && now - lastAutoDetectTs < AUTO_DETECT_COOLDOWN) return;
  if (source === "master" && masterAutoDetectDone) return;
  detecting = true;
  lastAutoDetectTs = now;
  if (source === "master") masterAutoDetectDone = true;

  const tzEl = $("currentTz");
  tzEl.classList.remove("shine", "error");
  tzEl.classList.add("loading");
  setRefreshing(true);

  try {
    const r = await fetchIpWho();
    tzEl.classList.remove("loading");
    if (r.ok) {
      if (r.tz !== config.timezone) {
        config.timezone = r.tz;
        await saveConfig();
        tzEl.textContent = r.tz;
        markGreaterCnTz(r.tz);
        refreshLivePanel();
      }
      void tzEl.offsetWidth;
      tzEl.classList.add("shine");
      setTimeout(() => tzEl.classList.remove("shine"), 1000);
    } else {
      tzEl.classList.add("error");
      tzEl.title = "检测失败：" + r.error;
      setTimeout(() => {
        tzEl.classList.remove("error");
        tzEl.title = "";
      }, 2200);
    }
  } finally {
    detecting = false;
    setRefreshing(false);
  }
}

$("refreshTzBtn").addEventListener("click", () => detectAndApply("manual"));

// ---------- 实时参数 ----------
async function refreshLivePanel(retry = true) {
  FEATURES.forEach((f) => {
    const sub = $("sub-" + f.key);
    if (!sub) return;
    sub.classList.add("loading");
    sub.classList.remove("bad");
    sub.textContent = "";
  });

  let p = null;
  let injectError = false;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      const resp = await chrome.tabs.sendMessage(tab.id, { type: "FCD_QUERY" }, { frameId: 0 });
      if (resp && resp.ok && resp.payload) p = resp.payload;
      else injectError = true;
    } else {
      injectError = true;
    }
  } catch (err) {
    injectError = true;
  }

  if (injectError) {
    if (retry) {
      // content script 可能尚未就绪（刚刷新页面/刚加载扩展），自动重试一次
      setTimeout(() => refreshLivePanel(false), 1200);
      return;
    }
    FEATURES.forEach((f) => {
      const sub = $("sub-" + f.key);
      if (!sub) return;
      sub.classList.remove("loading");
      sub.textContent = "未注入 · 请刷新页面后重试";
    });
    return;
  }

  const vals = {
    timezone: p.timezone,
    language: (p.langs || []).join(", "),
    fonts: p.fontsIntercepted ? "已拦截" : ((p.leakedFonts && p.leakedFonts.length) ? p.leakedFonts.join(", ") : "无泄漏"),
    webrtc: (config.features.webrtc) ? "已拦截" : "未拦截",
    intlLocale: p.locale,
    uaPlatform: p.uaPlatformValue,
    acceptLanguageHeader: (config.features.acceptLanguageHeader) ? (config.langs || []).join(", ") : ((p.realLangs && p.realLangs.length) ? p.realLangs.join(", ") : (config.langs || []).join(", "))
  };

  FEATURES.forEach((f) => {
    const sub = $("sub-" + f.key);
    if (!sub) return;
    sub.classList.remove("loading");
    const v = vals[f.key];
    const bad = (
      (f.key === "fonts" && p.leakedFonts && p.leakedFonts.length > 0) ||
      (f.key === "webrtc" && !p.webrtcPatched) ||
      (f.key === "timezone" && p.timezone !== config.timezone) ||
      (f.key === "language" && (p.langs || []).join(",") !== (config.langs || []).join(",")) ||
      (f.key === "intlLocale" && p.locale !== config.locale)
    );
    sub.innerHTML = escapeHtml(v);
    sub.classList.toggle("bad", !!bad);
  });
}

// ---------- 初始化 ----------
(async () => {
  await loadConfig();
  $("currentTz").textContent = config.timezone;
  markGreaterCnTz(config.timezone);
  buildRows();
  FEATURES.forEach((f) => updateRow(f.key));
  syncMaster();
  await applyAcceptLanguageRule(config.features.acceptLanguageHeader);
  await applyUaPlatformRule(config.features.uaPlatform);
  refreshLivePanel();
})();