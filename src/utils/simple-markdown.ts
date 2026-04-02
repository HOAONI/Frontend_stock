function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function renderInline(input: string): string {
  return escapeHtml(input)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

export function renderSimpleMarkdown(input: string): string {
  const lines = String(input || '').replaceAll('\r\n', '\n').split('\n')
  const output: string[] = []
  let inList = false
  let inCode = false
  const codeBuffer: string[] = []

  const closeList = () => {
    if (inList) {
      output.push('</ul>')
      inList = false
    }
  }

  const closeCode = () => {
    if (inCode) {
      output.push(`<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`)
      codeBuffer.length = 0
      inCode = false
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (line.startsWith('```')) {
      closeList()
      if (inCode)
        closeCode()
      else
        inCode = true
      continue
    }

    if (inCode) {
      codeBuffer.push(rawLine)
      continue
    }

    const trimmed = line.trim()
    if (!trimmed) {
      closeList()
      output.push('<br>')
      continue
    }
    if (trimmed.startsWith('### ')) {
      closeList()
      output.push(`<h3>${renderInline(trimmed.slice(4))}</h3>`)
      continue
    }
    if (trimmed.startsWith('## ')) {
      closeList()
      output.push(`<h2>${renderInline(trimmed.slice(3))}</h2>`)
      continue
    }
    if (trimmed.startsWith('# ')) {
      closeList()
      output.push(`<h1>${renderInline(trimmed.slice(2))}</h1>`)
      continue
    }
    if (trimmed.startsWith('- ')) {
      if (!inList) {
        output.push('<ul>')
        inList = true
      }
      output.push(`<li>${renderInline(trimmed.slice(2))}</li>`)
      continue
    }
    closeList()
    output.push(`<p>${renderInline(trimmed)}</p>`)
  }

  closeCode()
  closeList()
  return output.join('')
}
