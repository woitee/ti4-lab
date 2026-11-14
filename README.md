# TI4 Lab

TI4 lab is a Twilight Imperium 4 drafting and map building tool. It supports multiple draft formats, has browser notifications, discord integration, and many other fun things.

## Prerequisites

### Dependencies

- Node.js
- Sqlite3

### Environment setup

In your shell configuration, add the following

```
export TI4_LAB_DATABASE_PATH="file:///ABSOLUTE_PATH_HERE.sqlite"
```

_NOTE_: The path must be an absolute path.

### Public URL (self-hosting)

Set `PUBLIC_BASE_URL` to the address the site is served from, e.g.
`PUBLIC_BASE_URL="https://ti4.example.com"`. It is read at runtime (no rebuild needed) and used for
share links, social preview tags, Discord bot links and the URL printed on generated images.
If unset, pages fall back to the request's origin and server-only output (images, Discord)
to `http://localhost:$PORT`, so set it in production, especially behind a reverse proxy.
See `.env.example`.

## Installing / running

Assuming all the prerequisites are met, you can run the following commands to install and run the app:

```shell
npm install --global yarn
yarn install
yarn run dev
```

Open `https://localhost:3000/` in your browser and you're good to go.
