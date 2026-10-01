@echo off
setlocal enabledelayedexpansion

:: Toujours se placer dans le dossier du script
cd /d "%~dp0"

echo ========================================================
echo   Compilation locale de NousDeux APK (Standalone)
echo ========================================================

:: 1. Configuration des chemins d'acces
set "NODE_DIR=D:\Backup\App\All\Hack Code\App\node-v24.16.0-win-x64"
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot"
set "ANDROID_HOME=C:\Users\Jules\AppData\Local\Android\Sdk"

set "PATH=%NODE_DIR%;%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

echo [*] Dossier de travail : %CD%

echo [*] Node version :
call node -v
if %ERRORLEVEL% neq 0 (
  echo [ERREUR] Node.js introuvable dans %NODE_DIR%
  pause
  exit /b 1
)

echo [*] Java version :
call java -version
if %ERRORLEVEL% neq 0 (
  echo [ERREUR] Java introuvable dans %JAVA_HOME%
  pause
  exit /b 1
)

if not exist "%ANDROID_HOME%" (
  echo [ERREUR] SDK Android introuvable dans %ANDROID_HOME%
  pause
  exit /b 1
)

:: 2. Verification des dependances npm
if not exist "node_modules\expo" (
  echo.
  echo [*] Installation des dependances npm (npm ci)...
  call npm.cmd ci
  if %ERRORLEVEL% neq 0 (
    echo [ERREUR] Echec lors de npm ci.
    pause
    exit /b 1
  )
)

:: 3. Prebuild Expo Android
echo.
echo [*] Generation du code natif Android (expo prebuild)...
call npx.cmd expo prebuild --platform android --clean --no-install
if %ERRORLEVEL% neq 0 (
  echo [ERREUR] Echec lors de expo prebuild.
  pause
  exit /b 1
)

:: 4. Copie du Keystore officiel
echo.
echo [*] Configuration du Keystore officiel...
if not exist "android\app" mkdir "android\app"
if exist "credentials\debug.keystore" (
  copy /Y "credentials\debug.keystore" "android\app\debug.keystore"
  echo [OK] credentials\debug.keystore copie vers android\app\debug.keystore
) else (
  echo [ATTENTION] credentials\debug.keystore introuvable !
)

:: 5. Configuration de la signature standalone et du reseau IPv4 dans Gradle
echo.
echo [*] Configuration de la signature Release et des options JVM...
node -e "const fs = require('fs'); const file = 'android/app/build.gradle'; if (fs.existsSync(file)) { let content = fs.readFileSync(file, 'utf8'); if (content.includes('signingConfig signingConfigs.release')) { content = content.replace(/signingConfig signingConfigs\.release/g, 'signingConfig signingConfigs.debug'); } else if (!content.match(/release\s*\{[^}]*signingConfig/)) { content = content.replace(/(release\s*\{)/, '$1\n            signingConfig signingConfigs.debug'); } fs.writeFileSync(file, content); console.log('[OK] build.gradle configure pour signer l APK Release.'); } const propFile = 'android/gradle.properties'; if (fs.existsSync(propFile)) { let p = fs.readFileSync(propFile, 'utf8'); if (!p.includes('preferIPv4Stack')) { p += '\norg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -Djava.net.preferIPv4Stack=true\nsystemProp.java.net.preferIPv4Stack=true\n'; fs.writeFileSync(propFile, p); console.log('[OK] gradle.properties configure avec IPv4 stack.'); } }"

:: 6. Compilation Release locale
echo.
echo [*] Compilation de l'APK Release via Gradle (cela peut prendre 2 a 4 minutes)...
set "_JAVA_OPTIONS=-Djava.net.preferIPv4Stack=true"
set "GRADLE_OPTS=-Djava.net.preferIPv4Stack=true"
cd android
call gradlew.bat assembleRelease --no-daemon --parallel --build-cache

if %ERRORLEVEL% neq 0 (
  echo.
  echo [ERREUR] La compilation Gradle a echoue.
  cd ..
  pause
  exit /b 1
)
cd ..

echo.
echo ========================================================
echo   BRAVO ! Votre APK a ete genere avec succes !
echo ========================================================
echo.
if exist "android\app\build\outputs\apk\release\app-release.apk" (
  echo Fichier APK pret :
  echo %CD%\android\app\build\outputs\apk\release\app-release.apk
  echo.
  echo Verification des empreintes du certificat de l'APK :
  call "%JAVA_HOME%\bin\keytool.exe" -printcert -jarfile "android\app\build\outputs\apk\release\app-release.apk" | findstr /i "SHA1: SHA256:"
) else (
  dir /s /b android\app\build\outputs\apk\release\*.apk
)
echo.
echo ========================================================
echo.
pause
