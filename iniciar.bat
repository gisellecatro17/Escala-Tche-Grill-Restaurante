@echo off
title Tche Grill - Sistema de Ponto
echo.
echo  ====================================
echo   TCHE GRILL - Sistema de Ponto
echo  ====================================
echo.

:: Verifica Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo  ERRO: Node.js nao encontrado!
  echo  Baixe em: https://nodejs.org
  echo.
  pause
  exit /b 1
)

:: Verifica ngrok
where ngrok >nul 2>&1
if %errorlevel% neq 0 (
  :: Tenta na propria pasta
  if not exist "%~dp0ngrok.exe" (
    echo  =====================================================
    echo   NGROK NAO ENCONTRADO - rodando so na rede local
    echo  =====================================================
    echo.
    echo  Para ativar acesso externo (qualquer rede / 4G):
    echo.
    echo  1. Acesse: https://ngrok.com/signup
    echo  2. Crie uma conta gratuita
    echo  3. No painel do ngrok, copie seu "Authtoken"
    echo  4. Baixe o ngrok.exe em: https://ngrok.com/download
    echo  5. Coloque ngrok.exe nesta pasta:
    echo     %~dp0
    echo  6. Execute UMA VEZ:
    echo     ngrok config add-authtoken SEU_TOKEN_AQUI
    echo  7. Feche e abra o iniciar.bat novamente
    echo.
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "169.254"') do (
      set LOCAL_IP=%%a
      goto :show_local
    )
    :show_local
    set LOCAL_IP=%LOCAL_IP: =%
    echo  Acesso local (mesma rede Wi-Fi):
    echo  http://%LOCAL_IP%:3000/ponto.html
    echo.
    echo  Iniciando servidor...
    node "%~dp0server.js"
    pause
    exit /b 0
  )
  set NGROK_CMD=%~dp0ngrok.exe
) else (
  set NGROK_CMD=ngrok
)

:: Inicia servidor Node.js em janela separada (minimizada)
echo  Iniciando servidor Node.js...
start "Tche Grill - Servidor" /MIN node "%~dp0server.js"
timeout /t 3 /nobreak >nul

echo  Iniciando tunel ngrok...
echo.
echo  =====================================================
echo   ACESSO DE QUALQUER LUGAR (4G, outra rede, etc):
echo   - Aguarde aparecer a linha "Forwarding"
echo   - Copie o link  https://xxxx.ngrok-free.app
echo   - Acesse no tablet pelo Chrome
echo   - A camera funciona automaticamente (HTTPS)
echo  =====================================================
echo.
echo  NAO FECHE esta janela enquanto usar o sistema.
echo.
%NGROK_CMD% http 3000
pause
