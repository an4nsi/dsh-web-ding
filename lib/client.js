window.__ModuleLoader__.load({
	id: "dsh-web-ding",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/store.ts
		const KEY = "dsh-web-ding.settings";
		function load() {
			try {
				const raw = localStorage.getItem(KEY);
				if (raw !== null) {
					const parsed = JSON.parse(raw);
					return {
						notify: parsed.notify === true,
						sound: parsed.sound === true
					};
				}
			} catch {}
			return {
				notify: false,
				sound: false
			};
		}
		let current = load();
		const subscribers = /* @__PURE__ */ new Set();
		function getSettings() {
			return current;
		}
		function setSetting(key, value) {
			if (current[key] === value) return;
			current = {
				...current,
				[key]: value
			};
			try {
				localStorage.setItem(KEY, JSON.stringify(current));
			} catch {}
			for (const notify of subscribers) notify();
		}
		function subscribe(fn) {
			subscribers.add(fn);
			return () => {
				subscribers.delete(fn);
			};
		}
		//#endregion
		//#region src/client/chime.ts
		/**
		* Turn-end chime: a two-note sine motif (C5 -> E5), synthesized live via the
		* Web Audio API — no audio assets.
		*
		* Ported from agegr/pi-web, `hooks/useAudio.ts` (`playTone`):
		*   https://github.com/agegr/pi-web/blob/v0.8.8/hooks/useAudio.ts
		* Copyright (c) 2026 agegr — MIT License.
		* The note frequencies, spacing, and gain envelope are unchanged from
		* upstream; the React hook around them was reduced to this plain module.
		*/
		/** C5 then E5 — the major-third "ding-ding ↑". */
		const NOTE_HZ = [523.25, 659.25];
		let ctxRef = null;
		function getCtx() {
			if (ctxRef !== null && ctxRef.state !== "closed") return ctxRef;
			try {
				ctxRef = new AudioContext();
			} catch {
				return null;
			}
			return ctxRef;
		}
		/** Call from any user gesture: autoplay policy suspends fresh contexts until one happens. */
		function unlockChime() {
			const ctx = getCtx();
			if (ctx !== null && ctx.state === "suspended") ctx.resume().catch(() => {});
		}
		function playChime() {
			const ctx = getCtx();
			if (ctx === null) return;
			const play = () => {
				try {
					const now = ctx.currentTime;
					for (const [i, freq] of NOTE_HZ.entries()) {
						const osc = ctx.createOscillator();
						const gain = ctx.createGain();
						osc.connect(gain);
						gain.connect(ctx.destination);
						osc.type = "sine";
						osc.frequency.value = freq;
						const t = now + i * .18;
						gain.gain.setValueAtTime(0, t);
						gain.gain.linearRampToValueAtTime(.18, t + .02);
						gain.gain.exponentialRampToValueAtTime(.001, t + .45);
						osc.start(t);
						osc.stop(t + .45);
					}
				} catch {}
			};
			if (ctx.state === "suspended") {
				ctx.resume().then(play).catch(() => {});
				return;
			}
			play();
		}
		//#endregion
		//#region src/client/notify.ts
		/** Robust send path (MDN pattern): prefer an existing service worker
		* registration's showNotification(), fall back to the page-level
		* Notification() constructor. Both are the official Web Notifications API.
		*/
		async function sendTurnEnd(body, sessionId) {
			const opts = {
				body,
				tag: `turn-${sessionId}-${Date.now()}`
			};
			const log = "[dsh-web-ding]";
			try {
				const reg = typeof navigator !== "undefined" && navigator.serviceWorker?.controller ? await navigator.serviceWorker.getRegistration() : void 0;
				if (reg) {
					await reg.showNotification("任务完成", opts);
					console.info(`${log} shown via ServiceWorkerRegistration`);
					return;
				}
				const n = new Notification("任务完成", opts);
				n.addEventListener("show", () => console.info(`${log} browser accepted ('show' fired)`));
				n.addEventListener("error", (e) => console.error(`${log} notification error event`, e));
				n.addEventListener("click", () => {
					window.focus();
					n.close();
				});
			} catch (err) {
				console.error(`${log} failed to show notification`, err);
			}
		}
		//#endregion
		//#region src/client/TurnWatch.tsx
		/**
		* Invisible turn-end engine. Renders nothing — it exists so the plugin has a
		* mounted fiber in the conversation (the header-actions slot) whose effects
		* can watch the running flag. The visible controls live in the official
		* Settings page (see SettingsRows.tsx).
		*/
		function TurnWatch({ sessionId, useSessions }) {
			const running = useSessions((s) => s.byId[sessionId]?.running === true);
			const displayTitle = useSessions((s) => s.byId[sessionId]?.displayTitle);
			const prevRunning = (0, react.useRef)(null);
			const prevSession = (0, react.useRef)(null);
			const settingsRef = (0, react.useRef)(getSettings());
			(0, react.useEffect)(() => subscribe(() => {
				settingsRef.current = getSettings();
			}), []);
			(0, react.useEffect)(() => {
				if (prevSession.current !== sessionId) {
					prevSession.current = sessionId;
					prevRunning.current = running;
					return;
				}
				const prev = prevRunning.current;
				prevRunning.current = running;
				if (prev !== true || running !== false) return;
				const { notify, sound } = settingsRef.current;
				console.info(`[dsh-web-ding] turn end (notify=${notify} sound=${sound})`);
				if (notify && typeof Notification !== "undefined" && Notification.permission === "granted") sendTurnEnd(`${displayTitle ?? "会话"}：agent 已停止输出`, sessionId);
				if (sound) playChime();
			}, [
				running,
				displayTitle,
				sessionId
			]);
			return null;
		}
		//#endregion
		//#region \0dsh-css:src/client/Switch.module.css.mjs
		const css$1 = ".-G84bq_switch{flex:none;display:inline-flex;position:relative}.-G84bq_switchInput{opacity:0;cursor:pointer;margin:0;position:absolute;inset:0}.-G84bq_switchTrack{background:var(--dsw-alias-bg-mask-1);border-radius:10px;width:36px;height:20px;transition:background .16s;display:inline-block;position:relative}.-G84bq_switchThumb{background:var(--dsw-alias-bg-layer-2,#fff);border-radius:50%;width:16px;height:16px;transition:left .16s;position:absolute;top:2px;left:2px;box-shadow:0 1px 2px #00000040}.-G84bq_switchInput:checked+.-G84bq_switchTrack{background:var(--dsw-alias-brand-primary)}.-G84bq_switchInput:checked+.-G84bq_switchTrack .-G84bq_switchThumb{left:18px}.-G84bq_switchInput:focus-visible+.-G84bq_switchTrack{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}";
		const tagId$1 = "dsh-web-ding/Switch.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var Switch_module_css_default = {
			"switchThumb": "-G84bq_switchThumb",
			"switch": "-G84bq_switch",
			"switchTrack": "-G84bq_switchTrack",
			"switchInput": "-G84bq_switchInput"
		};
		//#endregion
		//#region src/client/Switch.tsx
		/**
		* Boolean control following DSH-better-sidebar's canonical recipe: a real,
		* visually-hidden native checkbox (semantics + keyboard focus intact) driving
		* a styled track/thumb. The framework ships no Toggle/Switch primitive.
		*/
		function Switch(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: Switch_module_css_default.switch,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					className: Switch_module_css_default.switchInput,
					checked: props.checked,
					"aria-label": props.label,
					onChange: (e) => props.onChange(e.currentTarget.checked)
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: Switch_module_css_default.switchTrack,
					"aria-hidden": "true",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: Switch_module_css_default.switchThumb })
				})]
			});
		}
		//#endregion
		//#region \0dsh-css:src/client/section.module.css.mjs
		const css = "._0JY9lG_wrap{flex-direction:column;gap:12px;width:100%;max-width:640px;display:flex}._0JY9lG_desc{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px;line-height:1.5}._0JY9lG_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:16px;margin:0;padding:0;list-style:none}._0JY9lG_row{justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;display:flex}._0JY9lG_row+._0JY9lG_row{border-top:1px solid var(--dsw-alias-border-l2)}._0JY9lG_texts{flex-direction:column;gap:2px;min-width:0;display:flex}._0JY9lG_title{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500}._0JY9lG_hint{color:var(--dsw-alias-label-tertiary);font-size:12px}";
		const tagId = "dsh-web-ding/section.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var section_module_css_default = {
			"row": "_0JY9lG_row",
			"texts": "_0JY9lG_texts",
			"hint": "_0JY9lG_hint",
			"title": "_0JY9lG_title",
			"desc": "_0JY9lG_desc",
			"card": "_0JY9lG_card",
			"wrap": "_0JY9lG_wrap"
		};
		//#endregion
		//#region src/client/WebDingSection.tsx
		/**
		* The "Web Ding" settings section (settings.section slot, order 100 = last in
		* the nav). Visual language mirrors the native pages: content sits inside the
		* shell's padded column, controls live in a hairline-bordered layer-3 card,
		* rows separated by hairlines, all colors via the host's --dsw-alias-* tokens.
		*
		* The shell hands us only { close }; everything else comes from our own
		* store. No locale service — the nav label is the brand name and row copy is
		* hardcoded zh per product decision.
		*/
		function useStored(key) {
			const [value, setValue] = (0, react.useState)(() => getSettings()[key]);
			(0, react.useEffect)(() => subscribe(() => setValue(getSettings()[key])), [key]);
			const update = (v) => {
				setSetting(key, v);
				setValue(v);
			};
			return [value, update];
		}
		function permHint() {
			if (typeof Notification === "undefined") return "此浏览器不支持通知";
			if (Notification.permission === "denied") return "权限已被屏蔽，可到浏览器站点设置里改回允许";
			return "";
		}
		function WebDingSection() {
			const [notify, setNotify] = useStored("notify");
			const [sound, setSound] = useStored("sound");
			const hint = notify ? permHint() : "";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: section_module_css_default.wrap,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: section_module_css_default.desc,
					children: "主 agent 停止输出时提醒你——切到别的窗口也不错过。"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("ul", {
					className: section_module_css_default.card,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
						className: section_module_css_default.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: section_module_css_default.texts,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: section_module_css_default.title,
								children: "任务完成通知"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: section_module_css_default.hint,
								children: hint !== "" ? hint : "系统级通知；开启时会就地请求浏览器权限"
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
							checked: notify,
							onChange: (v) => {
								if (v && typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
								setNotify(v);
							},
							label: "任务完成通知"
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
						className: section_module_css_default.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: section_module_css_default.texts,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: section_module_css_default.title,
								children: "完成提示音"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: section_module_css_default.hint,
								children: "两音符合成音，不依赖系统通知中心；开启时播一声试听"
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
							checked: sound,
							onChange: (v) => {
								unlockChime();
								if (v) playChime();
								setSound(v);
							},
							label: "完成提示音"
						})]
					})]
				})]
			});
		}
		//#endregion
		//#region src/client/index.ts
		const name = "dsh-web-ding";
		const inject = ["slots"];
		function apply(ctx) {
			const slots = ctx.slots;
			slots.inject("conversation.session.header.actions", () => slots.register({
				name: "conversation.session.header.actions",
				id: "web-ding-engine",
				order: 99
			}, TurnWatch));
			slots.inject("settings.section", () => slots.register({
				name: "settings.section",
				id: "web-ding",
				order: 100,
				label: () => "Web Ding"
			}, WebDingSection));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map