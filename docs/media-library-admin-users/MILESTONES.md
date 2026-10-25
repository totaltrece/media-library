# Milestones — Admin users

Delivered in one slice (ports, adapters, HTTP, UI, tests).

| Step | Outcome |
|------|---------|
| Port | `listUsers`, `deleteUser` on `AuthStore` |
| Adapters | SQLite and MariaDB |
| Policy | `/api/admin/users` and `/api/admin/backup` require admin |
| HTTP | GET list, POST create view user, DELETE view user, POST backup |
| UI | Admin zone (users + backup), view login lands on `/` |
| Tests | Store contract, HTTP, policy, Vue |
