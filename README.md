# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Local database connection

Create a `.env` file for the backend with `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`.
Run `npm run server` to start the MySQL API on `http://localhost:3001`.
The Vite app proxies `/api` requests to that server during development.

### Staff login

The default PESO administrator account (seeded in `database/staff_accounts_seed.sql` and in the local `basud_db`):

- Email: `pesoadmin@gmail.com`
- Password: `pesoadmin121314`

Passwords are stored as bcrypt hashes (`bcryptjs`, 10 rounds). To change the admin password, update the `password_hash` in the `staff_accounts` table and regenerate the hash with:

```
node -e "console.log(require('bcryptjs').hashSync('NEW_PASSWORD', 10))"
```

Set `AUTH_SECRET` in the backend `.env` to a long random string to sign staff session tokens.
