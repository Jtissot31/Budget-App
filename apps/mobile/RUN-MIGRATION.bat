@echo off
cd /d "%~dp0"
echo Moving form modules out of app/ ...
node scripts\move-forms.mjs
if errorlevel 1 (
  echo FAILED - see errors above
  exit /b 1
)
echo.
echo Running TypeScript check...
call npx tsc --noEmit
echo.
echo Done. Start Expo with: npx expo start --clear
pause
