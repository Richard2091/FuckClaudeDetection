// ============================================================
// Fuck Claude Detection  content-bridge.js  (ISOLATED world)
// 桥接 chrome.storage（配置存储）与 MAIN world hook：
//   1. 启动时读取配置并 postMessage 注入
//   2. storage 变化时实时推送
//   3. 转发 popup 的状态查询（chrome.runtime.onMessage -> window.postMessage）
// ============================================================
(() => {
  "use strict";

  const DEFAULT_CONFIG = {
    enabled: true,
    timezone: "America/New_York",
    locale: "en-US",
    langs: ["en-US", "en"],
    features: {
      timezone: true,
      language: true,
      fonts: true,
      webrtc: true,
      intlLocale: true,
      uaPlatform: false,
      acceptLanguageHeader: true
    }
  };

  function pushConfig(cfg) {
    try {
      window.postMessage({ type: "FCD_CONFIG", payload: cfg, nonce: "cfg-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10) }, "*");
    } catch (e) {}
  }

  function loadAndPush() {
    try {
      chrome.storage.local.get(["fcdConfig"], (res) => {
        const cfg = (res && res.fcdConfig) || DEFAULT_CONFIG;
        pushConfig(cfg);
      });
    } catch (e) {}
  }

  loadAndPush();

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.fcdConfig && changes.fcdConfig.newValue) {
        pushConfig(changes.fcdConfig.newValue);
      }
    });
  } catch (e) {}

  // popup 查询转发
  try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || msg.type !== "FCD_QUERY") return undefined;
      const queryId = "q" + Date.now() + Math.random().toString(36).slice(2, 8);
      let settled = false;
      const onWindowMessage = (event) => {
        if (!event.data || typeof event.data !== "object") return;
        if (event.data.type === "FCD_QUERY_RESULT" && event.data.queryId === queryId) {
          window.removeEventListener("message", onWindowMessage);
          settled = true;
          sendResponse({ ok: true, payload: event.data.payload });
        }
      };
      window.addEventListener("message", onWindowMessage);
      window.postMessage({ type: "FCD_QUERY", queryId: queryId }, "*");
      setTimeout(() => {
        if (!settled) {
          window.removeEventListener("message", onWindowMessage);
          try { sendResponse({ ok: false, error: "timeout" }); } catch (e) {}
        }
      }, 1500);
      return true; // 保持 sendResponse 异步可用
    });
  } catch (e) {}
})();