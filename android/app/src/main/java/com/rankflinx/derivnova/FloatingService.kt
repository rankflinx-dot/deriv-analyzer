package com.rankflinx.derivnova

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.min
import kotlin.math.roundToInt

class FloatingService : Service() {
    private lateinit var windowManager: WindowManager
    private var panel: LinearLayout? = null
    private var webView: WebView? = null
    private var params: WindowManager.LayoutParams? = null
    private var collapsed = false
    private var expandedHeight = 0

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        startAsForeground()
        if (panel == null) showOverlay()
        return START_STICKY
    }

    private fun startAsForeground() {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Floating analyzer", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Keeps the user-started DerivNova floating analyzer available"
            })
        }
        val open = PendingIntent.getActivity(this, 1, Intent(this, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val close = PendingIntent.getService(this, 2, Intent(this, FloatingService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        @Suppress("DEPRECATION")
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL_ID) else Notification.Builder(this)
        val notification: Notification = builder.setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("DerivNova is floating")
            .setContentText("Live public market analysis is open over your apps.")
            .setContentIntent(open)
            .setOngoing(true)
            .addAction(Notification.Action.Builder(null, "Close", close).build())
            .build()
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun showOverlay() {
        if (!Settings.canDrawOverlays(this)) {
            stopSelf()
            return
        }
        val overlayType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else WindowManager.LayoutParams.TYPE_PHONE
        // Native WebView select menus need the same window context as their overlay host.
        val overlayContext = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) createWindowContext(overlayType, null) else this
        windowManager = overlayContext.getSystemService(WindowManager::class.java)
        val density = overlayContext.resources.displayMetrics.density
        fun dp(v: Int) = (v * density).roundToInt()
        val screenWidth = overlayContext.resources.displayMetrics.widthPixels
        val screenHeight = overlayContext.resources.displayMetrics.heightPixels
        val width = min(dp(420), screenWidth - dp(24))
        expandedHeight = min(dp(680), screenHeight - dp(120))

        val root = LinearLayout(overlayContext).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                setColor(0xFF10141D.toInt())
                cornerRadius = dp(12).toFloat()
                setStroke(dp(1), 0xFF354154.toInt())
            }
            clipToOutline = true
            elevation = dp(12).toFloat()
        }
        val header = LinearLayout(overlayContext).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(12), 0, dp(6), 0)
            setBackgroundColor(0xFF191F2B.toInt())
        }
        val logo = ImageView(overlayContext).apply {
            setImageResource(R.drawable.ic_derivnova_mark)
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(0xFF2878E8.toInt(), 0xFF16B88B.toInt())
            ).apply { cornerRadius = dp(9).toFloat() }
            setPadding(dp(5), dp(5), dp(5), dp(5))
            contentDescription = "DerivNova market chart logo"
        }
        header.addView(logo, LinearLayout.LayoutParams(dp(30), dp(30)).apply { marginEnd = dp(9) })
        val title = TextView(overlayContext).apply {
            text = "DerivNova Analyzer"
            textSize = 14f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 0, dp(8), 0)
        }
        header.addView(title, LinearLayout.LayoutParams(0, dp(46), 1f))
        val collapse = Button(overlayContext).apply {
            text = "−"
            textSize = 18f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.TRANSPARENT)
            setPadding(dp(8), 0, dp(8), 0)
            contentDescription = "Minimize floating analyzer"
        }
        header.addView(collapse, LinearLayout.LayoutParams(dp(44), dp(44)))
        val close = Button(overlayContext).apply {
            text = "×"
            textSize = 20f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.TRANSPARENT)
            setPadding(dp(8), 0, dp(8), 0)
            contentDescription = "Close floating analyzer"
            setOnClickListener { stopSelf() }
        }
        header.addView(close, LinearLayout.LayoutParams(dp(44), dp(44)))
        root.addView(header, LinearLayout.LayoutParams(-1, dp(46)))

        val browser = WebView(overlayContext).apply {
            setBackgroundColor(0xFF10141D.toInt())
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            settings.setSupportZoom(false)
            isFocusable = true
            isFocusableInTouchMode = true
            webChromeClient = WebChromeClient()
            webViewClient = WebViewClient()
            loadUrl(ANALYZER_URL)
        }
        webView = browser
        root.addView(browser, LinearLayout.LayoutParams(-1, 0, 1f))

        collapse.setOnClickListener {
            collapsed = !collapsed
            browser.visibility = if (collapsed) View.GONE else View.VISIBLE
            collapse.text = if (collapsed) "▢" else "−"
            collapse.contentDescription = if (collapsed) "Expand floating analyzer" else "Minimize floating analyzer"
            val layout = params ?: return@setOnClickListener
            layout.height = if (collapsed) dp(48) else expandedHeight
            windowManager.updateViewLayout(root, layout)
        }
        title.setOnTouchListener(object : View.OnTouchListener {
            private var downX = 0f
            private var downY = 0f
            private var originX = 0
            private var originY = 0
            override fun onTouch(view: View, event: MotionEvent): Boolean {
                val layout = params ?: return false
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        downX = event.rawX
                        downY = event.rawY
                        originX = layout.x
                        originY = layout.y
                        return true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        layout.x = originX + (event.rawX - downX).roundToInt()
                        layout.y = originY + (event.rawY - downY).roundToInt()
                        try { windowManager.updateViewLayout(root, layout) } catch (_: Exception) { }
                        return true
                    }
                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> return true
                }
                return false
            }
        })

        val layout = WindowManager.LayoutParams(width, expandedHeight, overlayType, WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN, PixelFormat.TRANSLUCENT).apply {
            gravity = Gravity.TOP or Gravity.START
            x = dp(12)
            y = dp(72)
        }
        params = layout
        panel = root
        try {
            windowManager.addView(root, layout)
        } catch (_: Exception) {
            panel = null
            stopSelf()
        }
    }

    override fun onDestroy() {
        panel?.let { view -> try { windowManager.removeView(view) } catch (_: Exception) { } }
        webView?.apply {
            stopLoading()
            loadUrl("about:blank")
            removeAllViews()
            destroy()
        }
        panel = null
        webView = null
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE) else @Suppress("DEPRECATION") stopForeground(true)
        super.onDestroy()
    }

    companion object {
        private const val CHANNEL_ID = "derivnova_floating"
        private const val NOTIFICATION_ID = 17420
        private const val ACTION_STOP = "com.rankflinx.derivnova.STOP_FLOATING"
        private const val ANALYZER_URL = "https://rankflinx-dot.github.io/deriv-analyzer/"
    }
}

