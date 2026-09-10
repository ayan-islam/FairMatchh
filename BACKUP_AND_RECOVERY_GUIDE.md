# FairMatch backup, stop and recovery

The launcher runs background services. Closing the browser or VS Code does not stop them. These scripts manage this laptop installation and preserve its saved data.

## Everyday use

- Double-click `START_FAIRMATCH.cmd` to start the five services and open the app.
- Double-click `STOP_FAIRMATCH.cmd` to stop those services. MongoDB checkpoints its files before exiting. No saved records are deleted.
- While FairMatch is running, double-click `BACKUP_FAIRMATCH.cmd`. Finish any in-progress form submission or upload first. Keep the backup window open until it finishes.

Backup briefly stops the app, checkpoints MongoDB, stops object storage, archives the entire `data` directory, checks every archived file, then restarts FairMatch. A maintenance lock prevents the normal start/rebuild/stop scripts from racing with it. Unknown port owners or an additional test API stop the operation before any services are closed. Use the project launchers during maintenance; manually starting Maven bypasses this lock.

Backups are saved outside the project under `C:\Users\HP\Desktop\FairMatchBackups`. `logs/last-backup.json` gives the most recent verified ZIP path. A `.partial` file is not a completed backup. Failed backups attempt to restart the app and never remove the live data folder.

The ZIP includes MongoDB records and indexes, original MinIO PDFs (including hidden MinIO metadata), JWT/service keys and any local integration configuration stored under `data`. This MongoDB instance also contains isolated test databases, which are included because this is a whole-store checkpoint. It does not back up source code, installed runtimes, node_modules or OCR models. Keep the project folder and the recommended-stack PDF separately as well.

**Keep backup ZIPs private.** They are not encrypted and contain personal records, password hashes and keys. SHA-256 checks detect accidental corruption; they are not a signature proving who made an archive. For protection from disk failure, copy a verified ZIP to a private external drive. Do not submit the ZIP to your teacher as source code.

## Verify or restore without replacing the current app

From PowerShell in `C:\Users\HP\Desktop\fairmatch`:

```powershell
.\document-worker\.venv\Scripts\python.exe operations/backup_store.py verify "C:\path\FairMatch-backup.zip"
.\RESTORE_FAIRMATCH.ps1 -BackupPath "C:\path\FairMatch-backup.zip" -Destination "C:\Users\HP\Desktop\FairMatchRecovery"
```

Alternatively double-click `RESTORE_FAIRMATCH.cmd` and enter the two full paths when prompted. The destination must be a new folder with an existing parent. Restore verifies the entire archive before writing output, rejects unsafe paths/links/duplicate entries and never overwrites an existing folder. It also checks the extracted bytes. Insufficient space or any failure leaves the running installation unchanged; a failed recovery directory must not be activated.

To rehearse the recovery, use a freshly extracted folder:

```powershell
.\document-worker\.venv\Scripts\python.exe operations/rehearse_restore.py "C:\Users\HP\Desktop\FairMatchRecovery"
```

The rehearsal starts only the copied MongoDB/MinIO stores on loopback ports 27019, 9010 and 9011. It checks all archived database collection counts/content hashes, reads indexes and downloads each actual uploaded PDF. Privacy test fixtures intentionally have metadata without uploads; these are counted separately. The rehearsal never starts the API, emails or payment processing. It stops its own temporary services afterward. Opening copied stores changes their physical files, so repeat a rehearsal with a new extraction. Results appear in `logs/backup-restore-result.json`.

## Activate a recovery only when you need it

Recovery returns the app to the backup's date. Later changes will be absent from the restored copy. Activation is intentionally separate from extraction so inspecting a backup cannot replace current work.

1. Keep the current installation and take a fresh backup if it is still usable.
2. Restore the chosen ZIP to a new folder and successfully rehearse it. Use the same FairMatch code build and MongoDB 8.0 installation.
3. Run `STOP_FAIRMATCH.cmd`. Proceed only after it reports that FairMatch stopped successfully. Close any separate manually started test APIs.
4. In File Explorer, rename the current project's `data` folder to a unique name such as `data-before-recovery-20260910`. Keep it intact for rollback.
5. Copy the recovered folder's entire `data` directory into the project as `data`. Do not merge it into another directory. Database files, object storage and keys belong together.
6. Start with `START_FAIRMATCH.cmd`. Check sign-in, your jobs, applications, stages and a PDF download. Recheck account/session security after restoring an older security state.
7. If the checks fail, stop FairMatch again and restore the preserved original `data` folder. Never swap data while services are running.

The extraction and rehearsal are automated and tested. Replacing the active installation is a deliberate manual recovery operation; it has not been performed on your current data.

## Explain the code to your teacher

`BACKUP_FAIRMATCH.ps1` checks process ownership, takes an exclusive maintenance lock, stops writers and invokes Python. `backup_store.py prepare` hashes logical database records and asks MongoDB to checkpoint and shut down. `create` streams physical files into a ZIP, adds a manifest and verifies hashes before changing the extension from `.partial` to `.zip`.

`restore` validates allowed paths and hashes before creating a new directory, then verifies the extracted files again. `rehearse_restore.py` uses separate ports to prove the saved stores can actually open and return records/PDFs. A successful ZIP command alone would not prove this. `START_FAIRMATCH.ps1`, `STOP_FAIRMATCH.ps1` and `REBUILD_FAIRMATCH.ps1` respect the same maintenance lock.

Eight archive tests cover round trips with hidden files/keys, corrupt payloads, traversal, existing-folder protection, unlisted files, symlinks and duplicate entries. Run them with:

```powershell
.\document-worker\.venv\Scripts\python.exe -m unittest discover -s operations -p "test_*.py" -v
```

The worker requirements pin PyMongo for these local operations. No external backup provider or scheduled backup is configured.
