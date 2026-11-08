# 工位争锋 / Shiftfront

横屏离线职场题材 MOBA 原型。六位原创职业角色、三路兵线、5v5 电脑对战、防御塔、野区、技能、装备、升级、复活和基地胜负均可游玩。战场采用原创 Three.js 立体场景与职业模型；不支持 WebGL 时自动切换到 2D Canvas 战场。没有在线服务、广告、账号或第三方美术素材。该项目不使用《王者荣耀》的美术、角色、地图或商标。

仓库 `release/` 目录直接提供已构建的开发调试签名 APK。

## 安装

从 `release/shiftfront-v0.2.1-debug.apk` 安装 APK，Android 7.0 及以上，横屏运行。APK 是开发调试签名版，便于本机安装测试，不用于应用商店发布。对局为单机 5v5 AI，不支持联网真人匹配。旧版 APK 保留在同一目录。

## 构建

需要 JDK 17、Android SDK Platform 37、Build Tools 36+。Gradle 9.4.1 由仓库中的 Wrapper 自动获取，在项目目录执行：

```powershell
$env:JAVA_HOME = 'C:\path\to\jdk-17'
$env:ANDROID_HOME = 'C:\path\to\android-sdk'
.\gradlew.bat :app:assembleDebug
```

生成的安装包位于 `app/build/outputs/apk/debug/app-debug.apk`。游戏全部文件内置在 Android `assets` 中，打开 `app/src/main/assets/index.html` 也可以在桌面浏览器预览。

修改 3D 场景源码时先运行 `npm.cmd install` 和 `npm.cmd run bundle`，再重建 APK。打包后的 `scene3d.js` 已包含在源码中。执行 `npm.cmd test` 可运行规则测试；已安装 Chrome 时，`npm.cmd run smoke` 会检查动态战场、三种横屏尺寸、摇杆操作和 2D 回退，并在 `preview/` 生成截图。

## 操作

横屏触摸左下摇杆移动，右下普通攻击与三个职业技能；点按技能自动施放，拖动可为定向技能瞄准，四级解锁终极技能。上方可查看战绩和金币商店，右上角暂停。桌面浏览器可用 WASD/方向键移动、J/空格攻击、K/L/U 或 1/2/3 释放技能、B 打开商店、Tab 查看战绩和 Esc 暂停。

## 项目结构

- `app/src/main/assets/game.js`: 独立的战斗规则与 AI
- `src/scene3d.js`: 原创 Three.js 战场、职业模型与特效源码
- `app/src/main/assets/scene3d.js`: 可离线运行的打包后 3D 场景
- `app/src/main/assets/render.js`: 不支持 WebGL 时的 2D Canvas 回退
- `app/src/main/assets/app.js`: 界面与输入
- `app/src/main/java/`: 离线全屏 Android WebView 容器
- `tests/`: 使用 Node 内置测试运行器的规则测试

代码与项目原创绘制素材采用 [MIT 许可证](LICENSE)。
随包使用的 Three.js 采用 [MIT 许可证](app/src/main/assets/three-license.txt)。
`src/kaykit/` 内的 KayKit City Builder Bits 模型为 Kay Lousberg 发布的 CC0 1.0 素材（许可证随目录附上），当前版本未被成品场景引用，仅作为后续场景扩展的占位资源。
随附的 Gradle Wrapper 脚本与 JAR 属于 Gradle 项目，采用 [Apache-2.0 许可证](gradle/LICENSE)。
