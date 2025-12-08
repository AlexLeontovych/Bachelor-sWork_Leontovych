# GSAP React Playground

A small playground built with React + GSAP:

- Left side: textarea with animation code
- Right side: dropzone for images and preview
- "Compile" button to build the timeline
- "Show Preview" button to start/restart the animation

## How to Run

```bash
npm install
npm run dev
```

The Vite dev server will open (default: http://localhost:5173).

## How to Write Animations

The timeline is already created internally:

```js
const timeline = gsap.timeline()
timeline
  .fromTo('[data-image-index="0"]',{opacity:0,y:50},{opacity:1,y:0,duration:0.8})
  .fromTo('[data-image-index="1"]',{opacity:0,x:-50},{opacity:1,x:0,duration:0.8},'-=0.4')
```

In the textarea, you only need to write the part after `timeline`, starting directly with a dot:

```js
.fromTo('[data-image-index="0"]',{opacity:0,y:50},{opacity:1,y:0,duration:0.8})
.fromTo('[data-image-index="1"]',{opacity:0,x:-50},{opacity:1,x:0,duration:0.8},'-=0.4')
```

Each element has a `data-image-index="N"` attribute, so you can easily target specific images.
