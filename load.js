function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = resolve
    script.onerror = reject
    document.documentElement.appendChild(script)
  })
}

async function loadScripts() {
  const srcs = []

  for (const src of srcs) {
    await loadScript(src)
  }
}

loadScripts()
