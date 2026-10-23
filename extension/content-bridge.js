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

  // 原生 WebRTC 真实泄漏探测（ISOLATED world 不受 MAIN world patch 影响）
  // 返回泄漏的 IP 候选列表；1 秒超时
  function probeWebrtcLeak() {
    return new Promise((resolve) => {
      let resolved = false;
      const ips = [];
      let pc = null;
      const finish = () => {
        if (resolved) return;
        resolved = true;
        try { if (pc) pc.close(); } catch (e) {}
        resolve(ips);
      };
      try {
        pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        pc.onicecandidate = (e) => {
          if (!e.candidate || !e.candidate.candidate) { finish(); return; }
          const m = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/i.exec(e.candidate.candidate);
          if (m && m[1] && ips.indexOf(m[1]) === -1) ips.push(m[1]);
        };
        pc.createDataChannel("");
        pc.createOffer().then((sdp) => pc.setLocalDescription(sdp)).catch(() => finish());
      } catch (e) { finish(); }
      setTimeout(finish, 1000);
    });
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
          // 合并：WebRTC 未拦截时附加原生探测的真实泄漏值
          const payload = event.data.payload;
          const needProbe = payload && payload.features && payload.features.webrtc === false;
          if (needProbe) {
            probeWebrtcLeak().then((ips) => {
              payload.realWebrtcLeak = ips;
              settled = true;
              try { sendResponse({ ok: true, payload: payload }); } catch (e) {}
            });
          } else {
            settled = true;
            try { sendResponse({ ok: true, payload: payload }); } catch (e) {}
          }
        }
      };
      window.addEventListener("message", onWindowMessage);
      window.postMessage({ type: "FCD_QUERY", queryId: queryId }, "*");
      setTimeout(() => {
        if (!settled) {
          window.removeEventListener("message", onWindowMessage);
          try { sendResponse({ ok: false, error: "timeout" }); } catch (e) {}
        }
      }, 3000);
      return true; // 保持 sendResponse 异步可用
    });
  } catch (e) {}
})();