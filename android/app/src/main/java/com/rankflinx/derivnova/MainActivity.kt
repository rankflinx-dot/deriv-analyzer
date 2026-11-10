package com.rankflinx.derivnova

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
    private var waitingForOverlayPermission = false
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = 0xFF10141D.toInt()
        window.navigationBarColor = 0xFF10141D.toInt()
        window.decorView.systemUiVisibility = 0

        val page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(24), dp(28), dp(24), dp(28))
            setBackgroundColor(0xFF10141D.toInt())
        }
        val badge = TextView(this).apply {
            text = "N"
            textSize = 25f
            gravity = Gravity.CENTER
            setTextColor(0xFFFFFFFF.toInt())
            setBackgroundColor(0xFF2878E8.toInt())
            setPadding(dp(8), dp(2), dp(8), dp(2))
        }
        page.addView(badge, LinearLayout.LayoutParams(dp(48), dp(48)))
        page.addView(TextView(this).apply {
            text = "DerivNova Analyzer"
            textSize = 25f
            setTextColor(0xFFF4F6FB.toInt())
            setPadding(0, dp(18), 0, dp(6))
        })
        page.addView(TextView(this).apply {
            text = "Keep live market analysis visible while you use Deriv. The floating panel uses public market data and does not place trades."
            textSize = 15f
            setTextColor(0xFF9BA7B7.toInt())
            setLineSpacing(dp(3).toFloat(), 1f)
        })
        val start = Button(this).apply {
            text = "Start floating analyzer"
            setTextColor(0xFF071810.toInt())
            setBackgroundColor(0xFF16B88B.toInt())
            setOnClickListener { requestOverlayAndStart() }
        }
        page.addView(start, LinearLayout.LayoutParams(-1, dp(54)).apply { topMargin = dp(24) })
        statusText = TextView(this).apply {
            text = "To float above Deriv, Android will ask you to allow display over other apps."
            textSize = 13f
            setTextColor(0xFF9BA7B7.toInt())
            setPadding(0, dp(16), 0, 0)
        }
        page.addView(statusText)
        page.addView(TextView(this).apply {
            text = "Connection: wss://api.derivws.com/trading/v1/options/ws/public"
            textSize = 11f
            setTextColor(0xFF748198.toInt())
            setPadding(0, dp(20), 0, 0)
        })
        setContentView(page)
    }

    private fun requestOverlayAndStart() {
        if (!Settings.canDrawOverlays(this)) {
            waitingForOverlayPermission = true
            statusText.text = "Enable ‘Allow display over other apps’, then return here."
            val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
            startActivity(intent)
            return
        }
        startFloatingService()
    }

    override fun onResume() {
        super.onResume()
        if (waitingForOverlayPermission && Settings.canDrawOverlays(this)) {
            waitingForOverlayPermission = false
            startFloatingService()
        }
    }

    private fun startFloatingService() {
        val service = Intent(this, FloatingService::class.java)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(service) else startService(service)
            statusText.text = "Floating analyzer started. Switch to Deriv; drag the panel by its title bar."
        } catch (error: Exception) {
            statusText.text = "Could not start the floating window: ${error.message ?: "try again"}"
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}

