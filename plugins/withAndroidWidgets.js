const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const QUESTION_PROVIDER_KT = `package com.pixelthings.nousdeux

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class QuestionWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_question)

            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context, 0, intent,
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

class StreakWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_streak)

            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_container, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
`;

const QUESTION_WIDGET_INFO_XML = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="140dp"
    android:minHeight="110dp"
    android:targetCellWidth="2"
    android:targetCellHeight="2"
    android:maxResizeWidth="360dp"
    android:maxResizeHeight="360dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/widget_question"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:description="@string/widget_question_desc" />
`;

const STREAK_WIDGET_INFO_XML = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="140dp"
    android:minHeight="110dp"
    android:targetCellWidth="2"
    android:targetCellHeight="2"
    android:maxResizeWidth="360dp"
    android:maxResizeHeight="360dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/widget_streak"
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
            android:paddingHorizontal="10dp"
            android:paddingVertical="4dp"
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
  // 1. Déclarer les récepteurs dans AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);

    if (!mainApplication.receiver) {
      mainApplication.receiver = [];
    }

    const receivers = mainApplication.receiver;

    const questionReceiverExists = receivers.some(
      (r) => r.$ && r.$['android:name'] === '.QuestionWidgetProvider'
    );
    if (!questionReceiverExists) {
      receivers.push({
        $: {
          'android:name': '.QuestionWidgetProvider',
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
      (r) => r.$ && r.$['android:name'] === '.StreakWidgetProvider'
    );
    if (!streakReceiverExists) {
      receivers.push({
        $: {
          'android:name': '.StreakWidgetProvider',
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

  // 2. Écrire les fichiers natifs Kotlin, XML et Layouts
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const androidRoot = config.modRequest.platformProjectRoot;

      // Dossiers cibles
      const javaDir = path.join(androidRoot, 'app', 'src', 'main', 'java', 'com', 'pixelthings', 'nousdeux');
      const resDir = path.join(androidRoot, 'app', 'src', 'main', 'res');
      const xmlDir = path.join(resDir, 'xml');
      const layoutDir = path.join(resDir, 'layout');
      const drawableDir = path.join(resDir, 'drawable');
      const valuesDir = path.join(resDir, 'values');

      [javaDir, xmlDir, layoutDir, drawableDir, valuesDir].forEach((dir) => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });

      // Providers Kotlin
      fs.writeFileSync(path.join(javaDir, 'QuestionWidgetProvider.kt'), QUESTION_PROVIDER_KT, 'utf8');
      fs.writeFileSync(path.join(javaDir, 'StreakWidgetProvider.kt'), STREAK_PROVIDER_KT, 'utf8');

      // Widget XML Metadata
      fs.writeFileSync(path.join(xmlDir, 'question_widget_info.xml'), QUESTION_WIDGET_INFO_XML, 'utf8');
      fs.writeFileSync(path.join(xmlDir, 'streak_widget_info.xml'), STREAK_WIDGET_INFO_XML, 'utf8');

      // Drawables
      fs.writeFileSync(path.join(drawableDir, 'widget_background.xml'), WIDGET_BACKGROUND_XML, 'utf8');
      fs.writeFileSync(path.join(drawableDir, 'widget_card_bg.xml'), WIDGET_CARD_BG_XML, 'utf8');

      // Layouts
      fs.writeFileSync(path.join(layoutDir, 'widget_question.xml'), WIDGET_QUESTION_LAYOUT_XML, 'utf8');
      fs.writeFileSync(path.join(layoutDir, 'widget_streak.xml'), WIDGET_STREAK_LAYOUT_XML, 'utf8');

      // Strings
      const stringsPath = path.join(valuesDir, 'strings.xml');
      if (fs.existsSync(stringsPath)) {
        let stringsXml = fs.readFileSync(stringsPath, 'utf8');
        if (!stringsXml.includes('widget_question_desc')) {
          const insertIdx = stringsXml.lastIndexOf('</resources>');
          if (insertIdx !== -1) {
            const extraStrings = `
    <string name="widget_question_title">Question du Jour</string>
    <string name="widget_question_desc">Affiche la question du jour de votre couple sur votre écran d'accueil</string>
    <string name="widget_streak_title">Flamme &amp; Série</string>
    <string name="widget_streak_desc">Affiche votre série de jours ensemble et votre flamme</string>
`;
            stringsXml = stringsXml.slice(0, insertIdx) + extraStrings + stringsXml.slice(insertIdx);
            fs.writeFileSync(stringsPath, stringsXml, 'utf8');
          }
        }
      }

      return config;
    },
  ]);

  return config;
};

module.exports = withAndroidWidgets;
