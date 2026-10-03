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


def read_upload(upload, max_mb, max_pages):
    """Validate an uploaded PDF and return (bytes, page_count); raise PdfReadError with a user-facing message."""
    if upload is None:
        raise PdfReadError('Choose a PDF file to upload.')
    if upload.size > max_mb * 1024 * 1024:
        raise PdfReadError(f'The PDF is larger than {max_mb} MB.')
    data = upload.read()
    if not data.startswith(b'%PDF-'):
        raise PdfReadError('That file is not a PDF.')
    page_count = count_pages(data)
    if page_count == 0:
        raise PdfReadError('The PDF has no pages.')
    if page_count > max_pages:
        raise PdfReadError(
            f'The PDF has {page_count} pages; the limit is {max_pages}. Split it and upload the parts.'
        )
    return data, page_count


def extract_text(data, max_chars):
    """Concatenate the text layer of the PDF (empty for scanned/photo PDFs), up to max_chars."""
    pdf = _open(data)
    try:
        parts, total = [], 0
        for index in range(len(pdf)):
            page = pdf[index]
            try:
                textpage = page.get_textpage()
                try:
                    text = ' '.join(textpage.get_text_bounded().split())
                finally:
                    textpage.close()
            finally:
                page.close()
            if text:
                parts.append(text)
                total += len(text) + 1
                if total >= max_chars:
                    break
        return '\n'.join(parts)[:max_chars]
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
                    text = textpage.get_text_bounded().strip()[:MAX_PAGE_TEXT_CHARS]
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
