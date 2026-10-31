@echo off
setlocal
if not defined BOSES_RAG_ROOT set "BOSES_RAG_ROOT=%USERPROFILE%\Downloads\BOSES BANTAY\boses-bantay-mobile\services\chatbot\rag-bot"
"%BOSES_RAG_ROOT%\.venv\Scripts\python.exe" "%~dp0server.py" --rag-root "%BOSES_RAG_ROOT%"
pause
