import { useState, useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import './styles.css'
import ProjectModal from './components/project/ProjectModal/ProjectModal'
import ProjectsList from './components/project/ProjectsList/ProjectsList'
import MenuBar from './components/studio/MenuBar/MenuBar'
import Header from './components/studio/Header/Header'
import InspectorPanel from './components/studio/InspectorPanel/InspectorPanel'
import Canvas from './components/studio/Canvas/Canvas'
import DocumentPanel from './components/studio/DocumentPanel/DocumentPanel'
import JSEditor from './components/editors/JSEditor/JSEditor'
import CSSEditor from './components/editors/CSSEditor/CSSEditor'
import LayersWindow from './components/layers/LayersWindow/LayersWindow'
import AuthForm from './components/auth/AuthForm/AuthForm'
import UserCabinet from './components/user/UserCabinet/UserCabinet'
import { DEFAULT_CODE } from './components/shared/utils/constants'
import { getSession, onAuthStateChange, signOut } from './services/authService'
import { getUserProjects, createProject, updateProject, deleteProject, transformProjectFromDB, transformProjectToDB } from './services/projectService'
import { supabase } from './lib/supabase'

function App() {
  const [view, setView] = useState('login')
  const [user, setUser] = useState(null)
  const [isGuest, setIsGuest] = useState(false)
  const [loading, setLoading] = useState(true)
  const isSigningOutRef = useRef(false) // Прапорець для запобігання циклів при виході
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [projects, setProjects] = useState([])
  const [editingProjectId, setEditingProjectId] = useState(null)
  const [projectName, setProjectName] = useState('')
  const [projectStatus, setProjectStatus] = useState('')
  const [projectFormat, setProjectFormat] = useState('')
  const [projectScreenFormat, setProjectScreenFormat] = useState('landscape')
  const [currentProject, setCurrentProject] = useState(null)
  const [code, setCode] = useState(DEFAULT_CODE)
  const [images, setImages] = useState([])
  const [error, setError] = useState('')
  const [compiled, setCompiled] = useState(false)
  const [activeTab, setActiveTab] = useState('Document')
  const [showLayersModal, setShowLayersModal] = useState(false)
  const [draggedLayerIndex, setDraggedLayerIndex] = useState(null)
  const [editingLayerId, setEditingLayerId] = useState(null)
  const [selectedImageId, setSelectedImageId] = useState(null)
  const [draggingImageId, setDraggingImageId] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [editingTextId, setEditingTextId] = useState(null)
  const [resizingImageId, setResizingImageId] = useState(null)
  const [resizeHandle, setResizeHandle] = useState(null)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [showDocumentMenu, setShowDocumentMenu] = useState(false)
  const [showJSEditor, setShowJSEditor] = useState(false)
  const [showCSSEditor, setShowCSSEditor] = useState(false)
  const [cssCode, setCssCode] = useState('')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [sceneBackground, setSceneBackground] = useState('#ffffff')
  const [sceneBorderStyle, setSceneBorderStyle] = useState('none')
  const [sceneBorderColor, setSceneBorderColor] = useState('#000000')
  const [isSaved, setIsSaved] = useState(true)
  const [screenFormat, setScreenFormat] = useState('landscape') // 'landscape' або 'portrait'
  const [layersWindowPosition, setLayersWindowPosition] = useState({ x: 50, y: 100 })
  const [draggingLayersWindow, setDraggingLayersWindow] = useState(false)
  const [layersWindowDragOffset, setLayersWindowDragOffset] = useState({ x: 0, y: 0 })
  const [expandedSections, setExpandedSections] = useState({
    scenes: true,
    sceneProperties: true,
    creativeSize: false
  })

  // Функція для форматування розміру
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i]
  }

  // Обчислюємо загальний розмір всіх зображень
  const totalCreativeSize = images.reduce((total, img) => total + (img.size || 0), 0)
  const previewRef = useRef(null)
  const timelineRef = useRef(null)


  // Закриваємо меню при кліку поза ним
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showDocumentMenu && !e.target.closest('.studio-menu-item')) {
        setShowDocumentMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showDocumentMenu])

  // Оновлюємо ID елементів в DOM при зміні elementId
  useEffect(() => {
    if (previewRef.current) {
      images.forEach(image => {
        const imgElement = previewRef.current.querySelector(`img[data-image-index="${images.indexOf(image)}"]`)
        if (imgElement && image.elementId) {
          imgElement.id = image.elementId
        }
      })
    }
  }, [images])

  // Обробники для переміщення вікна шарів
  useEffect(() => {
    if (draggingLayersWindow) {
      const handleMouseMove = (e) => {
        if (!draggingLayersWindow) return
        e.preventDefault()
        
        const newX = e.clientX - layersWindowDragOffset.x
        const newY = e.clientY - layersWindowDragOffset.y
        
        // Обмежуємо позицію межами вікна
        const maxX = window.innerWidth - 350
        const maxY = window.innerHeight - 100
        
        setLayersWindowPosition({
          x: Math.max(0, Math.min(maxX, newX)),
          y: Math.max(0, Math.min(maxY, newY))
        })
      }
      const handleMouseUp = () => {
        setDraggingLayersWindow(false)
        setLayersWindowDragOffset({ x: 0, y: 0 })
      }
      
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [draggingLayersWindow, layersWindowDragOffset])

  const handleFiles = files => {
    const fileArray = Array.from(files || []).filter(file => file.type.startsWith('image/'))
    if (!fileArray.length) return

    const mapped = fileArray.map((file, index) => {
      // Використовуємо ім'я файлу як ім'я шару
      const fileName = file.name.replace(/\.[^/.]+$/, '') // Прибираємо розширення
      const originalName = fileName || `image-${Date.now()}-${index}`
      
      // Створюємо чистий ID з імені (прибираємо спецсимволи)
      const cleanId = originalName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase() || `image-${Date.now()}-${index}`
      
      // Перевіряємо унікальність ID
      let uniqueId = cleanId
      let counter = 1
      while (images.some(img => img.id === uniqueId || img.elementId === uniqueId)) {
        uniqueId = `${cleanId}-${counter}`
        counter++
      }
      
      return {
        id: uniqueId,
        name: originalName, // Ім'я = оригінальне ім'я файлу
        url: URL.createObjectURL(file),
        zIndex: images.length + index,
        x: 0,
        y: 0,
        width: null,
        height: null,
        elementId: uniqueId, // ID для GSAP = очищене ім'я
        className: '',
        trackingId: uniqueId,
        size: file.size, // Розмір файлу в байтах
        opacity: 1, // Прозорість від 0 до 1
        rotation: 0 // Поворот у градусах від 0 до 360
      }
    })

    setImages(prev => [...prev, ...mapped].map((img, idx) => ({ ...img, zIndex: idx })))
    setIsSaved(false) // Позначаємо проєкт як незбережений при додаванні зображень
  }

  const handleAddText = () => {
    const textId = `text-${Date.now()}`
    const newText = {
      id: textId,
      name: 'Text',
      type: 'text',
      text: 'New text',
      url: null, // Для тексту URL не потрібен
      zIndex: images.length,
      x: 100,
      y: 100,
      width: 200,
      height: null,
      elementId: textId,
      className: '',
      trackingId: textId,
      size: 0,
      opacity: 1,
      rotation: 0,
      fontSize: 16,
      fontFamily: 'Arial',
      color: '#000000',
      fontWeight: 'normal',
      textAlign: 'left'
    }
    setImages(prev => [...prev, newText].map((img, idx) => ({ ...img, zIndex: idx })))
    setSelectedImageId(textId)
    setIsSaved(false) // Позначаємо проєкт як незбережений при додаванні тексту
  }

  const moveLayer = (fromZIndex, toZIndex) => {
    if (fromZIndex === toZIndex) return
    
    const sortedImages = [...images].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
    const fromIndex = sortedImages.findIndex(img => img.zIndex === fromZIndex)
    const toIndex = sortedImages.findIndex(img => img.zIndex === toZIndex)
    
    if (fromIndex === -1 || toIndex === -1) return
    
    const [moved] = sortedImages.splice(fromIndex, 1)
    sortedImages.splice(toIndex, 0, moved)
    
    // Оновлюємо z-index для всіх зображень (зворотний порядок - верхній шар має більший z-index)
    const updatedImages = sortedImages.map((img, idx) => ({ 
      ...img, 
      zIndex: sortedImages.length - 1 - idx 
    }))
    
    setImages(updatedImages)
  }

  const handleLayerDragStart = (e, zIndex) => {
    setDraggedLayerIndex(zIndex)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleLayerDragOver = (e, zIndex) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedLayerIndex === null || draggedLayerIndex === zIndex) return
    
    moveLayer(draggedLayerIndex, zIndex)
    setDraggedLayerIndex(zIndex)
  }

  const handleLayerDragEnd = () => {
    setDraggedLayerIndex(null)
  }

  const handleDrop = event => {
    event.preventDefault()
    handleFiles(event.dataTransfer.files)
  }

  const handleDragOver = event => {
    event.preventDefault()
  }

  const handleFileInputChange = event => {
    handleFiles(event.target.files)
  }

  const resetTimeline = () => {
    if (timelineRef.current && timelineRef.current.kill) {
      timelineRef.current.kill()
      timelineRef.current = null
    }
  }

  // Скидаємо тільки анімаційні GSAP властивості елементів на сцені, зберігаючи розміри, позиції, opacity і rotation
  const resetSceneElements = () => {
    if (previewRef.current) {
      const elements = previewRef.current.querySelectorAll('[data-image-index]')
      elements.forEach((element) => {
        const dataIndex = element.getAttribute('data-image-index')
        if (dataIndex !== null) {
          const index = parseInt(dataIndex, 10)
          const image = images[index]
          
          if (image) {
            // Вбиваємо всі активні твіни для цього елемента
            gsap.killTweensOf(element)
            
            // Зберігаємо поточні значення зі state перед скиданням
            const savedWidth = image.width ? `${image.width}px` : 'auto'
            const savedHeight = image.height ? `${image.height}px` : 'auto'
            const savedOpacity = image.opacity !== undefined ? image.opacity : 1
            const savedRotation = image.rotation || 0
            
            // Скидаємо тільки анімаційні властивості GSAP, НЕ чіпаючи width, height, opacity і rotation
            // Використовуємо clearProps з конкретними властивостями, виключаючи користувацькі налаштування
            gsap.set(element, { 
              clearProps: 'scale,x,y,z,rotationX,rotationY,rotationZ,skewX,skewY'
            })
            
            // Примусово відновлюємо розміри, opacity і rotation зі state після скидання
            // Використовуємо setTimeout щоб переконатись, що clearProps виконався
            setTimeout(() => {
              element.style.width = savedWidth
              element.style.height = savedHeight
              element.style.opacity = savedOpacity
              element.style.transform = savedRotation ? `rotate(${savedRotation}deg)` : 'none'
              element.style.transformOrigin = 'center center'
              
              // Також відновлюємо позицію wrapper
              const wrapper = element.parentElement
              if (wrapper && wrapper.classList.contains('canvas-image-wrapper')) {
                wrapper.style.left = `${image.x || 0}px`
                wrapper.style.top = `${image.y || 0}px`
              }
            }, 0)
          } else {
            // Якщо не знайшли image, просто вбиваємо твіни і скидаємо анімаційні властивості
            gsap.killTweensOf(element)
            gsap.set(element, { 
              clearProps: 'scale,x,y,z,rotationX,rotationY,rotationZ'
            })
          }
        }
      })
    }
  }

  const compileCode = (playOnScene = false) => {
    setError('')

    // Якщо не потрібно програвати на сцені, просто валідуємо синтаксис без створення timeline
    if (!playOnScene) {
      try {
        // Перевіряємо тільки синтаксис коду, не створюючи timeline
        // Це запобігає застосуванню GSAP анімації до елементів на сцені
        const wrapperBody = `
          const timeline = gsap.timeline({ paused: true })
          timeline${code}
          return timeline
        `
        
        // Просто перевіряємо, що функція може бути створена (синтаксис правильний)
        // Але НЕ викликаємо її, щоб не застосовувати анімацію до елементів
        new Function('gsap', 'images', 'container', wrapperBody)
        
        // Перевіряємо наявність елементів на сцені (тільки для інформації)
        if (previewRef.current) {
          const elements = previewRef.current.querySelectorAll('[data-image-index]')
          if (elements.length === 0 && images.length > 0) {
            setError('Images are not yet loaded in DOM. Try again after loading.')
            setCompiled(false)
            return
          }
        }
        
        setCompiled(true)
      } catch (err) {
        console.error(err)
        setError(err.message)
        setCompiled(false)
      }
      return
    }
    
    // Якщо потрібно програвати на сцені, створюємо і застосовуємо timeline
    resetTimeline()

    try {
      const wrapperBody = `
        const timeline = gsap.timeline()
        timeline${code}
        return timeline
      `
      
      const factory = new Function('gsap', 'images', 'container', wrapperBody)
      const timeline = factory(gsap, images, previewRef.current)
      
      // Перевіряємо наявність елементів перед застосуванням анімації
      if (previewRef.current) {
        const elements = previewRef.current.querySelectorAll('[data-image-index]')
        if (elements.length === 0 && images.length > 0) {
          setError('Зображення ще не завантажені в DOM. Спробуйте знову після завантаження.')
          setCompiled(false)
          return
        }
      }
      
      timelineRef.current = timeline
      setCompiled(true)
    } catch (err) {
      console.error(err)
      setError(err.message)
      setCompiled(false)
    }
  }

  const handlePreview = () => {
    if (!compiled) {
      compileCode()
      return
    }

    if (timelineRef.current && timelineRef.current.restart) {
      timelineRef.current.restart()
    }
  }

  const handleClearImages = () => {
    images.forEach(image => URL.revokeObjectURL(image.url))
    setImages([])
    resetTimeline()
    setCompiled(false)
  }

  const handleCreateProject = async (openStudio = false) => {
    if (!projectName.trim() || !projectStatus || !projectFormat) {
      return
    }
    
    if (isGuest) {
      alert('Гості не можуть створювати проєкти')
      return
    }

    try {
      const projectData = {
        name: projectName,
        status: projectStatus,
        format: projectFormat,
        screenFormat: projectScreenFormat,
        images: [],
        code: DEFAULT_CODE,
        cssCode: '',
        sceneBackground: '#ffffff',
        sceneBorderStyle: 'none',
        sceneBorderColor: '#000000'
      }

      const dbProject = await createProject(projectData)
      const newProject = transformProjectFromDB(dbProject)
      
      setProjects(prev => [...prev, newProject])
      setProjectName('')
      setProjectStatus('')
      setProjectFormat('')
      setProjectScreenFormat('landscape')
      
      if (openStudio) {
        setCurrentProject(newProject)
        setCurrentProject(newProject)
        setView('editor')
        // Очищаємо дані при створенні нового проєкту
        setImages([])
        setCode(DEFAULT_CODE)
        setCssCode('')
        setSceneBackground('#ffffff')
        setSceneBorderStyle('none')
        setSceneBorderColor('#000000')
        setScreenFormat(projectScreenFormat) // Встановлюємо формат з проєкту
        setIsSaved(true) // Новий проєкт вважається збереженим (порожній проєкт)
      }
    } catch (error) {
      console.error('Error creating project:', error)
      alert('Failed to create project: ' + error.message)
    }
    // Модальне вікно закривається через пропси
  }

  const handleRenameLayer = (layerId, newName) => {
    if (!newName.trim()) return
    const trimmedName = newName.trim()
    // Очищаємо ім'я для використання як ID (прибираємо спецсимволи)
    const cleanId = trimmedName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase() || trimmedName
    
    // Перевіряємо унікальність нового ID
    let uniqueId = cleanId
    let counter = 1
    const currentImages = images.filter(img => img.id !== layerId)
    while (currentImages.some(img => img.id === uniqueId || img.elementId === uniqueId)) {
      uniqueId = `${cleanId}-${counter}`
      counter++
    }
    
    setImages(prev => prev.map(img => {
      if (img.id === layerId) {
        const updated = { ...img, name: trimmedName, id: uniqueId, elementId: uniqueId, trackingId: uniqueId }
        // Оновлюємо ID елемента в DOM
        setTimeout(() => {
          if (previewRef.current) {
            const element = previewRef.current.querySelector(`[data-image-index="${prev.indexOf(img)}"]`)
            if (element) {
              element.id = uniqueId
            }
          }
        }, 0)
        setIsSaved(false) // Позначаємо проєкт як незбережений при перейменуванні шару
        return updated
      }
      return img
    }))
    setEditingLayerId(null)
    
    // Оновлюємо selectedImageId якщо перейменували вибраний елемент
    if (selectedImageId === layerId) {
      setSelectedImageId(uniqueId)
    }
  }

  const handleUpdateImageProperty = (imageId, property, value) => {
    setImages(prev => prev.map(img => {
      if (img.id === imageId) {
        const updated = { ...img, [property]: value }
        // Якщо оновлюється elementId, оновлюємо також trackingId і ID в DOM
        if (property === 'elementId') {
          updated.trackingId = value
          // Оновлюємо ID елемента в DOM (для зображень і тексту)
          setTimeout(() => {
            if (previewRef.current) {
              const element = previewRef.current.querySelector(`[id="${img.elementId || img.id}"]`)
              if (element) {
                element.id = value
              }
            }
          }, 0)
        }
        // Якщо оновлюємо текст, знімаємо режим редагування
        if (property === 'text' && editingTextId === imageId) {
          setEditingTextId(null)
        }
        setIsSaved(false) // Позначаємо проєкт як незбережений при зміні властивостей
        return updated
      }
      return img
    }))
  }

  const handleDeleteLayer = (layerId) => {
    if (window.confirm('Delete this layer?')) {
      const image = images.find(img => img.id === layerId)
      if (image) {
        URL.revokeObjectURL(image.url)
      }
      setImages(prev => prev.filter(img => img.id !== layerId))
      if (selectedImageId === layerId) {
        setSelectedImageId(null)
      }
    }
  }

  const handleLayersWindowDragStart = (e) => {
    if (e.target.closest('.layers-window-close') || e.target.closest('.layers-window-filter') || e.target.closest('.layers-window-item')) {
      return
    }
    setDraggingLayersWindow(true)
    const rect = e.currentTarget.closest('.layers-window').getBoundingClientRect()
    setLayersWindowDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    e.preventDefault()
  }

  const handleImageDragStart = (e, imageId) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedImageId(imageId)
    setDraggingImageId(imageId)
    const image = images.find(img => img.id === imageId)
    if (image && previewRef.current) {
      const canvasRect = previewRef.current.getBoundingClientRect()
      const imageRect = e.currentTarget.getBoundingClientRect()
      setDragOffset({
        x: e.clientX - canvasRect.left - (image.x || 0),
        y: e.clientY - canvasRect.top - (image.y || 0)
      })
    }
  }

  const handleImageDrag = (e) => {
    if (!draggingImageId || !previewRef.current) return
    
    e.preventDefault()
    e.stopPropagation()
    const canvasRect = previewRef.current.getBoundingClientRect()
    const canvasDimensions = screenFormat === 'portrait' 
      ? { width: 390, height: 884 }
      : { width: 1024, height: 600 }
    const newX = Math.max(0, Math.min(canvasDimensions.width, e.clientX - canvasRect.left - dragOffset.x))
    const newY = Math.max(0, Math.min(canvasDimensions.height, e.clientY - canvasRect.top - dragOffset.y))
    
    setImages(prev => prev.map(img => 
      img.id === draggingImageId ? { ...img, x: newX, y: newY } : img
    ))
    setIsSaved(false) // Позначаємо проєкт як незбережений при переміщенні елементів
  }

  const handleImageDragEnd = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDraggingImageId(null)
    setDragOffset({ x: 0, y: 0 })
  }

  const handleScaleImage = (scale) => {
    if (!selectedImageId) return
    
    const image = images.find(img => img.id === selectedImageId)
    if (!image) return
    
    const img = new Image()
    img.src = image.url
    img.onload = () => {
      const naturalWidth = img.naturalWidth
      const naturalHeight = img.naturalHeight
      
      // Якщо розміри не задані, використовуємо природні розміри
      const currentWidth = image.width || naturalWidth
      const currentHeight = image.height || naturalHeight
      
      const newWidth = Math.max(10, Math.round(currentWidth * scale))
      const newHeight = Math.max(10, Math.round(currentHeight * scale))
      
      setImages(prev => prev.map(img => 
        img.id === selectedImageId ? { 
          ...img, 
          width: newWidth, 
          height: newHeight 
        } : img
      ))
    }
    img.onerror = () => {
      // Якщо зображення не завантажилось, використовуємо поточні розміри
      const currentWidth = image.width || 100
      const currentHeight = image.height || 100
      
      const newWidth = Math.max(10, Math.round(currentWidth * scale))
      const newHeight = Math.max(10, Math.round(currentHeight * scale))
      
      setImages(prev => prev.map(img => 
        img.id === selectedImageId ? { 
          ...img, 
          width: newWidth, 
          height: newHeight 
        } : img
      ))
    }
  }

  const handleResizeStart = (e, imageId, handle) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingImageId(imageId)
    setResizeHandle(handle)
    
    const image = images.find(img => img.id === imageId)
    if (image) {
      const rect = e.currentTarget.getBoundingClientRect()
      const canvasRect = previewRef.current?.getBoundingClientRect()
      if (canvasRect) {
        setResizeStart({
          x: e.clientX,
          y: e.clientY,
          width: image.width || rect.width,
          height: image.height || rect.height,
          startX: image.x || 0,
          startY: image.y || 0
        })
      }
    }
  }

  const handleResize = (e) => {
    if (!resizingImageId || !resizeHandle || !previewRef.current) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const canvasRect = previewRef.current.getBoundingClientRect()
    const deltaX = (e.clientX - resizeStart.x) / (window.devicePixelRatio || 1)
    const deltaY = (e.clientY - resizeStart.y) / (window.devicePixelRatio || 1)
    
    const image = images.find(img => img.id === resizingImageId)
    if (!image) return
    
    let newWidth = resizeStart.width
    let newHeight = resizeStart.height
    let newX = resizeStart.startX
    let newY = resizeStart.startY
    
    // Обробка зміни розміру по горизонталі
    if (resizeHandle.includes('e')) {
      newWidth = Math.max(10, resizeStart.width + deltaX)
    }
    if (resizeHandle.includes('w')) {
      const oldWidth = resizeStart.width
      newWidth = Math.max(10, resizeStart.width - deltaX)
      newX = resizeStart.startX + (oldWidth - newWidth)
    }
    
    // Обробка зміни розміру по вертикалі
    if (resizeHandle.includes('s')) {
      newHeight = Math.max(10, resizeStart.height + deltaY)
    }
    if (resizeHandle.includes('n')) {
      const oldHeight = resizeStart.height
      newHeight = Math.max(10, resizeStart.height - deltaY)
      newY = resizeStart.startY + (oldHeight - newHeight)
    }
    
    // Обмежуємо позицію межами канваса
    const canvasDimensions = screenFormat === 'portrait' 
      ? { width: 390, height: 884 }
      : { width: 1024, height: 600 }
    newX = Math.max(0, Math.min(canvasDimensions.width - newWidth, newX))
    newY = Math.max(0, Math.min(canvasDimensions.height - newHeight, newY))
    
    setImages(prev => prev.map(img => 
      img.id === resizingImageId ? { 
        ...img, 
        width: Math.round(newWidth), 
        height: Math.round(newHeight),
        x: Math.round(newX),
        y: Math.round(newY)
      } : img
    ))
    setIsSaved(false) // Позначаємо проєкт як незбережений при зміні розміру елементів
  }

  const handleResizeEnd = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingImageId(null)
    setResizeHandle(null)
  }

  const handleSave = async () => {
    if (!currentProject) return
    
    if (isGuest) {
      alert('Гості не можуть зберігати проєкти')
      return
    }

    try {
      // Конвертуємо blob URLs в base64 перед збереженням
      const imagesWithBase64 = await Promise.all(
        images.map(async (img) => {
          if (img.type === 'text') {
            // Текстові елементи не потребують конвертації
            return {
              id: img.id,
              name: img.name,
              type: img.type,
              zIndex: img.zIndex,
              x: img.x,
              y: img.y,
              width: img.width,
              height: img.height,
              elementId: img.elementId,
              className: img.className,
              trackingId: img.trackingId,
              opacity: img.opacity,
              rotation: img.rotation,
              text: img.text,
              fontSize: img.fontSize,
              fontFamily: img.fontFamily,
              color: img.color,
              fontWeight: img.fontWeight,
              textAlign: img.textAlign
            }
          }
          
          // Якщо вже є base64, використовуємо його
          if (img.base64) {
            return {
              id: img.id,
              name: img.name,
              type: img.type,
              url: img.base64, // Зберігаємо base64 як url для зворотної сумісності
              base64: img.base64,
              zIndex: img.zIndex,
              x: img.x,
              y: img.y,
              width: img.width,
              height: img.height,
              elementId: img.elementId,
              className: img.className,
              trackingId: img.trackingId,
              opacity: img.opacity,
              rotation: img.rotation
            }
          }
          
          // Конвертуємо blob URL в base64
          try {
            const base64 = await blobToBase64(img.url)
            return {
              id: img.id,
              name: img.name,
              type: img.type,
              url: base64, // Зберігаємо base64 як url
              base64: base64,
              zIndex: img.zIndex,
              x: img.x,
              y: img.y,
              width: img.width,
              height: img.height,
              elementId: img.elementId,
              className: img.className,
              trackingId: img.trackingId,
              opacity: img.opacity,
              rotation: img.rotation
            }
          } catch (err) {
            console.error('Error converting image to base64:', err)
            // Якщо не вдалося конвертувати, зберігаємо як є
            return {
              id: img.id,
              name: img.name,
              type: img.type,
              url: img.url,
              zIndex: img.zIndex,
              x: img.x,
              y: img.y,
              width: img.width,
              height: img.height,
              elementId: img.elementId,
              className: img.className,
              trackingId: img.trackingId,
              opacity: img.opacity,
              rotation: img.rotation
            }
          }
        })
      )

      // Зберігаємо дані проєкту
      const updatedProject = {
        ...currentProject,
        images: imagesWithBase64,
        code: code,
        cssCode: cssCode,
        sceneBackground: sceneBackground,
        sceneBorderStyle: sceneBorderStyle,
        sceneBorderColor: sceneBorderColor,
        screenFormat: screenFormat,
        updatedAt: new Date().toISOString()
      }

      // Зберігаємо в БД
      const dbProject = await updateProject(currentProject.id, updatedProject)
      const transformedProject = transformProjectFromDB(dbProject)
      
      setProjects(prev => prev.map(project => 
        project.id === currentProject.id ? transformedProject : project
      ))
      setCurrentProject(transformedProject)
      setIsSaved(true) // Позначаємо проєкт як збережений
      setShowDocumentMenu(false)
    } catch (error) {
      console.error('Error saving project:', error)
      alert('Failed to save project: ' + error.message)
    }
  }

  const handleSaveAndQuit = () => {
    handleSave()
    setView('projects')
  }

  // Обробка гарячих клавіш
  useEffect(() => {
    // Працюємо тільки в редакторі
    if (view !== 'editor' || !currentProject) return

    const handleKeyDown = (e) => {
      // Перевіряємо, що користувач не знаходиться в полі вводу
      const target = e.target
      const isInput = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.isContentEditable ||
                      target.closest('.code-editor-hidden') ||
                      target.closest('.css-editor') ||
                      target.closest('.js-editor')
      
      if (isInput) return

      // Перевіряємо модифікатори (⌘ на Mac = metaKey, Ctrl на Windows/Linux = ctrlKey)
      const isModifierPressed = e.metaKey || e.ctrlKey
      const isShiftPressed = e.shiftKey

      if (!isModifierPressed) return

      const key = e.key.toLowerCase()

      // ⌘P или Ctrl+P - Landscape Preview
      if (key === 'p' && !isShiftPressed && screenFormat === 'landscape') {
        e.preventDefault()
        handleLandscapePreview()
        return
      }

      // ⌘⇧P или Ctrl+Shift+P - Portrait Preview
      if (key === 'p' && isShiftPressed && screenFormat === 'portrait') {
        e.preventDefault()
        handlePortraitPreview()
        return
      }

      // ⌘E или Ctrl+E - Export
      if (key === 'e' && !isShiftPressed) {
        e.preventDefault()
        handleExport()
        return
      }

      // ⌘S или Ctrl+S - Save
      if (key === 's' && !isShiftPressed) {
        e.preventDefault()
        handleSave()
        return
      }

      // ⌘⇧Enter или Ctrl+Shift+Enter - Save and Quit
      if (e.key === 'Enter' && isShiftPressed && isModifierPressed) {
        e.preventDefault()
        handleSaveAndQuit()
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [view, currentProject, screenFormat])

  // Функція для конвертації blob URL в base64
  const blobToBase64 = (blobUrlOrBlob) => {
    return new Promise((resolve, reject) => {
      // Якщо це вже Blob об'єкт, використовуємо його напрямую
      if (blobUrlOrBlob instanceof Blob) {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blobUrlOrBlob)
      } else {
        // Якщо це URL рядок, завантажуємо через fetch
        fetch(blobUrlOrBlob)
          .then(res => res.blob())
          .then(blob => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
          .catch(reject)
      }
    })
  }

  // Функция для генерации HTML контента
  const generateHTMLContent = (imagesWithBase64) => {
    const canvasWidth = screenFormat === 'portrait' ? 390 : 1024
    const canvasHeight = screenFormat === 'portrait' ? 884 : 600
    
    return `<!DOCTYPE html>
<html>
<head>
  <title>${currentProject?.name || 'Creative'}</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    body {
      background: #1a1a1a;
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .preview-wrapper {
      width: 100vw;
      height: 100vh;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .preview-container {
      width: ${canvasWidth}px;
      height: ${canvasHeight}px;
      background-color: ${sceneBackground};
      border: ${sceneBorderStyle !== 'none' ? `1px ${sceneBorderStyle} ${sceneBorderColor}` : 'none'};
      position: relative;
      overflow: hidden;
      transform-origin: center center;
    }
    .preview-image {
      position: absolute;
      object-fit: contain;
      display: block;
      max-width: ${canvasWidth}px;
      max-height: ${canvasHeight}px;
    }
    .preview-text {
      position: absolute;
      display: block;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    ${cssCode ? `/* Custom CSS */\n${cssCode}` : ''}
  </style>
</head>
<body>
  <div class="preview-wrapper">
    <div class="preview-container" id="preview-canvas">
      ${imagesWithBase64.map((image, index) => {
        if (image.type === 'text') {
          return `
            <div 
              id="${image.elementId || image.id}"
              class="preview-text"
              data-image-index="${index}"
              style="
                z-index: ${image.zIndex};
                left: ${image.x || 0}px;
                top: ${image.y || 0}px;
                width: ${image.width ? image.width + 'px' : 'auto'};
                opacity: ${image.opacity !== undefined ? image.opacity : 1};
                transform: ${image.rotation ? `rotate(${image.rotation}deg)` : 'none'};
                transform-origin: center center;
                font-size: ${image.fontSize || 16}px;
                font-family: ${image.fontFamily || 'Arial'};
                color: ${image.color || '#000000'};
                font-weight: ${image.fontWeight || 'normal'};
                text-align: ${image.textAlign || 'left'};
              "
            >${image.text || 'New text'}</div>
          `
        } else {
          return `
            <img 
              id="${image.elementId || image.id}"
              src="${image.base64}" 
              alt="${image.name}"
              class="preview-image"
              data-image-index="${index}"
              style="
                z-index: ${image.zIndex};
                left: ${image.x || 0}px;
                top: ${image.y || 0}px;
                ${image.width ? `width: ${image.width}px;` : `max-width: ${canvasWidth}px;`}
                ${image.height ? `height: ${image.height}px;` : `max-height: ${canvasHeight}px;`}
                object-fit: contain;
                opacity: ${image.opacity !== undefined ? image.opacity : 1};
                transform: ${image.rotation ? `rotate(${image.rotation}deg)` : 'none'};
                transform-origin: center center;
              "
            />
          `
        }
      }).join('')}
          </div>
  </div>
  <script>
    const code = ${JSON.stringify(code)};
    const container = document.getElementById('preview-canvas');
    
    function updateScale() {
      const container = document.querySelector('.preview-container');
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const canvasWidth = ${canvasWidth};
      const canvasHeight = ${canvasHeight};
      
      const scaleX = windowWidth / canvasWidth;
      const scaleY = windowHeight / canvasHeight;
      const scale = Math.min(scaleX, scaleY);
      
      container.style.width = canvasWidth + 'px';
      container.style.height = canvasHeight + 'px';
      container.style.transform = 'scale(' + scale + ')';
      container.style.transformOrigin = 'center center';
    }
    
    window.addEventListener('resize', updateScale);
    updateScale();
    
    setTimeout(() => {
      try {
        const images = container.querySelectorAll('img');
        let loadedCount = 0;
        const totalImages = images.length;
        
        if (totalImages === 0) {
          console.warn('No images found');
          return;
        }
        
        const checkAllLoaded = () => {
          loadedCount++;
          if (loadedCount === totalImages) {
            const wrapperBody = \`
              const timeline = gsap.timeline()
              timeline\${code}
              return timeline
            \`;
            
            try {
              const factory = new Function('gsap', 'images', 'container', wrapperBody);
              const timeline = factory(gsap, [], container);
              if (timeline && typeof timeline.play === 'function') {
                timeline.play();
              } else {
                console.error('Timeline creation failed:', timeline);
              }
            } catch (err) {
              console.error('Animation error:', err);
            }
          }
        };
        
        images.forEach((img) => {
          if (img.complete) {
            checkAllLoaded();
          } else {
            img.addEventListener('load', checkAllLoaded);
            img.addEventListener('error', checkAllLoaded);
          }
        });
      } catch (err) {
        console.error('Animation error:', err);
      }
    }, 200);
  </script>
</body>
</html>`
  }

  const handleExport = async () => {
    if (images.length === 0) {
      alert('Немає зображень для експорту')
      setShowDocumentMenu(false)
      return
    }

    try {
      // Конвертуємо зображення в base64 (текстові елементи пропускаємо)
      const imagesWithBase64 = await Promise.all(
        images.map(async (img) => {
          if (img.type === 'text') {
            return img // Текстові елементи не потребують конвертації
          }
          const base64 = await blobToBase64(img.url)
          return {
            ...img,
            base64: base64
          }
        })
      )

      // Експорт як HTML файл
      const htmlContent = generateHTMLContent(imagesWithBase64)
      
      // Створюємо blob і завантажуємо файл
      const blob = new Blob([htmlContent], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${currentProject?.name || 'creative'}.html`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setShowDocumentMenu(false)
    } catch (error) {
      console.error('Помилка експорту:', error)
      alert('Помилка експорту: ' + error.message)
    }
  }

  // Загальна функція для створення превью
  const createPreview = (format) => {
    // Вбиваємо timeline на сцені і скидаємо всі GSAP властивості елементів
    resetTimeline()
    resetSceneElements()
    
    // Компілюємо код якщо потрібно (тільки для валідації, не застосовуємо на сцені)
    if (!compiled) {
      compileCode(false) // Не застосовуємо анімацію на сцені
    }
    
    if (images.length === 0) {
      alert('Немає зображень для превью')
      setShowDocumentMenu(false)
      return
    }
    
    const isPortrait = format === 'portrait'
    const canvasWidth = isPortrait ? 390 : 1024
    const canvasHeight = isPortrait ? 884 : 600
    
    // Обчислюємо коефіцієнт масштабування для елементів
    // Якщо формат превью відрізняється від формату проєкту, масштабуємо елементи
    const sourceCanvasWidth = screenFormat === 'portrait' ? 390 : 1024
    const sourceCanvasHeight = screenFormat === 'portrait' ? 884 : 600
    
      // Обчислюємо коефіцієнт масштабування по ширині (основний параметр)
    const scale = canvasWidth / sourceCanvasWidth
    
    const previewWindow = window.open('', '_blank', 'fullscreen=yes')
    if (previewWindow) {
      const imagesData = images.map((img, idx) => ({
        url: img.base64 || img.url, // Використовуємо base64 якщо є, інакше url
        base64: img.base64 || (img.url && img.url.startsWith('data:') ? img.url : null),
        name: img.name,
        id: img.id,
        type: img.type,
        elementId: img.elementId || img.id,
        zIndex: img.zIndex || idx,
        x: (img.x || 0) * scale,
        y: (img.y || 0) * scale,
        width: img.width ? img.width * scale : null,
        height: img.height ? img.height * scale : null,
        opacity: img.opacity !== undefined ? img.opacity : 1,
        rotation: img.rotation || 0,
        text: img.text,
        fontSize: img.fontSize ? img.fontSize * scale : 16,
        fontFamily: img.fontFamily,
        color: img.color,
        fontWeight: img.fontWeight,
        textAlign: img.textAlign
      }))
      
      previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Preview ${isPortrait ? 'Portrait' : 'Landscape'} - ${currentProject?.name || 'Creative'}</title>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body {
              width: 100%;
              height: 100%;
              overflow: hidden;
            }
            body {
              background: #1a1a1a;
              font-family: system-ui, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .preview-wrapper {
              width: 100vw;
              height: 100vh;
              position: relative;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .preview-container {
              width: ${canvasWidth}px;
              height: ${canvasHeight}px;
              background-color: ${sceneBackground};
              border: ${sceneBorderStyle !== 'none' ? `1px ${sceneBorderStyle} ${sceneBorderColor}` : 'none'};
              position: relative;
              overflow: hidden;
              transform-origin: center center;
            }
            .preview-image {
              position: absolute;
              object-fit: contain;
              display: block;
              max-width: ${canvasWidth}px;
              max-height: ${canvasHeight}px;
            }
            .preview-text {
              position: absolute;
              display: block;
              white-space: pre-wrap;
              word-wrap: break-word;
            }
            ${cssCode ? `/* Custom CSS */\n${cssCode}` : ''}
          </style>
        </head>
        <body>
          <div class="preview-wrapper">
            <div class="preview-container" id="preview-canvas">
              ${imagesData.map((image, index) => {
                if (image.type === 'text') {
                  return `
                    <div 
                      id="${image.elementId || image.id}"
                      class="preview-text"
                      data-image-index="${index}"
                      style="
                        z-index: ${image.zIndex};
                        left: ${image.x || 0}px;
                        top: ${image.y || 0}px;
                        width: ${image.width ? image.width + 'px' : 'auto'};
                        opacity: ${image.opacity !== undefined ? image.opacity : 1};
                        transform: ${image.rotation ? `rotate(${image.rotation}deg)` : 'none'};
                        transform-origin: center center;
                        font-size: ${image.fontSize || 16}px;
                        font-family: ${image.fontFamily || 'Arial'};
                        color: ${image.color || '#000000'};
                        font-weight: ${image.fontWeight || 'normal'};
                        text-align: ${image.textAlign || 'left'};
                      "
                    >${image.text || 'New text'}</div>
                  `
                } else {
                  return `
                    <img 
                      id="${image.elementId || image.id}"
                      src="${image.base64 || image.url || ''}" 
                      alt="${image.name}"
                      class="preview-image"
                      data-image-index="${index}"
                      style="
                        z-index: ${image.zIndex};
                        left: ${image.x || 0}px;
                        top: ${image.y || 0}px;
                        ${image.width ? `width: ${image.width}px;` : `max-width: ${canvasWidth}px;`}
                        ${image.height ? `height: ${image.height}px;` : `max-height: ${canvasHeight}px;`}
                        object-fit: contain;
                        opacity: ${image.opacity !== undefined ? image.opacity : 1};
                        transform: ${image.rotation ? `rotate(${image.rotation}deg)` : 'none'};
                        transform-origin: center center;
                      "
                    />
                  `
                }
              }).join('')}
            </div>
          </div>
          <script>
            const code = ${JSON.stringify(code)};
            const container = document.getElementById('preview-canvas');
            
            function updateScale() {
              const container = document.querySelector('.preview-container');
              const windowWidth = window.innerWidth;
              const windowHeight = window.innerHeight;
              const canvasWidth = ${canvasWidth};
              const canvasHeight = ${canvasHeight};
              
              const scaleX = windowWidth / canvasWidth;
              const scaleY = windowHeight / canvasHeight;
              const scale = Math.min(scaleX, scaleY);
              
              // Устанавливаем точные размеры контейнера
              container.style.width = canvasWidth + 'px';
              container.style.height = canvasHeight + 'px';
              container.style.transform = 'scale(' + scale + ')';
              container.style.transformOrigin = 'center center';
            }
            
            window.addEventListener('resize', updateScale);
            updateScale();
            
            setTimeout(() => {
              try {
                // Ждем загрузки всех элементов (изображения и текст)
                const elements = container.querySelectorAll('.preview-image, .preview-text');
                let loadedCount = 0;
                const totalElements = elements.length;
                
                if (totalElements === 0) {
                  console.warn('No elements found in preview');
                  return;
                }
                
                const checkAllLoaded = () => {
                  loadedCount++;
                  if (loadedCount === totalElements) {
                    // Все элементы загружены, запускаем анимацию
                    const wrapperBody = \`
                      const timeline = gsap.timeline()
                      timeline\${code}
                      return timeline
                    \`;
                    
                    try {
                      const factory = new Function('gsap', 'images', 'container', wrapperBody);
                      const timeline = factory(gsap, [], container);
                      if (timeline && typeof timeline.play === 'function') {
                        timeline.play();
                      } else {
                        console.error('Timeline creation failed:', timeline);
                        alert('Animation creation error. Check console for details.');
                      }
                    } catch (err) {
                      console.error('Animation error:', err);
                      alert('Animation error: ' + err.message);
                    }
                  }
                };
                
                // Проверяем загрузку каждого элемента
                elements.forEach((el) => {
                  if (el.tagName === 'IMG') {
                    if (el.complete) {
                      checkAllLoaded();
                    } else {
                      el.addEventListener('load', checkAllLoaded);
                      el.addEventListener('error', checkAllLoaded);
                    }
                  } else {
                    // Для текстових елементів вважаємо, що вони завжди "завантажені"
                    checkAllLoaded();
                  }
                });
              } catch (err) {
                console.error('Animation error:', err);
                alert('Animation error: ' + err.message);
              }
            }, 200);
          </script>
        </body>
        </html>
      `)
      previewWindow.document.close()
      
      // Спроба відкрити в повноекранному режимі
      if (previewWindow.document.documentElement.requestFullscreen) {
        previewWindow.document.documentElement.requestFullscreen().catch(() => {})
      } else if (previewWindow.document.documentElement.webkitRequestFullscreen) {
        previewWindow.document.documentElement.webkitRequestFullscreen()
      } else if (previewWindow.document.documentElement.msRequestFullscreen) {
        previewWindow.document.documentElement.msRequestFullscreen()
      }
    }
    setShowDocumentMenu(false)
  }

  const handleLandscapePreview = () => {
    createPreview('landscape')
  }

  const handlePortraitPreview = () => {
    createPreview('portrait')
  }

  // Функція для превью проєкту зі списку
  const handleProjectPreview = (project, format) => {
    if (!project.images || project.images.length === 0) {
      alert('Немає зображень у проєкті для превью')
      return
    }

    const projectScreenFormat = project.screenFormat || 'landscape'
    const projectCode = project.code || DEFAULT_CODE
    const projectCssCode = project.cssCode || ''
    const projectImages = project.images || []
    
    const isPortrait = format === 'portrait'
    const canvasWidth = isPortrait ? 390 : 1024
    const canvasHeight = isPortrait ? 884 : 600
    
    const sourceCanvasWidth = projectScreenFormat === 'portrait' ? 390 : 1024
    const sourceCanvasHeight = projectScreenFormat === 'portrait' ? 884 : 600
    const scale = canvasWidth / sourceCanvasWidth
    
    const previewWindow = window.open('', '_blank', 'fullscreen=yes')
    if (previewWindow) {
      const imagesData = projectImages.map((img, idx) => ({
        name: img.name,
        id: img.id,
        type: img.type,
        elementId: img.elementId || img.id,
        zIndex: img.zIndex || idx,
        x: (img.x || 0) * scale,
        y: (img.y || 0) * scale,
        width: img.width ? img.width * scale : null,
        height: img.height ? img.height * scale : null,
        opacity: img.opacity !== undefined ? img.opacity : 1,
        rotation: img.rotation || 0,
        text: img.text,
        fontSize: img.fontSize ? img.fontSize * scale : 16,
        fontFamily: img.fontFamily,
        color: img.color,
        fontWeight: img.fontWeight,
        textAlign: img.textAlign,
        url: img.base64 || (img.url && img.url.startsWith('data:') ? img.url : img.url) || '',
        base64: img.base64 || (img.url && img.url.startsWith('data:') ? img.url : null)
      }))
      
      previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Preview ${isPortrait ? 'Portrait' : 'Landscape'} - ${project.name || 'Creative'}</title>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: #1a1a1a;
              overflow: hidden;
            }
            .preview-wrapper {
              width: 100vw;
              height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .preview-container {
              width: ${canvasWidth}px;
              height: ${canvasHeight}px;
              position: relative;
              background: ${project.sceneBackground || '#ffffff'};
              border: ${project.sceneBorderStyle === 'solid' ? `1px solid ${project.sceneBorderColor || '#000000'}` : 'none'};
              overflow: hidden;
            }
            .preview-image {
              position: absolute;
              object-fit: contain;
              display: block;
              max-width: ${canvasWidth}px;
              max-height: ${canvasHeight}px;
            }
            .preview-text {
              position: absolute;
              white-space: nowrap;
              user-select: none;
            }
            ${projectCssCode}
          </style>
        </head>
        <body>
          <div class="preview-wrapper">
            <div class="preview-container" id="preview-canvas">
              ${imagesData.map((image, index) => {
                if (image.type === 'text') {
                  return `
                    <div 
                      id="${image.elementId || image.id}"
                      class="preview-text"
                      data-image-index="${index}"
                      style="
                        z-index: ${image.zIndex};
                        left: ${image.x || 0}px;
                        top: ${image.y || 0}px;
                        font-size: ${image.fontSize || 16}px;
                        font-family: ${image.fontFamily || 'Arial'};
                        color: ${image.color || '#000000'};
                        font-weight: ${image.fontWeight || 'normal'};
                        text-align: ${image.textAlign || 'left'};
                        opacity: ${image.opacity !== undefined ? image.opacity : 1};
                        transform: ${image.rotation ? `rotate(${image.rotation}deg)` : 'none'};
                        transform-origin: center center;
                      "
                    >${image.text || ''}</div>
                  `
                } else {
                  return `
                    <img 
                      id="${image.elementId || image.id}"
                      src="${image.url || image.base64 || ''}" 
                      alt="${image.name}"
                      class="preview-image"
                      data-image-index="${index}"
                      style="
                        z-index: ${image.zIndex};
                        left: ${image.x || 0}px;
                        top: ${image.y || 0}px;
                        ${image.width ? `width: ${image.width}px;` : `max-width: ${canvasWidth}px;`}
                        ${image.height ? `height: ${image.height}px;` : `max-height: ${canvasHeight}px;`}
                        object-fit: contain;
                        opacity: ${image.opacity !== undefined ? image.opacity : 1};
                        transform: ${image.rotation ? `rotate(${image.rotation}deg)` : 'none'};
                        transform-origin: center center;
                      "
                    />
                  `
                }
              }).join('')}
          </div>
          </div>
          <script>
            const code = ${JSON.stringify(projectCode)};
            const canvasWidth = ${canvasWidth};
            const canvasHeight = ${canvasHeight};
            
            function updateScale() {
              const wrapper = document.querySelector('.preview-wrapper');
              const container = document.querySelector('.preview-container');
              if (!wrapper || !container) return;
              
              const scaleX = window.innerWidth / canvasWidth;
              const scaleY = window.innerHeight / canvasHeight;
              const scale = Math.min(scaleX, scaleY);
              
              container.style.transform = \`scale(\${scale})\`;
            }
            
            window.addEventListener('resize', updateScale);
            updateScale();
            
            setTimeout(() => {
              try {
                const elements = document.querySelectorAll('[data-image-index]');
                let loadedCount = 0;
                const totalElements = elements.length;
                
                function checkAllLoaded() {
                  loadedCount++;
                  if (loadedCount >= totalElements) {
                    try {
                      const wrapperBody = \`
                        const timeline = gsap.timeline()
                        timeline\${code}
                        return timeline
                      \`;
                      const factory = new Function('gsap', 'images', 'container', wrapperBody);
                      const timeline = factory(gsap, [], document.getElementById('preview-canvas'));
                      if (timeline && timeline.play) {
                        timeline.play();
                      }
                    } catch (err) {
                      console.error('Animation error:', err);
                      alert('Animation error: ' + err.message);
                    }
                  }
                }
                
                elements.forEach((el) => {
                  if (el.tagName === 'IMG') {
                    if (el.complete) {
                      checkAllLoaded();
                    } else {
                      el.addEventListener('load', checkAllLoaded);
                      el.addEventListener('error', checkAllLoaded);
                    }
                  } else {
                    checkAllLoaded();
                  }
                });
              } catch (err) {
                console.error('Animation error:', err);
                alert('Animation error: ' + err.message);
              }
            }, 200);
          </script>
        </body>
        </html>
      `)
      previewWindow.document.close()
      
      if (previewWindow.document.documentElement.requestFullscreen) {
        previewWindow.document.documentElement.requestFullscreen().catch(() => {})
      } else if (previewWindow.document.documentElement.webkitRequestFullscreen) {
        previewWindow.document.documentElement.webkitRequestFullscreen()
      } else if (previewWindow.document.documentElement.msRequestFullscreen) {
        previewWindow.document.documentElement.msRequestFullscreen()
      }
    }
  }

  // Функція для експорту проєкту зі списку
  const handleProjectExport = async (project) => {
    if (!project.images || project.images.length === 0) {
      alert('Немає зображень у проєкті для експорту')
      return
    }

    try {
      const projectScreenFormat = project.screenFormat || 'landscape'
      const canvasWidth = projectScreenFormat === 'portrait' ? 390 : 1024
      const canvasHeight = projectScreenFormat === 'portrait' ? 884 : 600
      
      const imagesWithBase64 = await Promise.all(
        project.images.map(async (img) => {
          if (img.type === 'text') {
            return img
          }
          if (img.base64) {
            return { ...img, base64: img.base64 }
          }
          if (img.url) {
            try {
              const response = await fetch(img.url)
              const blob = await response.blob()
              const base64 = await blobToBase64(blob)
              return { ...img, base64 }
            } catch (err) {
              console.error('Error converting image:', err)
              return img
            }
          }
          return img
        })
      )

      const htmlContent = generateProjectHTMLContent(imagesWithBase64, project, projectScreenFormat)
      
      const blob = new Blob([htmlContent], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${project.name || 'creative'}.html`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Помилка експорту:', error)
      alert('Помилка експорту: ' + error.message)
    }
  }

  // Функція для генерації HTML контенту проєкту
  const generateProjectHTMLContent = (imagesWithBase64, project, format) => {
    const isPortrait = format === 'portrait'
    const canvasWidth = isPortrait ? 390 : 1024
    const canvasHeight = isPortrait ? 884 : 600
    
    const projectCode = project.code || DEFAULT_CODE
    const projectCssCode = project.cssCode || ''
    
    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.name || 'Creative'}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #1a1a1a;
      overflow: hidden;
    }
    .preview-wrapper {
      width: 100vw;
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .preview-container {
      width: ${canvasWidth}px;
      height: ${canvasHeight}px;
      position: relative;
      background: ${project.sceneBackground || '#ffffff'};
      border: ${project.sceneBorderStyle === 'solid' ? `1px solid ${project.sceneBorderColor || '#000000'}` : 'none'};
      overflow: hidden;
    }
    .preview-image {
      position: absolute;
      object-fit: contain;
      display: block;
      max-width: ${canvasWidth}px;
      max-height: ${canvasHeight}px;
    }
    .preview-text {
      position: absolute;
      white-space: nowrap;
      user-select: none;
    }
    ${projectCssCode}
  </style>
</head>
<body>
  <div class="preview-wrapper">
    <div class="preview-container" id="preview-canvas">
      ${imagesWithBase64.map((image, index) => {
        if (image.type === 'text') {
          return `
            <div 
              id="${image.elementId || image.id}"
              class="preview-text"
              data-image-index="${index}"
              style="
                z-index: ${image.zIndex};
                left: ${image.x || 0}px;
                top: ${image.y || 0}px;
                font-size: ${image.fontSize || 16}px;
                font-family: ${image.fontFamily || 'Arial'};
                color: ${image.color || '#000000'};
                font-weight: ${image.fontWeight || 'normal'};
                text-align: ${image.textAlign || 'left'};
                opacity: ${image.opacity !== undefined ? image.opacity : 1};
                transform: ${image.rotation ? `rotate(${image.rotation}deg)` : 'none'};
                transform-origin: center center;
              "
            >${image.text || ''}</div>
          `
        } else {
          return `
            <img 
              id="${image.elementId || image.id}"
              src="${image.base64 || image.url || ''}" 
              alt="${image.name}"
              class="preview-image"
              data-image-index="${index}"
              style="
                z-index: ${image.zIndex};
                left: ${image.x || 0}px;
                top: ${image.y || 0}px;
                ${image.width ? `width: ${image.width}px;` : `max-width: ${canvasWidth}px;`}
                ${image.height ? `height: ${image.height}px;` : `max-height: ${canvasHeight}px;`}
                object-fit: contain;
                opacity: ${image.opacity !== undefined ? image.opacity : 1};
                transform: ${image.rotation ? `rotate(${image.rotation}deg)` : 'none'};
                transform-origin: center center;
              "
            />
          `
        }
      }).join('')}
            </div>
  </div>
  <script>
    const code = ${JSON.stringify(projectCode)};
    const canvasWidth = ${canvasWidth};
    const canvasHeight = ${canvasHeight};
    
    function updateScale() {
      const wrapper = document.querySelector('.preview-wrapper');
      const container = document.querySelector('.preview-container');
      if (!wrapper || !container) return;
      
      const scaleX = window.innerWidth / canvasWidth;
      const scaleY = window.innerHeight / canvasHeight;
      const scale = Math.min(scaleX, scaleY);
      
      container.style.transform = \`scale(\${scale})\`;
    }
    
    window.addEventListener('resize', updateScale);
    updateScale();
    
    setTimeout(() => {
      try {
        const elements = document.querySelectorAll('[data-image-index]');
        let loadedCount = 0;
        const totalElements = elements.length;
        
        function checkAllLoaded() {
          loadedCount++;
          if (loadedCount >= totalElements) {
            try {
              const wrapperBody = \`
                const timeline = gsap.timeline()
                timeline\${code}
                return timeline
              \`;
              const factory = new Function('gsap', 'images', 'container', wrapperBody);
              const timeline = factory(gsap, [], document.getElementById('preview-canvas'));
              if (timeline && timeline.play) {
                timeline.play();
              }
            } catch (err) {
              console.error('Animation error:', err);
              alert('Ошибка анимации: ' + err.message);
            }
          }
        }
        
        elements.forEach((el) => {
          if (el.tagName === 'IMG') {
            if (el.complete) {
              checkAllLoaded();
            } else {
              el.addEventListener('load', checkAllLoaded);
              el.addEventListener('error', checkAllLoaded);
            }
          } else {
            checkAllLoaded();
          }
        });
      } catch (err) {
        console.error('Animation error:', err);
        alert('Ошибка анимации: ' + err.message);
      }
    }, 200);
  </script>
</body>
</html>`
  }

  const handleEditProject = async (project) => {
    // Перевіряємо права доступу: тільки адмін може редагувати активні проєкти
    if (project.status === 'Active') {
      const { isAdmin } = await import('./services/authService')
      const adminStatus = await isAdmin()
      if (!adminStatus) {
        alert('Тільки адмін може редагувати активні проєкти')
        return
      }
    }
    
    setCurrentProject(project)
    // Відновлюємо збережені дані проєкту
    if (project.images) {
      // Відновлюємо зображення з base64 або URL
      const restoredImages = project.images.map(img => {
        if (img.type === 'text') {
          return img // Текстові елементи не потребують відновлення URL
        }
        // Якщо є base64, створюємо blob URL з нього
        if (img.base64) {
          // Конвертуємо base64 в blob URL для відображення
          try {
            const byteCharacters = atob(img.base64.split(',')[1] || img.base64)
            const byteNumbers = new Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i)
            }
            const byteArray = new Uint8Array(byteNumbers)
            const blob = new Blob([byteArray], { type: 'image/png' })
            const blobUrl = URL.createObjectURL(blob)
            return {
              ...img,
              url: blobUrl,
              base64: img.base64 // Зберігаємо base64 для майбутнього збереження
            }
          } catch (err) {
            console.error('Error creating blob URL from base64:', err)
            return img
          }
        }
        // Якщо URL це base64 рядок (починається з data:), використовуємо її напряму
        if (img.url && img.url.startsWith('data:')) {
          return {
            ...img,
            base64: img.url
          }
        }
        // Якщо це звичайний URL, використовуємо його
        return img
      })
      setImages(restoredImages)
    } else {
      setImages([])
    }
    if (project.code) {
      setCode(project.code)
    } else {
      setCode(DEFAULT_CODE)
    }
    if (project.cssCode) {
      setCssCode(project.cssCode)
    } else {
      setCssCode('')
    }
    if (project.sceneBackground) {
      setSceneBackground(project.sceneBackground)
    } else {
      setSceneBackground('#ffffff')
    }
    if (project.sceneBorderStyle) {
      setSceneBorderStyle(project.sceneBorderStyle)
    } else {
      setSceneBorderStyle('none')
    }
    if (project.sceneBorderColor) {
      setSceneBorderColor(project.sceneBorderColor)
    } else {
      setSceneBorderColor('#000000')
    }
    if (project.screenFormat) {
      setScreenFormat(project.screenFormat)
    } else {
      setScreenFormat('landscape') // За замовчуванням landscape
    }
    setIsSaved(true) // При відкритті проєкту вважаємо його збереженим
    setCurrentProject(project)
    setView('editor')
  }

  const handleUpdateProject = async (projectId, field, value) => {
    if (isGuest) {
      alert('Гості не можуть оновлювати проєкти')
      return
    }

    // Знаходимо проєкт для перевірки статусу
    const project = projects.find(p => p.id === projectId)
    
    // Перевіряємо права доступу при зміні активного проєкту
    if (project && project.status === 'Active' && (field === 'name' || field === 'status')) {
      const { isAdmin } = await import('./services/authService')
      const adminStatus = await isAdmin()
      if (!adminStatus) {
        alert('Тільки адмін може редагувати активні проєкти')
        return
      }
    }

    try {
      // Оновлюємо в БД
      const updates = { [field]: value }
      const dbProject = await updateProject(projectId, updates)
      const transformedProject = transformProjectFromDB(dbProject)
      
      setProjects(prev => prev.map(project => 
        project.id === projectId ? transformedProject : project
      ))
      if (currentProject && currentProject.id === projectId) {
        setCurrentProject(transformedProject)
      }
    } catch (error) {
      console.error('Error updating project:', error)
      alert('Failed to update project: ' + error.message)
    }
  }

  const handleDeleteProject = async (projectId) => {
    if (isGuest) {
      alert('Гості не можуть видаляти проєкти')
      return
    }

    // Знаходимо проєкт для перевірки його статусу
    const project = projects.find(p => p.id === projectId)
    if (!project) {
      alert('Проєкт не знайдено')
      return
    }

    // Перевіряємо права доступу: звичайний користувач не може видаляти активні проєкти
    if (project.status === 'Active') {
      try {
        const { isAdmin } = await import('./services/authService')
        const adminStatus = await isAdmin()
        if (!adminStatus) {
          alert('Тільки адмін може видаляти активні проєкти')
          return
        }
      } catch (error) {
        console.error('Error checking admin status:', error)
        alert('Помилка перевірки прав доступу')
        return
      }
    }

    if (!window.confirm('Ви впевнені, що хочете видалити цей проєкт?')) {
      return
    }

    try {
      // Видаляємо з БД
      await deleteProject(projectId)
      
      // Якщо видалюваний проєкт відкритий в редакторі, закриваємо редактор
      if (currentProject && currentProject.id === projectId) {
        setView('projects')
        setCurrentProject(null)
        setImages([])
        setCode(DEFAULT_CODE)
        setCssCode('')
        setSceneBackground('#ffffff')
        setSceneBorderStyle('none')
        setSceneBorderColor('#000000')
        setScreenFormat('landscape')
        setSelectedImageId(null)
        setEditingTextId(null)
        resetTimeline()
        setCompiled(false)
        setError('')
      }
      
      // Видаляємо проєкт зі списку
      setProjects(prev => prev.filter(project => project.id !== projectId))
      
      // Якщо редагували цей проєкт, скидаємо editingProjectId
      if (editingProjectId === projectId) {
        setEditingProjectId(null)
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      alert('Failed to delete project: ' + error.message)
    }
  }

  const handleNewProject = () => {
    setProjectName('')
    setProjectStatus('Paused') // Завжди Paused за замовчуванням
    setProjectFormat('PageGrabber X') // Завжди PageGrabber X за замовчуванням
    setProjectScreenFormat('landscape')
    setShowProjectModal(true)
  }

  const handleCloseModal = () => {
    setShowProjectModal(false)
  }

  // Завантаження проєктів з БД
  const loadProjects = async () => {
    const startTime = performance.now()
    const time = new Date().toLocaleTimeString('uk-UA', { hour12: false, fractionalSecondDigits: 3 })
    console.log(`[${time}] [БД ДЕБАГ] loadProjects: Початок завантаження проєктів з БД...`)
    console.log(`[${time}] [БД ДЕБАГ] loadProjects: Поточний стан:`, {
      currentProjectsCount: projects.length,
      hasUser: !!user,
      isGuest
    })
    
    try {
      // Крок 1: Імпорт функції
      console.log(`[${time}] [БД ДЕБАГ] loadProjects: Крок 1 - Імпорт getPublicProjects`)
      const importStartTime = performance.now()
      const { getPublicProjects } = await import('./services/projectService')
      const importDuration = (performance.now() - importStartTime).toFixed(2)
      console.log(`[${time}] [БД ДЕБАГ] loadProjects: Крок 1 успішний (${importDuration}ms)`)
      
      // Крок 2: Отримання даних з БД
      console.log(`[${time}] [БД ДЕБАГ] loadProjects: Крок 2 - Виклик getPublicProjects()`)
      const getDataStartTime = performance.now()
      const projectsData = await getPublicProjects()
      const getDataDuration = (performance.now() - getDataStartTime).toFixed(2)
      console.log(`[${time}] [БД ДЕБАГ] loadProjects: Крок 2 успішний (${getDataDuration}ms)`, {
        rawDataCount: projectsData?.length || 0,
        hasData: !!projectsData,
        isArray: Array.isArray(projectsData)
      })
      
      // Крок 3: Перетворення даних
      console.log(`[${time}] [БД ДЕБАГ] loadProjects: Крок 3 - Перетворення проєктів`)
      const transformStartTime = performance.now()
      const transformedProjects = projectsData.map(transformProjectFromDB)
      const transformDuration = (performance.now() - transformStartTime).toFixed(2)
      console.log(`[${time}] [БД ДЕБАГ] loadProjects: Крок 3 успішний (${transformDuration}ms)`, {
        transformedCount: transformedProjects.length,
        sampleProject: transformedProjects[0] ? {
          id: transformedProjects[0].id,
          name: transformedProjects[0].name,
          imagesCount: transformedProjects[0].images?.length || 0
        } : null
      })
      
      // Крок 4: Встановлення стану
      console.log(`[${time}] [БД ДЕБАГ] loadProjects: Крок 4 - Встановлення стану`)
      const setStateStartTime = performance.now()
      setProjects(transformedProjects)
      const setStateDuration = (performance.now() - setStateStartTime).toFixed(2)
      const totalDuration = (performance.now() - startTime).toFixed(2)
      
      console.log(`[${time}] [БД ДЕБАГ] loadProjects: Успішно завершено (загалом ${totalDuration}ms)`, {
        projectsCount: transformedProjects.length,
        setStateDuration,
        breakdown: {
          import: importDuration,
          getData: getDataDuration,
          transform: transformDuration,
          setState: setStateDuration
        }
      })
    } catch (error) {
      const totalDuration = (performance.now() - startTime).toFixed(2)
      console.error(`[${time}] [БД ДЕБАГ] loadProjects: Помилка завантаження проєктів (${totalDuration}ms)`, {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        stack: error.stack
      })
      // Якщо помилка, використовуємо порожній масив
      setProjects([])
      console.log(`[${time}] [БД ДЕБАГ] loadProjects: Встановлено порожній масив проєктів`)
    }
  }

  // Перевірка автентифікації при завантаженні
  useEffect(() => {
    let mounted = true
    let authStateHandled = false // Прапорець, що вказує чи вже оброблено подію автентифікації
    
    // Таймаут для гарантії, що loading буде встановлено в false
    const timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn('[БД ДЕБАГ] Таймаут перевірки автентифікації - встановлюємо loading в false')
        setLoading(false)
      }
    }, 5000) // 5 секунд максимум (збільшено для дачі часу onAuthStateChange)
    
    const checkAuth = async () => {
      try {
        console.log('[БД ДЕБАГ] Початок перевірки автентифікації...')
        
        // Спочатку перевіряємо, чи є збережена сесія в localStorage (швидка перевірка)
        const storedSession = localStorage.getItem('sb-' + (import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] || '') + '-auth-token')
        console.log('[БД ДЕБАГ] Перевірка localStorage на наявність збереженої сесії:', {
          hasStoredSession: !!storedSession,
          storedSessionLength: storedSession?.length || 0
        })
        
        // Якщо є збережена сесія, даємо більше часу на отримання
        const timeoutDuration = storedSession ? 5000 : 3000
        
        const session = await Promise.race([
          getSession(),
          new Promise((resolve) => setTimeout(() => {
            console.warn(`[БД ДЕБАГ] Таймаут getSession (${timeoutDuration}ms) - повертаємо null`)
            resolve(null)
          }, timeoutDuration))
        ])
        console.log('[БД ДЕБАГ] Результат перевірки сесії:', session ? 'Сесію знайдено' : 'Сесію не знайдено')
        
        if (!mounted) return
        
        if (session?.user) {
          console.log('[БД ДЕБАГ] Користувач авторизований:', session.user.email)
          // Перевіряємо, чи вже оброблено подію автентифікації через onAuthStateChange
          if (!authStateHandled) {
          setUser(session.user)
          setIsGuest(false)
            // Завантажуємо проєкти з БД
          try {
            await loadProjects()
          } catch (error) {
              console.error('[БД ДЕБАГ] Помилка завантаження проєктів при перевірці автентифікації:', error)
              // Продовжуємо навіть якщо не вдалося завантажити проєкти
          }
            // Встановлюємо view на projects після успішної автентифікації
          if (mounted) {
            setView('projects')
          }
        } else {
            console.log('[БД ДЕБАГ] Стан автентифікації вже оброблено через onAuthStateChange, пропускаємо')
          }
        } else {
          console.log('[БД ДЕБАГ] Користувач не авторизований')
          // Перевіряємо, чи вже оброблено подію автентифікації через onAuthStateChange
          if (!authStateHandled) {
            // Явно встановлюємо null для user і false для isGuest
          setUser(null)
          setIsGuest(false)
            // Встановлюємо view на login якщо користувач не авторизований
          if (mounted) {
            setView('login')
            }
          } else {
            console.log('[БД ДЕБАГ] Стан автентифікації вже оброблено через onAuthStateChange, пропускаємо')
          }
        }
      } catch (error) {
        console.error('[БД ДЕБАГ] Помилка перевірки автентифікації:', error)
        console.error('[БД ДЕБАГ] Детали ошибки:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
        if (mounted) {
          setUser(null)
          setIsGuest(false)
        }
      } finally {
        clearTimeout(timeoutId)
        if (mounted) {
          console.log('[БД ДЕБАГ] Перевірка автентифікації завершена, встановлюємо loading в false')
          setLoading(false)
        }
      }
    }

    // Запускаємо перевірку автентифікації
    console.log('[БД ДЕБАГ] Запуск checkAuth...')
    checkAuth()

    // Підписка на зміни статусу автентифікації
    let subscription = null
    try {
      const subscriptionData = onAuthStateChange((event, session) => {
        if (!mounted) return
        
        console.log(`[БД ДЕБАГ] onAuthStateChange: Подія ${event} отримана`, {
          event,
          hasSession: !!session,
          userId: session?.user?.id,
          email: session?.user?.email,
          authStateHandled
        })
        
        // Обробляємо помилки refresh token
        if (event === 'SIGNED_OUT' && !session && !isSigningOutRef.current) {
          console.log('[БД ДЕБАГ] Виявлено вихід через помилку refresh token')
          authStateHandled = true
          setUser(null)
          setIsGuest(false)
          setProjects([])
          if (mounted) {
            setView('login')
            setLoading(false)
          }
          return
        }
        
        // Якщо користувач у гостьовому режимі, ігноруємо події автентифікації
        if (isGuest && event !== 'SIGNED_OUT') {
          console.log('[БД ДЕБАГ] onAuthStateChange: Ігноруємо подію (гостьовий режим)')
          return
        }
        
        // Якщо це подія виходу, яку ми самі викликали, не обробляємо її повторно
        if (event === 'SIGNED_OUT' && isSigningOutRef.current) {
          isSigningOutRef.current = false
          console.log('[БД ДЕБАГ] onAuthStateChange: Ігноруємо подію (самостійний вихід)')
          return
        }
        
        if (session?.user) {
          // ВАЖЛИВО: Спочатку встановлюємо користувача та view СИНХРОННО
          // щоб checkAuth бачив, що стан вже оброблено
          console.log(`[БД ДЕБАГ] onAuthStateChange: ШВИДКЕ встановлення користувача та view для події ${event}`)
          setUser(session.user)
          setIsGuest(false)
          if (mounted) {
            setView('projects')
            // Встановлюємо loading в false для подій входу
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
              console.log(`[БД ДЕБАГ] onAuthStateChange: Встановлюємо loading в false для події ${event}`)
              setLoading(false)
            }
          }
          
          // Встановлюємо прапорець ПІСЛЯ встановлення користувача
          authStateHandled = true
          
          // Тепер виконуємо асинхронні операції (перевірка бану, завантаження проєктів)
          // в фоновому режимі - використовуємо setTimeout щоб не блокувати callback
          setTimeout(async () => {
            try {
              // Перевіряємо бан після встановлення користувача
              console.log(`[БД ДЕБАГ] onAuthStateChange: Перевірка бану для ${session.user.id}`)
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('banned')
              .eq('id', session.user.id)
              .single()
            
            if (profileError) {
                console.warn('[БД ДЕБАГ] Помилка перевірки бану:', profileError.message)
            }
            
              if (!profileError && profile?.banned && mounted) {
                // Якщо користувач забанений, виходимо
                console.log('[БД ДЕБАГ] Користувач забанений, вихід з системи...')
                isSigningOutRef.current = true
              await signOut()
              setUser(null)
              setIsGuest(false)
              setProjects([])
              if (mounted) {
                setView('login')
                  setLoading(false)
              }
              alert('Your account has been blocked. Please contact an administrator.')
                return
              }
              
              // Завантажуємо проєкти після перевірки бану
              console.log(`[БД ДЕБАГ] onAuthStateChange: Завантаження проєктів для події ${event}`)
          try {
            await loadProjects()
          } catch (error) {
                console.error(`[БД ДЕБАГ] onAuthStateChange: Помилка завантаження проєктів для події ${event}:`, error)
          }
              
              console.log(`[БД ДЕБАГ] onAuthStateChange: Обробка події ${event} завершена`, {
                event,
                userId: session.user.id,
                email: session.user.email
              })
            } catch (error) {
              console.error(`[БД ДЕБАГ] onAuthStateChange: Помилка при обробці події ${event}:`, error)
            }
          }, 0)
        } else {
          // Скидаємо стан тільки при явному виході
          if (event === 'SIGNED_OUT') {
            setUser(null)
            setIsGuest(false)
            setProjects([])
            if (mounted) {
              setView('login')
              setLoading(false) // Убеждаемся, что loading сброшен
            }
          }
          // Для інших подій (наприклад, TOKEN_REFRESHED без користувача) не скидаємо стан
          // щоб не скидати стан гостя
        }
      })
      subscription = subscriptionData?.data?.subscription || subscriptionData?.subscription
    } catch (error) {
      console.error('Error setting up auth state change:', error)
      // Якщо не вдалося підписатися, все одно продовжуємо
      if (mounted) {
        setLoading(false)
      }
    }

    return () => {
      mounted = false
      if (subscription) {
        try {
          subscription.unsubscribe()
        } catch (error) {
          console.error('Error unsubscribing:', error)
        }
      }
    }
  }, [])

  // Періодична перевірка бану для залогінених користувачів
  useEffect(() => {
    if (!user || isGuest || loading) return
    
    let mounted = true // Прапорець для відстеження монтування компонента
    let isCheckingBan = false // Прапорець для запобігання множинних одночасних перевірок

    const checkBanStatus = async () => {
      // Запобігаємо множинним одночасним перевіркам
      if (isCheckingBan) {
        console.log('[БД ДЕБАГ] Перевірка бану вже виконується, пропускаємо...')
        return
      }
      
      try {
        isCheckingBan = true
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('banned')
          .eq('id', user.id)
          .single()
        
        if (profileError) {
          console.warn('[БД ДЕБАГ] Помилка періодичної перевірки бану:', profileError.message)
        }
        
        if (!profileError && profile?.banned && mounted) {
          // Якщо користувач забанений, виходимо
          console.log('[БД ДЕБАГ] Пользователь забанен, выход из системы...')
          await signOut()
          if (mounted) {
            setUser(null)
            setIsGuest(false)
            setProjects([])
            setView('login')
            setLoading(false) // Убеждаемся, что loading сброшен
            alert('Ваш аккаунт заблокирован. Обратитесь к администратору.')
          }
        }
      } catch (error) {
        console.error('[БД ДЕБАГ] Помилка періодичної перевірки бану:', error)
      } finally {
        isCheckingBan = false
      }
    }

    // Перевіряємо бан кожні 30 секунд
    const intervalId = setInterval(() => {
      if (mounted && user && !isGuest && !loading && !isCheckingBan) {
        checkBanStatus()
      }
    }, 30000)
    
    // Перевіряємо одразу при монтуванні (тільки якщо не в процесі завантаження)
    // Використовуємо невелику затримку, щоб переконатися, що loading завершено
    const timeoutId = setTimeout(() => {
      if (mounted && !loading && user && !isGuest && !isCheckingBan) {
        checkBanStatus()
      }
    }, 500)

    return () => {
      mounted = false
      if (intervalId) {
        clearInterval(intervalId)
      }
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [user, isGuest, loading])

  // Синхронізуємо view зі станом автентифікації
  // Прибрано для запобігання зациклюванню - onAuthStateChange вже керує view
  // Цей useEffect викликав конфлікти з onAuthStateChange

  const handleAuthSuccess = async () => {
    const startTime = performance.now()
    const time = new Date().toLocaleTimeString('uk-UA', { hour12: false, fractionalSecondDigits: 3 })
    console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Початок обробки успішного входу...`)
    console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Поточний стан:`, {
      view,
      hasUser: !!user,
      isGuest,
      loading,
      projectsCount: projects.length
    })
    
    try {
      // Крок 1: Отримання сесії
      console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Крок 1 - Отримання сесії`)
      const sessionStartTime = performance.now()
      const session = await getSession()
      const sessionDuration = (performance.now() - sessionStartTime).toFixed(2)
      
      if (!session?.user) {
        const totalDuration = (performance.now() - startTime).toFixed(2)
        console.warn(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Сесію не знайдено після входу (${sessionDuration}ms, загалом ${totalDuration}ms)`)
        setLoading(false)
        return
      }
      
      console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Крок 1 успішний (${sessionDuration}ms)`, {
        userId: session.user.id,
        email: session.user.email
      })
      
      // Крок 2: Перевірка бану
      console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Крок 2 - Перевірка бану`)
      const banCheckStartTime = performance.now()
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('banned')
          .eq('id', session.user.id)
          .single()
        
        const banCheckDuration = (performance.now() - banCheckStartTime).toFixed(2)
        
        if (profileError) {
          console.warn(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Помилка перевірки бану (${banCheckDuration}ms)`, {
            message: profileError.message,
            code: profileError.code
          })
        }
        
        if (!profileError && profile?.banned) {
          const totalDuration = (performance.now() - startTime).toFixed(2)
          console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Користувач забанений, вихід... (загалом ${totalDuration}ms)`)
          await signOut()
          setUser(null)
          setIsGuest(false)
          setProjects([])
          setView('login')
          setLoading(false)
          alert('Ваш акаунт заблоковано. Зверніться до адміністратора.')
          return
        }
        
        console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Крок 2 успішний (${banCheckDuration}ms)`, {
          banned: profile?.banned || false
        })
      } catch (banCheckError) {
        const banCheckDuration = (performance.now() - banCheckStartTime).toFixed(2)
        console.warn(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Помилка перевірки статусу бану (${banCheckDuration}ms)`, banCheckError)
        // Продовжуємо навіть якщо не вдалося перевірити бан
      }
      
      // Крок 3: Встановлення користувача
      console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Крок 3 - Встановлення користувача`)
      setUser(session.user)
      setIsGuest(false)
      console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Крок 3 завершено - стан оновлено`, {
        userId: session.user.id,
        email: session.user.email
      })
      
      // Крок 4: Завантаження проєктів
      console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Крок 4 - Завантаження проєктів`)
      const loadProjectsStartTime = performance.now()
      try {
        await loadProjects()
        const loadProjectsDuration = (performance.now() - loadProjectsStartTime).toFixed(2)
        console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Крок 4 успішний (${loadProjectsDuration}ms)`)
      } catch (error) {
        const loadProjectsDuration = (performance.now() - loadProjectsStartTime).toFixed(2)
        console.error(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Помилка завантаження проєктів (${loadProjectsDuration}ms)`, {
          message: error.message,
          code: error.code
        })
        // Продовжуємо навіть якщо не вдалося завантажити проєкти
      }
      
      // Крок 5: Встановлення view та loading
      console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Крок 5 - Встановлення view та loading`)
      setView('projects')
      setLoading(false)
      
      const totalDuration = (performance.now() - startTime).toFixed(2)
      console.log(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Вхід завершено успішно (загалом ${totalDuration}ms)`, {
        view: 'projects',
        loading: false,
        hasUser: true,
        isGuest: false
      })
    } catch (error) {
      const totalDuration = (performance.now() - startTime).toFixed(2)
      console.error(`[${time}] [БД ДЕБАГ] handleAuthSuccess: Помилка при обробці входу (${totalDuration}ms)`, {
        message: error.message,
        code: error.code,
        stack: error.stack
      })
      setLoading(false)
      // Не встановлюємо помилку тут, щоб не заважати onAuthStateChange
    }
  }

  const handleGuestLogin = async () => {
    const time = new Date().toLocaleTimeString('uk-UA', { hour12: false, fractionalSecondDigits: 3 })
    console.log(`[${time}] [БД ДЕБАГ] handleGuestLogin: Початок`)
    
    try {
      // Встановлюємо гостьовий режим
      // Для гостя user має бути null, а isGuest = true
      console.log(`[${time}] [БД ДЕБАГ] handleGuestLogin: Встановлення гостьового режиму`)
    setUser(null)
    setIsGuest(true)
      setLoading(false) // Скидаємо loading для гостя
      setView('projects') // Встановлюємо view одразу
      
      console.log(`[${time}] [БД ДЕБАГ] handleGuestLogin: Завантаження проєктів для гостя`)
      // Завантажуємо проєкти для гостя
    await loadProjects()
      
      console.log(`[${time}] [БД ДЕБАГ] handleGuestLogin: Завершено успішно`)
    } catch (error) {
      const time = new Date().toLocaleTimeString('uk-UA', { hour12: false, fractionalSecondDigits: 3 })
      console.error(`[${time}] [БД ДЕБАГ] handleGuestLogin: Помилка`, error)
      setLoading(false)
      setView('login')
    }
  }

  // Показуємо завантаження тільки якщо ще перевіряємо автентифікацію
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#050816',
        color: '#e5e7eb'
      }}>
        Loading...
      </div>
    )
  }

  // Сторінка входу
  if (view === 'login') {
    return (
      <AuthForm 
        onAuthSuccess={handleAuthSuccess} 
        onGuestLogin={handleGuestLogin} 
      />
    )
  }

  // Сторінка списку проєктів
  if (view === 'projects') {
    return (
      <>
        <ProjectsList
          projects={projects}
          editingProjectId={editingProjectId}
          onNewProject={handleNewProject}
          onEditProject={handleEditProject}
          onUpdateProject={handleUpdateProject}
          onSetEditingId={setEditingProjectId}
          onProjectPreview={handleProjectPreview}
          onProjectExport={handleProjectExport}
          onDeleteProject={handleDeleteProject}
          onSignOut={async () => {
            await signOut()
            setUser(null)
            setIsGuest(false)
            setView('login')
          }}
          onOpenCabinet={() => setView('cabinet')}
          isGuest={isGuest}
        />
        {showProjectModal && (
          <ProjectModal
            projectName={projectName}
            projectStatus={projectStatus}
            projectFormat={projectFormat}
            screenFormat={projectScreenFormat}
            onNameChange={setProjectName}
            onStatusChange={setProjectStatus}
            onFormatChange={setProjectFormat}
            onScreenFormatChange={setProjectScreenFormat}
            onClose={handleCloseModal}
            onSave={() => {
              handleCreateProject(false)
              setShowProjectModal(false)
            }}
            onSaveAndOpen={() => {
              handleCreateProject(true)
              setShowProjectModal(false)
            }}
          />
        )}
      </>
    )
  }

  // Сторінка кабінету користувача
  if (view === 'cabinet') {
    if (isGuest) {
      setView('projects')
      return null
    }
    return (
      <UserCabinet
        projects={projects}
        onBack={() => setView('projects')}
        onSignOut={async () => {
          await signOut()
          setUser(null)
          setIsGuest(false)
          setView('login')
        }}
        onEditProject={handleEditProject}
        onProjectPreview={handleProjectPreview}
        onProjectExport={handleProjectExport}
        onDeleteProject={handleDeleteProject}
      />
    )
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const selectedImage = images.find(img => img.id === selectedImageId)
  
  // Сторінка редактора проєкту
  if (view === 'editor' && currentProject) {
    return (
    <div className="studio-root">
      <MenuBar
        showDocumentMenu={showDocumentMenu}
        onToggleDocumentMenu={() => setShowDocumentMenu(!showDocumentMenu)}
        onLandscapePreview={handleLandscapePreview}
        onPortraitPreview={handlePortraitPreview}
        screenFormat={screenFormat}
        onExport={handleExport}
        onSave={handleSave}
        onSaveAndQuit={handleSaveAndQuit}
      />

      <Header
        project={currentProject}
        onBack={() => {
          if (!isSaved) {
            // Якщо проєкт не збережено, очищаємо всі дані
            setImages([])
            setCode(DEFAULT_CODE)
            setCssCode('')
            setSceneBackground('#ffffff')
            setSceneBorderStyle('none')
            setSceneBorderColor('#000000')
            setScreenFormat('landscape')
            setSelectedImageId(null)
            setEditingTextId(null)
            resetTimeline()
            setCompiled(false)
            setError('')
          }
          setView('projects')
        }}
      />

      <div className="studio-content">
        <InspectorPanel
          selectedImage={selectedImage}
          selectedImageId={selectedImageId}
          onUpdateProperty={handleUpdateImageProperty}
          onScaleImage={handleScaleImage}
        />

        <Canvas
          previewRef={previewRef}
          images={images}
          selectedImageId={selectedImageId}
          draggingImageId={draggingImageId}
          onDrop={(e) => {
            e.preventDefault()
            handleDrop(e)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            if (draggingImageId) {
              handleImageDrag(e)
            } else {
              handleDragOver(e)
            }
          }}
          onMouseMove={(e) => {
            if (resizingImageId) {
              handleResize(e)
            } else if (draggingImageId) {
              handleImageDrag(e)
            }
          }}
          onMouseUp={(e) => {
            if (resizingImageId) {
              handleResizeEnd(e)
            } else if (draggingImageId) {
              handleImageDragEnd(e)
            }
          }}
          onMouseLeave={(e) => {
            if (resizingImageId) {
              handleResizeEnd(e)
            } else if (draggingImageId) {
              handleImageDragEnd(e)
            }
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget || e.target.classList.contains('canvas-grid')) {
              setSelectedImageId(null)
            }
          }}
          onImageClick={setSelectedImageId}
          onImageDragStart={handleImageDragStart}
          onResizeStart={handleResizeStart}
          sceneBackground={sceneBackground}
          sceneBorderStyle={sceneBorderStyle}
          sceneBorderColor={sceneBorderColor}
          editingTextId={editingTextId}
          onTextEdit={setEditingTextId}
          onTextChange={(id, text) => {
            // Оновлюємо текст в реальному часі при редагуванні
            setImages(prev => prev.map(img => 
              img.id === id ? { ...img, text: text } : img
            ))
            setIsSaved(false) // Позначаємо проєкт як незбережений при зміні тексту
          }}
          onTextBlur={(id, text) => {
            // При втраті фокуса зберігаємо текст і виходимо з режиму редагування
            setImages(prev => prev.map(img => 
              img.id === id ? { ...img, text: text || 'Новый текст' } : img
            ))
            setEditingTextId(null)
          }}
          screenFormat={screenFormat}
        />

        <DocumentPanel
          activeTab={activeTab}
          onTabChange={setActiveTab}
          expandedSections={expandedSections}
          onToggleSection={toggleSection}
          totalCreativeSize={totalCreativeSize}
          onShowLayers={() => setShowLayersModal(true)}
          onShowJSEditor={() => setShowJSEditor(true)}
          onShowCSSEditor={() => setShowCSSEditor(true)}
          onDeleteLayer={handleDeleteLayer}
          selectedImageId={selectedImageId}
          sceneBackground={sceneBackground}
          sceneBorderStyle={sceneBorderStyle}
          sceneBorderColor={sceneBorderColor}
          onSceneBackgroundChange={(value) => {
            setSceneBackground(value)
            setIsSaved(false) // Позначаємо проєкт як незбережений при зміні властивостей сцены
          }}
          onSceneBorderStyleChange={(value) => {
            setSceneBorderStyle(value)
            setIsSaved(false)
          }}
          onSceneBorderColorChange={(value) => {
            setSceneBorderColor(value)
            setIsSaved(false)
          }}
          screenFormat={screenFormat}
        />
          </div>

      <div className="studio-hidden-upload">
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInputChange}
          id="studio-file-input"
        />
          </div>

      <button
        className="studio-add-button"
        onClick={() => setShowAddMenu(true)}
        title="Add content"
      >
        +
      </button>

      {/* Модальное окно выбора типа контента */}
      {showAddMenu && (
        <div className="modal-overlay" onClick={() => setShowAddMenu(false)}>
          <div className="modal-content add-content-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Content</h2>
              <button className="modal-close" onClick={() => setShowAddMenu(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="add-content-options">
                <button
                  className="add-content-option"
                  onClick={() => {
                    setShowAddMenu(false)
                    document.getElementById('studio-file-input').click()
                  }}
                >
                  <div className="add-content-icon">🖼️</div>
                  <div className="add-content-label">Image</div>
                  <div className="add-content-description">Upload image from computer</div>
                </button>
                <button
                  className="add-content-option"
                  onClick={() => {
                    setShowAddMenu(false)
                    handleAddText()
                  }}
                >
                  <div className="add-content-icon">📝</div>
                  <div className="add-content-label">Text</div>
                  <div className="add-content-description">Add text element</div>
                </button>
                </div>
            </div>
          </div>
        </div>
      )}

      {showJSEditor && (
        <JSEditor
          code={code}
          images={images}
          onCodeChange={(newCode) => {
            setCode(newCode)
            setIsSaved(false) // Помечаем проект как несохраненный при изменении кода
          }}
          onApply={() => {
            compileCode(false)
            setShowJSEditor(false)
          }}
          onClose={() => setShowJSEditor(false)}
        />
      )}

      {showCSSEditor && (
        <CSSEditor
          cssCode={cssCode}
          onCssChange={(newCss) => {
            setCssCode(newCss)
            setIsSaved(false) // Помечаем проект как несохраненный при изменении CSS
          }}
          onApply={() => setShowCSSEditor(false)}
          onClose={() => setShowCSSEditor(false)}
        />
      )}

      {showLayersModal && (
        <LayersWindow
          images={images}
          selectedImageId={selectedImageId}
          editingLayerId={editingLayerId}
          draggedLayerIndex={draggedLayerIndex}
          layersWindowPosition={layersWindowPosition}
          draggingLayersWindow={draggingLayersWindow}
          onClose={() => setShowLayersModal(false)}
          onSelectImage={setSelectedImageId}
          onRenameLayer={handleRenameLayer}
          onDeleteLayer={handleDeleteLayer}
          onLayerDragStart={handleLayerDragStart}
          onLayerDragOver={handleLayerDragOver}
          onLayerDragEnd={handleLayerDragEnd}
          onWindowDragStart={handleLayersWindowDragStart}
          onSetEditingId={setEditingLayerId}
          onUpdateImageName={(imageId, newName) => {
            setImages(prev => prev.map(img => 
              img.id === imageId ? { ...img, name: newName } : img
            ))
          }}
        />
      )}

      <div className="studio-code-panel-hidden">
          <textarea
          className="code-editor-hidden"
            value={code}
            onChange={event => setCode(event.target.value)}
            spellCheck="false"
          />
        <div className="studio-controls-hidden">
          <button onClick={() => compileCode(false)}>Compile</button>
          <button onClick={handlePreview}>Preview</button>
          </div>
          {error && (
            <div className="error-box">
              <strong>Error:</strong> {error}
            </div>
          )}
          </div>

    </div>
  )
  }

  return null
}

export default App

