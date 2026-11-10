# DerivNova Floating Analyzer for Android

This companion opens the DerivNova Analyzer website inside a draggable Android overlay, so its public market analysis can remain visible while you switch to Deriv. It is an analysis display only and does not place trades or request a Deriv password/token.

## Install

1. Download `app-debug.apk` from the **derivnova-floating-analyzer** artifact in the latest successful [Android APK workflow](https://github.com/rankflinx-dot/deriv-analyzer/actions/workflows/android-apk.yml).
2. Open the APK on your Android phone and allow installation when Android asks.
3. Open **DerivNova Floating Analyzer** and tap **Start floating analyzer**.
4. Allow **Display over other apps**, then return to the app. The analyzer appears in a movable window.
5. Open Deriv. Drag the analyzer by its title; use **−** to collapse it or **×** to close it. The persistent notification also has a close action.

The analyzer uses the existing hosted site and its existing public WebSocket connection: `wss://api.derivws.com/trading/v1/options/ws/public`. Android's overlay permission must be granted explicitly. Some devices or apps may hide overlays while secure trading or login screens are open.

## Build locally

Requires JDK 17, Android SDK 35, and Gradle 8.9:

```sh
gradle --no-daemon -p android assembleDebug
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

