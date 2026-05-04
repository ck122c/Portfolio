# Deployment Ready Setup

Portfolio ab Render + GitHub deployment ke liye ready hai. Backend Express app `Frontend/` ko static serve karta hai, isliye Render par single web service se frontend + backend dono chalenge.

## Local Run

```bash
cd "/Users/chandankumar/ Scorce Code/Portfolio"
npm start
```

Local URL:

```text
http://localhost:5001
```

Admin login:

```text
http://localhost:5001/admin/login.html
```

## GitHub Upload

```bash
git init
git add .
git commit -m "Prepare portfolio deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Important: `Backend/.env` GitHub par push nahi hoga. Real passwords/secrets Render dashboard me add karna hai.

## Render Setup

1. Render dashboard me `New +` -> `Blueprint` select karo.
2. GitHub repo connect karo.
3. Render `render.yaml` read karke web service create karega.
4. Environment variables me production values add karo.
5. Deploy complete hone ke baad Render URL ko `PUBLIC_SITE_URL` me set karo.

## Required Render Environment Variables

```text
NODE_ENV=production
PUBLIC_SITE_URL=https://your-render-app.onrender.com
ADMIN_PASS=your-secure-admin-password
ADMIN_TOKEN_SECRET=long-random-secret
DB_HOST=your-mysql-host
DB_PORT=3306
DB_USER=your-mysql-user
DB_PASS=your-mysql-password
DB_NAME=your-mysql-db-name
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true
```

## Optional Email Alert Variables

```text
ALERT_EMAIL_TO=your-alert-email@gmail.com
ALERT_ON_VISIT=true
ALERT_VISIT_THROTTLE_MINUTES=30
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-gmail-app-password
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_SECURE=true
MAIL_FROM=your-email@gmail.com
```

## Database Setup

Production MySQL database me schema import karo:

```bash
mysql -h YOUR_DB_HOST -P 3306 -u YOUR_DB_USER -p YOUR_DB_NAME < Backend/sql/schema.sql
```

Images/resume uploads SQL database me save hote hain, filesystem me nahi. Render redeploy ke baad bhi uploaded data safe rahega, jab tak MySQL database same hai.

## Health Check

Render health check path:

```text
/healthz
```

Expected response:

```json
{"ok":true,"service":"portfolio","status":"healthy"}
```
