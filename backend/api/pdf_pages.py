"""Render PDF pages to JPEG data URLs (plus any text layer) for multimodal AI input."""

import base64
import io

import pypdfium2 as pdfium

MAX_IMAGE_SIDE_PX = 1600
MAX_SCALE = 3.0
JPEG_QUALITY = 80
MAX_PAGE_TEXT_CHARS = 4000


class PdfReadError(Exception):
    pass


def _open(data):
    try:
        return pdfium.PdfDocument(data)
    except pdfium.PdfiumError as exc:
        raise PdfReadError('Could not read this PDF. It may be damaged or password-protected.') from exc


def count_pages(data):
    pdf = _open(data)
    try:
        return len(pdf)
    finally:
        pdf.close()


def render_pages(data, start, end):
    """Render 0-based pages [start, end) as dicts with a 1-based page number, image data URL and text."""
    pdf = _open(data)
    try:
        pages = []
        for index in range(start, end):
            page = pdf[index]
            try:
                width, height = page.get_size()
                scale = min(MAX_IMAGE_SIDE_PX / max(width, height, 1), MAX_SCALE)
                image = page.render(scale=scale).to_pil().convert('RGB')
                buffer = io.BytesIO()
                image.save(buffer, format='JPEG', quality=JPEG_QUALITY)
                textpage = page.get_textpage()
                try:
                    text = textpage.get_text_range().strip()[:MAX_PAGE_TEXT_CHARS]
                finally:
                    textpage.close()
            finally:
                page.close()
            pages.append({
                'number': index + 1,
                'image_data_url': 'data:image/jpeg;base64,' + base64.b64encode(buffer.getvalue()).decode('ascii'),
                'text': text,
            })
        return pages
    finally:
        pdf.close()
