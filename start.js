import { createServer } from 'node:net';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { execSync, spawn, exec } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

// Resolve paths against the project root, not the caller's CWD, so shortcuts work.
const ROOT = path.dirname(fileURLToPath(import.meta.url));
try { process.chdir(ROOT); } catch {}

// Ensure UTF-8 output in Windows Command Prompt
if (process.platform === 'win32') {
  try {
    execSync('chcp 65001 >nul', { stdio: 'ignore' });
  } catch {}
}

console.log('===================================================');
console.log('       🎮 调教模拟器 - 独立桌面应用程序');
console.log('  （免浏览器模式 · 专属独立视窗 · 关窗自动保存）');
console.log('===================================================\n');

// 确保数据目录存在
const DATA_DIR = path.join(ROOT, 'data');
try {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
} catch {}

// 1. 检查并安装必要依赖
if (!existsSync('node_modules')) {
  console.log('[1/3] 首次运行，正在快速配置独立客户端运行环境 (npm install)...');
  try {
    execSync('npm install --no-audit --no-fund --loglevel=error', {
      stdio: 'inherit',
      shell: true,
    });
    console.log('运行环境准备就绪！\n');
  } catch (err) {
    console.error('\n[错误] 环境配置失败，请检查网络后重试。', err);
    process.exit(1);
  }
} else {
  console.log('[1/3] 客户端运行环境检测正常。');
}

// 2. 检测指定端口服务是否已健康运行 (使用 127.0.0.1 杜绝 IPv6 冲突)
function checkServerHealthy(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// 自动寻找可用端口
function findAvailablePort(startPort = 3000) {
  return new Promise((resolve) => {
    function test(port) {
      if (port > 4200) return resolve(null);
      const s = createServer();
      s.once('error', () => test(port + 1));
      s.once('listening', () => {
        s.close(() => resolve(port));
      });
      s.listen(port, '127.0.0.1');
    }
    test(startPort);
  });
}

const DEFAULT_PORT = 3000;
const isAlreadyRunning = await checkServerHealthy(DEFAULT_PORT);
let targetPort = DEFAULT_PORT;

if (!isAlreadyRunning) {
  targetPort = await findAvailablePort(DEFAULT_PORT);
  if (!targetPort) {
    console.error('[错误] 3000-4200 端口段均被占用，无法启动服务。请关闭占用端口的程序后重试。');
    process.exit(1);
  }
}

console.log(`[2/3] 分配专属独立通信端口: ${targetPort}${isAlreadyRunning ? ' (复用已运行服务)' : ''}`);
console.log('[3/3] 本地数据落盘保障: 权威存档位于 ./data/app_storage.json（每次关闭全自动保存）\n');

// 统一使用 127.0.0.1，彻底解决 Windows 下 localhost 优先解析 IPv6 [::1] 造成的白屏/连接被拒
const appUrl = `http://127.0.0.1:${targetPort}`;

// 3. 寻找系统中支持 App Mode 的独立视窗宿主 (Edge / Chrome / Chromium)
function findStandaloneAppBrowser() {
  if (process.platform === 'win32') {
    const progFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env['LOCALAPPDATA'] || 'C:\\Users\\Default\\AppData\\Local';

    const edgeCandidates = [
      path.join(progFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(progFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ];
    for (const p of edgeCandidates) {
      if (existsSync(p)) return { name: 'Microsoft Edge (App Mode)', path: p };
    }

    const chromeCandidates = [
      path.join(progFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(progFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ];
    for (const p of chromeCandidates) {
      if (existsSync(p)) return { name: 'Google Chrome (App Mode)', path: p };
    }
  } else if (process.platform === 'darwin') {
    const macEdge = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
    if (existsSync(macEdge)) return { name: 'Microsoft Edge (App Mode)', path: macEdge };
    const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (existsSync(macChrome)) return { name: 'Google Chrome (App Mode)', path: macChrome };
  } else {
    const linuxBinaries = ['microsoft-edge', 'google-chrome', 'chromium-browser', 'chromium'];
    for (const bin of linuxBinaries) {
      try {
        execSync(`which ${bin}`, { stdio: 'ignore' });
        return { name: `${bin} (App Mode)`, path: bin };
      } catch {}
    }
  }
  return null;
}

// 4. 唤起无边框/无地址栏独立程序窗口
function launchStandaloneAppWindow(targetUrl) {
  const browser = findStandaloneAppBrowser();

  if (browser) {
    console.log(`>>> 正在激活独立程序专属视窗: ${browser.name} <<<`);
    console.log(`>>> 纯净独立视窗 (1440x920)，无浏览器地址栏与多余标签页 <<<\n`);

    // 注意：不要传递自定义 --user-data-dir，因为在 Windows 系统下当 Edge 后台运行时，
    // 不同的 user-data-dir 会造成 Chromium 单例协调器锁死并挂起在空白白屏（about:blank）！
    // 移除后直接借助宿主内核以纯粹 App 独立视窗形式秒开，永不锁死！
    const appArgs = [
      `--app=${targetUrl}`,
      '--new-window',
      '--window-size=1440,920',
      '--window-position=center',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-features=Translate,OptimizationHints,MediaRouter',
    ];

    try {
      const appWin = spawn(browser.path, appArgs, {
        detached: true,
        stdio: 'ignore',
      });
      appWin.unref();

      console.log('===================================================');
      console.log(' [就绪] 调教模拟器 独立程序窗口已呈现！');
      console.log(' [访问地址] ' + targetUrl);
      console.log(' [状态] 关窗/退出时进度将自动实时持久化写入 ./data/ 目录。');
      console.log(' [提示] 如需彻底结束后台服务，请在此控制台窗口按 Ctrl+C。');
      console.log('===================================================\n');
      return;
    } catch (err) {
      console.warn('调用独立应用路径失败，切换为系统命令调用:', err.message);
    }
  }

  // 备用系统命令唤起
  if (process.platform === 'win32') {
    exec(`start msedge --app="${targetUrl}" --new-window --window-size=1440,920 || start chrome --app="${targetUrl}" --new-window --window-size=1440,920 || start "" "${targetUrl}"`, () => {});
  } else if (process.platform === 'darwin') {
    exec(`open -na "Google Chrome" --args --app="${targetUrl}" --new-window || open "${targetUrl}"`, () => {});
  } else {
    exec(`google-chrome --app="${targetUrl}" --new-window || xdg-open "${targetUrl}"`, () => {});
  }
}

// 5. 确保 Vite HTML 模板与服务完全响应后再弹出窗口，从根源杜绝白屏
function waitForServerAndLaunch(port, maxTries = 60) {
  let tries = 0;
  let launched = false;

  const timer = setInterval(() => {
    tries++;
    const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (!launched && res.statusCode === 200 && (body.includes('root') || body.includes('html'))) {
          launched = true;
          clearInterval(timer);
          setTimeout(() => {
            launchStandaloneAppWindow(appUrl);
          }, 300);
        }
      });
    });

    req.on('error', () => {
      if (tries >= maxTries && !launched) {
        launched = true;
        clearInterval(timer);
        launchStandaloneAppWindow(appUrl);
      }
    });

    req.setTimeout(1200, () => req.destroy());
  }, 400);
}

// 6. 如果服务未启动，则启动后端服务
if (!isAlreadyRunning) {
  console.log(`正在启动模拟器核心服务: ${appUrl}`);
  console.log('正在预热界面与角色数据，请稍候...\n');

  waitForServerAndLaunch(targetPort);

  const tsxCli = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  let child;

  if (existsSync(tsxCli)) {
    child = spawn(process.execPath, [tsxCli, 'server.ts'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        PORT: String(targetPort),
      },
    });
  } else {
    const isWin = process.platform === 'win32';
    child = spawn('npm', ['run', 'dev'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        PORT: String(targetPort),
      },
      shell: isWin ? true : false,
    });
  }

  child.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`\n[退出] 服务中断 (退出码: ${code})`);
    }
    process.exit(code || 0);
  });

  child.on('error', (err) => {
    console.error('\n[错误] 无法启动服务:', err);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    console.log('\n[退出] 接收到退出信号，已触发全量数据落盘保存...');
    child.kill('SIGINT');
    process.exit(0);
  });
} else {
  // 服务已在后台健康运行，直接秒级呈现独立程序窗口
  console.log(`[提示] 检测到模拟器服务已处于就绪状态，直接激活独立程序窗口...\n`);
  launchStandaloneAppWindow(appUrl);
}
