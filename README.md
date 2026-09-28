# 调教模拟器 (Tiaojiao Simulator)

一个**完全本地部署**的 AI 角色扮演 / 剧情模拟器。你可以自定义角色、势力、性格、技能、武器、场景与人物关系，把互动过程交给 Gemini 或任意 OpenAI 兼容接口来演绎。**所有存档、立绘与配置都保存在你自己的电脑上**，不会上传到任何服务器（只有你主动配置的 AI 接口会收到对话内容）。

> 📦 **本仓库不包含任何预设内容（空白框架）**：角色、势力、性格、种族、关系、技能/武器、开局剧情与快捷提示词等均以空列表发布，需要你在界面中自行创建或导入。仓库中只保留程序运行所必需的通用界面分类与服务商接口配置。

> ⚠️ **内容分级与免责声明**
> 本项目包含面向成年人的虚构科幻/戏剧题材与可自定义的提示词（包括"角色扮演越狱/反拒答"设置）。**仅供 18 岁以上成年人在完全虚构的语境中使用。**
> - 请勿用于生成现实中的暴力、违法或侵害他人的内容；
> - 使用者必须自行遵守所接入 AI 服务商的用户协议与当地法律法规；
> - 提示词与模型输出均由使用者自行负责，作者不对任何使用后果承担责任。

---

## ✨ 功能

- 🎭 **角色系统**：自定义角色卡、外观、立绘/视频、性格、语音台词、弱点与敏感部位（初始为空，全部由你创建）。
- 🏛️ **世界设定**：势力、种族、关系羁绊、自定义开局剧情、收容环境与每日结算。
- 💬 **多种交互**：审讯 / 对话 / 实时模式 / 自动回复，支持多人小队同台。
- 🤖 **多模型接入**：内置 Google Gemini，并提供 DeepSeek、OpenAI、Claude、硅基流动、OpenRouter、Kimi、智谱等 OpenAI 兼容服务商的可选配置，也可自定义任意中转接口。
- 🔎 **可选联网搜索**：支持 Google / Bing / DuckDuckGo / 百度 / 搜狗 / 维基百科（可在设置中开关）。
- 💾 **本地持久化**：服务端 `data/` 目录 + 浏览器 IndexedDB / localStorage 双保险，支持存档槽、全量备份与恢复。
- 🖥️ **桌面式启动**：双击 `start.bat` 即可用 Edge/Chrome 的 App 模式打开独立窗口，关窗自动落盘。

## 🚀 快速开始（Windows，推荐）

1. 安装 [Node.js 18+](https://nodejs.org/)；
2. 解压项目，双击 **`start.bat`**（或 `启动独立程序.bat`）；
3. 首次运行会自动执行 `npm install`，随后弹出独立程序窗口；
4. 在右上角 **AI 设置** 中填入你自己的 API Key（也可在根目录创建 `.env` 写入 `GEMINI_API_KEY=...`）。

> 首次启动会自动创建 `data/` 目录，所有数据都保存在其中。

## 🛠️ 手动运行

```bash
npm install

# 开发模式（Vite 中间件，改代码即时生效）
npm run dev

# 生产模式（先构建再用 dist 运行）
npm run build
npm start
```

默认只监听 `127.0.0.1:3000`。如需局域网访问，可显式设置环境变量：`HOST=0.0.0.0 PORT=3000 npm start`（⚠️ 接口无鉴权，局域网内任何设备都能读取你的存档与 API Key，请谨慎）。

## 📁 数据与备份

| 路径 | 内容 |
| --- | --- |
| `data/app_storage.json` | 权威存档（角色、预设、进度、对话索引等） |
| `data/portraits.json` | 角色立绘（base64） |
| `data/saves/*.json` | 存档槽文件 |
| `data/backups/` | 自动快照与备份归档 |
| `data/uploads/` | 你手动上传的图片 / 视频 / 音频 |

- 这些文件**已被 `.gitignore` 排除**，请勿提交到公开仓库（它们可能包含你的 API Key）。
- 覆盖升级前，建议先备份整个 `data/` 目录。
- 服务端写盘采用「临时文件 + 原子替换」，并带有体量护栏；如果存档损坏，会被重命名为 `app_storage.json.corrupt-<时间戳>` 而不是被清空。

## 🧱 技术栈

React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · Express 4 · `@google/genai` · esbuild

## 📄 许可

[MIT](./LICENSE)

## English

A fully local, self-hosted AI role-play / story simulator with customizable characters, factions, scenarios and relationships. Supports Google Gemini and any OpenAI-compatible endpoint. All saves stay on your machine. **18+ fictional content; use at your own risk and comply with your AI provider's terms.**
