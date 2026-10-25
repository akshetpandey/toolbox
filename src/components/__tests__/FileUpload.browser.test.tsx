import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { FileUpload } from '@/components/FileUpload'

afterEach(cleanup)

test.each([false, true])(
  'the file picker is keyboard accessible with selected=%s',
  async (selected) => {
    render(
      <FileUpload
        selectedFiles={selected ? [{ name: 'selected.txt', size: 10 }] : []}
        onFileSelect={vi.fn()}
        onClearFiles={vi.fn()}
        acceptedTypes="*/*"
        title="Drop a file here"
        description="Choose any file"
        supportedFormats={['All files']}
      />,
    )
    const input = screen.getByLabelText<HTMLInputElement>('Upload file')
    const click = vi.spyOn(input, 'click').mockImplementation(() => undefined)
    const choose = screen.getByRole('button', {
      name: selected ? 'Change file' : 'Choose file',
    })

    // Start before the widget, then reach its real button using only Tab.
    const start = document.createElement('button')
    document.body.prepend(start)
    start.focus()
    for (
      let presses = 0;
      presses < 3 && document.activeElement !== choose;
      presses++
    ) {
      await userEvent.tab()
    }
    expect(document.activeElement).toBe(choose)
    await userEvent.keyboard('{Enter}')
    expect(click).toHaveBeenCalledTimes(1)
    await userEvent.keyboard(' ')
    expect(click).toHaveBeenCalledTimes(2)
    start.remove()
  },
)
