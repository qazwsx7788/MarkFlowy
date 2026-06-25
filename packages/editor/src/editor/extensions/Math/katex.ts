import katex from 'katex'

// Drop-in replacement for the previous mathjax-full based renderer.
// KaTeX produces HTML+CSS output (much smaller bundle ~tens of KB vs
// mathjax-full's ~1-2MB with AllPackages) and renders an order of magnitude
// faster. The exported function names/signatures are kept identical to the old
// mathjax.ts so call sites don't change.

export interface Tex2SvgOptions {
  display?: boolean
}

function renderToString(latex: string, options: Tex2SvgOptions = {}): string {
  const { display = false } = options
  try {
    return katex.renderToString(latex || '', {
      displayMode: display,
      throwOnError: true,
      // htmlAndMathml keeps an a11y MathML fallback while rendering visually
      // with HTML/CSS (KaTeX's fast path).
      output: 'htmlAndMathml',
    })
  } catch (err) {
    console.error('[KaTeX] render error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return `<span style="color:red">${message}</span>`
  }
}

export function tex2svg(latex: string, options: Tex2SvgOptions = {}): string {
  return renderToString(latex, options)
}

export function tex2svgInline(latex: string): string {
  return renderToString(latex, { display: false })
}

export function tex2svgDisplay(latex: string): string {
  return renderToString(latex, { display: true })
}
