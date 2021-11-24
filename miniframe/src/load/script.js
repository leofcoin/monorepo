export default (src, integrity, crossorigin) => new Promise((resolve, reject) => {
  const script = document.createElement('script')
  script.onload = () => resolve()
  script.onerror = () => reject()
  script.src = src
  script.setAttribute('async', '')
  if (integrity) script.setAttribute('integrity', integrity)
  if (crossorigin) script.setAttribute('crossorigin', crossorigin)

  document.head.appendChild(script)
})
