# Supabase setup

The app connects to the project URL and publishable key provided for this catalog. To enable product management in that project:

1. Run `setup.sql` in the project's SQL Editor.
2. In Storage, create a **public** bucket named `product-images`. The SQL file adds public-read and signed-in-write policies for its files.
3. Create or invite an account in the project's Authentication settings. Sign in to `/admin` with that account.

Product browsing is public. Product changes and image uploads require a signed-in account. Any account in this project that can sign in can manage products; apply tighter project-specific policies if only selected staff should have access.