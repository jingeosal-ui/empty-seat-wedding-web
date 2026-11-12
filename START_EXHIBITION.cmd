@echo off
setlocal
chcp 65001 >nul
pushd "%~dp0" || exit /b 1
set "EXHIBITION_NODE=%~dp0runtime\node-win-x64\node.exe"
if not exist "%EXHIBITION_NODE%" goto missing_runtime
if not exist "%~dp0public\models\pose_landmarker_lite.task" goto missing_assets
if not exist "%~dp0public\models\face_landmarker.task" goto missing_assets
if not exist "%~dp0public\vendor\wasm\vision_wasm_internal.wasm" goto missing_assets
if /i "%~1"=="--no-browser" (
 "%EXHIBITION_NODE%" "%~dp0server.mjs"
) else (
 "%EXHIBITION_NODE%" "%~dp0server.mjs" --open
)
set "EXHIBITION_EXIT=%ERRORLEVEL%"
popd
if not "%EXHIBITION_EXIT%"=="0" pause
exit /b %EXHIBITION_EXIT%
:missing_runtime
echo 포함된 실행 파일이 없습니다. ZIP을 완전히 풀고 폴더 전체를 복사하세요.
echo 필요한 파일: runtime\node-win-x64\node.exe
goto failed
:missing_assets
echo 전시 리소스가 빠졌습니다. 실행 파일만 옮기지 말고 폴더 전체를 복사하세요.
:failed
popd
pause
exit /b 1
