export const formatVolume = (amount) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount) + ' Units'
}

export const formatTime = (dateInput) => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  return new Intl.DateTimeFormat('en-MY', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date)
}

export const formatScore = (score) => {
  return (score * 100).toFixed(0) + '%'
}
