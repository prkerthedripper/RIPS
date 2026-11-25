This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Deploy on Render

This app is a Node.js web service backed by PostgreSQL, not a static site. The included
[`render.yaml`](./render.yaml) creates both resources and connects them securely.

1. Push this project to GitHub, then choose **New + → Blueprint** in Render and select the repo.
2. Render prompts for `ADMIN_PASSWORD`; provide a unique, long password. It is used only when a
   brand-new database is seeded.
3. Apply the Blueprint. On every start, `npm run db:deploy` applies any new migrations, seeds only
   an empty database, then starts Next.js.

For an existing Render web service, set its build command to `npm ci && npm run build`, start command
to `npm run start:render`, and add `DATABASE_URL` using the Render Postgres **internal** connection URL.
Also add a non-empty `ADMIN_PASSWORD` before the first deployment.
