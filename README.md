# Baht Bloom Market

Create a clean skeleton structure for a Product Catalog web app with two main routes: / (Product Catalog) and /admin (Admin Dashboard), using Supabase project [https://gqcbwexhcnlcgazmmpscv.supabase.co](https://gqcbwexhcnlcgazmmpscv.supabase.co) and publishable key sb_publishable_FO7v0TcUa8BjEgcJh0VKmg_ytWl9GFG.

Table products columns: id, name, category, price, description, image_url, is_available, created_at. Storage bucket: product-images.

On /: display a clean grid of product cards (image, name, category, price in THB ฿, description, availability status) with search/category filter and a navigation button to /admin.

On /admin: display a form to add a product (name, category, price, description, optional image upload to product-images or image_url, is_available) and a product list with toggle availability and delete actions, plus a link back to /.

Keep the structure simple, clean, and easy to maintain in VS Code without extra pages.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c426f329-8d31-4384-b38b-cda1fda509f5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
