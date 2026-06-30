# Camp Store POS

Local-first point of sale web app for the Iowa-Missouri Conference camp store. The clerk workflow is optimized for fast camper lookup, cart entry, balance preview, checkout, local transaction logging, and queued Google Sheets sync.

## Features

- Login-first access pattern with signed HTTP-only session cookies.
- Local SQLite users with hashed passwords and roles: `OWNER`, `ADMIN`, and `CLERK`.
- Clerk POS screen with searchable campers, searchable items, category browsing, touch-friendly cart, quantity controls, current balance, and new balance preview.
- CafeScanner-style layout: light gray background, centered cards, compact top nav, and blue primary actions.
- Admin/backend control screen for dashboard stats, Google Sheets configuration, status, settings, imports, sync, diagnostics, recent transactions, and user management.
- SQLite live operational database with WAL enabled.
- Google Sheets import/sync:
  - `Items` tab: column A `Cost`, column B `Item Name`, column C `Category`.
  - `Campers / Balances` tab: column A `Child Name`, column B `Initial Balance`, column C `Current Balance`.
  - `Logs` tab receives transaction append rows with timestamp, clerk, child, balances, total, purchased items, transaction ID, and status.
- Offline queue: sales update local balances immediately and remain pending until sync succeeds.
- Duplicate-resistant sync through generated transaction IDs.
- Backup/restore scripts and environment validation.

## Quick start

```bash
cp .env.example .env
npm install
npm run setup
npm start
```

Open `http://localhost:3077`. Unauthenticated users are sent to the login screen. After login, clerks go to the Clerk POS page and owners/admins can use `http://localhost:3077/admin.html`.

## Default owner setup

Set these environment variables before running `npm run setup` or starting the app for the first time:

```bash
DEFAULT_OWNER_USERNAME=admin
DEFAULT_OWNER_PASSWORD=change-me-now
DEFAULT_OWNER_DISPLAY_NAME=Administrator
SESSION_SECRET=change-me-to-a-long-random-secret
```

`npm run setup` initializes the SQLite database, applies migrations, creates the `users` table when needed, and seeds the default `OWNER` user from these values only when no users exist yet. Passwords are stored as salted `scrypt` hashes in SQLite, never as plain text. The setup output prints the seeded username, but never prints the password.

For first login, open `http://localhost:3077` after setup and sign in with `DEFAULT_OWNER_USERNAME` and `DEFAULT_OWNER_PASSWORD`. No manual SQL is required. After the first login, immediately change the default password or create named owner/admin/clerk users and stop using the bootstrap password.

## Roles and access

- `OWNER`: full access to Clerk POS, admin/backend controls, settings, import/sync, diagnostics, transactions, and user management.
- `ADMIN`: access to Clerk POS and admin/backend controls, including settings, import/sync, diagnostics, and transactions.
- `CLERK`: access only to the Clerk POS sale workflow.

All POS data API endpoints require a valid login. Admin APIs additionally require `OWNER` or `ADMIN`; user-management APIs require `OWNER`.

## Creating and changing users

### In the app

1. Sign in as an `OWNER`.
2. Open **Dashboard → User Management**.
3. Enter username, display name, role, and a temporary password.
4. Select **Create user**.

### From the command line

Run these commands from the application directory on the server. They use the configured `.env` database path and application password hashing, so no manual SQL is required.

```bash
npm run users:list
npm run users:create -- username password "Display Name" CLERK
npm run users:create -- admin1 temporary-password "Store Admin" ADMIN
npm run users:password -- username newPassword
```

Roles are `OWNER`, `ADMIN`, and `CLERK`; `users:create` defaults to `CLERK` when the role is omitted. Keep `SESSION_SECRET` stable across restarts so existing sessions remain valid; change it when you intentionally want to invalidate all sessions.

## Google Sheets setup from the Admin UI

Google Sheets can be configured after first setup without editing `.env`. Existing `.env` values are still used as fallback defaults until settings are saved in SQLite.

1. Sign in as an `OWNER` or `ADMIN`. `CLERK` users cannot open the admin configuration screen or call the settings/import/sync APIs.
2. Open **Admin → Configuration**.
3. Paste the full **Google Sheet URL** from your browser address bar. A raw spreadsheet ID is also accepted for advanced users; the app extracts and stores the spreadsheet ID automatically.
4. Confirm or edit the tab names:
   - **Items tab name** defaults to `Items`.
   - **Campers/Balances tab name** defaults to `Campers / Balances`.
   - **Logs tab name** defaults to `Logs`.
5. Paste or upload the full service account JSON key. The app auto-fills the service account email and private key from `client_email` and `private_key`. Advanced manual service account email/private key fields remain available if needed.
6. Click **Save Google Settings**. The sheet URL, extracted spreadsheet ID, tab names, service account email, and private key are stored locally in SQLite. The private key is not displayed back in full; the UI only shows configured/masked status.
7. Click **Test Google Connection**. The test verifies that the spreadsheet opens, the configured Items, Campers/Balances, and Logs tabs exist, and the service account has edit access.

### Required Google Sheet tabs and columns

Create these tabs, or configure matching custom tab names in **Admin → Configuration**:

- `Items` (default Items tab)
  - Column A: `Cost`
  - Column B: `Item Name`
  - Column C: `Category`
- `Campers / Balances` (default Campers/Balances tab)
  - Column A: `Child Name`
  - Column B: `Initial Balance`
  - Column C: `Current Balance`
- `Logs` (default Logs tab)
  - Transaction logs are appended here during sync.

Rows begin on row 2. Blank rows are skipped. Item rows with missing item names or invalid costs are skipped with detailed Admin UI warnings; item rows with missing categories import as `Uncategorized` with warnings. Invalid tab names and duplicate camper names are reported as detailed errors in the Admin UI.

### Service account sharing instructions

1. In Google Cloud, create a service account and enable the Google Sheets API for the project.
2. Create/download a JSON key for the service account.
3. Open the Google Sheet, click **Share**, and share it with the service account `client_email` as **Editor**. Editor access is required so pending transactions can append to Logs and update camper balances.
4. Paste or upload the full JSON into **Admin → Configuration**. The app will auto-fill the service account email and private key.

### Import/sync workflow

Use **Admin → Configuration** or the dashboard import/sync card:

- **Test Connection** validates credentials, configured tabs, and edit access.
- **Import Items from configured Items tab** imports the configured Items tab range `A2:C` and reports imported item counts by category when the import completes.
- **Import Campers from configured Campers/Balances tab** imports the configured Campers/Balances tab range `A2:C`.
- **Import Everything** imports items and campers/balances.
- **Push Pending Transactions to Logs and balances** appends unsynced local sales to the configured Logs tab and updates camper current balances in the configured Campers/Balances tab.

The dashboard shows Google Sheets status, last import time, last sync time, pending sync count, total items, and item counts by category.

## Deployment/update approach

This app is a single Node/Express service serving static frontend files and API endpoints. A typical internal deployment can run it with systemd, PM2, Docker, or another existing IMSDA host process manager.

Recommended CafeScanner-style update flow:

```bash
git pull
npm install --omit=dev
npm run setup
sudo systemctl restart campstore-pos
```

The same flow is available as a script:

```bash
SERVICE_NAME=campstore-pos ./scripts/update-app.sh
# or, for non-systemd hosts:
RESTART_CMD="pm2 restart campstore-pos" ./scripts/update-app.sh
```

Deployment notes:

- Set `DEFAULT_OWNER_USERNAME`, `DEFAULT_OWNER_PASSWORD`, and `DEFAULT_OWNER_DISPLAY_NAME` before the first run.
- Set a strong `SESSION_SECRET` in production.
- Set `COOKIE_SECURE=true` when serving only over HTTPS.
- Keep the SQLite database and `backups/` directory on persistent storage.
- Set `APP_VERSION` in the environment during deployment if you want a release name; otherwise the app reports the current git commit when available.

## Backup and restore

```bash
npm run backup
npm run restore -- backups/campstore-YYYY-MM-DD.sqlite
```

Back up before imports, before updates, and at the end of store days.

## Offline operation

- Complete sales normally while offline.
- The local SQLite database is the source of truth during store operation.
- Transactions with `sync_status` other than `synced` are pending.
- When internet returns, use Admin → Push pending transactions.

## Sheet validation notes

The importer rejects duplicate child names and camper balance errors. Item import skips blank rows, warns and skips missing item names or invalid costs, and warns when a category is missing. Avoid renaming tabs or moving required columns.

## Troubleshooting

- `Invalid username or password`: verify the user exists and is active in SQLite, or recreate an owner with the default owner environment variables on a fresh database.
- `Authentication required`: sign in again; sessions expire after 12 hours.
- `Google Sheets credentials are not configured`: open Admin → Configuration and save Spreadsheet ID, service account email, and private key; `.env` remains a fallback.
- Pending transactions remain after sync: inspect Admin status events and transaction errors.
- Incorrect camper balance in Sheets: local transactions are authoritative; run Push pending transactions, then verify the camper row in `Campers / Balances`.
- Import caution: importing does not intentionally overwrite local unsynced transaction logs. Perform pending sync before a new operating day import when possible.
