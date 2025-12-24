import type { TradeStep } from '../lib/types'

export async function executeDOMStep(
  step: TradeStep
): Promise<{ success: boolean; selector: string; type: string }> {
  const { type, selector, value, waitAfter = 0 } = step

  const waitForElement = (sel: string, timeout = 3000): Promise<HTMLElement> => {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(sel) as HTMLElement | null
      if (element) {
        resolve(element)
        return
      }

      const obs = new MutationObserver(() => {
        const el = document.querySelector(sel) as HTMLElement | null
        if (el) {
          obs.disconnect()
          resolve(el)
        }
      })

      obs.observe(document.body, { childList: true, subtree: true })

      setTimeout(() => {
        obs.disconnect()
        reject(new Error(`Element not found: ${sel}`))
      }, timeout)
    })
  }

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  console.log(`[Arbflow] Executing step: ${type} on ${selector}`)

  const element = await waitForElement(selector)

  switch (type) {
    case 'click':
      element.click()
      break

    case 'clear_and_type':
      element.focus()
      ;(element as HTMLInputElement).value = ''
      element.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(50)
      ;(element as HTMLInputElement).value = value || ''
      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.dispatchEvent(new Event('change', { bubbles: true }))
      break

    case 'type':
      element.focus()
      ;(element as HTMLInputElement).value = value || ''
      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.dispatchEvent(new Event('change', { bubbles: true }))
      break

    default:
      throw new Error(`Unknown step type: ${type}`)
  }

  if (waitAfter > 0) {
    await sleep(waitAfter)
  }

  return { success: true, selector, type }
}

