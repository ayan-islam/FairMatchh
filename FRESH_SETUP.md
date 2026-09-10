# Setting up a fresh Windows clone

The supplied start files were built for a Windows laptop. They expect the runtime layout below. This is a manual developer setup, not a portable installer.

## 1. Source and dependencies

Clone into a directory named **fairmatch**. Some existing service-recognition scripts use that name. Do not run a second installation beside an existing one on the same service ports.

Install Node.js/npm, Python 3.12 and MongoDB 8.0 from their official distributions. Place Java 21 in `tools/jdk-21.0.8+9`, Maven 3.9.11 in `tools/apache-maven-3.9.11`, and a compatible MinIO executable at `tools/minio.exe`, or adapt the scripts consistently to your installed paths. START_FAIRMATCH.ps1 currently expects MongoDB at `%LOCALAPPDATA%/Programs/MongoDB/Server/8.0/bin/mongod.exe`.

From the root:

```powershell
python -m venv document-worker/.venv
.\document-worker\.venv\Scripts\python.exe -m pip install -r document-worker/requirements.txt
cd frontend
npm.cmd ci
npm.cmd run build
cd ..\backend
.\mvnw.cmd -DskipTests package
cd ..
New-Item -ItemType Directory -Force data, logs
```

The supplied mvnw.cmd is a project-local launcher for the expected Java/Maven folders. It is not the standard Maven Wrapper downloader. No runtime binaries are committed.

For local English/Bangla OCR, follow OCR_SETUP_AND_CODE_GUIDE.md and tools/install_ocr_models.py. Test fixtures are synthetic and are safe to use for extraction tests.

## 2. Initialize a new database once

Create `data/mongo`. Start your MongoDB executable with `--bind_ip 127.0.0.1 --port 27018 --replSet fairmatch-rs --dbpath <absolute path to data/mongo>`. Keep that process running while initializing:

```powershell
.\document-worker\.venv\Scripts\python.exe tools/init_mongo.py
```

Do not reinitialize or delete an existing data directory to resolve a startup problem. The main launcher recognizes the running replica-set process. A new empty replica set must be initialized before the backend's database operations can work.

## 3. Create the administrator privately

Copy integrations.properties.example to data/integrations.properties. For the first startup of a fresh database only, enable `fairmatch.bootstrap.admin-enabled` and fill the administrator username, email, name and initial password. Start the application, sign in as that administrator, then disable bootstrap and remove the initial password from the private configuration. See ACCOUNT_SECURITY_SETUP.md.

Keep `fairmatch.seed=false` and `fairmatch.bootstrap.demo-enabled=false`. Register your own employer and candidate accounts in the UI. An administrator reviews the employer's real supporting evidence before publication. Test passwords in this repository do not log into an existing installation.

## 4. Start and check

```powershell
.\START_FAIRMATCH.cmd
```

The document startup script generates private service credentials when absent. Java generates a persistent signing key. All are saved under ignored data paths. Check http://127.0.0.1:8080/actuator/health and open http://127.0.0.1:3000. The launcher expects backend/target and frontend/.next to have been built.

Email delivery requires your own SMTP sender settings. Payments require additional merchant integration. Neither service is simulated as successfully delivered/paid. Do not commit filled configuration, exported candidate data, uploaded PDFs or backups.

For code changes, use REBUILD_FAIRMATCH.ps1 after the services/dependencies are available. It coordinates stopping only recognized app processes, tests, builds and restart. Review BACKUP_AND_RECOVERY_GUIDE.md before handling saved data.
