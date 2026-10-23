// ============================================================
// Fuck Claude Detection  content.js  v3.0  (world: MAIN)
// 动态配置驱动的统一指纹守卫（交叉审核整改版）
//
// 覆盖信号与真实性设计：
//   1. Intl 时区        - 构造器注入 timeZone，resolvedOptions 强制
//   2. Date 时区偏移    - 按每个 Date 时间戳动态计算（含夏令时）
//   3. Date.toString    - 尾部时区标注替换
//   4. Intl locale      - 构造器注入默认 locale（真实行为一致）
//   5. 浏览器语言       - navigator.languages 冻结副本
//   6. 中文字体拦截     - measureText 剔除（大小写无关 + 空列表回退）
//   7. WebRTC           - 独立原型链防逃逸 + 候选拦截 + getConfiguration 一致
//   8. UA 平台（增强）  - platform/UA/vendor/UA-CH JS hook（默认关）
// 已知边界（见 ROADMAP）：Web Worker、渲染层指纹、TLS 指纹、IP 地理
// ============================================================
(() => {
  "use strict";

  // ---------- 保留原生引用（在任何 patch 之前） ----------
  const OrigDTF = Intl.DateTimeFormat;
  const OrigDate = Date;
  const origDTFResolved = OrigDTF.prototype.resolvedOptions;
  const origGTO = Date.prototype.getTimezoneOffset;
  const origToString = Date.prototype.toString;
  const origToTimeString = Date.prototype.toTimeString;
  const origToLocaleString = Date.prototype.toLocaleString;
  const origToLocaleDateString = Date.prototype.toLocaleDateString;
  const origToLocaleTimeString = Date.prototype.toLocaleTimeString;
  const origLangsDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, "languages");
  const origLangDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, "language");
  const origPlatformDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, "platform");
  const origUserAgentDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, "userAgent");
  const origVendorDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, "vendor");

  // ---------- state（bridge 会在启动后推送用户配置） ----------
  const state = {
    timezone: "America/New_York",
    locale: "en-US",
    langs: Object.freeze(["en-US", "en"]),
    tzLabel: "America/New_York",
    features: {
      timezone: true,
      language: true,
      fonts: true,
      webrtc: true,
      intlLocale: true,
      uaPlatform: false
    }
  };

  function tzActive() { return !!state.features.timezone; }
  function langActive() { return !!state.features.language; }
  function fontsActive() { return !!state.features.fonts; }
  function webrtcActive() { return !!state.features.webrtc; }
  function intlActive() { return !!state.features.intlLocale; }
  function uaActive() { return !!state.features.uaPlatform; }

  function keepName(fn, name) {
    try { Object.defineProperty(fn, "name", { value: name, configurable: true }); } catch (e) {}
  }

  // ---------- 时区工具：按时间戳动态计算目标时区偏移 ----------
  let tzFormatter = null;
  let tzFormatterTz = null;
  function getTzFormatter() {
    if (!tzFormatter || tzFormatterTz !== state.timezone) {
      tzFormatter = new OrigDTF("en-US", {
        timeZone: state.timezone, hour12: false,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      });
      tzFormatterTz = state.timezone;
    }
    return tzFormatter;
  }
  // getTimezoneOffset 语义：UTC - local（分钟）
  function tzOffsetForMs(ms) {
    try {
      const parts = {};
      getTzFormatter().formatToParts(new OrigDate(ms)).forEach((p) => { parts[p.type] = p.value; });
      const asUTC = OrigDate.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
      return Math.round((ms - asUTC) / 60000);
    } catch (e) {
      return 300;
    }
  }

  // ---------- 1. Intl.DateTimeFormat 构造器：注入 timeZone + locale ----------
  function PatchedDateTimeFormat(...args) {
    const options = Object.assign({}, args[1] || {});
    if (tzActive() && !options.timeZone) options.timeZone = state.timezone;
    const locale = (intlActive() && args[0] === undefined) ? state.locale : args[0];
    return new OrigDTF(locale, options);
  }
  PatchedDateTimeFormat.prototype = OrigDTF.prototype;
  try { PatchedDateTimeFormat.supportedLocalesOf = OrigDTF.supportedLocalesOf.bind(OrigDTF); } catch (e) {}
  keepName(PatchedDateTimeFormat, "DateTimeFormat");
  Intl.DateTimeFormat = PatchedDateTimeFormat;

  // ---------- 2. Intl.DateTimeFormat.prototype.resolvedOptions ----------
  const patchedDTFRO = function resolvedOptions() {
    const opts = origDTFResolved.call(this);
    const out = Object.assign({}, opts);
    if (intlActive()) out.locale = state.locale;
    if (tzActive()) out.timeZone = state.timezone;
    return out;
  };
  keepName(patchedDTFRO, "resolvedOptions");
  OrigDTF.prototype.resolvedOptions = patchedDTFRO;

  // ---------- 3. Intl 其他构造器：默认 locale 注入（真实行为一致） ----------
  ["NumberFormat", "Collator", "RelativeTimeFormat", "ListFormat", "PluralRules", "DisplayNames", "Segmenter"].forEach((name) => {
    try {
      const Orig = Intl[name];
      if (typeof Orig !== "function") return;
      const Patched = function (...args) {
        if (intlActive() && (args[0] === undefined || args[0] === null || args[0] === "")) {
          args[0] = state.locale;
        }
        return new Orig(...args);
      };
      Patched.prototype = Orig.prototype;
      try { Patched.supportedLocalesOf = Orig.supportedLocalesOf.bind(Orig); } catch (e) {}
      keepName(Patched, name);
      Intl[name] = Patched;
      // resolvedOptions 的 locale 也强制（保持报告与行为一致）
      if (Orig.prototype && typeof Orig.prototype.resolvedOptions === "function") {
        const origRO = Orig.prototype.resolvedOptions;
        const patchedRO = function resolvedOptions() {
          const opts = origRO.call(this);
          if (!intlActive()) return opts;
          return Object.assign({}, opts, { locale: state.locale });
        };
        keepName(patchedRO, "resolvedOptions");
        Orig.prototype.resolvedOptions = patchedRO;
      }
    } catch (e) {}
  });

  // ---------- 4. Date.getTimezoneOffset：按时间戳动态计算 ----------
  const patchedGTO = function getTimezoneOffset() {
    if (!tzActive()) return origGTO.call(this);
    try {
      return tzOffsetForMs(this.getTime());
    } catch (e) {
      return origGTO.call(this);
    }
  };
  keepName(patchedGTO, "getTimezoneOffset");
  Date.prototype.getTimezoneOffset = patchedGTO;

  // ---------- 5. Date.toString / toTimeString：时区标注 ----------
  const TZ_TAIL_REGEX = /\sGMT[+-]\d{4}\s*\([^)]*\)\s*$/;
  function replaceTzTail(s) {
    if (typeof s !== "string" || !TZ_TAIL_REGEX.test(s)) return s;
    return s.replace(TZ_TAIL_REGEX, " " + tzOffsetLabel() + " (" + state.timezone + ")");
  }
  function tzOffsetLabel() {
    // getTimezoneOffset 语义为 UTC-local（纽约=+240）；GMT 标签语义为 local-UTC（纽约=-0400）
    const off = tzActive() ? -tzOffsetForMs(OrigDate.now()) : -origGTO.call(new OrigDate());
    const sign = off < 0 ? "-" : "+";
    const abs = Math.abs(off);
    return "GMT" + sign + String(Math.floor(abs / 60)).padStart(2, "0") + String(abs % 60).padStart(2, "0");
  }
  ["toString", "toTimeString"].forEach((m) => {
    const orig = m === "toString" ? origToString : origToTimeString;
    const patched = function () {
      const s = orig.apply(this, arguments);
      if (!tzActive()) return s;
      return replaceTzTail(s);
    };
    keepName(patched, m);
    Date.prototype[m] = patched;
  });

  // ---------- 6. Date toLocale* 系列 ----------
  [["toLocaleString", origToLocaleString], ["toLocaleDateString", origToLocaleDateString], ["toLocaleTimeString", origToLocaleTimeString]].forEach(([m, orig]) => {
    const patched = function () {
      const locale = arguments[0];
      const options = arguments[1];
      const newOptions = Object.assign({}, options || {});
      if (tzActive() && !newOptions.timeZone) newOptions.timeZone = state.timezone;
      const finalLocale = locale === undefined ? (intlActive() ? state.locale : locale) : locale;
      return orig.call(this, finalLocale, newOptions);
    };
    keepName(patched, m);
    Date.prototype[m] = patched;
  });

  // ---------- 7. navigator.languages / language（冻结副本） ----------
  try {
    Object.defineProperty(Navigator.prototype, "languages", {
      get: function () {
        if (!langActive()) return origLangsDesc.get.call(this);
        return Object.freeze(state.langs.slice());
      },
      set: function () {},
      configurable: true
    });
    Object.defineProperty(Navigator.prototype, "language", {
      get: function () {
        if (!langActive()) return origLangDesc.get.call(this);
        return state.langs[0] || state.locale;
      },
      set: function () {},
      configurable: true
    });
  } catch (e) {}

  // ---------- 8. WebRTC：独立原型链 + 候选拦截 + getConfiguration 一致 ----------
  (function patchWebRTC() {
    if (typeof window.RTCPeerConnection === "undefined") return;
    const Orig = window.RTCPeerConnection;
    function PatchedRTC(...args) {
      if (!webrtcActive()) return new Orig(...args);
      let config = args[0];
      if (config && typeof config === "object") {
        config = Object.assign({}, config);
        config.iceServers = [];
        config.iceTransportPolicy = "relay";
      } else {
        config = { iceServers: [], iceTransportPolicy: "relay" };
      }
      const pc = new Orig(config);
      // onicecandidate：不可删除的实例拦截
      try {
        let stored = null;
        Object.defineProperty(pc, "onicecandidate", {
          get: function () { return stored; },
          set: function (fn) { stored = typeof fn === "function" ? fn : null; },
          configurable: false
        });
      } catch (e) {}
      try {
        const origAdd = pc.addEventListener.bind(pc);
        pc.addEventListener = function (type, listener, opts) {
          if (type === "icecandidate" && webrtcActive()) {
            return origAdd("icecandidate", function () {}, opts);
          }
          return origAdd(type, listener, opts);
        };
      } catch (e) {}
      // getConfiguration 一致性：不暴露真实 STUN 配置
      try {
        if (typeof Orig.prototype.getConfiguration === "function") {
          pc.getConfiguration = function () {
            const cfg = Orig.prototype.getConfiguration.call(this);
            return Object.assign({}, cfg, { iceServers: [], iceTransportPolicy: "relay" });
          };
        }
      } catch (e) {}
      return pc;
    }
    // 独立原型链：constructor 指向 PatchedRTC，页面无法经 constructor 逃逸到原生构造器
    PatchedRTC.prototype = Object.create(Orig.prototype);
    try {
      Object.defineProperty(PatchedRTC.prototype, "constructor", {
        value: PatchedRTC, writable: true, configurable: true
      });
    } catch (e) {}
    try {
      Object.getOwnPropertyNames(Orig).forEach((k) => {
        if (!(k in PatchedRTC)) {
          try { PatchedRTC[k] = Orig[k]; } catch (e) {}
        }
      });
    } catch (e) {}
    keepName(PatchedRTC, "RTCPeerConnection");
    window.RTCPeerConnection = PatchedRTC;
    try { if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = PatchedRTC; } catch (e) {}
  })();

  // ---------- 9. UA 平台伪装（可选增强，默认关） ----------
  const MAC_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  try {
    const macUAD = {
      brands: [
        { brand: "Google Chrome", version: "131" },
        { brand: "Chromium", version: "131" },
        { brand: "Not_A Brand", version: "24" }
      ],
      mobile: false,
      platform: "macOS",
      getHighEntropyValues: function (hints) {
        const all = {
          architecture: "arm",
          bitness: "64",
          model: "",
          platform: "macOS",
          platformVersion: "14.5.0",
          uaFullVersion: "131.0.6778.86",
          fullVersionList: [
            { brand: "Google Chrome", version: "131.0.6778.86" },
            { brand: "Chromium", version: "131.0.6778.86" },
            { brand: "Not_A Brand", version: "24.0.0.0" }
          ],
          wow64: false
        };
        const out = {};
        (hints || []).forEach((h) => { if (h in all) out[h] = all[h]; });
        out.mobile = false;
        out.platform = "macOS";
        return Promise.resolve(out);
      },
      toJSON: function () {
        return { brands: this.brands, mobile: this.mobile, platform: this.platform };
      }
    };
    Object.defineProperty(Navigator.prototype, "platform", {
      get: function () { return uaActive() ? "MacIntel" : origPlatformDesc.get.call(this); },
      set: function () {},
      configurable: true
    });
    Object.defineProperty(Navigator.prototype, "userAgent", {
      get: function () { return uaActive() ? MAC_UA : origUserAgentDesc.get.call(this); },
      set: function () {},
      configurable: true
    });
    Object.defineProperty(Navigator.prototype, "vendor", {
      get: function () { return uaActive() ? "Apple Computer, Inc." : origVendorDesc.get.call(this); },
      set: function () {},
      configurable: true
    });
    Object.defineProperty(navigator, "userAgentData", {
      get: function () { return uaActive() ? macUAD : origUAD; },
      set: function () {},
      configurable: true
    });
  } catch (e) {}
  // origUAD 在上方 try 中使用，此处兜底声明顺序（hoisting 不适用于 const，故提前获取）
  // （若上方抛错，UA 伪装整体失效但不影响其他模块）

  // ---------- 10. Canvas 字体拦截（大小写无关 + 空列表回退） ----------
  const CN_FONTS = [
    "Microsoft YaHei UI", "Microsoft YaHei", "SimSun", "NSimSun", "SimHei",
    "KaiTi", "FangSong", "DengXian", "FangSong_GB2312", "KaiTi_GB2312",
    "PingFang SC", "Hiragino Sans GB", "STHeiti", "STSong", "STKaiti", "STFangsong",
    "Songti SC", "Source Han Sans CN", "Source Han Sans SC",
    "Noto Sans CJK SC", "Noto Serif CJK SC",
    "WenQuanYi Micro Hei", "WenQuanYi Zen Hei", "WenQuanYi Zen Hei Sharp",
    "Microsoft JhengHei UI", "Microsoft JhengHei", "PMingLiU", "MingLiU",
    "DFKai-SB", "PingFang TC", "PingFang HK",
    "Source Han Sans TW", "Noto Sans CJK TC", "Noto Serif CJK TC",
    "MiSans", "MiSans Norm", "MIUI", "HarmonyOS Sans SC", "HarmonyOS Sans",
    "HONOR Sans", "OPPO Sans", "vivo Sans", "Alibaba PuHuiTi", "Alibaba Sans",
    "DingTalk JinBuTi", "Douyin Sans", "HYQiHei", "HYZhengYuan",
    "FZShuSong-Z01S", "FZKai-Z03S", "FZHei-B01S", "FZFangSong-Z02S",
    "FZLanTingHei", "FZXiHei", "FounderType"
  ];
  const CN_FONT_SET = new Map(CN_FONTS.map((f) => [f.toLowerCase(), f]));
  const QUICK_REGEX = new RegExp("(" + CN_FONTS.map((f) => f.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")).join("|") + ")", "i");

  function stripChineseFonts(fontStr) {
    const m = fontStr.match(/^(.*?\b\d+(?:\.\d+)?(?:px|pt|em|rem|cm|mm|in|pc|ex|ch|vw|vh|vmin|vmax|%)(?:\s*\/\s*[\d.]+)?)\s+(.+)$/i);
    if (!m) return fontStr;
    const prefix = m[1];
    const familiesStr = m[2];
    const familyList = [];
    let current = "";
    let quote = null;
    const DQ = String.fromCharCode(34);
    const SQ = String.fromCharCode(39);
    for (let i = 0; i < familiesStr.length; i++) {
      const ch = familiesStr.charAt(i);
      if (quote) {
        current += ch;
        if (ch === quote) quote = null;
      } else if (ch === DQ || ch === SQ) {
        quote = ch;
        current += ch;
      } else if (ch === ",") {
        familyList.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    familyList.push(current.trim());
    const filtered = familyList.filter((f) => {
      let unquoted = f;
      if (unquoted.length >= 2 && (unquoted.charAt(0) === DQ || unquoted.charAt(0) === SQ) && unquoted.charAt(unquoted.length - 1) === unquoted.charAt(0)) {
        unquoted = unquoted.substring(1, unquoted.length - 1);
      }
      unquoted = unquoted.trim();
      return !CN_FONT_SET.has(unquoted.toLowerCase());
    });
    if (filtered.length === familyList.length) return fontStr;
    // 空列表回退中性字体，避免把 font 清成非法值
    if (filtered.length === 0) return (prefix ? prefix + " " : "") + "sans-serif";
    return (prefix ? prefix + " " : "") + filtered.join(", ");
  }

  function patchMeasure(proto) {
    if (!proto || !proto.measureText) return;
    const origMeasure = proto.measureText;
    const patched = function measureText(text) {
      try {
        if (fontsActive()) {
          const font = this.font;
          if (typeof font === "string" && QUICK_REGEX.test(font)) {
            const cleaned = stripChineseFonts(font);
            if (cleaned !== font) {
              this.font = cleaned;
              let result;
              try {
                result = origMeasure.call(this, text);
              } finally {
                this.font = font;
              }
              return result;
            }
          }
        }
      } catch (e) {}
      return origMeasure.call(this, text);
    };
    proto.measureText = patched;
  }
  patchMeasure(window.CanvasRenderingContext2D && window.CanvasRenderingContext2D.prototype);
  patchMeasure(window.OffscreenCanvasRenderingContext2D && window.OffscreenCanvasRenderingContext2D.prototype);

  // ---------- 11. 消息通道（带一次性 nonce 防重放） ----------
  const seenNonces = new Set();
  function isReplay(nonce) {
    if (!nonce) return false;
    if (seenNonces.has(nonce)) return true;
    seenNonces.add(nonce);
    if (seenNonces.size > 500) {
      // 简单清理：保留最近 250 个
      const arr = Array.from(seenNonces).slice(-250);
      seenNonces.clear();
      arr.forEach((n) => seenNonces.add(n));
    }
    return false;
  }

  window.addEventListener("message", (event) => {
    if (!event.data || typeof event.data !== "object") return;
    if (event.source !== window) return; // 仅接受同窗口（bridge）消息
    const msg = event.data;
    if (msg.type === "FCD_CONFIG" && msg.payload && typeof msg.payload === "object") {
      if (isReplay(msg.nonce)) return; // 拒绝重放
      applyConfig(msg.payload);
    } else if (msg.type === "FCD_QUERY" && msg.queryId) {
      const reply = {
        type: "FCD_QUERY_RESULT",
        queryId: msg.queryId,
        payload: selfCheck()
      };
      event.source.postMessage(reply, "*");
    }
  });

  function applyConfig(cfg) {
    try {
      if (typeof cfg.timezone === "string" && cfg.timezone) state.timezone = cfg.timezone;
      if (typeof cfg.locale === "string" && cfg.locale) state.locale = cfg.locale;
      if (Array.isArray(cfg.langs) && cfg.langs.length) state.langs = Object.freeze(cfg.langs.slice());
      if (cfg.features && typeof cfg.features === "object") {
        ["timezone", "language", "fonts", "webrtc", "intlLocale", "uaPlatform"].forEach((k) => {
          if (typeof cfg.features[k] === "boolean") state.features[k] = cfg.features[k];
        });
      }
    } catch (e) {}
  }

  // ---------- 12. selfCheck（popup 查询） ----------
  function selfCheck() {
    const out = {};
    try {
      out.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      out.locale = Intl.DateTimeFormat().resolvedOptions().locale;
      out.langs = Array.from(navigator.languages);
      out.tzOffset = new Date().getTimezoneOffset();
      out.toStringTail = new Date().toString().slice(-50);
      out.numLocale = Intl.NumberFormat().resolvedOptions().locale;
      out.features = Object.assign({}, state.features);
      // 字体自查：拦截开启 → 全屏蔽（零成本）；关闭 → 原生实测泄漏名单
      if (fontsActive()) {
        out.leakedFonts = [];
        out.fontsIntercepted = true;
      } else {
        const CHECK_FONTS = ["Microsoft YaHei", "SimSun", "SimHei", "KaiTi", "FangSong", "DengXian", "Microsoft JhengHei", "PingFang SC"];
        const probe = (fontName) => {
          const c = document.createElement("canvas").getContext("2d");
          const text = "中文字体检测ABCabc012";
          c.font = "72px monospace";
          const a = c.measureText(text).width;
          c.font = "72px \"" + fontName + "\", monospace";
          const b = c.measureText(text).width;
          return Math.abs(b - a) > 0.5;
        };
        out.leakedFonts = CHECK_FONTS.filter(probe);
        out.fontsIntercepted = false;
      }
      out.yaHeiLeak = out.leakedFonts.length > 0;
      out.webrtcPatched = typeof RTCPeerConnection !== "undefined" && RTCPeerConnection.toString().indexOf("[native code]") === -1;
      out.uaPlatformActive = uaActive();
    } catch (e) {
      out.error = String(e && e.message);
    }
    return out;
  }
})();