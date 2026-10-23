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
  { key: "acceptLanguageHeader", name: "请求语言" },
  { key: "fonts", name: "中文字体拦截" },
  { key: "webrtc", name: "WebRTC 拦截" },
  { key: "intlLocale", name: "Intl 区域" },
  { key: "uaPlatform", name: "UA 平台", desc: () => "伪装 macOS（增强）" }
];

const AUTO_DETECT_COOLDOWN = 60 * 1000;

let config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
let masterAutoDetectDone = false;
let lastAutoDetectTs = 0;
let detecting = false;
let masterPending = false;
const pendingFeatures = new Set();

function $(id) { return document.getElementById(id); }

function initializeBrandVersion() {
  try {
    const manifest = chrome.runtime.getManifest();
    $("brandVersion").href = manifest.homepage_url || $("brandVersion").href;
    const version = manifest.version;
    $("brandVersion").textContent = `V${version}`;
  } catch (e) {
    $("brandVersion").textContent = "V0.0.0";
  }
}
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 点击信息区复制完整内容；复制成功短暂反馈后恢复
function copySub(el) {
  if (el.classList.contains("loading")) return;
  const text = el.textContent;
  if (!text) return;
  const showCopied = () => {
    el.classList.add("copied");
    const prev = el.textContent;
    el.textContent = "已复制";
    setTimeout(() => {
      el.classList.remove("copied");
      el.textContent = prev;
    }, 900);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(showCopied).catch(() => {
      // 后备方案：execCommand
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); showCopied(); } catch (e) {}
      ta.remove();
    });
  } else {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); showCopied(); } catch (e) {}
    ta.remove();
  }
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
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ fcdConfig: config }, () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message || "配置保存失败"));
      else resolve();
    });
  });
}

// ---------- 总开关联动 ----------
function anyOn() { return FEATURES.some((f) => config.features[f.key]); }
function allOff() { return FEATURES.every((f) => !config.features[f.key]); }

function syncMaster() {
  const cb = $("masterCheckbox");
  cb.checked = anyOn();
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
      '<div class="feature-sub" id="sub-' + f.key + '" title=""></div>';
    list.appendChild(row);
    row.querySelector("input").addEventListener("change", onFeatureToggle);
    row.querySelector(".feature-sub").addEventListener("click", function () { copySub(this); });
  });
}

// 动效：开=持续高亮+pulse，关=去高亮+pulse
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

// 信息区说明。失败说明不会定时清除，只有后续成功值/实时值会覆盖它。
function setFeatureNotice(key, message, type) {
  const sub = $("sub-" + key);
  if (!sub) return;
  sub.classList.remove("loading", "status-error", "copied");
  sub.textContent = message;
  sub.title = message;
  if (type === "error") sub.classList.add("status-error");
}

// ---------- 子开关功能应用 ----------
async function requireResult(result, fallback) {
  if (!result || !result.ok) {
    throw new Error((result && result.error) || fallback);
  }
}

async function getProxyTimezoneForEnable() {
  const r = await fetchIpWho();
  if (!r.ok) throw new Error(r.error || "无法获取代理时区");
  return r.tz;
}

async function enableFeature(key) {
  if (key === "acceptLanguageHeader") {
    await requireResult(await applyAcceptLanguageRule(true), "请求语言规则开启失败");
    return { ruleChanged: true };
  }
  if (key === "uaPlatform") {
    await requireResult(await applyUaPlatformRule(true), "UA 平台规则开启失败");
    return { ruleChanged: true };
  }
  if (key === "timezone") {
    return { timezone: await getProxyTimezoneForEnable() };
  }
  return {};
}

async function disableFeature(key) {
  if (key === "acceptLanguageHeader") {
    await requireResult(await applyAcceptLanguageRule(false), "请求语言规则关闭失败");
    return { ruleChanged: true };
  }
  if (key === "uaPlatform") {
    await requireResult(await applyUaPlatformRule(false), "UA 平台规则关闭失败");
    return { ruleChanged: true };
  }
  return {};
}

// 保存等后续步骤失败时，把已经变更的 DNR 规则恢复到原状态
async function rollbackFeatureRule(key, enable) {
  if (key === "acceptLanguageHeader") {
    await requireResult(await applyAcceptLanguageRule(enable), "原规则恢复失败");
  } else if (key === "uaPlatform") {
    await requireResult(await applyUaPlatformRule(enable), "原规则恢复失败");
  }
}

// ---------- 子开关 ----------
// 统一的子开关执行入口：子开关和总开关都走这里，保证成功结果和失败回滚一致
async function applyFeatureState(key, requested, options) {
  const opts = Object.assign({
    refresh: true,
    showSuccessNotice: true,
    showErrorNotice: true
  }, options || {});

  const input = $("sw-" + key);
  const previous = !!config.features[key];
  if (requested === previous) {
    if (input) input.checked = previous;
    updateRow(key);
    return { ok: true, changed: false };
  }

  pendingFeatures.add(key);
  input.checked = requested ? false : previous;
  setFeatureNotice(key, requested ? "正在开启..." : "正在关闭...");

  let prepared = null;
  let ruleApplied = false;
  const previousTimezone = config.timezone;

  try {
    if (requested) {
      prepared = await enableFeature(key);
    } else {
      prepared = await disableFeature(key);
    }
    ruleApplied = !!(prepared && prepared.ruleChanged);
    config.features[key] = requested;
    if (prepared && prepared.timezone) config.timezone = prepared.timezone;
    await saveConfig();
    if (prepared && prepared.timezone && config.timezone !== previousTimezone) {
      $("currentTz").textContent = config.timezone;
      markGreaterCnTz(config.timezone);
    }
    updateRow(key);
    syncMaster();

    // 开启/关闭成功后立即读取实时值，覆盖“正在处理”状态
    if (opts.refresh) {
      await refreshLivePanel({ loadingRows: [key] });
    } else if (opts.showSuccessNotice) {
      setFeatureNotice(key, requested ? "已开启" : "已关闭");
    }
    return { ok: true, changed: true };
  } catch (err) {
    let rollbackNote = "";
    config.features[key] = previous;
    config.timezone = previousTimezone;
    $("currentTz").textContent = config.timezone;
    markGreaterCnTz(config.timezone);
    if (ruleApplied) {
      try {
        await rollbackFeatureRule(key, previous);
      } catch (rollbackErr) {
        rollbackNote = "；原规则恢复失败：" + (rollbackErr.message || "操作未完成");
      }
    }
    refreshSeq++;
    updateRow(key);
    syncMaster();
    if (opts.showErrorNotice) {
      setFeatureNotice(key, (requested ? "开启失败：" : "关闭失败：") + (err.message || "操作未完成") + rollbackNote, "error");
    }
    return {
      ok: false,
      changed: false,
      error: (err.message || "操作未完成") + rollbackNote
    };
  } finally {
    pendingFeatures.delete(key);
  }
}

async function onFeatureToggle(e) {
  const input = e.target;
  const key = input.dataset.key;
  const previous = !!config.features[key];

  // 同一开关操作未结束前忽略重复触发
  if (pendingFeatures.has(key) || masterPending) {
    input.checked = previous;
    return;
  }
  await applyFeatureState(key, input.checked, { refresh: true });
}

// ---------- 总开关（一键全开/全关） ----------
$("masterCheckbox").addEventListener("change", async (e) => {
  const cb = $("masterCheckbox");
  const on = cb.checked;

  if (masterPending || pendingFeatures.size) {
    cb.checked = anyOn();
    return;
  }

  const previousFeatures = Object.assign({}, config.features);
  const previousTimezone = config.timezone;
  masterPending = true;
  cb.checked = false;

  const changedKeys = [];
  let failedKey = "";
  let failureError = "";

  // 总开关不批量伪造结果，而是逐项调用子开关的开启/关闭入口
  for (const feature of FEATURES) {
    setFeatureNotice(feature.key, on ? "正在开启..." : "正在关闭...");
    const result = await applyFeatureState(feature.key, on, {
      refresh: false,
      showSuccessNotice: false,
      showErrorNotice: false
    });
    if (!result.ok) {
      failedKey = feature.key;
      failureError = result.error || "操作未完成";
      break;
    }
    changedKeys.push(feature.key);
  }

  if (failedKey) {
    const rollbackErrors = [];

    // 后面的子项失败时，把本次已变更的子项逐个恢复到操作前状态
    for (const key of changedKeys.slice().reverse()) {
      const result = await applyFeatureState(key, !!previousFeatures[key], {
        refresh: false,
        showSuccessNotice: false,
        showErrorNotice: false
      });
      if (!result.ok) {
        const feature = FEATURES.find((item) => item.key === key);
        rollbackErrors.push((feature ? feature.name : key) + "：" + result.error);
      }
    }

    config.features = previousFeatures;
    config.timezone = previousTimezone;
    refreshSeq++;
    $("currentTz").textContent = config.timezone;
    markGreaterCnTz(config.timezone);
    try {
      await saveConfig();
    } catch (saveErr) {
      rollbackErrors.push("配置恢复失败：" + (saveErr.message || "操作未完成"));
    }

    syncMaster();
    const rollbackNote = rollbackErrors.length ? "；原状态恢复失败：" + rollbackErrors.join("；") : "";
    const feature = FEATURES.find((item) => item.key === failedKey);
    const failureName = feature ? feature.name : "子选项";
    FEATURES.forEach((item) => {
      updateRow(item.key);
      setFeatureNotice(
        item.key,
        (on ? "总开关开启失败：" : "总开关关闭失败：") + failureName + "：" + failureError + rollbackNote,
        "error"
      );
    });
  } else {
    // 成功后统一刷新所有信息区，用原始值/伪装值替换等待说明
    await refreshLivePanel();
    syncMaster();
  }

  masterPending = false;
});

// ---------- Accept-Language 规则 ----------
async function applyAcceptLanguageRule(enable) {
  try {
    if (enable) {
      await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: ["fc_ruleset"] });
    } else {
      await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ["fc_ruleset"] });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || "规则应用失败" };
  }
}

// 从扩展自身真实 UA 动态推导 Mac UA / UA-CH（避免版本基准与浏览器脱节）
function deriveMacUaInfo() {
  const realUa = navigator.userAgent;
  const m = /(Chrome\/(\d+)(?:\.([\d.]+))?)/i.exec(realUa);
  const major = m ? m[2] : "131";
  const full = m && m[3] ? major + "." + m[3] : major + ".0.0.0";
  return {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) " + (m ? m[1] : "Chrome/131.0.0.0") + " Safari/537.36",
    major: major,
    fullVersionList: [
      { brand: "Google Chrome", version: full },
      { brand: "Chromium", version: full },
      { brand: "Not_A Brand", version: "24.0.0.0" }
    ],
    platformVersion: "14.5.0"
  };
}

async function applyUaPlatformRule(enable) {
  try {
    if (enable) {
      const info = deriveMacUaInfo();
      const headers = [
        { header: "User-Agent", operation: "set", value: info.ua },
        { header: "Sec-CH-UA", operation: "set", value: "\"Google Chrome\";v=\"" + info.major + "\", \"Chromium\";v=\"" + info.major + "\", \"Not_A Brand\";v=\"24\"" },
        { header: "Sec-CH-UA-Platform", operation: "set", value: "\"macOS\"" },
        { header: "Sec-CH-UA-Mobile", operation: "set", value: "?0" },
        { header: "Sec-CH-UA-Platform-Version", operation: "set", value: info.platformVersion },
        { header: "Sec-CH-UA-Full-Version-List", operation: "set", value: "\"Google Chrome\";v=\"" + info.fullVersionList[0].version + "\", \"Chromium\";v=\"" + info.fullVersionList[1].version + "\", \"Not_A Brand\";v=\"24.0.0.0\"" }
      ];
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [{
          id: 100,
          priority: 2,
          action: { type: "modifyHeaders", requestHeaders: headers },
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
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || "规则应用失败" };
  }
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
        refreshLivePanel({ loadingRows: ["timezone"] });
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
let refreshSeq = 0;

async function refreshLivePanel(options) {
  const opts = options || {};
  const retry = opts.retry !== false;
  const seq = ++refreshSeq;
  // 只让受影响的行进入 loading；未受影响的行静默保持
  const loadingSet = new Set(opts.loadingRows || FEATURES.map((f) => f.key));
  FEATURES.forEach((f) => {
    const sub = $("sub-" + f.key);
    if (!sub) return;
    if (loadingSet.has(f.key)) {
      sub.classList.add("loading");
      sub.classList.remove("bad");
      sub.textContent = "";
    }
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
      setTimeout(() => {
        if (seq === refreshSeq) {
          refreshLivePanel({ retry: false, loadingRows: opts.loadingRows });
        }
      }, 1200);
      return;
    }
    FEATURES.forEach((f) => {
      const sub = $("sub-" + f.key);
      if (!sub || !loadingSet.has(f.key)) return;
      sub.classList.remove("loading", "status-error");
      sub.textContent = "未注入 · 请刷新页面后重试";
      sub.title = "当前页面无法读取（chrome:// 页面或扩展重载后未刷新）";
    });
    return;
  }

  const vals = {
    timezone: p.timezone,
    language: (p.langs || []).join(", "),
    fonts: p.fontsIntercepted ? "已拦截" : ((p.leakedFonts && p.leakedFonts.length) ? p.leakedFonts.join(", ") : "无泄漏"),
    webrtc: (config.features.webrtc) ? "已拦截" : ((p.realWebrtcLeak && p.realWebrtcLeak.length) ? p.realWebrtcLeak.join(", ") : ((p.realWebrtcLeak && p.realWebrtcLeak.length === 0) ? "无泄漏" : "未拦截")),
    intlLocale: p.locale,
    uaPlatform: p.uaPlatformValue || "",
    acceptLanguageHeader: (config.features.acceptLanguageHeader) ? (config.langs || []).join(", ") : ((p.realLangs && p.realLangs.length) ? p.realLangs.join(", ") : "浏览器原始语言")
  };

  if (seq !== refreshSeq) return;

  FEATURES.forEach((f) => {
    const sub = $("sub-" + f.key);
    if (!sub || !loadingSet.has(f.key)) return;
    sub.classList.remove("loading", "status-error");
    const v = vals[f.key];
    const bad = (
      (f.key === "fonts" && p.leakedFonts && p.leakedFonts.length > 0) ||
      (f.key === "webrtc" && !config.features.webrtc && p.realWebrtcLeak && p.realWebrtcLeak.length > 0) ||
      (f.key === "timezone" && p.timezone !== config.timezone) ||
      (f.key === "language" && (p.langs || []).join(",") !== (config.langs || []).join(",")) ||
      (f.key === "intlLocale" && p.locale !== config.locale)
    );
    sub.textContent = v;
    sub.title = v;
    sub.classList.toggle("bad", !!bad);
  });
}

// ---------- 初始化 ----------
initializeBrandVersion();
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

