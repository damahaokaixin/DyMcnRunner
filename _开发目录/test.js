// 这是一个原理文件

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

function createWindow() {
    let win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // 读取cookies
    const cookies = JSON.parse(fs.readFileSync(path.join(__dirname, 'cookies.json'), 'utf8'));

    // 使用Promise.all来等待所有cookie都设置完毕
    const cookiePromises = cookies.map(cookie => {
        // 检查并调整cookie的domain和url
        const domain = cookie.domain.replace(/^\./, ''); // 移除域名开始的点
        const cookieUrl = `http${cookie.secure ? 's' : ''}://${domain}${cookie.path}`;
        const fullCookie = { ...cookie, url: cookieUrl };

        return win.webContents.session.cookies.set(fullCookie).then(() => {
            console.log('Cookie successfully set:', fullCookie);
        }).catch(error => {
            console.log("fullCookie:", fullCookie)
            console.error('Error setting cookie:', error);
        });
    });

    // 当所有cookie都设置完成后，加载网页
    Promise.all(cookiePromises).then(() => {
        win.loadURL('https://buyin.jinritemai.com/dashboard');  // 你的网站地址

        win.webContents.once('did-finish-load', () => {
            win.webContents.executeJavaScript('document.documentElement.outerHTML').then((html) => {
                // console.log("输出结果为:", html);  // 这里的html变量包含了整个页面的HTML
            });
        });
    });

    // 打开开发者工具
    win.webContents.openDevTools();
}

app.whenReady().then(createWindow);

// 在所有窗口关闭时退出
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
