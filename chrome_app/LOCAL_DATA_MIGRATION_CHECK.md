# Dragon House Local Data Migration Check

Before any future migration from local Family Hub storage to PostgreSQL:

1. Open `Family Hub`.
2. Go to `Сім’я → Керування → Резервне копіювання та відновлення`.
3. Click `Експортувати повну резервну копію`.
4. Keep the exported `dragon-house-family-hub-backup-YYYY-MM-DD-HH-mm.json` file outside the extension.
5. Run backend dry-run only:
   ```powershell
   npm run data:migrate:dry-run -- --file "C:\path\dragon-house-family-hub-backup.json"
   ```

The extension must not automatically migrate localStorage or IndexedDB on startup.
Do not delete localStorage or IndexedDB during dry-run.
