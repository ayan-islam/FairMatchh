@echo off
setlocal
rem Project-local Maven launcher; uses bundled tools without a global install.
set "JAVA_HOME=%~dp0..\tools\jdk-21.0.8+9"
set "MAVEN_HOME=%~dp0..\tools\apache-maven-3.9.11"
if not exist "%JAVA_HOME%\bin\java.exe" (
  echo Java 21 was not found in the project's tools folder.
  exit /b 1
)
if not exist "%MAVEN_HOME%\bin\mvn.cmd" (
  echo Maven was not found in the project's tools folder.
  exit /b 1
)
call "%MAVEN_HOME%\bin\mvn.cmd" -f "%~dp0pom.xml" %*
exit /b %ERRORLEVEL%
