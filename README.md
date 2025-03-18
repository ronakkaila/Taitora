# Cylinder Management Application

A web-based application for managing cylinder inventory, sales, purchases, and customer accounts.

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- npm or yarn
- SQLite3

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd pgt-app
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   - Copy the example environment file: `cp .env.example .env`
   - Generate a secure session secret: `npm run generate-secret`
   - Edit the `.env` file and set your own values for:
     - `SESSION_SECRET`: Copy the generated secret from the previous step
     - `EMAIL_USER`: Your email address for sending notifications
     - `EMAIL_PASSWORD`: Your email app password (for Gmail, generate an app password)
     - `SECURE_COOKIE`: Set to `true` if deploying with HTTPS, `false` for development

4. Start the server:
   - For development: `npm run dev`
   - For production: `npm start`

### Directory Structure

- `/public`: Front-end static files
  - `/pages`: HTML pages
  - `/js`: JavaScript files
- `/server`: Back-end code
  - `app.js`: Main server file
  - `database.js`: Database configuration
  - `financialReports.js`: Financial report generation

## Environment Variables

The application uses the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3001 |
| NODE_ENV | Environment (development/production) | production |
| SECURE_COOKIE | Whether cookies require HTTPS | false |
| SESSION_SECRET | Secret for session encryption | - |
| SESSION_DURATION | Session timeout in milliseconds | 1800000 (30 min) |
| EMAIL_SERVICE | Email service provider | gmail |
| EMAIL_USER | Email username | - |
| EMAIL_PASSWORD | Email password | - |
| DB_BASE_DIR | Directory for user databases | ./server/user_databases |
| AUTH_DB_PATH | Path to authentication database | ./server/auth.db |
| BACKUP_DIR | Path for database backups | ./server/temp_backups |
| UPLOAD_DIR | Path for file uploads | ./server/uploads |
| RESET_TOKEN_EXPIRY | Password reset token expiry in ms | 3600000 (1 hour) |
| OTP_EXPIRY | OTP expiry in ms | 300000 (5 min) |
| RATE_LIMIT_WINDOW | Rate limiting window in minutes | 15 |
| RATE_LIMIT_MAX | Maximum requests per window | 100 |

## Security Best Practices

1. **Keep your .env file secure**: 
   - Never commit .env to version control
   - Use different values for production and development

2. **Email Configuration**:
   - For Gmail, use an app password instead of your main password
   - Consider using environment-specific email accounts

3. **Session Secret**:
   - Use a strong random string (at least 32 characters)
   - Change it periodically

4. **Database Security**:
   - Regular backups
   - Secure file permissions for database directories

## Deployment

### Heroku Deployment

1. Create a Heroku account and install Heroku CLI
2. From your project directory, run:
   ```
   heroku create
   git push heroku main
   ```
3. Set environment variables:
   ```
   heroku config:set SESSION_SECRET=your_secret_here
   heroku config:set EMAIL_USER=your_email@gmail.com
   heroku config:set EMAIL_PASSWORD=your_app_password
   heroku config:set NODE_ENV=production
   ```

### Manual Deployment

1. Set up a VPS with Node.js installed
2. Clone repository and install dependencies
3. Configure environment variables
4. Use PM2 or similar for process management:
   ```
   npm install -g pm2
   pm2 start server/app.js
   ```

## License

[Your License Information] 