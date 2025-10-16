# Security Setup for Fruit POS

## Setting a Secure Password

To secure the POS system for your mom's use, you need to set a strong admin password using environment variables.

### Step 1: Create or Update Your .env File

In the root directory of your project, create or update the `.env` file with a strong password:

```
ADMIN_PASSWORD=YourStrongPasswordHere!
```

### Step 2: Password Requirements

For good security, your password should:
- Be at least 12 characters long
- Include uppercase and lowercase letters
- Include numbers and special characters
- Not be a common word or phrase
- Not include personal information (names, birthdays, etc.)

Example of a strong password:
```
ADMIN_PASSWORD=M0m$Fru1t$P0S_2024!
```

### Step 3: Restart the Application

After setting the password, restart your application for the changes to take effect:

```bash
npm run dev
```

### Step 4: How to Lock/Unlock

Your mom can now:
1. **Log in**: Go to the app and enter the password
2. **Lock the app**: Click the red "Lock" button in the sidebar (bottom left)
3. **Unlock**: Enter the password again when prompted

### Additional Security Tips

1. **Share the password securely**: Tell your mom the password in person or over the phone - don't write it down where others might see it
2. **Change the password periodically**: Consider updating the password every few months
3. **Keep the app updated**: Regularly update the application to get security fixes
4. **Use HTTPS**: When deploying, ensure your site uses HTTPS (this is already configured for production)

### For Development

If you're running the app locally, the `.env` file is automatically loaded. Make sure to:
- Never commit your `.env` file to version control (it's already in .gitignore)
- Use different passwords for development and production
- Consider using `.env.local` for local development secrets

### Troubleshooting

If you can't log in:
1. Check that `ADMIN_PASSWORD` is set in your `.env` file
2. Restart the application after changing the password
3. Make sure you're typing the password exactly (it's case-sensitive)

For any other issues, check the browser console for error messages.