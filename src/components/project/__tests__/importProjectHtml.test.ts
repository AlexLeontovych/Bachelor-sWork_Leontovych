// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { parseImportedProjectHtml } from '../importProjectHtml'

const createExportedHtmlFixture = () => `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Imported Creative</title>
  <style>
    .preview-container {
      width: 390px;
      height: 884px;
      position: relative;
      background: #101827;
      border: 1px solid #7dd3fc;
      overflow: hidden;
    }
    .preview-image {
      position: absolute;
      object-fit: contain;
    }
    .preview-text {
      position: absolute;
      white-space: nowrap;
      user-select: none;
    }
    .custom-headline { letter-spacing: 0.04em; }
  </style>
</head>
<body>
  <div class="preview-wrapper">
    <div class="preview-container" id="preview-canvas">
      <img
        id="hero-image"
        src="data:image/png;base64,AAA"
        alt="Hero"
        class="preview-image"
        data-image-index="0"
        style="z-index: 1; left: 24px; top: 32px; width: 120px; height: 80px; opacity: 0.8; transform: rotate(12deg);"
      />
      <div
        id="headline"
        class="preview-text custom-headline"
        data-image-index="1"
        style="z-index: 2; left: 48px; top: 96px; font-size: 28px; font-family: Inter; color: #ffffff; font-weight: 800; text-align: center; opacity: 1; transform: none;"
      >Launch now</div>
    </div>
  </div>
  <script>
    const code = ".fromTo('#headline',{opacity:0},{opacity:1,duration:0.6})";
  </script>
</body>
</html>`

describe('parseImportedProjectHtml', () => {
  it('restores layers, scene styles, CSS, orientation, and animation code from exported HTML', () => {
    const parsedProject = parseImportedProjectHtml(createExportedHtmlFixture())

    expect(parsedProject.screenFormat).toBe('portrait')
    expect(parsedProject.sceneBackground).toBe('#101827')
    expect(parsedProject.sceneBorderStyle).toBe('solid')
    expect(parsedProject.sceneBorderColor).toBe('#7dd3fc')
    expect(parsedProject.cssCode).toContain('.custom-headline')
    expect(parsedProject.code).toContain("fromTo('#headline'")
    expect(parsedProject.images).toHaveLength(2)
    expect(parsedProject.images[0]).toMatchObject({
      id: 'hero-image',
      type: 'image',
      name: 'Hero',
      x: 24,
      y: 32,
      width: 120,
      height: 80,
      opacity: 0.8,
      rotation: 12
    })
    expect(parsedProject.images[1]).toMatchObject({
      id: 'headline',
      type: 'text',
      text: 'Launch now',
      fontSize: 28,
      fontFamily: 'Inter',
      color: 'rgb(255, 255, 255)',
      fontWeight: '800',
      textAlign: 'center'
    })
  })

  it('rejects HTML that is not a studio export', () => {
    expect(() => parseImportedProjectHtml('<html><body>No canvas</body></html>'))
      .toThrow('exported creative canvas')
  })
})
