# GSAP React Playground

A small playground built with React and GSAP.

## Features

- Left side: textarea with animation code
- Right side: dropzone for images and preview
- `Compile` button to build the timeline
- `Show Preview` button to start or restart the animation

## Local Development

Install dependencies and start the Vite development server:

```bash
npm install
npm run dev
```

The app is served by Vite at `http://localhost:5173/Bachelor-sWork_Leontovych/`.

## Production Build

Create a production build in the local `dist` directory:

```bash
npm run build
```

Use this command when you want to verify the production bundle locally without preparing a GitHub Pages deployment.

## GitHub Pages Deployment

The repository now includes a GitHub Actions workflow that automatically builds and deploys the site to GitHub Pages after every push to `main`.

### Required GitHub configuration

1. Open the repository settings on GitHub.
2. Go to `Pages`.
3. Set the source to `GitHub Actions`.
4. Go to `Settings -> Secrets and variables -> Actions`.
5. Create `VITE_SUPABASE_URL` as a repository variable or secret.
6. Create `VITE_SUPABASE_ANON_KEY` as a repository secret or variable.

The workflow accepts `VITE_SUPABASE_ANON_KEY` from either `Secrets` or `Variables`, so your current repository setup will work.

### Manual fallback build

If you want to generate a static export locally without running the workflow, you can still build the site into the `docs` directory:

```bash
npm run build:deploy
```

This command no longer overwrites the project root. It is only a local fallback and is not required for the normal GitHub Pages deployment flow.

## How to Write Animations

The timeline is already created internally:

```js
const timeline = gsap.timeline()
timeline
  .fromTo('[data-image-index="0"]', { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.8 })
  .fromTo('[data-image-index="1"]', { opacity: 0, x: -50 }, { opacity: 1, x: 0, duration: 0.8 }, '-=0.4')
```

In the textarea, you only need to write the part after `timeline`, starting directly with a dot:

```js
.fromTo('[data-image-index="0"]', { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.8 })
.fromTo('[data-image-index="1"]', { opacity: 0, x: -50 }, { opacity: 1, x: 0, duration: 0.8 }, '-=0.4')
```

Each element has a `data-image-index="N"` attribute, so you can easily target specific images.
