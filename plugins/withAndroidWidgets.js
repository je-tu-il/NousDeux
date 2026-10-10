const { withAndroidManifest, withDangerousMod, withStringsXml, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const QUESTION_PROVIDER_KT = `package com.pixelthings.nousdeux

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import org.json.JSONObject

class QuestionWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val prefs = context.getSharedPreferences("nousdeux_widgets", Context.MODE_PRIVATE)
        val payloadStr = prefs.getString("widget_payload", null)
        var questionText = "Quelle est la plus belle chose que ton partenaire ait faite pour toi ?"
        var partnerAnswered = false
        var userAnswered = false
        var bothAnswered = false
        var partnerPseudo = "Partenaire"

        if (payloadStr != null) {
            try {
                val json = JSONObject(payloadStr)
                if (json.has("todayQuestion")) {
                    val q = json.getString("todayQuestion")
                    if (q.isNotBlank()) questionText = q
                }
                if (json.has("partnerAnswered")) {
                    partnerAnswered = json.getBoolean("partnerAnswered")
                }
                if (json.has("userAnswered")) {
                    userAnswered = json.getBoolean("userAnswered")
                }
                if (json.has("bothAnswered")) {
                    bothAnswered = json.getBoolean("bothAnswered")
                }
                if (json.has("partnerPseudo")) {
                    val p = json.getString("partnerPseudo")
                    if (p.isNotBlank()) partnerPseudo = p
                }
            } catch (e: Exception) {
                // fallback
            }
        }

        var badgeText = "💬 QUESTION"
        var ctaText = "Touche pour répondre ✨"

        if (bothAnswered || (userAnswered && partnerAnswered)) {
            badgeText = "✨ DÉCOUVERT"
            ctaText = "Vous avez tous les deux répondu 🎉"
        } else if (partnerAnswered && !userAnswered) {
            badgeText = "💌 À TOI DE JOUER"
            ctaText = "$partnerPseudo a répondu ! Touche pour voir ✨"
        } else if (userAnswered && !partnerAnswered) {
            badgeText = "⏳ EN ATTENTE"
            ctaText = "En attente de $partnerPseudo... 💕"
        }

        val themeId = if (payloadStr != null) {
            try {
                val json = JSONObject(payloadStr)
                if (json.has("themeId")) json.getString("themeId") else "widget_default"
            } catch (e: Exception) { "widget_default" }
        } else "widget_default"
        val bgRes = context.resources.getIdentifier("widget_bg_" + themeId, "drawable", context.packageName)

        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_question)
            if (bgRes != 0) {
                views.setInt(R.id.widget_container, "setBackgroundResource", bgRes)
            }
            views.setTextViewText(R.id.widget_question_text, questionText)
            views.setTextViewText(R.id.widget_badge, badgeText)
            views.setTextViewText(R.id.widget_cta, ctaText)

            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                data = android.net.Uri.parse("nousdeuxapp://daylink")
            }
            val pendingIntent = PendingIntent.getActivity(
                context, 101, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_container, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
`;

const STREAK_PROVIDER_KT = `package com.pixelthings.nousdeux

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import org.json.JSONObject

class StreakWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val prefs = context.getSharedPreferences("nousdeux_widgets", Context.MODE_PRIVATE)
        val payloadStr = prefs.getString("widget_payload", null)
        var streakNumber = "🔥 1"
        var streakLabel = "JOUR ENSEMBLE"
        var partnerAnswered = false
        var userAnswered = false
        var bothAnswered = false
        var partnerPseudo = "Partenaire"

        if (payloadStr != null) {
            try {
                val json = JSONObject(payloadStr)
                val streak = if (json.has("streak")) json.getInt("streak") else 1
                streakNumber = "🔥 $streak"
                streakLabel = if (streak > 1) "JOURS ENSEMBLE" else "JOUR ENSEMBLE"
                if (json.has("partnerAnswered")) partnerAnswered = json.getBoolean("partnerAnswered")
                if (json.has("userAnswered")) userAnswered = json.getBoolean("userAnswered")
                if (json.has("bothAnswered")) bothAnswered = json.getBoolean("bothAnswered")
                if (json.has("partnerPseudo")) {
                    val p = json.getString("partnerPseudo")
                    if (p.isNotBlank()) partnerPseudo = p
                }
            } catch (e: Exception) {
                // fallback
            }
        }

        var statusText = "Touche pour voir ➔"
        if (bothAnswered || (userAnswered && partnerAnswered)) {
            statusText = "🎉 Défi du jour relevé !"
        } else if (partnerAnswered && !userAnswered) {
            statusText = "💌 $partnerPseudo a répondu !"
        } else if (userAnswered && !partnerAnswered) {
            statusText = "⏳ En attente de $partnerPseudo"
        }

        val themeId = if (payloadStr != null) {
            try {
                val json = JSONObject(payloadStr)
                if (json.has("themeId")) json.getString("themeId") else "widget_default"
            } catch (e: Exception) { "widget_default" }
        } else "widget_default"
        val bgRes = context.resources.getIdentifier("widget_bg_" + themeId, "drawable", context.packageName)

        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_streak)
            if (bgRes != 0) {
                views.setInt(R.id.widget_container, "setBackgroundResource", bgRes)
            }
            views.setTextViewText(R.id.streak_number, streakNumber)
            views.setTextViewText(R.id.streak_label, streakLabel)
            views.setTextViewText(R.id.streak_status, statusText)

            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                data = android.net.Uri.parse("nousdeuxapp://dashboard")
            }
            val pendingIntent = PendingIntent.getActivity(
                context, 102, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_container, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
`;

const WIDGET_BRIDGE_MODULE_KT = `package com.pixelthings.nousdeux

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class WidgetBridgeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WidgetBridge"

    @ReactMethod
    fun isPinSupported(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val appWidgetManager = AppWidgetManager.getInstance(reactApplicationContext)
                promise.resolve(appWidgetManager.isRequestPinAppWidgetSupported)
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestPinWidget(widgetType: String, promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val appWidgetManager = AppWidgetManager.getInstance(reactApplicationContext)
                if (!appWidgetManager.isRequestPinAppWidgetSupported) {
                    promise.resolve(false)
                    return
                }

                val providerClass = if (widgetType == "streak") {
                    StreakWidgetProvider::class.java
                } else {
                    QuestionWidgetProvider::class.java
                }

                val myProvider = ComponentName(reactApplicationContext, providerClass)
                val success = appWidgetManager.requestPinAppWidget(myProvider, null, null)
                promise.resolve(success)
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.reject("PIN_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun updateWidgetData(jsonPayload: String, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("nousdeux_widgets", Context.MODE_PRIVATE)
            prefs.edit().putString("widget_payload", jsonPayload).apply()

            val appWidgetManager = AppWidgetManager.getInstance(reactApplicationContext)

            val questionIds = appWidgetManager.getAppWidgetIds(ComponentName(reactApplicationContext, QuestionWidgetProvider::class.java))
            if (questionIds.isNotEmpty()) {
                QuestionWidgetProvider().onUpdate(reactApplicationContext, appWidgetManager, questionIds)
                val intent = Intent(reactApplicationContext, QuestionWidgetProvider::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, questionIds)
                }
                reactApplicationContext.sendBroadcast(intent)
            }

            val streakIds = appWidgetManager.getAppWidgetIds(ComponentName(reactApplicationContext, StreakWidgetProvider::class.java))
            if (streakIds.isNotEmpty()) {
                StreakWidgetProvider().onUpdate(reactApplicationContext, appWidgetManager, streakIds)
                val intent = Intent(reactApplicationContext, StreakWidgetProvider::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, streakIds)
                }
                reactApplicationContext.sendBroadcast(intent)
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UPDATE_ERROR", e.message, e)
        }
    }
}
`;

const WIDGET_BRIDGE_PACKAGE_KT = `package com.pixelthings.nousdeux

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager

class WidgetBridgePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(WidgetBridgeModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<View, ReactShadowNode<*>>> {
        return emptyList()
    }
}
`;

const QUESTION_WIDGET_INFO_BASE_XML = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="110dp"
    android:minHeight="110dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/widget_question"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen" />
`;

const QUESTION_WIDGET_INFO_V31_XML = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="110dp"
    android:minHeight="110dp"
    android:targetCellWidth="2"
    android:targetCellHeight="2"
    android:maxResizeWidth="360dp"
    android:maxResizeHeight="360dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/widget_question"
    android:previewLayout="@layout/widget_question"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:description="@string/widget_question_desc" />
`;

const STREAK_WIDGET_INFO_BASE_XML = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="110dp"
    android:minHeight="110dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/widget_streak"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen" />
`;

const STREAK_WIDGET_INFO_V31_XML = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="110dp"
    android:minHeight="110dp"
    android:targetCellWidth="2"
    android:targetCellHeight="2"
    android:maxResizeWidth="360dp"
    android:maxResizeHeight="360dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/widget_streak"
    android:previewLayout="@layout/widget_streak"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:description="@string/widget_streak_desc" />
`;

const WIDGET_BACKGROUND_XML = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <gradient
        android:angle="315"
        android:startColor="#FF9A8B"
        android:endColor="#FF6A88"
        android:type="linear" />
    <corners android:radius="22dp" />
</shape>
`;

const WIDGET_CARD_BG_XML = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#33FFFFFF" />
    <corners android:radius="14dp" />
</shape>
`;

const WIDGET_QUESTION_LAYOUT_XML = `<?xml version="1.0" encoding="utf-8"?>
<RelativeLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_container"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/widget_background"
    android:padding="14dp">

    <LinearLayout
        android:id="@+id/header_layout"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="center_vertical">

        <TextView
            android:id="@+id/widget_app_title"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:text="NousDeux"
            android:textColor="#FFFFFF"
            android:textSize="12sp"
            android:textStyle="bold" />

        <TextView
            android:id="@+id/widget_badge"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="💬 QUESTION"
            android:textColor="#FFE5E0"
            android:textSize="10sp"
            android:textStyle="bold" />
    </LinearLayout>

    <LinearLayout
        android:id="@+id/content_box"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:layout_below="@id/header_layout"
        android:layout_marginTop="8dp"
        android:background="@drawable/widget_card_bg"
        android:padding="12dp"
        android:gravity="center"
        android:orientation="vertical">

        <TextView
            android:id="@+id/widget_question_text"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="Quelle est la plus belle chose que ton partenaire ait faite pour toi ?"
            android:textColor="#FFFFFF"
            android:textSize="13sp"
            android:textStyle="bold"
            android:gravity="center"
            android:maxLines="4"
            android:ellipsize="end" />

        <TextView
            android:id="@+id/widget_cta"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="6dp"
            android:text="Touche pour répondre ✨"
            android:textColor="#FFE5E0"
            android:textSize="10sp"
            android:textStyle="italic" />
    </LinearLayout>
</RelativeLayout>
`;

const WIDGET_STREAK_LAYOUT_XML = `<?xml version="1.0" encoding="utf-8"?>
<RelativeLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_container"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/widget_background"
    android:padding="14dp">

    <LinearLayout
        android:id="@+id/streak_header"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="center_vertical">

        <TextView
            android:id="@+id/streak_app_title"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:text="NousDeux"
            android:textColor="#FFFFFF"
            android:textSize="12sp"
            android:textStyle="bold" />

        <TextView
            android:id="@+id/streak_badge"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="🔥 DUO"
            android:textColor="#FFE5E0"
            android:textSize="10sp"
            android:textStyle="bold" />
    </LinearLayout>

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:layout_below="@id/streak_header"
        android:layout_marginTop="8dp"
        android:gravity="center"
        android:orientation="vertical">

        <TextView
            android:id="@+id/streak_number"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="🔥 1"
            android:textColor="#FFFFFF"
            android:textSize="32sp"
            android:textStyle="bold" />

        <TextView
            android:id="@+id/streak_label"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="JOURS ENSEMBLE"
            android:textColor="#FFE5E0"
            android:textSize="11sp"
            android:textStyle="bold"
            android:letterSpacing="0.05" />

        <TextView
            android:id="@+id/streak_status"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="6dp"
            android:background="@drawable/widget_card_bg"
            android:paddingLeft="10dp"
            android:paddingRight="10dp"
            android:paddingTop="4dp"
            android:paddingBottom="4dp"
            android:text="Touche pour voir ➔"
            android:textColor="#FFFFFF"
            android:textSize="10sp" />
    </LinearLayout>
</RelativeLayout>
`;

/**
 * Plugin Expo pour injecter les widgets natifs Android (Question du jour & Flamme).
 */
const withAndroidWidgets = (config) => {
  // 1. Injecter les chaînes de description et titres dans strings.xml via withStringsXml
  config = withStringsXml(config, (config) => {
    config.modResults = AndroidConfig.Strings.setStringItem(
      [
        { $: { name: 'widget_question_title' }, _: 'NousDeux - Question du Jour' },
        { $: { name: 'widget_question_desc' }, _: "Affiche la question du jour de votre couple sur votre écran d'accueil" },
        { $: { name: 'widget_streak_title' }, _: 'NousDeux - Flamme & Série' },
        { $: { name: 'widget_streak_desc' }, _: 'Affiche votre série de jours ensemble et votre flamme' },
      ],
      config.modResults
    );
    return config;
  });

  // 2. Déclarer les récepteurs dans AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    if (!config.modResults.manifest.$) {
      config.modResults.manifest.$ = {};
    }
    // internalOnly est essentiel pour que l'OS publie les AppWidgetProviders lors du sideload
    config.modResults.manifest.$['android:installLocation'] = 'internalOnly';

    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);

    if (!mainApplication.receiver) {
      mainApplication.receiver = [];
    }

    const receivers = mainApplication.receiver;

    // Nettoyer les anciens attributs invalides et normaliser
    receivers.forEach((r) => {
      if (r.$ && (r.$['android:name'] === '.QuestionWidgetProvider' || r.$['android:name'] === 'com.pixelthings.nousdeux.QuestionWidgetProvider')) {
        delete r.$['android:description'];
        r.$['android:name'] = '.QuestionWidgetProvider';
        r.$['android:icon'] = '@mipmap/ic_launcher';
        r.$['android:label'] = '@string/widget_question_title';
        r.$['android:exported'] = 'true';
      }
      if (r.$ && (r.$['android:name'] === '.StreakWidgetProvider' || r.$['android:name'] === 'com.pixelthings.nousdeux.StreakWidgetProvider')) {
        delete r.$['android:description'];
        r.$['android:name'] = '.StreakWidgetProvider';
        r.$['android:icon'] = '@mipmap/ic_launcher';
        r.$['android:label'] = '@string/widget_streak_title';
        r.$['android:exported'] = 'true';
      }
    });

    const questionReceiverExists = receivers.some(
      (r) => r.$ && (r.$['android:name'] === '.QuestionWidgetProvider' || r.$['android:name'] === 'com.pixelthings.nousdeux.QuestionWidgetProvider')
    );
    if (!questionReceiverExists) {
      receivers.push({
        $: {
          'android:name': '.QuestionWidgetProvider',
          'android:label': '@string/widget_question_title',
          'android:icon': '@mipmap/ic_launcher',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.appwidget.action.APPWIDGET_UPDATE',
                },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': '@xml/question_widget_info',
            },
          },
        ],
      });
    }

    const streakReceiverExists = receivers.some(
      (r) => r.$ && (r.$['android:name'] === '.StreakWidgetProvider' || r.$['android:name'] === 'com.pixelthings.nousdeux.StreakWidgetProvider')
    );
    if (!streakReceiverExists) {
      receivers.push({
        $: {
          'android:name': '.StreakWidgetProvider',
          'android:label': '@string/widget_streak_title',
          'android:icon': '@mipmap/ic_launcher',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.appwidget.action.APPWIDGET_UPDATE',
                },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': '@xml/streak_widget_info',
            },
          },
        ],
      });
    }

    return config;
  });

  // 3. Écrire les fichiers natifs Kotlin, XML et Layouts
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const androidRoot = config.modRequest.platformProjectRoot;

      // Dossiers cibles
      const javaDir = path.join(androidRoot, 'app', 'src', 'main', 'java', 'com', 'pixelthings', 'nousdeux');
      const resDir = path.join(androidRoot, 'app', 'src', 'main', 'res');
      const xmlDir = path.join(resDir, 'xml');
      const xmlV31Dir = path.join(resDir, 'xml-v31');
      const layoutDir = path.join(resDir, 'layout');
      const drawableDir = path.join(resDir, 'drawable');
      const valuesDir = path.join(resDir, 'values');

      [javaDir, xmlDir, xmlV31Dir, layoutDir, drawableDir, valuesDir].forEach((dir) => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });

      // Providers Kotlin & Bridge Module
      fs.writeFileSync(path.join(javaDir, 'QuestionWidgetProvider.kt'), QUESTION_PROVIDER_KT, 'utf8');
      fs.writeFileSync(path.join(javaDir, 'StreakWidgetProvider.kt'), STREAK_PROVIDER_KT, 'utf8');
      fs.writeFileSync(path.join(javaDir, 'WidgetBridgeModule.kt'), WIDGET_BRIDGE_MODULE_KT, 'utf8');
      fs.writeFileSync(path.join(javaDir, 'WidgetBridgePackage.kt'), WIDGET_BRIDGE_PACKAGE_KT, 'utf8');

      // Patch MainApplication.kt pour enregistrer WidgetBridgePackage
      const mainAppPath = path.join(javaDir, 'MainApplication.kt');
      if (fs.existsSync(mainAppPath)) {
        let mainAppContent = fs.readFileSync(mainAppPath, 'utf8');
        if (!mainAppContent.includes('WidgetBridgePackage')) {
          if (mainAppContent.includes('PackageList(this).packages.apply')) {
            mainAppContent = mainAppContent.replace(
              /PackageList\(this\)\.packages\.apply\s*\{/,
              'PackageList(this).packages.apply {\n          add(WidgetBridgePackage())'
            );
          } else if (/PackageList\(this\)\.packages/.test(mainAppContent)) {
            mainAppContent = mainAppContent.replace(
              /PackageList\(this\)\.packages/,
              'PackageList(this).packages.apply {\n          add(WidgetBridgePackage())\n        }'
            );
          }
          fs.writeFileSync(mainAppPath, mainAppContent, 'utf8');
        }
      }

      // Widget XML Metadata (Base pour API <= 30 et V31 pour API >= 31)
      fs.writeFileSync(path.join(xmlDir, 'question_widget_info.xml'), QUESTION_WIDGET_INFO_BASE_XML, 'utf8');
      fs.writeFileSync(path.join(xmlDir, 'streak_widget_info.xml'), STREAK_WIDGET_INFO_BASE_XML, 'utf8');
      fs.writeFileSync(path.join(xmlV31Dir, 'question_widget_info.xml'), QUESTION_WIDGET_INFO_V31_XML, 'utf8');
      fs.writeFileSync(path.join(xmlV31Dir, 'streak_widget_info.xml'), STREAK_WIDGET_INFO_V31_XML, 'utf8');

      // Drawables
      fs.writeFileSync(path.join(drawableDir, 'widget_background.xml'), WIDGET_BACKGROUND_XML, 'utf8');
      fs.writeFileSync(path.join(drawableDir, 'widget_card_bg.xml'), WIDGET_CARD_BG_XML, 'utf8');

      const themeGradients = {
        widget_bg_widget_default: ['#FF9A8B', '#FF6A88'],
        widget_bg_widget_streak_7: ['#FF416C', '#FF4B2B'],
        widget_bg_widget_streak_14: ['#0f2027', '#203a43'],
        widget_bg_widget_streak_30: ['#11998e', '#38ef7d'],
        widget_bg_widget_shop_1: ['#8A2387', '#E94057'],
        widget_bg_widget_shop_2: ['#43e97b', '#38f9d7'],
        widget_bg_widget_shop_3: ['#fa709a', '#fee140'],
        widget_bg_widget_shop_4: ['#232526', '#414345'],
        widget_bg_widget_shop_5: ['#654ea3', '#eaafc8'],
      };
      for (const [bgName, colors] of Object.entries(themeGradients)) {
        const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <gradient
        android:angle="315"
        android:startColor="${colors[0]}"
        android:endColor="${colors[1]}"
        android:type="linear" />
    <corners android:radius="22dp" />
</shape>
`;
        fs.writeFileSync(path.join(drawableDir, `${bgName}.xml`), bgXml, 'utf8');
      }

      // Layouts
      fs.writeFileSync(path.join(layoutDir, 'widget_question.xml'), WIDGET_QUESTION_LAYOUT_XML, 'utf8');
      fs.writeFileSync(path.join(layoutDir, 'widget_streak.xml'), WIDGET_STREAK_LAYOUT_XML, 'utf8');

      // Fallback direct pour strings.xml
      const stringsPath = path.join(valuesDir, 'strings.xml');
      if (fs.existsSync(stringsPath)) {
        let stringsXml = fs.readFileSync(stringsPath, 'utf8');
        if (!stringsXml.includes('widget_question_desc')) {
          const insertIdx = stringsXml.lastIndexOf('</resources>');
          if (insertIdx !== -1) {
            const extraStrings = `
    <string name="widget_question_title">NousDeux - Question du Jour</string>
    <string name="widget_question_desc">Affiche la question du jour de votre couple sur votre écran d'accueil</string>
    <string name="widget_streak_title">NousDeux - Flamme &amp; Série</string>
    <string name="widget_streak_desc">Affiche votre série de jours ensemble et votre flamme</string>
`;
            stringsXml = stringsXml.slice(0, insertIdx) + extraStrings + stringsXml.slice(insertIdx);
            fs.writeFileSync(stringsPath, stringsXml, 'utf8');
          }
        }

        // Dédoublonnage défensif de app_name pour garantir l'absence d'erreur Gradle mergeReleaseResources
        const appNameMatches = stringsXml.match(/<string name="app_name">.*?<\/string>/g);
        if (appNameMatches && appNameMatches.length > 1) {
          let keptFirst = false;
          stringsXml = stringsXml.replace(/<string name="app_name">.*?<\/string>[\r\n]*/g, () => {
            if (!keptFirst) {
              keptFirst = true;
              return '<string name="app_name">NousDeux</string>\n';
            }
            return '';
          });
          fs.writeFileSync(stringsPath, stringsXml, 'utf8');
        }
      }

      return config;
    },
  ]);

  return config;
};

module.exports = withAndroidWidgets;
