const { app, BrowserWindow } = require('electron');
const minimist = require('minimist');
const path = require('path');
const fs = require('fs');

// 从命令行参数获取网页地址、cookie和超时时间
const args = minimist(process.argv.slice(2));

if (!args.url || !args.cookies || !args.timeout) {
    console.error('Usage: electron <app> --url=<url> --cookies=<cookiesJson> --timeout=<timeout> [--show-window=<0|1>] [--min-show-time=<seconds>] [--useragent=<userAgent>]');
    process.exit(1);
}

const url = args.url;
const cookiesJson = args.cookies;
const timeout = parseInt(args.timeout, 10); // 超时时间，以秒为单位
const showWindow = parseInt(args['show-window'] || 0, 10); // 窗口显示控制
const minShowTime = parseInt(args['min-show-time'] || 0, 10); // 最小显示时间，以秒为单位
const userAgent = args.useragent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'; // 默认用户代理
const cookies = JSON.parse(cookiesJson);

// 生成随机用户数据目录
function createRandomUserDataDir() {
    const baseUserDataPath = app.getPath('userData');
    const randomDir = path.join(baseUserDataPath, `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`);
    fs.mkdirSync(randomDir, { recursive: true });
    return randomDir;
}

function createWindow() {
    if (!showWindow) {
        app.dock.hide();
    }

    // 使用随机用户数据目录
    const userDataDir = createRandomUserDataDir();
    const session = require('electron').session.fromPartition(`persist:${userDataDir}`);

    let win = new BrowserWindow({
        width: 800,
        height: 600,
        show: !!showWindow, // 控制窗口是否显示
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            session: session
        }
    });

    // 设置用户代理
    win.webContents.setUserAgent(userAgent);

    // 使用Promise.all来等待所有cookie都设置完毕
    const cookiePromises = cookies.map(cookie => {
        // 检查并调整cookie的domain和url
        const domain = cookie.domain.replace(/^\./, ''); // 移除域名开始的点
        const cookieUrl = `http${cookie.secure ? 's' : ''}://${domain}${cookie.path}`;
        const fullCookie = { ...cookie, url: cookieUrl };

        return session.cookies.set(fullCookie).then(() => {
            // console.log('Cookie successfully set:', fullCookie);
        }).catch(error => {
            // console.log("fullCookie:", fullCookie);
            // console.error('Error setting cookie:', error);
        });
    });

    // 设置超时计时器
    const timeoutId = setTimeout(() => {
        // console.error('Error: 页面加载已经超时');
        if (minShowTime > 0 && !minShowTimeReached) {
            // 如果超时发生且最小显示时间未到，设置在最小显示时间到达后退出
            setTimeout(() => {
                app.quit();
            }, (minShowTime * 1000) - (timeout * 1000));
        } else {
            app.quit();
        }
    }, timeout * 1000);

    // 初始化状态变量
    let minShowTimeReached = false;
    let pageLoadCompleted = false;

    // 如果设置了最少显示时间，启动计时器
    if (minShowTime > 0) {
        setTimeout(() => {
            minShowTimeReached = true;
            if (pageLoadCompleted) {
                clearTimeout(timeoutId); // 清除超时计时器
                app.quit();
            }
        }, minShowTime * 1000);
    } else {
        minShowTimeReached = true; // 如果没有设置，直接认为已到时间
    }

    // 当所有cookie都设置完成后，加载网页
    Promise.all(cookiePromises).then(() => {
        win.loadURL(url);

        win.webContents.once('did-stop-loading', () => {
            setTimeout(() => {
                win.webContents.executeJavaScript('document.documentElement.outerHTML').then((html) => {
                    console.log(html);  // 输出网页源码
                    pageLoadCompleted = true;
                    if (minShowTimeReached) {
                        clearTimeout(timeoutId); // 清除超时计时器
                        app.quit();  // 如果已达到最少显示时间，则退出应用
                    }
                }).catch(error => {
                    console.error('Error executing JavaScript:', error);
                    clearTimeout(timeoutId); // 清除超时计时器
                    app.quit();  // 出现错误后退出应用
                });
            }, 5000);  // 延迟5秒以确保所有JavaScript执行完毕，你可以根据需要调整时间
        });
    }).catch(error => {
        // console.error('Error setting cookies:', error);
        clearTimeout(timeoutId); // 清除超时计时器
        app.quit();  // 出现错误后退出应用
    });

    // 打开开发者工具（可选）
    // win.webContents.openDevTools();
}

// 确保应用准备就绪后创建窗口
app.whenReady().then(createWindow);

// 在所有窗口关闭时退出应用
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 激活应用时，如果没有窗口则创建窗口
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// demo用法示例:
// electron app.js --url="https://www.baidu.com" --cookies='[{"name":"cookie1","value":"value1","domain":".example.com","path":"/","secure":false}]' --timeout=10 --show-window=0 --min-show-time=15

// electron app.js --url="https://www.baidu.com" --cookies='[{"name":"cookie1","value":"value1","domain":".example.com","path":"/","secure":false}]' --timeout=10 --show-window=0 --min-show-time=5
