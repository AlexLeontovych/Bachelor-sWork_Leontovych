// Форматирование размера файла
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i]
}

// Генерация уникального ID для изображения из имени файла
export const generateImageId = (fileName, existingIds) => {
  const cleanName = fileName.replace(/\.[^/.]+$/, '')
  const cleanId = cleanName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase() || `image-${Date.now()}`
  
  let uniqueId = cleanId
  let counter = 1
  while (existingIds.includes(uniqueId)) {
    uniqueId = `${cleanId}-${counter}`
    counter++
  }
  
  return uniqueId
}

