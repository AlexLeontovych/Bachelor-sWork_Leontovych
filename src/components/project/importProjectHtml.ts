import { DEFAULT_CODE } from '../shared/utils/constants'

export type ImportedProjectElement = {
  id: string
  elementId: string
  type?: 'text' | 'image'
  name: string
  url?: string
  base64?: string
  text?: string
  x: number
  y: number
  width?: number
  height?: number
  zIndex: number
  opacity: number
  rotation: number
  fontSize?: number
  fontFamily?: string
  color?: string
  fontWeight?: string
  textAlign?: string
}

export type ImportedProjectHtml = {
  images: ImportedProjectElement[]
  code: string
  cssCode: string
  sceneBackground: string
  sceneBorderStyle: string
  sceneBorderColor: string
  screenFormat: 'landscape' | 'portrait'
}

const DEFAULT_SCENE_BACKGROUND = '#ffffff'
const DEFAULT_SCENE_BORDER_COLOR = '#000000'
const HTML_FILE_MAX_SIZE_BYTES = 10 * 1024 * 1024

const parsePixelValue = (value: string | null | undefined, fallback = 0): number => {
  const parsedValue = Number.parseFloat(String(value || '').replace('px', ''))
  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

const parseOptionalPixelValue = (value: string | null | undefined): number | undefined => {
  const parsedValue = Number.parseFloat(String(value || '').replace('px', ''))
  return Number.isFinite(parsedValue) ? parsedValue : undefined
}

const parseOpacityValue = (value: string | null | undefined): number => {
  const parsedValue = Number.parseFloat(String(value || ''))
  return Number.isFinite(parsedValue) ? parsedValue : 1
}

const parseRotationValue = (value: string | null | undefined): number => {
  const match = String(value || '').match(/rotate\((-?\d+(?:\.\d+)?)deg\)/i)
  return match ? Number.parseFloat(match[1]) : 0
}

const parseCssDeclaration = (cssCode: string, propertyName: string): string => {
  const escapedPropertyName = propertyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = cssCode.match(new RegExp(`${escapedPropertyName}\\s*:\\s*([^;]+);`, 'i'))
  return match?.[1]?.trim() || ''
}

const extractStyleBlock = (htmlContent: string): string => {
  const styleMatches = Array.from(htmlContent.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi))
  return styleMatches.at(-1)?.[1]?.trim() || ''
}

const extractProjectCssCode = (styleCode: string): string => {
  const previewTextRuleMatch = styleCode.match(/\.preview-text\s*\{[\s\S]*?\}\s*([\s\S]*)$/i)
  return previewTextRuleMatch?.[1]?.trim() || ''
}

const extractAnimationCode = (htmlContent: string): string => {
  const codeMatch = htmlContent.match(/const\s+code\s*=\s*("(?:\\.|[^"\\])*")\s*;/)

  if (!codeMatch) {
    return DEFAULT_CODE
  }

  try {
    const parsedCode = JSON.parse(codeMatch[1])
    return typeof parsedCode === 'string' ? parsedCode : DEFAULT_CODE
  } catch (error) {
    throw new Error('The imported HTML contains invalid animation code.')
  }
}

const resolveSceneBackground = (styleCode: string): string => {
  const containerRule = styleCode.match(/\.preview-container\s*\{([\s\S]*?)\}/i)?.[1] || ''
  return parseCssDeclaration(containerRule, 'background') || DEFAULT_SCENE_BACKGROUND
}

const resolveSceneBorder = (styleCode: string): { sceneBorderStyle: string; sceneBorderColor: string } => {
  const containerRule = styleCode.match(/\.preview-container\s*\{([\s\S]*?)\}/i)?.[1] || ''
  const borderValue = parseCssDeclaration(containerRule, 'border')

  if (!borderValue || borderValue.toLowerCase() === 'none') {
    return {
      sceneBorderStyle: 'none',
      sceneBorderColor: DEFAULT_SCENE_BORDER_COLOR
    }
  }

  const colorMatch = borderValue.match(/(#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/i)
  return {
    sceneBorderStyle: borderValue.includes('solid') ? 'solid' : 'none',
    sceneBorderColor: colorMatch?.[1] || DEFAULT_SCENE_BORDER_COLOR
  }
}

const resolveScreenFormat = (styleCode: string): 'landscape' | 'portrait' => {
  const containerRule = styleCode.match(/\.preview-container\s*\{([\s\S]*?)\}/i)?.[1] || ''
  const width = parsePixelValue(parseCssDeclaration(containerRule, 'width'), 1024)
  const height = parsePixelValue(parseCssDeclaration(containerRule, 'height'), 600)
  return height > width ? 'portrait' : 'landscape'
}

const parseImportedElement = (element: Element, index: number): ImportedProjectElement => {
  const htmlElement = element as HTMLElement
  const elementId = htmlElement.id || `imported-layer-${index + 1}`
  const zIndex = Number.parseInt(htmlElement.style.zIndex || String(index + 1), 10)
  const x = parsePixelValue(htmlElement.style.left)
  const y = parsePixelValue(htmlElement.style.top)
  const opacity = parseOpacityValue(htmlElement.style.opacity)
  const rotation = parseRotationValue(htmlElement.style.transform)

  if (htmlElement.tagName.toLowerCase() === 'img') {
    const imageElement = htmlElement as HTMLImageElement
    const source = imageElement.getAttribute('src') || ''

    return {
      id: elementId,
      elementId,
      type: 'image',
      name: imageElement.getAttribute('alt') || `Imported image ${index + 1}`,
      url: source,
      base64: source.startsWith('data:') ? source : undefined,
      x,
      y,
      width: parseOptionalPixelValue(htmlElement.style.width),
      height: parseOptionalPixelValue(htmlElement.style.height),
      zIndex: Number.isFinite(zIndex) ? zIndex : index + 1,
      opacity,
      rotation
    }
  }

  return {
    id: elementId,
    elementId,
    type: 'text',
    name: `Text ${index + 1}`,
    text: htmlElement.textContent || '',
    x,
    y,
    zIndex: Number.isFinite(zIndex) ? zIndex : index + 1,
    opacity,
    rotation,
    fontSize: parsePixelValue(htmlElement.style.fontSize, 16),
    fontFamily: htmlElement.style.fontFamily || 'Arial',
    color: htmlElement.style.color || '#000000',
    fontWeight: htmlElement.style.fontWeight || 'normal',
    textAlign: htmlElement.style.textAlign || 'left'
  }
}

/**
 * Restores a project payload from an HTML file produced by the studio exporter.
 *
 * @param htmlContent - Full HTML file content.
 * @returns Imported project scene data ready for project creation.
 *
 * @example
 * const importedProject = parseImportedProjectHtml(html)
 */
export const parseImportedProjectHtml = (htmlContent: string): ImportedProjectHtml => {
  try {
    if (!htmlContent.trim()) {
      throw new Error('The selected HTML file is empty.')
    }

    const parser = new DOMParser()
    const document = parser.parseFromString(htmlContent, 'text/html')
    const parserError = document.querySelector('parsererror')

    if (parserError) {
      throw new Error('The selected file is not a valid HTML document.')
    }

    const previewContainer = document.querySelector('#preview-canvas, .preview-container')

    if (!previewContainer) {
      throw new Error('The HTML file does not contain an exported creative canvas.')
    }

    const styleCode = extractStyleBlock(htmlContent)
    const { sceneBorderStyle, sceneBorderColor } = resolveSceneBorder(styleCode)
    const elements = Array.from(previewContainer.querySelectorAll('[data-image-index]'))
      .map(parseImportedElement)
      .sort((firstElement, secondElement) => firstElement.zIndex - secondElement.zIndex)

    return {
      images: elements,
      code: extractAnimationCode(htmlContent),
      cssCode: extractProjectCssCode(styleCode),
      sceneBackground: resolveSceneBackground(styleCode),
      sceneBorderStyle,
      sceneBorderColor,
      screenFormat: resolveScreenFormat(styleCode)
    }
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unable to parse the imported HTML file.')
  }
}

/**
 * Reads and parses an exported studio HTML file.
 *
 * @param file - User-selected HTML file.
 * @returns Imported project scene data.
 *
 * @example
 * const importedProject = await readImportedProjectHtmlFile(file)
 */
export const readImportedProjectHtmlFile = async (file: File): Promise<ImportedProjectHtml> => {
  try {
    if (!file) {
      throw new Error('Select an HTML file before importing.')
    }

    const isHtmlFile = file.type === 'text/html' || file.name.toLowerCase().endsWith('.html')

    if (!isHtmlFile) {
      throw new Error('Only exported .html files can be imported.')
    }

    if (file.size > HTML_FILE_MAX_SIZE_BYTES) {
      throw new Error('The selected HTML file is too large. Please import a file up to 10 MB.')
    }

    const htmlContent = await file.text()
    return parseImportedProjectHtml(htmlContent)
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unable to read the imported HTML file.')
  }
}
